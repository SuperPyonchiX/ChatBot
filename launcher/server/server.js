#!/usr/bin/env node
/**
 * ChatBot Node.js Server
 * 
 * 機能:
 * - 静的ファイル配信 (app/ ディレクトリ)
 * - Anthropic API へのリバースプロキシ (/anthropic/*)
 * - CORS対応
 * - グレースフルシャットダウン
 * - 自動ポート検出
 * - PID管理
 * - ブラウザプロセス監視と自動停止
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

// ========================================
// Configuration
// ========================================

const DEFAULT_PORT = 50000;
const SERVER_TIMEOUT = 30000; // 30秒
const ANTHROPIC_BASE = 'api.anthropic.com';
const BROWSER_MONITOR_INTERVAL = 5000; // 5秒ごとにブラウザチェック
const BROWSER_ZERO_THRESHOLD = 2; // 2回連続(10秒間)でブラウザゼロなら停止
const DEBUG_MODE = process.env.DEBUG === 'true' || process.argv.includes('--debug');

// ディレクトリ構成
const serverDir = __dirname;
const projectRoot = path.resolve(serverDir, '..', '..');
const appRoot = path.join(projectRoot, 'app');
const pidFile = path.join(serverDir, 'server.pid');

// ブラウザ監視状態
let browserMonitorTimer = null;
let consecutiveZeroChecks = 0;
let monitoringEnabled = false;

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

// ========================================
// Utility Functions
// ========================================

/**
 * ログ出力
 */
function log(message, level = 'INFO') {
  // DEBUGレベルは--debugフラグがある場合のみ出力
  if (level === 'DEBUG' && !DEBUG_MODE) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * ファイルのMIMEタイプを取得
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * エラーレスポンスを送信
 */
function sendError(res, statusCode, message, details = null) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  
  const errorResponse = {
    error: message,
    status: statusCode,
    timestamp: new Date().toISOString()
  };
  
  if (details) {
    errorResponse.details = details;
  }
  
  res.end(JSON.stringify(errorResponse, null, 2));
}

/**
 * パスがルートディレクトリ配下にあるかチェック (ディレクトリトラバーサル防止)
 */
function isUnderRoot(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * ポートが利用可能かチェック
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

/**
 * 利用可能なポートを見つける
 */
async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await checkPort(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

// ========================================
// CORS and Headers
// ========================================

/**
 * CORS ヘッダーを設定
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access, accept, authorization, cache-control');
  res.setHeader('Access-Control-Expose-Headers', '*');
}

// ========================================
// Request Handlers
// ========================================

/**
 * OPTIONS リクエスト (CORS Preflight) を処理
 */
function handleOptions(res) {
  setCorsHeaders(res);
  res.writeHead(204);
  res.end();
}

/**
 * Anthropic API へのリバースプロキシ
 */
function handleAnthropicProxy(req, res) {
  const parsedUrl = url.parse(req.url);
  let upstreamPath = parsedUrl.pathname.replace(/^\/anthropic/, '');
  
  // デフォルトパス
  if (!upstreamPath || upstreamPath === '') {
    upstreamPath = '/v1/messages';
  }
  
  log(`Proxy request: ${req.method} ${upstreamPath}`);
  
  // アップストリームへのリクエストオプション
  const options = {
    hostname: ANTHROPIC_BASE,
    port: 443,
    path: upstreamPath + (parsedUrl.search || ''),
    method: req.method,
    headers: {}
  };
  
  // ヘッダーをコピー (Hop-by-hop ヘッダーは除外)
  const skipHeaders = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'];
  for (const [key, value] of Object.entries(req.headers)) {
    if (!skipHeaders.includes(key.toLowerCase())) {
      options.headers[key] = value;
    }
  }
  
  // アップストリームリクエストを作成
  const proxyReq = https.request(options, (proxyRes) => {
    log(`Upstream response: ${proxyRes.statusCode}`);
    
    // レスポンスヘッダーをコピー
    const responseHeaders = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (!skipHeaders.includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    }
    
    // CORS ヘッダーを追加
    responseHeaders['Access-Control-Allow-Origin'] = '*';
    responseHeaders['Access-Control-Expose-Headers'] = '*';
    responseHeaders['Cache-Control'] = 'no-cache';
    
    // レスポンスを返す
    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res);
  });
  
  // エラーハンドリング
  proxyReq.on('error', (error) => {
    log(`Proxy error: ${error.message}`, 'ERROR');
    if (!res.headersSent) {
      sendError(res, 502, 'Bad Gateway', error.message);
    }
  });
  
  // タイムアウト設定
  proxyReq.setTimeout(SERVER_TIMEOUT, () => {
    log('Proxy request timeout', 'WARN');
    proxyReq.destroy();
    if (!res.headersSent) {
      sendError(res, 504, 'Gateway Timeout');
    }
  });
  
  // リクエストボディをパイプ
  req.pipe(proxyReq);
  
  // クライアント側のエラーハンドリング
  req.on('error', (error) => {
    log(`Client request error: ${error.message}`, 'ERROR');
    proxyReq.destroy();
  });
}

/**
 * 静的ファイルを配信
 */
function handleStaticFile(req, res) {
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;
  
  // ルートアクセスは index.html へ
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }
  
  // ファイルパスを構築
  const filePath = path.join(appRoot, pathname);
  
  // ディレクトリトラバーサル攻撃を防止
  if (!isUnderRoot(appRoot, filePath)) {
    log(`Security: Path traversal attempt detected: ${pathname}`, 'WARN');
    return sendError(res, 403, 'Forbidden');
  }
  
  // ファイルの存在確認
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      log(`File not found: ${filePath}`, 'WARN');
      return sendError(res, 404, 'Not Found');
    }
    
    // ファイルを読み込んで返す
    const mimeType = getMimeType(filePath);
    
    setCorsHeaders(res);
    res.writeHead(200, { 
      'Content-Type': mimeType,
      'Content-Length': stats.size
    });
    
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
    
    readStream.on('error', (error) => {
      log(`Error reading file ${filePath}: ${error.message}`, 'ERROR');
      if (!res.headersSent) {
        sendError(res, 500, 'Internal Server Error');
      }
    });
  });
}

// ========================================
// Main Request Handler
// ========================================

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url);
  
  // OPTIONS リクエスト (CORS Preflight)
  if (req.method === 'OPTIONS') {
    return handleOptions(res);
  }
  
  // ヘルスチェックエンドポイント
  if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/api/health') {
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      browserMonitoring: monitoringEnabled
    }));
    return;
  }
  
  // Anthropic API プロキシ
  if (parsedUrl.pathname.startsWith('/anthropic')) {
    return handleAnthropicProxy(req, res);
  }
  
  // 静的ファイル配信
  return handleStaticFile(req, res);
}

// ========================================
// Server Lifecycle
// ========================================

/**
 * サーバーを起動
 */
async function startServer(port) {
  // ポートの利用可能性をチェック
  const availablePort = await findAvailablePort(port);
  
  if (availablePort !== port) {
    log(`Port ${port} is in use, using ${availablePort} instead`, 'WARN');
  }
  
  // HTTPサーバーを作成
  const server = http.createServer(handleRequest);
  
  // タイムアウト設定
  server.setTimeout(SERVER_TIMEOUT);
  
  // サーバー起動
  return new Promise((resolve, reject) => {
    server.listen(availablePort, () => {
      const address = `http://localhost:${availablePort}`;
      log(`Server started: ${address}`);
      log(`Project root: ${projectRoot}`);
      log(`App root: ${appRoot}`);
      log(`Anthropic proxy: ${address}/anthropic/ -> https://${ANTHROPIC_BASE}/`);
      
      // PIDファイルを作成
      try {
        fs.writeFileSync(pidFile, process.pid.toString(), 'utf-8');
        log(`PID ${process.pid} saved to ${pidFile}`);
      } catch (error) {
        log(`Failed to write PID file: ${error.message}`, 'WARN');
      }
      
      resolve({ server, port: availablePort });
    });
    
    server.on('error', (error) => {
      log(`Server error: ${error.message}`, 'ERROR');
      reject(error);
    });
  });
}

/**
 * ブラウザプロセス数を取得（Windows専用）
 */
function getBrowserProcessCount() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(0);
      return;
    }
    
    const browsers = ['brave.exe', 'chrome.exe', 'msedge.exe', 'firefox.exe'];
    let totalCount = 0;
    let completed = 0;
    const timeout = setTimeout(() => {
      log('Browser process detection timeout', 'WARN');
      resolve(totalCount);
    }, 3000);
    
    browsers.forEach(browserName => {
      exec(`tasklist /FI "IMAGENAME eq ${browserName}" /NH`, (error, stdout, stderr) => {
        if (error) {
          log(`Error checking ${browserName}: ${error.message}`, 'DEBUG');
          if (stderr) {
            log(`stderr: ${stderr}`, 'DEBUG');
          }
        } else if (stdout) {
          // "INFO: No tasks are running which match the specified criteria." を除外
          const lines = stdout.trim().split('\n').filter(line => {
            const normalized = line.toLowerCase();
            return normalized.includes(browserName.toLowerCase()) && 
                   !normalized.includes('no tasks') &&
                   !normalized.includes('info:');
          });
          
          if (lines.length > 0) {
            log(`Found ${lines.length} ${browserName} process(es)`, 'DEBUG');
            totalCount += lines.length;
          }
        }
        
        completed++;
        if (completed === browsers.length) {
          clearTimeout(timeout);
          log(`Total browser processes detected: ${totalCount}`, 'DEBUG');
          resolve(totalCount);
        }
      });
    });
  });
}

/**
 * ブラウザ監視を開始
 */
function startBrowserMonitoring(server) {
  if (monitoringEnabled || process.platform !== 'win32') {
    return;
  }
  
  monitoringEnabled = true;
  log('Browser monitoring started');
  
  browserMonitorTimer = setInterval(async () => {
    const browserCount = await getBrowserProcessCount();
    
    if (browserCount === 0) {
      consecutiveZeroChecks++;
      const remainingChecks = BROWSER_ZERO_THRESHOLD - consecutiveZeroChecks;
      const remainingTime = remainingChecks * (BROWSER_MONITOR_INTERVAL / 1000);
      log(`No browser processes detected (check ${consecutiveZeroChecks}/${BROWSER_ZERO_THRESHOLD}, ${remainingTime}s remaining)`);
      
      if (consecutiveZeroChecks >= BROWSER_ZERO_THRESHOLD) {
        log(`No browser processes for ${BROWSER_ZERO_THRESHOLD * BROWSER_MONITOR_INTERVAL / 1000}s. Initiating shutdown.`);
        stopBrowserMonitoring();
        gracefulShutdown(server);
      }
    } else {
      if (consecutiveZeroChecks > 0) {
        consecutiveZeroChecks = 0;
      }
      if (browserCount <= 5) {
        log(`Browsers active: ${browserCount} processes`);
      }
    }
  }, BROWSER_MONITOR_INTERVAL);
}

/**
 * ブラウザ監視を停止
 */
function stopBrowserMonitoring() {
  if (browserMonitorTimer) {
    clearInterval(browserMonitorTimer);
    browserMonitorTimer = null;
    monitoringEnabled = false;
    log('Browser monitoring stopped');
  }
}

/**
 * グレースフルシャットダウン
 */
function gracefulShutdown(server) {
  log('Shutting down server gracefully...');
  
  // ブラウザ監視を停止
  stopBrowserMonitoring();
  
  // 新しい接続を受け付けない
  server.close(() => {
    log('Server closed');
    
    // PIDファイルを削除
    try {
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
        log('PID file removed');
      }
    } catch (error) {
      log(`Failed to remove PID file: ${error.message}`, 'WARN');
    }
    
    process.exit(0);
  });
  
  // 10秒後に強制終了
  setTimeout(() => {
    log('Forcing shutdown...', 'WARN');
    process.exit(1);
  }, 10000);
}

// ========================================
// Entry Point
// ========================================

async function main() {
  try {
    // コマンドライン引数またはenv.PORTからポート番号を取得
    const args = process.argv.slice(2);
    const portArg = args.find(arg => arg.startsWith('--port='));
    const monitorArg = args.find(arg => arg === '--monitor-browser');
    const noMonitorArg = args.find(arg => arg === '--no-monitor');
    const port = portArg 
      ? parseInt(portArg.split('=')[1], 10) 
      : parseInt(process.env.PORT || DEFAULT_PORT, 10);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${port}`);
    }
    
    // サーバー起動
    const { server } = await startServer(port);
    
    // ブラウザ監視を有効化（--monitor-browserオプション指定時、--no-monitorオプションがない場合）
    if (monitorArg && !noMonitorArg) {
      // サーバー起動後、少し待ってから監視開始
      setTimeout(() => {
        startBrowserMonitoring(server);
      }, 3000);
    } else if (noMonitorArg) {
      log('Browser monitoring disabled by --no-monitor flag');
    }
    
    // シグナルハンドラーを設定
    process.on('SIGINT', () => gracefulShutdown(server));
    process.on('SIGTERM', () => gracefulShutdown(server));
    
    // 未処理の例外をキャッチ
    process.on('uncaughtException', (error) => {
      log(`Uncaught exception: ${error.message}`, 'ERROR');
      log(error.stack, 'ERROR');
      gracefulShutdown(server);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      log(`Unhandled rejection at: ${promise}, reason: ${reason}`, 'ERROR');
    });
    
  } catch (error) {
    log(`Failed to start server: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// サーバー起動
if (require.main === module) {
  main();
}

module.exports = { 
  startServer, 
  gracefulShutdown, 
  startBrowserMonitoring, 
  stopBrowserMonitoring 
};
