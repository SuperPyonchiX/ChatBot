@echo off
cd /d "%~dp0"
echo ローカルサーバーを起動中...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"^
$port = 8000; ^
$url = 'http://localhost:' + $port + '/'; ^
try { ^
    $listener = New-Object System.Net.HttpListener; ^
    $listener.Prefixes.Add($url); ^
    $listener.Start(); ^
    Write-Host 'サーバーを開始しました: ' -NoNewline; ^
    Write-Host $url -ForegroundColor Green; ^
    Write-Host 'Ctrl + C で終了' -ForegroundColor Yellow; ^
    Start-Process $url; ^
    Write-Host 'ブラウザでindex.htmlを開きました' -ForegroundColor Cyan; ^
    while ($listener.IsListening) { ^
        try { ^
            $context = $listener.GetContext(); ^
            $path = $context.Request.Url.LocalPath.TrimStart('/'); ^
            if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' } ^
            $file = Join-Path (Get-Location) $path; ^
            Write-Host (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -NoNewline; ^
            Write-Host (' ' + $context.Request.HttpMethod + ' ' + $path + ' - ') -NoNewline; ^
            if (Test-Path $file) { ^
                $contentType = 'text/plain; charset=utf-8'; ^
                switch ([System.IO.Path]::GetExtension($file).ToLower()) { ^
                    '.html' { $contentType = 'text/html; charset=utf-8' } ^
                    '.css' { $contentType = 'text/css; charset=utf-8' } ^
                    '.js' { $contentType = 'text/javascript; charset=utf-8' } ^
                    '.png' { $contentType = 'image/png' } ^
                    '.jpg' { $contentType = 'image/jpeg' } ^
                    '.jpeg' { $contentType = 'image/jpeg' } ^
                    '.gif' { $contentType = 'image/gif' } ^
                    '.svg' { $contentType = 'image/svg+xml' } ^
                    '.json' { $contentType = 'application/json; charset=utf-8' } ^
                    '.ico' { $contentType = 'image/x-icon' } ^
                } ^
                $bytes = [System.IO.File]::ReadAllBytes($file); ^
                $context.Response.StatusCode = 200; ^
                $context.Response.ContentType = $contentType; ^
                $context.Response.Headers.Add('Access-Control-Allow-Origin', '*'); ^
                $context.Response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); ^
                $context.Response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type'); ^
                $context.Response.ContentLength64 = $bytes.Length; ^
                $context.Response.OutputStream.Write($bytes, 0, $bytes.Length); ^
                Write-Host ('200 OK - ' + $contentType) -ForegroundColor Green ^
            } else { ^
                $context.Response.StatusCode = 404; ^
                $errorMessage = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found'); ^
                $context.Response.ContentType = 'text/plain; charset=utf-8'; ^
                $context.Response.ContentLength64 = $errorMessage.Length; ^
                $context.Response.OutputStream.Write($errorMessage, 0, $errorMessage.Length); ^
                Write-Host '404 Not Found' -ForegroundColor Yellow ^
            } ^
            $context.Response.Close() ^
        } catch { ^
            $errorMessage = $_.Exception.Message; ^
            Write-Host $errorMessage -ForegroundColor Red; ^
            if ($context -ne $null) { ^
                $context.Response.StatusCode = 500; ^
                $errorBytes = [System.Text.Encoding]::UTF8.GetBytes('500 Internal Server Error'); ^
                $context.Response.ContentType = 'text/plain; charset=utf-8'; ^
                $context.Response.ContentLength64 = $errorBytes.Length; ^
                $context.Response.OutputStream.Write($errorBytes, 0, $errorBytes.Length); ^
                $context.Response.Close() ^
            } ^
        } ^
    } ^
} catch { ^
    Write-Host ('サーバーの起動に失敗しました: ' + $_.Exception.Message) -ForegroundColor Red ^
} finally { ^
    if ($listener -ne $null) { ^
        $listener.Stop(); ^
        $listener.Close(); ^
        Write-Host 'サーバーを停止しました。' -ForegroundColor Yellow ^
    } ^
}"