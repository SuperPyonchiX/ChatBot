/**
 * ChatBot Node.js サーバー
 *
 * 目的:
 * - Expressサーバーでフロントエンドを配信
 * - ブラウザから直接APIを呼び出す際のCORS問題を回避
 * - OpenAI、Claude、Geminiの各APIへのプロキシ機能を提供
 *
 * 起動方法:
 * - npm start
 * - デフォルトポート: 50000
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs').promises;
const os = require('os');
const crypto = require('crypto');
const { registerCodexRoutes, WORKSPACE_DIR, EXEC_ENABLED } = require('./codexRoutes');
const { registerEnterpriseRoutes } = require('./enterpriseRoutes');

// ポート設定
const PORT = process.env.PORT || 50000;

const app = express();
registerEnterpriseRoutes(app);

// ========================================
// CORS設定（すべてのオリジンを許可）
// ========================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'anthropic-version', 'anthropic-dangerous-direct-browser-access', 'x-goog-api-key'],
    credentials: false
}));

// ========================================
// 静的ファイルの配信（アプリケーション本体）
// ========================================
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// ========================================
// OpenAI API プロキシ
// ========================================
app.use('/openai', createProxyMiddleware({
    target: 'https://api.openai.com',
    changeOrigin: true,
    pathRewrite: {
        '^/openai': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[OpenAI] ${req.method} ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('[OpenAI] プロキシエラー:', err.message);
        res.status(500).json({
            error: {
                message: 'OpenAI APIへの接続に失敗しました',
                details: err.message
            }
        });
    }
}));

// ========================================
// OpenAI Responses API プロキシ
// ========================================
app.use('/responses', createProxyMiddleware({
    target: 'https://api.openai.com',
    changeOrigin: true,
    pathRewrite: {
        '^/responses': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Responses] ${req.method} ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('[Responses] プロキシエラー:', err.message);
        res.status(500).json({
            error: {
                message: 'OpenAI Responses APIへの接続に失敗しました',
                details: err.message
            }
        });
    }
}));

// ========================================
// Claude (Anthropic) API プロキシ
// ========================================
app.use('/anthropic', createProxyMiddleware({
    target: 'https://api.anthropic.com',
    changeOrigin: true,
    pathRewrite: {
        '^/anthropic': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Claude] ${req.method} ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('[Claude] プロキシエラー:', err.message);
        res.status(500).json({
            error: {
                message: 'Claude APIへの接続に失敗しました',
                details: err.message
            }
        });
    }
}));

// ========================================
// Gemini API プロキシ
// ========================================
app.use('/gemini', createProxyMiddleware({
    target: 'https://generativelanguage.googleapis.com',
    changeOrigin: true,
    pathRewrite: {
        '^/gemini': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Gemini] ${req.method} ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('[Gemini] プロキシエラー:', err.message);
        res.status(500).json({
            error: {
                message: 'Gemini APIへの接続に失敗しました',
                details: err.message
            }
        });
    }
}));

// ========================================
// Azure OpenAI API プロキシ（動的エンドポイント）
// ========================================
app.post('/azure-openai', express.json({ limit: '10mb' }), async (req, res) => {
    const { targetUrl, apiKey, body } = req.body;

    if (!targetUrl || !apiKey || !body) {
        return res.status(400).json({
            error: { message: 'targetUrlとapiKeyとbodyは必須です' }
        });
    }

    console.log(`[Azure OpenAI] POST ${targetUrl}`);

    const controller = new AbortController();
    const abortUpstream = () => controller.abort();
    res.on('close', abortUpstream);

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        // ストリーミングレスポンスの場合
        const contentType = response.headers.get('content-type');
        if (body.stream && contentType && contentType.includes('text/event-stream')) {
            res.status(response.status);
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Node.js 18+ の ReadableStream を使用
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            const pump = async () => {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        res.end(decoder.decode());
                        break;
                    }
                    res.write(decoder.decode(value, { stream: true }));
                }
            };

            await pump().catch(err => {
                console.error('[Azure OpenAI] ストリーミングエラー:', err.message);
                res.destroy(err);
            });
        } else {
            // 通常のJSONレスポンス
            const data = await response.text();
            if (contentType) res.setHeader('Content-Type', contentType);
            res.status(response.status).send(data);
        }
    } catch (error) {
        if (controller.signal.aborted) return;
        console.error('[Azure OpenAI] プロキシエラー:', error.message);
        res.status(500).json({
            error: {
                message: 'Azure OpenAI APIへの接続に失敗しました',
                details: error.message
            }
        });
    } finally {
        res.off('close', abortUpstream);
    }
});

// ========================================
// Confluence Data Center API プロキシ
// ========================================
app.post('/confluence-proxy', express.json({ limit: '10mb' }), async (req, res) => {
    const { targetUrl, authorization } = req.body;

    if (!targetUrl || !authorization) {
        return res.status(400).json({
            error: { message: 'targetUrlとauthorizationは必須です' }
        });
    }


    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'error',
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[Confluence] タイムアウト');
            res.status(504).json({
                error: {
                    message: 'Confluence APIへのリクエストがタイムアウトしました',
                    details: 'Request timeout after 30 seconds'
                }
            });
        } else {
            console.error('[Confluence] プロキシエラー:', error.name);
            res.status(500).json({
                error: {
                    message: 'Confluence APIへの接続に失敗しました',
                    details: 'ネットワーク・証明書・認証設定を確認してください'
                }
            });
        }
    }
});

// ========================================
// 汎用URLフェッチプロキシ（url_fetch ツール / ワークフロー http ノード用）
// ========================================
app.all('/api/fetch-url', express.json({ limit: '10mb' }), async (req, res) => {
    const targetUrl = req.query.url;

    let parsed;
    try {
        parsed = new URL(String(targetUrl));
    } catch {
        return res.status(400).json({ error: { message: 'url クエリパラメータが不正です' } });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: { message: 'http / https 以外のURLは取得できません' } });
    }

    const method = req.method === 'OPTIONS' ? 'GET' : req.method;
    console.log(`[FetchURL] ${method} ${parsed.href}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const options = {
            method,
            headers: {
                'Accept': req.headers['accept'] || '*/*',
                'User-Agent': 'ChatBot-FetchProxy/1.0'
            },
            signal: controller.signal,
            redirect: 'follow'
        };
        if (['POST', 'PUT', 'PATCH'].includes(method) && req.body && Object.keys(req.body).length > 0) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(req.body);
        }

        const response = await fetch(parsed.href, options);
        clearTimeout(timeout);

        const contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8';
        const body = await response.text();
        res.status(response.status).set('Content-Type', contentType).send(body);
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            console.error('[FetchURL] タイムアウト');
            res.status(504).json({ error: { message: 'URLの取得がタイムアウトしました', details: 'Request timeout after 30 seconds' } });
        } else {
            console.error('[FetchURL] 取得エラー:', error.message);
            res.status(502).json({ error: { message: 'URLの取得に失敗しました', details: error.message } });
        }
    }
});

// ========================================
// Codex CLI 連携 / ワークスペース API（server/codexRoutes.js）
// ========================================
registerCodexRoutes(app);

// ========================================
// C++ コンパイル・実行 API
// ========================================
app.post('/api/compile/cpp', express.json({ limit: '1mb' }), async (req, res) => {
    const { code, input = '' } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'コードが指定されていません' });
    }

    // コードサイズ制限 (100KB)
    if (code.length > 100000) {
        return res.status(400).json({ error: 'コードが大きすぎます（100KB以下にしてください）' });
    }

    // 一時ディレクトリを作成
    const tempId = crypto.randomBytes(8).toString('hex');
    const tempDir = path.join(os.tmpdir(), `cpp_${tempId}`);
    const sourceFile = path.join(tempDir, 'main.cpp');
    const outputFile = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');

    try {
        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(sourceFile, code, 'utf-8');

        console.log(`[C++] コンパイル開始: ${tempDir}`);

        // g++ でコンパイル
        const compileCommand = process.platform === 'win32'
            ? `g++ -std=c++17 -O2 -o "${outputFile}" "${sourceFile}" 2>&1`
            : `g++ -std=c++17 -O2 -o "${outputFile}" "${sourceFile}" 2>&1`;

        const compileResult = await new Promise((resolve) => {
            exec(compileCommand, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    stdout: stdout || '',
                    stderr: stderr || '',
                    error: error ? error.message : null
                });
            });
        });

        if (!compileResult.success) {
            console.log(`[C++] コンパイルエラー`);
            return res.json({
                success: false,
                phase: 'compile',
                error: compileResult.stdout || compileResult.stderr || compileResult.error || 'コンパイルに失敗しました'
            });
        }

        console.log(`[C++] コンパイル成功、実行開始`);

        // プログラムを実行
        const runCommand = process.platform === 'win32' ? `"${outputFile}"` : `"${outputFile}"`;

        const runResult = await new Promise((resolve) => {
            const child = exec(runCommand, {
                timeout: 10000,
                maxBuffer: 1024 * 1024,
                cwd: tempDir
            }, (error, stdout, stderr) => {
                resolve({
                    success: !error || error.killed === false,
                    stdout: stdout || '',
                    stderr: stderr || '',
                    exitCode: error ? error.code : 0,
                    killed: error ? error.killed : false
                });
            });

            // 標準入力にデータを送信
            if (input) {
                child.stdin.write(input);
            }
            child.stdin.end();
        });

        console.log(`[C++] 実行完了`);

        res.json({
            success: true,
            output: runResult.stdout,
            stderr: runResult.stderr,
            exitCode: runResult.exitCode || 0,
            killed: runResult.killed
        });

    } catch (error) {
        console.error(`[C++] エラー:`, error);
        res.status(500).json({
            success: false,
            error: error.message || '実行中にエラーが発生しました'
        });
    } finally {
        // クリーンアップ
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) {
            console.error(`[C++] クリーンアップエラー:`, e);
        }
    }
});

// ========================================
// ルートアクセス時のリダイレクト
// ========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// ========================================
// サーバー起動
// ========================================
app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('   ChatBot Node.js Server');
    console.log('========================================');
    console.log('');
    console.log(`Server URL: http://localhost:${PORT}`);
    console.log(`Public Path: ${publicPath}`);
    console.log('');
    console.log('Proxy Endpoints:');
    console.log(`   - OpenAI:            http://localhost:${PORT}/openai/*`);
    console.log(`   - Responses:         http://localhost:${PORT}/responses/*`);
    console.log(`   - Claude:            http://localhost:${PORT}/anthropic/*`);
    console.log(`   - Gemini:            http://localhost:${PORT}/gemini/*`);
    console.log(`   - Azure OpenAI:      http://localhost:${PORT}/azure-openai`);
    console.log(`   - Confluence:        http://localhost:${PORT}/confluence-proxy`);
    console.log(`   - Jira/Confluence:   /api/enterprise/read`);
    console.log(`   - Fetch URL:         http://localhost:${PORT}/api/fetch-url?url=...`);
    console.log(`   - C++ Compile:       http://localhost:${PORT}/api/compile/cpp`);
    console.log(`   - Codex Run (SSE):   http://localhost:${PORT}/api/codex/run`);
    console.log(`   - Codex Cancel:      http://localhost:${PORT}/api/codex/cancel`);
    console.log(`   - Workspace:         http://localhost:${PORT}/api/workspace/{files,file,exec}`);
    console.log('');
    console.log(`Workspace Dir: ${WORKSPACE_DIR}`);
    console.log(`Workspace Exec: ${EXEC_ENABLED ? 'enabled' : 'disabled (WORKSPACE_EXEC_ENABLED=0)'}`);
    console.log('');
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
});

// ========================================
// エラーハンドリング
// ========================================
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
