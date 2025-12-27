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

// ポート設定
const PORT = process.env.PORT || 50000;

const app = express();

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
    console.log(`   - OpenAI:    http://localhost:${PORT}/openai/*`);
    console.log(`   - Responses: http://localhost:${PORT}/responses/*`);
    console.log(`   - Claude:    http://localhost:${PORT}/anthropic/*`);
    console.log(`   - Gemini:    http://localhost:${PORT}/gemini/*`);
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
