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
      # Reverse proxy to Anthropic using HttpWebRequest (most compatible with PS 5.1)
      $upPath = ($req.RawUrl -replace '^/anthropic','')
      if ([string]::IsNullOrWhiteSpace($upPath)) { $upPath = '/v1/messages' }
      $uri = $upstreamBase + $upPath

      Write-Host "Proxy request to: $uri Method: $($req.HttpMethod)"

      try {
        # Create HttpWebRequest
        $webReq = [System.Net.HttpWebRequest]::Create($uri)
        $webReq.Method = $req.HttpMethod
        $webReq.Timeout = 30000
        $webReq.KeepAlive = $false

        # Copy headers (skip hop-by-hop headers)
        if ($req.Headers -and $req.Headers.AllKeys) {
          foreach ($name in $req.Headers.AllKeys) {
            if ($name -match '^(Host|Content-Length|Connection|Accept-Encoding|Transfer-Encoding)$') { continue }
            try {
              $value = $req.Headers[$name]
              if ($value) { 
                $webReq.Headers.Add($name, $value)
                Write-Host "Added header: $name = $value"
              }
            } catch {
              Write-Host "Failed to add header $name : $($_.Exception.Message)"
            }
          }
        }

        # Handle request body for POST
        if ($req.HttpMethod -eq 'POST' -and $req.HasEntityBody) {
          $webReq.ContentType = $req.ContentType
          
          try {
            $requestStream = $webReq.GetRequestStream()
            $req.InputStream.CopyTo($requestStream)
            $requestStream.Close()
            Write-Host "Request body copied successfully"
          } catch {
            Write-Host "Error copying request body: $($_.Exception.Message)"
          }
        }

        # Get response
        $webResp = $webReq.GetResponse()
        $statusCode = [int]$webResp.StatusCode
        Write-Host "Upstream response status: $statusCode"

        # Set response status and content type
        $res.StatusCode = $statusCode
        if ($webResp.ContentType) {
          $res.ContentType = $webResp.ContentType
        }

        # Copy response headers (filter out hop-by-hop)
        $skip = @('transfer-encoding','content-length','connection')
        foreach ($headerName in $webResp.Headers.AllKeys) {
          if ($skip -contains $headerName.ToLowerInvariant()) { continue }
          try {
            $headerValue = $webResp.Headers[$headerName]
            $res.Headers[$headerName] = $headerValue
          } catch {
            Write-Host "Failed to copy response header $headerName : $($_.Exception.Message)"
          }
        }

        # Our CORS headers
        Set-CorsHeaders $res
        $res.Headers['Access-Control-Expose-Headers'] = '*'
        $res.Headers['Cache-Control'] = 'no-cache'

        # Stream response body (supports SSE)
        $responseStream = $webResp.GetResponseStream()
        $buffer = New-Object byte[] 8192
        $totalBytes = 0
        
        while (($bytesRead = $responseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
          $res.OutputStream.Write($buffer, 0, $bytesRead)
          $totalBytes += $bytesRead
          try { $res.OutputStream.Flush() } catch {}
        }
        
        $responseStream.Close()
        $webResp.Close()
        Write-Host "Response completed: $totalBytes bytes"

      } catch [System.Net.WebException] {
        $webEx = $_.Exception
        Write-Host "WebException: $($webEx.Message)"
        
        $statusCode = 500
        $errorResponse = ""
        
        if ($webEx.Response) {
          $statusCode = [int]$webEx.Response.StatusCode
          try {
            $errorStream = $webEx.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorResponse = $reader.ReadToEnd()
            $reader.Close()
            $errorStream.Close()
          } catch {}
        }
        
        $res.StatusCode = $statusCode
        Set-CorsHeaders $res
        $res.ContentType = 'application/json; charset=utf-8'
        
        $errorDetails = @{
          error = 'Proxy Error'
          message = $webEx.Message
          status = $statusCode
          response = $errorResponse
        }
        $errorMsg = $errorDetails | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($errorMsg)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        
      } catch {
        Write-Host "General proxy error: $($_.Exception.Message)"
        $res.StatusCode = 500
        Set-CorsHeaders $res
        $res.ContentType = 'application/json; charset=utf-8'
        
        $errorDetails = @{
          error = 'Proxy Error'
          message = $_.Exception.Message
          type = $_.Exception.GetType().Name
        }
        $errorMsg = $errorDetails | ConvertTo-Json -Compress
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
