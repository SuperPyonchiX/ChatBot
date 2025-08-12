param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'SilentlyContinue'

function Set-CorsHeaders([System.Net.HttpListenerResponse]$resp) {
  $resp.Headers['Access-Control-Allow-Origin'] = '*'
  $resp.Headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  $resp.Headers['Access-Control-Allow-Headers'] = 'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access, accept, authorization, cache-control'
}

# MIME types
$Mime = @{ 
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.svg'='image/svg+xml';
  '.json'='application/json; charset=utf-8'; '.ico'='image/x-icon'; '.pdf'='application/pdf'; '.woff'='font/woff';
  '.woff2'='font/woff2'; '.mp4'='video/mp4'; '.mp3'='audio/mpeg'; '.webm'='video/webm'
}

# Paths
$serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $serverDir '..'))
$prefix = "http://localhost:$Port/"

# HttpClient for upstream proxy (PowerShell 5.1 compatible)
$upstreamBase = 'https://api.anthropic.com'

# HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
  Write-Host "PS Server started: $prefix (root: $projectRoot)"
} catch {
  Write-Error "Failed to start listener on $prefix : $($_.Exception.Message)"
  exit 1
}

function Get-ContentType($path) {
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($Mime.ContainsKey($ext)) { return $Mime[$ext] }
  return 'application/octet-stream'
}

function Test-UnderRoot([string]$base, [string]$full) {
  $b = [System.IO.Path]::GetFullPath($base)
  $f = [System.IO.Path]::GetFullPath($full)
  return $f.StartsWith($b, [System.StringComparison]::OrdinalIgnoreCase)
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch [System.Net.HttpListenerException] {
    # Normal shutdown or port conflict
    break
  } catch {
    # Unexpected error
    Write-Host "Server error: $($_.Exception.Message)"
    break
  }
  $req = $ctx.Request
  $res = $ctx.Response

  try {
    # Preflight
    if ($req.HttpMethod -eq 'OPTIONS') {
      Set-CorsHeaders $res
      $res.StatusCode = 204
      $res.Close()
      continue
    }

    if ($req.RawUrl -like '/anthropic/*') {
      # Reverse proxy to Anthropic (using Invoke-WebRequest for PS 5.1 compatibility)
      $upPath = ($req.RawUrl -replace '^/anthropic','')
      if ([string]::IsNullOrWhiteSpace($upPath)) { $upPath = '/v1/messages' }
      $uri = $upstreamBase + $upPath

      # Prepare headers for upstream request
      $headers = @{}
      foreach ($name in $req.Headers.AllKeys) {
        if ($name -match '^(Host|Content-Length|Connection|Accept-Encoding)$') { continue }
        $headers[$name] = $req.Headers[$name]
      }

      # Prepare body
      $body = $null
      if ($req.HasEntityBody) {
        $ms = New-Object System.IO.MemoryStream
        $req.InputStream.CopyTo($ms)
        $body = $ms.ToArray()
        $ms.Dispose()
      }

      try {
        # Make upstream request using Invoke-RestMethod
        $splat = @{
          Uri = $uri
          Method = $req.HttpMethod
          Headers = $headers
          TimeoutSec = 30
        }
        if ($body -ne $null) { 
          $splat.Body = $body
          if ($req.ContentType) { $splat.ContentType = $req.ContentType }
        }

        $upstreamResponse = Invoke-WebRequest @splat -UseBasicParsing

        # Set response status and headers
        $res.StatusCode = $upstreamResponse.StatusCode
        
        # Filter and set headers from upstream
        $skip = @('transfer-encoding','content-length','connection','access-control-allow-origin','access-control-allow-methods','access-control-allow-headers','access-control-expose-headers','access-control-allow-credentials')
        foreach ($header in $upstreamResponse.Headers.GetEnumerator()) {
          $name = $header.Name
          if ($skip -contains $name.ToLowerInvariant()) { continue }
          if ($name -eq 'Content-Type') { 
            $res.ContentType = $header.Value 
          } else { 
            $res.Headers[$name] = $header.Value 
          }
        }

        # Our CORS headers
        Set-CorsHeaders $res
        $res.Headers['Access-Control-Expose-Headers'] = '*'
        $res.Headers['Cache-Control'] = 'no-cache'

        # Write response body
        $bytes = $upstreamResponse.Content
        if ($bytes -is [string]) { $bytes = [System.Text.Encoding]::UTF8.GetBytes($bytes) }
        $res.OutputStream.Write($bytes, 0, $bytes.Length)

      } catch {
        # Error response
        $res.StatusCode = 500
        Set-CorsHeaders $res
        $res.ContentType = 'application/json; charset=utf-8'
        $errorMsg = @{ error = 'Proxy Error'; message = $_.Exception.Message } | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($errorMsg)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
      
      $res.OutputStream.Close()
      $res.Close()
      continue
    }

    # Static files
    $pathOnly = $req.RawUrl.Split('?')[0]
    if ([string]::IsNullOrWhiteSpace($pathOnly) -or $pathOnly -eq '/') { $pathOnly = '/index.html' }
    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot ($pathOnly.TrimStart('/'))))

  if (-not (Test-UnderRoot $projectRoot $fullPath) -or -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
      Set-CorsHeaders $res
      $res.StatusCode = 404
      $res.ContentType = 'text/plain; charset=utf-8'
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $res.OutputStream.Write($bytes,0,$bytes.Length)
      $res.Close()
      continue
    }

    $res.StatusCode = 200
    $res.ContentType = Get-ContentType $fullPath
    Set-CorsHeaders $res

    $fs = [System.IO.File]::OpenRead($fullPath)
    try {
      $fs.CopyTo($res.OutputStream)
    } finally {
      $fs.Dispose(); $res.OutputStream.Close(); $res.Close()
    }
  } catch {
    try {
      Set-CorsHeaders $res
      $res.StatusCode = 500
      $res.ContentType = 'application/json; charset=utf-8'
      $msg = @{ error = 'Internal Server Error'; message = ($_.Exception.Message) } | ConvertTo-Json -Compress
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
      $res.OutputStream.Write($bytes,0,$bytes.Length)
      $res.Close()
    } catch {}
  }
}

# Cleanup
Write-Host "Shutting down server..."
try { $listener.Stop(); $listener.Close() } catch { Write-Host "Cleanup error: $($_.Exception.Message)" }
