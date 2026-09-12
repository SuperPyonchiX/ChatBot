# サーバープロキシ設定

対象: `app/server/index.js`。ブラウザから直接 API を叩くと CORS で失敗するため、すべて Express 経由にする。

## 既存ルート（2形式）

| 形式 | パス | 転送先 |
| --- | --- | --- |
| `createProxyMiddleware` | `/openai/*` | api.openai.com |
| `createProxyMiddleware` | `/responses/*` | api.openai.com |
| `createProxyMiddleware` | `/anthropic/*` | api.anthropic.com |
| `createProxyMiddleware` | `/gemini/*` | generativelanguage.googleapis.com |
| `app.post` | `/azure-openai` | リクエストボディの `targetUrl`（動的、Responses / Chat Completions共通） |
| `app.post` | `/openai-embeddings` | api.openai.com |
| `app.post` | `/azure-openai-embeddings` | 動的 |
| `app.post` | `/confluence-proxy` | ボディの `targetUrl`（動的、認証ヘッダ組み替え） |
| `app.all` | `/api/fetch-url?url=` | 汎用URL取得（url_fetch ツール / http ノード用） |
| `app.post` | `/api/compile/cpp` | ローカル g++ |
| `app.post` | `/api/codex/run` | Codex CLI を `spawn` し JSONL を SSE 中継（`server/codexRoutes.js`） |
| `app.post` | `/api/codex/cancel` | 実行中 Codex ジョブの停止 |
| `app.get` / `app.post` | `/api/workspace/files` `/file` `/exec` | ワークスペース一覧・読み書き・コマンド実行（同上） |

使い分け: **パスをそのまま転送するだけなら `createProxyMiddleware`**。ヘッダを組み替える・転送先がユーザー設定で変わる・レスポンスを加工するなら `app.post` 型。最近追加されたものは全部 `app.post` 型で、`/confluence-proxy` が最新の書き方。

## 形式1: createProxyMiddleware

既存4本の直後に追加する。

```javascript
// ========================================
// New API プロキシ
// ========================================
app.use('/newapi', createProxyMiddleware({
    target: 'https://api.newservice.com',
    changeOrigin: true,
    pathRewrite: { '^/newapi': '' },
    timeout: 120000,
    proxyTimeout: 120000,
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[NewAPI] ${req.method} ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('[NewAPI] プロキシエラー:', err.message);
        if (!res.headersSent) {
            res.status(500).json({
                error: { message: 'New APIへの接続に失敗しました', details: err.message }
            });
        }
    }
}));
```

SSE ストリーミングは http-proxy-middleware が自動で流すので追加設定は不要。長い応答に備えて `timeout` / `proxyTimeout` は入れる。

## 形式2: app.post

`/confluence-proxy` の構造。

```javascript
// ========================================
// New API プロキシ
// ========================================
app.post('/newapi-proxy', express.json({ limit: '10mb' }), async (req, res) => {
    const { targetUrl, apiKey, payload } = req.body;

    if (!targetUrl || !apiKey) {
        return res.status(400).json({ error: { message: 'targetUrlとapiKeyは必須です' } });
    }

    console.log(`[NewAPI] POST ${targetUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeout);

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        clearTimeout(timeout);
        console.error('[NewAPI] プロキシエラー:', error.message);
        res.status(500).json({ error: { message: 'New APIへの接続に失敗しました', details: error.message } });
    }
});
```

ストリーミングを `app.post` 型で扱う場合は `response.body` を `res` に pipe し、`Content-Type: text/event-stream` を付ける。

## CORS ヘッダ

ブラウザから独自ヘッダを送るなら `allowedHeaders` に足す。現行値:

```javascript
allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'anthropic-version', 'anthropic-dangerous-direct-browser-access', 'x-goog-api-key']
```

## 起動ログ

`app.listen` 内の `Proxy Endpoints:` 一覧に1行足す。運用時にここを見て確認するため、漏らさない。

```javascript
console.log(`   - NewAPI:            http://localhost:${PORT}/newapi/*`);
```

## config.js 側

```javascript
// window.CONFIG.AIAPI.ENDPOINTS（現行）
ENDPOINTS: {
    OPENAI: '/openai/v1/chat/completions',
    RESPONSES: '/responses/v1/responses',
    GEMINI: '/gemini/v1beta/models',
    CLAUDE: '/anthropic/v1/messages',
    NEW_API: '/newapi/v1/chat'          // 追加
    // Azure用エンドポイントはユーザー設定から生成
}
```
