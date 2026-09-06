# ChatBot

マルチAIプロバイダ（OpenAI / Azure OpenAI / Claude / Gemini）対応のブラウザチャットアプリ。Express が静的配信と API プロキシを兼ね、フロントは素の JavaScript。ビルド・テスト・Lint・CI はいずれも無い。

## コマンド

```bash
cd app && npm install && npm start   # http://localhost:50000（PORT で上書き可、dev も同じ）
scripts\StartChatBot.bat             # Node 確認 → install → 起動 → ブラウザを開く
```

- C++ 実行はサーバー側に g++ が必要。Python は Pyodide なので不要
- 変更後の確認はブラウザで行う。コンソールに `Uncaught ReferenceError`（読み込み順ミス）や `[Module]` プレフィックスのエラーが無いことを見る

## 技術的制約

- **ビルドなし・ES Modules なし**。`index.html` 末尾の `<script>` 列を上から順に評価する。クラスは `window.Xxx = Xxx` でグローバル公開して次のスクリプトから参照する
- `jsconfig.json` で `checkJs` 有効。型は JSDoc で書く
- 永続化は LocalStorage（設定、API キーは暗号化）と IndexedDB（RAG ベクトル、エージェント記憶、カスタムツール、生成ファイル、ワークフロー）
- 外部ライブラリは CDN を `<head>` で読む。npm 依存はサーバー側の express / http-proxy-middleware / cors のみ

## サブシステム地図

| サブシステム | 入口 | 補足 |
| --- | --- | --- |
| AI API | `js/core/api.js` | モデル名で `openaiApi.js` / `claudeApi.js` / `geminiApi.js` / `responsesApi.js` に委譲。モデル一覧は `config.js` の `MODELS` が正本 |
| チャットツール | `js/core/tools/toolManager.js` | 通常チャットの Function Calling。Excel / PowerPoint / Canvas 生成 |
| エージェント | `js/core/agent/agentOrchestrator.js` | ReAct ループ。ツールは `agent/tools/agentToolManager.js`、UI は `components/agent/`、設定は `modals/agentSettings/` |
| ワークフロー | `js/core/workflow/nodeRegistry.js`, `workflowEngine.js` | DAG 実行。ビルダーは `modals/workflowBuilder/` + `components/workflow/` |
| チャットフロー | `js/core/chatflow/chatFlowNodes.js`, `chatFlowEngine.js` | 会話内の逐次遷移。ビルダーは `modals/chatFlowBuilder/` |
| RAG | `js/core/rag/ragManager.js` | ローカル埋め込み（Transformers.js）or OpenAI / Azure。Confluence 取り込みは `confluenceDataSource.js` |
| コード実行 | `js/core/executors/codeExecutor.js` | JS / TS / Python / C++ / HTML。言語別は `executors/languages/` |
| アーティファクト | `js/components/artifact/artifactManager.js` | HTML / SVG / Mermaid / Markdown / Draw.io のプレビュー |
| Codex 連携 | `js/core/codex/codexClient.js` | サーバー `app/server/codexRoutes.js` が `codex exec --json` を spawn し SSE 中継。作業先は `app/workspace/`。チャット内カードは `components/codex/`、エージェントからは `agent/tools/codexTaskTool.js` |
| チャット UI | `js/components/chat/` | 表示 `chatRenderer.js`、送信 `chatActions.js`、履歴 `chatHistory.js` |
| モーダル | `js/modals/{機能}/{機能}Modal.js` | 開閉の共通処理は `modalHandlers.js` |
| サーバー | `app/server/index.js` | 下記 |

**ツールは2系統あり混同しない。** `js/core/tools/` は通常チャット用で `ToolRegistry` に登録する。`js/core/agent/tools/` はエージェントループ専用で `AgentToolManager` に登録する。レジストリもスキーマ定義も別で、片方に登録してももう片方には現れない。

## スクリプト読み込み順

新規ファイルは `index.html` の同じサブシステムのコメントブロック内に、依存先の後・依存元の前に置く。ブロックは上から順に: 実行環境 → Core（`config.js` 先頭）→ Utils → Components / API → ツール機能 → RAG → エージェント（内側に「エージェントツール」「カスタムツール関連」）→ ワークフロー → チャットフロー → アーティファクト → コンポーネント → モーダル → Monaco → `main.js`（必ず最後）。

CSS は `<head>` の `<!-- Components CSS -->` の並びに `<link>` を足す。`css/tools.css` だけ `components/` の外にある例外。

## 必須コーディング規約

### シングルトン（全クラス）

```javascript
class ClassName {
    static #instance = null;

    constructor() {
        if (ClassName.#instance) {
            return ClassName.#instance;
        }
        ClassName.#instance = this;
    }

    static get getInstance() {
        if (!ClassName.#instance) {
            ClassName.#instance = new ClassName();
        }
        return ClassName.#instance;
    }

    #privateMethod() { /* ES2022 private */ }
}

window.ClassName = ClassName;
```

`getInstance` はゲッターなので `ClassName.getInstance.method()` と呼ぶ（括弧なし）。

### 命名

| 種類 | 規則 | 例 |
| --- | --- | --- |
| クラス | PascalCase | `ChatRenderer`, `OpenAIAPI` |
| メソッド | camelCase | `addUserMessage` |
| プライベート | `#` プレフィックス | `#validateInput` |
| 定数 | SCREAMING_SNAKE | `MAX_RETRIES` |
| CSS 変数 / クラス | kebab-case | `--background-primary`, `.chat-message` |
| ツール名・ノード type | snake_case | `rag_search`, `http` |

### 設定値・ログ・エラー

- 数値や URL のハードコード禁止。すべて `window.CONFIG`（`js/core/config.js`）から取る。新しい設定はサブシステムに対応するトップレベルキー（`AGENT` `TOOLS` `WORKFLOW` `CHATFLOW` `RAG` `UI` など）の下に追加する
- パブリックメソッドには JSDoc（`@param` `@returns` `@throws`）を書く
- ログは `console.log('[ModuleName] ...')` の形でモジュール名を前置する。成功 / 警告 / エラーの区別に絵文字を使ってよい
- 例外は `console.error('[ModuleName] 処理名エラー:', error)` で記録してから再スローする

## サーバー

`app/server/index.js` は2形式のルートを持つ。パスをそのまま転送するだけなら `createProxyMiddleware`（`/openai` `/responses` `/anthropic` `/gemini`）。ヘッダ組み替えや転送先が動的なら `app.post`（`/azure-openai` `/openai-embeddings` `/azure-openai-embeddings` `/confluence-proxy` `/api/compile/cpp`）。新規外部 API は後者で書き、`app.listen` 内の `Proxy Endpoints:` ログにも1行足す。Codex / ワークスペース系（`/api/codex/*` `/api/workspace/*`）だけは `app/server/codexRoutes.js` に分離してあり、`registerCodexRoutes(app)` で登録する。

## スキル

| スキル | 使う場面 |
| --- | --- |
| `chatbot-api` | AI プロバイダの追加、プロキシ追加、ストリーミング |
| `chatbot-agent-tool` | エージェントツール / チャットツールの追加 |
| `chatbot-flow-node` | ワークフロー / チャットフローのノード追加 |
| `chatbot-component` | UI 部品・モーダル・CSS の追加 |

## 変更後の確認

- 新規スクリプトは `index.html` に追加したか（追加漏れは `ReferenceError` で気づく）
- 機能追加・モデル変更は `README.md` の該当節を更新したか
- 手順が変わったら該当スキルの `SKILL.md` / `references/` を更新したか
