# サーバープロキシ設定

## app/server/index.js への追加

### プロキシ設定の追加

```javascript
// ========================================
// New API プロキシ
// ========================================
app.use('/newapi', createProxyMiddleware({
    target: 'https://api.newservice.com',
    changeOrigin: true,
    pathRewrite: {
        '^/newapi': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[NewAPI] ${req.method} ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('[NewAPI] プロキシエラー:', err.message);
        res.status(500).json({
            error: {
                message: 'New APIへの接続に失敗しました',
                details: err.message
            }
        });
    }
}));
```

### 配置位置

既存のプロキシ設定の後に追加：

```javascript
// OpenAI API プロキシ
app.use('/openai', ...);

// Responses API プロキシ
app.use('/responses', ...);

// Claude API プロキシ
app.use('/anthropic', ...);

// Gemini API プロキシ
app.use('/gemini', ...);

// 新しいAPI プロキシ（ここに追加）
app.use('/newapi', ...);
```

## CORSヘッダーの追加

必要に応じてallowedHeadersを更新：

```javascript
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-api-key',
        'anthropic-version',
        'anthropic-dangerous-direct-browser-access',
        'x-goog-api-key',
        'x-new-api-header'  // 新しいAPIのカスタムヘッダー
    ],
    credentials: false
}));
```

## 完全なプロキシ設定例

```javascript
const { createProxyMiddleware } = require('http-proxy-middleware');

// ========================================
// New API プロキシ
// ========================================
const newApiProxy = createProxyMiddleware({
    target: 'https://api.newservice.com',
    changeOrigin: true,
    pathRewrite: {
        '^/newapi': ''
    },
    timeout: 120000,  // 2分
    proxyTimeout: 120000,
    onProxyReq: (proxyReq, req, res) => {
        // リクエストログ
        console.log(`[NewAPI] ${req.method} ${req.url}`);

        // 必要に応じてヘッダーを追加
        if (req.headers['x-new-api-key']) {
            proxyReq.setHeader('Authorization', `Bearer ${req.headers['x-new-api-key']}`);
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        // レスポンスログ
        console.log(`[NewAPI] Response: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
        console.error('[NewAPI] プロキシエラー:', err.message);
        if (!res.headersSent) {
            res.status(500).json({
                error: {
                    message: 'New APIへの接続に失敗しました',
                    details: err.message
                }
            });
        }
    }
});

app.use('/newapi', newApiProxy);
```

## ストリーミング対応

ストリーミングAPIの場合、特別な設定は通常不要（http-proxy-middlewareが自動処理）。

ただし、長時間接続の場合はタイムアウト設定を確認：

```javascript
app.use('/newapi', createProxyMiddleware({
    target: 'https://api.newservice.com',
    changeOrigin: true,
    timeout: 120000,  // 2分
    proxyTimeout: 120000,
    // ...
}));
```

## config.jsへの追加

```javascript
// window.CONFIG.AIAPI.ENDPOINTS
ENDPOINTS: {
    OPENAI: '/openai/v1/chat/completions',
    RESPONSES: '/responses/v1/responses',
    GEMINI: '/gemini/v1beta/models',
    CLAUDE: '/anthropic/v1/messages',
    NEW_API: '/newapi/v1/chat'  // 追加
}
```
