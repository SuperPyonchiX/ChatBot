/*
  Lightweight static server + same-origin reverse proxy for Anthropic
  - Serves files from project root on http://localhost:8000
  - Proxies /anthropic/* to https://api.anthropic.com/* with CORS + SSE passthrough
*/

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 50000;
const PROJECT_ROOT = path.join(__dirname, '..');
const ANTHROPIC_BASE = 'api.anthropic.com';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.webm': 'video/webm'
};

function setCommonCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access, accept, authorization, cache-control'
  );
}

function handleAnthropicProxy(req, res) {
  if (req.method === 'OPTIONS') {
    setCommonCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  const upstreamPath = req.url.replace(/^\/anthropic/, '') || '/v1/messages';

  const headers = { ...req.headers };
  delete headers['host'];
  delete headers['content-length'];
  delete headers['connection'];
  delete headers['accept-encoding'];

  const options = {
    hostname: ANTHROPIC_BASE,
    port: 443,
    path: upstreamPath,
    method: req.method,
    headers
  };

  const upstream = https.request(options, (upstreamRes) => {
    // Filter out upstream CORS and hop-by-hop headers to avoid duplicates
    const filtered = { ...upstreamRes.headers };
    [
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-expose-headers',
      'access-control-allow-credentials',
      'connection',
      'transfer-encoding',
      'content-length'
    ].forEach((h) => delete filtered[h]);

    res.writeHead(upstreamRes.statusCode || 500, {
      ...filtered,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': '*',
      'Cache-Control': 'no-cache'
    });
    upstreamRes.pipe(res);
  });

  upstream.on('error', (err) => {
    res.statusCode = 502;
    setCommonCors(res);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Bad Gateway', message: String((err && err.message) || err) }));
  });

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    req.pipe(upstream);
  } else {
    upstream.end();
  }
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.join(PROJECT_ROOT, urlPath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      setCommonCors(res);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';

    setCommonCors(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', type);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', () => res.end());
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/anthropic/')) return handleAnthropicProxy(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`Server started: ${url}`);
  console.log(`Serving static from: ${PROJECT_ROOT}`);
  console.log(`Same-origin Anthropic proxy: ${url}anthropic/ -> https://${ANTHROPIC_BASE}/`);
});
