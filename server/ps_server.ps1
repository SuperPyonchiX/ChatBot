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

# HttpClient for upstream proxy
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.AutomaticDecompression = [System.Net.DecompressionMethods]::None
$http = New-Object System.Net.Http.HttpClient($handler)
$upstreamBase = 'https://api.anthropic.com'

# HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Error "Failed to start listener on $prefix : $($_.Exception.Message)"
  exit 1
}

Write-Host "PS Server started: $prefix (root: $projectRoot)"

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
  } catch {
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
      # Reverse proxy to Anthropic
      $upPath = ($req.RawUrl -replace '^/anthropic','')
      if ([string]::IsNullOrWhiteSpace($upPath)) { $upPath = '/v1/messages' }
      $uri = $upstreamBase + $upPath

      $method = New-Object System.Net.Http.HttpMethod($req.HttpMethod)
      $hreq = New-Object System.Net.Http.HttpRequestMessage($method, $uri)

      # Copy headers (filter hop-by-hop)
      foreach ($name in $req.Headers.AllKeys) {
        if ($name -match '^(Host|Content-Length|Connection|Accept-Encoding)$') { continue }
        $value = $req.Headers[$name]
        try { $hreq.Headers.TryAddWithoutValidation($name, $value) | Out-Null } catch {}
      }

      # Body
      if ($req.HasEntityBody) {
        $ms = New-Object System.IO.MemoryStream
        $req.InputStream.CopyTo($ms)
        $bytes = $ms.ToArray()
        $ms.Dispose()
        $content = New-Object System.Net.Http.ByteArrayContent($bytes)
        if ($req.ContentType) { $content.Headers.TryAddWithoutValidation('Content-Type', $req.ContentType) | Out-Null }
        $hreq.Content = $content
      }

      $hres = $http.SendAsync($hreq, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result
      $res.StatusCode = [int]$hres.StatusCode

      # Filter and set headers from upstream
      $skip = @('transfer-encoding','content-length','connection','access-control-allow-origin','access-control-allow-methods','access-control-allow-headers','access-control-expose-headers','access-control-allow-credentials')
      foreach ($kv in $hres.Headers) {
        $name = $kv.Key; $vals = ($kv.Value -join ', ')
        if ($skip -contains $name.ToLowerInvariant()) { continue }
        $res.Headers[$name] = $vals
      }
      foreach ($kv in $hres.Content.Headers) {
        $name = $kv.Key; $vals = ($kv.Value -join ', ')
        if ($skip -contains $name.ToLowerInvariant()) { continue }
        if ($name -eq 'Content-Type') { $res.ContentType = $vals } else { $res.Headers[$name] = $vals }
      }

      # Our CORS headers
      Set-CorsHeaders $res
      $res.Headers['Access-Control-Expose-Headers'] = '*'
      $res.Headers['Cache-Control'] = 'no-cache'

      # Stream body (SSE compatible)
      $upStream = $hres.Content.ReadAsStreamAsync().Result
      $buf = New-Object byte[] 8192
      while (($read = $upStream.Read($buf,0,$buf.Length)) -gt 0) {
        $res.OutputStream.Write($buf,0,$read)
        try { $res.OutputStream.Flush() } catch {}
      }
      $upStream.Dispose()
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
try { $listener.Stop(); $listener.Close() } catch {}
