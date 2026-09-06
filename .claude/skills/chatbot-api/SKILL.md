---
name: chatbot-api
description: ChatBotプロジェクトに新しいAIプロバイダを組み込む工程スキル。`js/core/xxxApi.js` のAPIクラス作成、`api.js` のルーティング追加、`config.js` の MODELS / ENDPOINTS / STORAGE.KEYS / TOOLS.COMPATIBLE_MODELS 追加、`app/server/index.js` のプロキシ追加、apiSettingsModal のキー入力欄追加、SSEストリーミング実装までを順に行う。「新しいAI APIを追加したい」「○○のモデルを使えるようにして」「プロキシを追加して」「ストリーミングに対応させて」で使う。AI が呼ぶツールの追加は chatbot-tool、UI部品の追加は chatbot-component。
---

# AI プロバイダ追加

## 既存クラス（手本）

| クラス | ファイル | 特徴 |
| --- | --- | --- |
| `OpenAIAPI` | `js/core/openaiApi.js` | Chat Completions。最も標準的な手本 |
| `ClaudeAPI` | `js/core/claudeApi.js` | Messages API。Web検索ツール対応 |
| `GeminiAPI` | `js/core/geminiApi.js` | GenerateContent |
| `ResponsesAPI` | `js/core/responsesApi.js` | OpenAI Responses API（Web検索） |

ルーターは `js/core/api.js` の `AIAPI.callAIAPI(messages, model, attachments, options)`。モデル名でプロバイダを判定して各クラスに委譲する。

## 手順

1. **config.js**（`app/public/js/core/config.js`）
   - `AIAPI.ENDPOINTS` にプロキシ経由のパスを追加（例: `NEW_API: '/newapi/v1/chat'`）
   - `STORAGE.KEYS` に API キー保存用キーを追加（例: `NEW_API_KEY: 'newApiKey'`）
   - `MODELS` にモデル配列を追加。既存は `MODELS.OPENAI` / `CLAUDE` / `GEMINI`
   - Function Calling に対応するなら `TOOLS.COMPATIBLE_MODELS` にも同じモデル名を足す。ここに無いとチャットツールが出ない
   - Web検索に対応するなら `WEB_SEARCH` 配下の対応モデル表にも足す
2. **サーバープロキシ**（`app/server/index.js`）: `references/server-proxy-setup.md`。単純転送なら `createProxyMiddleware`、ヘッダ組み替えや動的 URL なら `app.post` 型。起動ログの `Proxy Endpoints:` 一覧にも1行足す
3. **API クラス**（`js/core/newApi.js`）: `references/api-class-template.md`。必須メソッド:
   - `callNewAPI(messages, model, attachments, options)`
   - `#validateAPISettings()`
   - `#prepareNewRequest()`
   - `#executeNewRequest()`（非ストリーミング）
   - `#executeStreamNewRequest()`（ストリーミング。`references/streaming-implementation.md`）
4. **ルーティング**（`js/core/api.js`）: `callAIAPI` のプロバイダ判定に分岐を追加
5. **API 設定 UI**（`js/modals/apiSettings/apiSettingsModal.js` と `index.html` の対応フォーム）: キー入力欄と保存処理を追加。キーは `Storage` 経由で暗号化保存される
6. **index.html**: `<script src="js/core/responsesApi.js">` の並び（`api.js` の直後ブロック）に追加
7. **README.md** の対応モデル表を更新

## 動作確認

1. `cd app && npm start` → 起動ログに新プロキシが出る
2. API 設定モーダルでキーを保存し、再読み込み後も残っている
3. モデル選択に新モデルが出て、非ストリーミング・ストリーミング双方で応答が返る
4. サーバーコンソールに `[NewAPI] POST /...` のログが出る
5. 添付ファイル付きで送って `#prepareNewRequest` が壊れない
6. 無効なキーで `[NewAPI]` プレフィックスのエラーが UI に表示される

## 参照ファイル

| ファイル | 読むタイミング |
| --- | --- |
| `references/api-class-template.md` | 手順3でクラスを書くとき |
| `references/server-proxy-setup.md` | 手順2でプロキシを足すとき |
| `references/streaming-implementation.md` | SSE ストリーミングを実装するとき |
