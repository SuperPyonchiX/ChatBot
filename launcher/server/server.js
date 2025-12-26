/**
 * ChatBot ローカルプロキシサーバー
 * 
 * 目的:
 * - ブラウザから直接APIを呼び出す際のCORS問題を回避
 * - APIキーをクライアント側で管理しつつ、安全にリクエストを転送
 * - OpenAI、Claude、Geminiの各APIへのプロキシ機能を提供
 * 
 * 起動方法:
 * - node server.js [--port=ポート番号]
 * - デフォルトポート: 50000
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

// コマンドライン引数からポート番号を取得
const args = process.argv.slice(2);
const portArg = args.find(arg => arg.startsWith('--port='));
const PORT = portArg ? parseInt(portArg.split('=')[1]) : 50000;

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
const appPath = path.join(__dirname, '../../app');
app.use(express.static(appPath));

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
// ルートアクセス時のリダイレクト
// ========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(appPath, 'index.html'));
});

// ========================================
// サーバー起動
// ========================================
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║           ChatBot ローカルプロキシサーバー起動             ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🌐 サーバーURL: http://localhost:${PORT}`);
    console.log(`📁 アプリケーションパス: ${appPath}`);
    console.log('');
    console.log('🔄 プロキシエンドポイント:');
    console.log(`   - OpenAI:    http://localhost:${PORT}/openai/*`);
    console.log(`   - Responses: http://localhost:${PORT}/responses/*`);
    console.log(`   - Claude:    http://localhost:${PORT}/anthropic/*`);
    console.log(`   - Gemini:    http://localhost:${PORT}/gemini/*`);
    console.log('');
    console.log('💡 ブラウザで http://localhost:' + PORT + ' を開いてください');
    console.log('');
    console.log('⏹  サーバーを停止するには Ctrl+C を押してください');
    console.log('');
});

// ========================================
// エラーハンドリング
// ========================================
process.on('uncaughtException', (err) => {
    console.error('未処理の例外:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未処理のPromise拒否:', reason);
});
