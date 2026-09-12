---
name: chatbot-tool
description: ChatBotプロジェクトに、モデルが通常チャットで自分で呼び出すツール（Function Calling）を追加する工程スキル。`js/core/tools/builtin/{name}Tool.js` の自己完結シングルトン（name/description/parameters/execute）を作り、`toolManager.js` の `#registerAgentTools()` のクラス名一覧、`config.js` の `TOOLS.DISPLAY_NAMES` / `CATEGORIES`（ホスト OS に触るなら `DEFAULT_DISABLED` も）、index.html の「情報取得・実行系ツール」ブロックに登録して、ツール設定モーダルとチャットで確認するところまで行う。「○○ツールを追加して」「AIが△△できるようにして」「PowerPoint のような生成ツールを増やして」で使う。AIプロバイダの追加は chatbot-api、UI部品の追加は chatbot-component。
---

# ツール追加

ツールは 1 系統だけ。`ToolRegistry`（`js/core/tools/toolRegistry.js`）に登録されたものが、対応モデル（`CONFIG.TOOLS.COMPATIBLE_MODELS`）との通常チャットで Function Calling として渡り、モデルが必要と判断したときに呼ばれる。呼び出し → 実行 → 結果をモデルへ返す → 続きを生成、の往復は `chatActions.js#processAndSendMessage` が `TOOLS.MAX_ROUNDS` まで回す。ユーザーがモードを選ぶ仕組みは無い。

登録の仕方は 2 通りあるが、**新規はすべて「ビルトインツール」形式**で書く。

| 形式 | 例 | 登録 |
| --- | --- | --- |
| ビルトインツール（推奨） | `web_search` `calculator` `codex_task` | `js/core/tools/builtin/{camel}Tool.js` を作り、`toolManager.js#registerAgentTools()` のクラス名配列に足す |
| 生成系（歴史的） | `generate_powerpoint` `process_excel` `render_canvas` | `toolManager.js#registerBuiltInTools()` に inline スキーマ + `executors/` の `ToolExecutorBase` 派生。新規では使わない |

## 手順

雛形は `references/tool-template.md`。

1. **ツールクラスを作る**: `app/public/js/core/tools/builtin/{camel}Tool.js`。`urlFetchTool.js` を手本に、次を必ず持たせる
   - `name`: snake_case。LLM に渡る関数名。以降の登録はすべてこの文字列で行う
   - `description`: モデルが「いつ使うか」を判断する文。ツール設定モーダルにもそのまま出る
   - `parameters`: JSON Schema `{ type: 'object', properties, required }`。Gemini にも渡るので `ToolSchemaConverter` が扱える型だけ使う
   - `async execute(params, context)`: 必ず `{ success: boolean, ..., error?: string }` を返す。内部で try/catch し、throw しない。`context.container` にチャットの応答本文要素が入るので、進捗カードを出したいツールはそこに append する（`codexTaskTool.js` が例）
   - 戻り値に `type: 'file'`（`blob` `filename` `mimeType`）か `type: 'image'`（`dataUrl`）を含めると、`chatActions.js#displayToolResult` がダウンロードカード / プレビューを自動で出す。それ以外はモデルにだけ返る
   - シングルトン定型と、末尾の `window.XxxTool = XxxTool;`
2. **マネージャーに登録**: `js/core/tools/toolManager.js` の `#registerAgentTools()` にあるクラス名の配列に `'XxxTool'` を足す。`window.XxxTool` が未定義なら黙ってスキップされる
3. **表示名と分類**: `js/core/config.js` の `TOOLS.DISPLAY_NAMES`（思考過程の「○○を実行中」に出る）と `TOOLS.CATEGORIES`（`generate` / `info` / `exec` / `workspace`）に `name` を足す。ホスト OS のファイルやコマンドに触るツールは `TOOLS.DEFAULT_DISABLED` にも入れて、既定では無効にする
4. **スクリプトを読み込む**: `app/public/index.html` の `<!-- 情報取得・実行系ツール -->` ブロックに `<script>` を足す。`toolManager.js` より前ならどこでもよい（参照は `initialize()` 時）
5. **サーバー側が要る場合**: 外部 API を叩くなら `app/server/index.js` に `app.post('/xxx-proxy', ...)` を追加する。手順は chatbot-api の `references/server-proxy-setup.md`。ワークスペースのファイル・コマンドが要るなら `server/codexRoutes.js` の `/api/workspace/*` を使う
6. UI 側の作業は不要。`modals/toolSettings/toolSettingsModal.js` が `ToolManager.getAllTools()` から一覧を自動生成する

## 動作確認

1. `cd app && npm start` でサーバーを起動し http://localhost:50000 を開く
2. ブラウザコンソールの `[ToolManager] 初期化完了: N 個登録` の N が 1 増え、`Uncaught ReferenceError` が無い
3. 設定 → 高度な機能 → ツール設定の一覧に新ツールが出て、有効/無効を切り替えて保存できる（保存先は localStorage `tool_settings`）
4. 対応モデルを選び、ツールを使いたくなる依頼を送る。思考過程に「{表示名}を実行中...」→「{表示名}完了」が出て、モデルが結果を踏まえて答える
5. `execute` に不正パラメータを渡したとき `{ success: false, error }` が返り、モデルがエラー内容を受け取って会話が続く（例外で止まらない）

## 参照ファイル

| ファイル | 読むタイミング |
| --- | --- |
| `references/tool-template.md` | 手順 1 でクラスを書くとき。雛形、登録差分、既存ツールの役割表 |
