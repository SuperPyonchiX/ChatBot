# ChatBot - ローカルプロキシサーバー開発ガイド

## 概要

このドキュメントでは、ChatBotアプリケーションで使用されているローカルプロキシサーバーの実装と、CORS問題の解決方法について説明します。

## なぜローカルプロキシサーバーが必要か?

### CORS問題

ブラウザのセキュリティ機能により、異なるオリジン（ドメイン・プロトコル・ポート）へのリクエストは制限されます。

```
file://で開いた場合:
  file:///path/to/app/index.html
      ↓ (ブロック!)
  https://api.openai.com/v1/chat/completions
  
エラー: "CORS policy: No 'Access-Control-Allow-Origin' header"
```

### 解決方法: ローカルプロキシサーバー

Node.jsサーバーを経由することで、すべてのリクエストを同一オリジンから送信できます。

```
http://localhost:50000で開いた場合:
  http://localhost:50000/
      ↓ (同一オリジン)
  http://localhost:50000/openai/v1/chat/completions
      ↓ (プロキシが転送)
  https://api.openai.com/v1/chat/completions
```

## アーキテクチャ

### リクエストフロー

```
┌─────────────┐
│  ブラウザ   │
│ (クライアント)│
└──────┬──────┘
       │ fetch('http://localhost:50000/openai/v1/chat/completions')
       ↓
┌─────────────────────────────┐
│  Node.jsプロキシサーバー    │
│  (Express + http-proxy-middleware) │
├─────────────────────────────┤
│  ルーティング:              │
│  /openai/*   → OpenAI API   │
│  /anthropic/* → Claude API   │
│  /gemini/*   → Gemini API   │
│  /responses/* → Responses API│
└──────┬──────────────────────┘
       │ https://api.openai.com/v1/chat/completions
       ↓
┌─────────────┐
│  OpenAI API │
└─────────────┘
```

### ファイル構成

```
launcher/server/
├── server.js          # プロキシサーバー本体
├── package.json       # 依存関係定義
└── node_modules/      # インストールされたパッケージ
    ├── express/
    ├── http-proxy-middleware/
    └── cors/
```

## サーバー実装の詳細

### 主要な設定

#### 1. CORS設定

```javascript
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', ...],
    credentials: false
}));
```

- `origin: '*'`: すべてのオリジンからのリクエストを許可（ローカル開発用）
- `allowedHeaders`: 各APIプロバイダに必要なヘッダーを許可

#### 2. プロキシ設定

```javascript
app.use('/openai', createProxyMiddleware({
    target: 'https://api.openai.com',
    changeOrigin: true,
    pathRewrite: {
        '^/openai': ''  // /openai/v1/... → /v1/...
    }
}));
```

- `target`: 転送先のAPIエンドポイント
- `changeOrigin: true`: Hostヘッダーをターゲットに合わせて変更
- `pathRewrite`: URLパスの書き換えルール

#### 3. 静的ファイル配信

```javascript
const appPath = path.join(__dirname, '../../app');
app.use(express.static(appPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(appPath, 'index.html'));
});
```

- `app/` ディレクトリを静的ファイルとして配信
- ルートアクセス時は `index.html` を返す

## クライアント側の実装

### API通信の設定（config.js）

```javascript
window.CONFIG = {
    AIAPI: {
        ENDPOINTS: {
            OPENAI: 'http://localhost:50000/openai/v1/chat/completions',
            RESPONSES: 'http://localhost:50000/responses/v1/responses',
            GEMINI: 'http://localhost:50000/gemini/v1beta/models',
            CLAUDE: 'http://localhost:50000/anthropic/v1/messages'
        }
    }
};
```

### fetchリクエストの例（openaiApi.js）

```javascript
const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
});
```

- エンドポイントはconfig.jsで定義されたローカルプロキシ経由のURL
- APIキーはクライアント側で管理（プロキシは透過的に転送）

## 開発とデバッグ

### サーバーの起動

```bash
# 開発用起動（ログ出力あり）
cd launcher/server
node server.js --port=50000

# 別ポート指定
node server.js --port=3000
```

### デバッグログ

サーバーは各リクエストをコンソールに出力します：

```
[OpenAI] POST /openai/v1/chat/completions
[Claude] POST /anthropic/v1/messages
[Gemini] GET /gemini/v1beta/models/gemini-2.5-pro:streamGenerateContent
```

### エラーハンドリング

プロキシエラーは適切なエラーレスポンスを返します：

```javascript
onError: (err, req, res) => {
    console.error('[OpenAI] プロキシエラー:', err.message);
    res.status(500).json({
        error: {
            message: 'OpenAI APIへの接続に失敗しました',
            details: err.message
        }
    });
}
```

## セキュリティ考慮事項

### 1. APIキーの管理

- **クライアント側で暗号化**: `cryptoHelper.js`でAPIキーを暗号化してローカルストレージに保存
- **プロキシは保存しない**: サーバーはAPIキーを保存せず、透過的に転送のみ
- **ローカルのみ**: サーバーは `localhost` でのみリッスン（外部アクセス不可）

### 2. CORS設定

- 本番環境では `origin: '*'` を特定のオリジンに制限すべき
- ローカル開発用途では問題なし

### 3. HTTPSの考慮

- 本番環境では HTTPS を使用すべき
- ローカル開発では HTTP で問題なし
- APIへの転送は常に HTTPS

## トラブルシューティング

### よくある問題

#### 1. サーバーが起動しない

**エラー**: `Error: listen EADDRINUSE: address already in use :::50000`

**原因**: ポート50000が既に使用中

**解決策**:
```bash
# 別のポートで起動
node server.js --port=50001

# または、使用中のプロセスを終了
# Windowsの場合
netstat -ano | findstr :50000
taskkill /PID <PID> /F
```

#### 2. CORS エラーが発生

**エラー**: `CORS policy: No 'Access-Control-Allow-Origin' header`

**原因**: サーバーが起動していない、または直接 `file://` で開いている

**解決策**:
1. サーバーを起動: `launcher\StartChatBot.bat`
2. ブラウザで `http://localhost:50000` を開く
3. 直接 `app/index.html` を開かない

#### 3. API接続エラー

**エラー**: `Failed to fetch` または `Network error`

**考えられる原因**:
1. インターネット接続がない
2. APIキーが無効
3. プロキシ設定が間違っている

**デバッグ方法**:
1. サーバーログを確認（コンソール出力）
2. ブラウザの開発者ツールでネットワークタブを確認
3. APIキーを再設定

## 新しいAPIプロバイダの追加

### 手順

1. **サーバー側にプロキシを追加** (`server.js`)

```javascript
app.use('/newapi', createProxyMiddleware({
    target: 'https://api.newprovider.com',
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
                message: 'NewAPI APIへの接続に失敗しました',
                details: err.message
            }
        });
    }
}));
```

2. **クライアント側にエンドポイントを追加** (`config.js`)

```javascript
ENDPOINTS: {
    // ... 既存のエンドポイント
    NEWAPI: 'http://localhost:50000/newapi/v1/endpoint'
}
```

3. **APIクライアントクラスを作成** (`newApi.js`)

```javascript
class NewAPI {
    static #instance = null;
    
    static get getInstance() {
        if (!NewAPI.#instance) {
            NewAPI.#instance = new NewAPI();
        }
        return NewAPI.#instance;
    }
    
    async callNewAPI(messages, model, options = {}) {
        const endpoint = window.CONFIG.AIAPI.ENDPOINTS.NEWAPI;
        // 実装...
    }
}
```

## まとめ

- **ローカルプロキシサーバー**: CORS問題を解決し、安全なAPI通信を実現
- **Express + http-proxy-middleware**: シンプルで拡張性の高い実装
- **セキュリティ**: APIキーはクライアント側で管理、サーバーは透過的に転送
- **開発効率**: 新しいAPIプロバイダの追加が容易

---

更新日: 2025年12月26日
