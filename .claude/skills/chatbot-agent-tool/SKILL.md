---
name: chatbot-agent-tool
description: ChatBotプロジェクトのエージェント機能にビルトインツールを追加する工程スキル。`js/core/agent/tools/{name}Tool.js` の自己完結シングルトン（name/description/parameters/keywords/execute/getToolDefinition）を作り、`agentToolManager.js` の `#registerBuiltInTools()`、`agentToolSelector.js` のカテゴリ表、`config.js` の `AGENT.TOOLS.BUILTIN`、index.html の「エージェントツール」ブロックに登録して、エージェント設定モーダルで確認するところまで行う。「エージェントに○○ツールを追加して」「エージェントが△△できるようにして」「ビルトインツールを増やして」で使う。通常チャットの Function Calling 用ツール（Excel/PowerPoint/Canvas 生成の系統、`js/core/tools/`）を足す場合もこのスキルの「チャットツール」節を使う。フロービルダーのノード追加は chatbot-flow-node、AIプロバイダの追加は chatbot-api。
---

# エージェントツール追加

最初に **どちらの系統か** を決める。両者はレジストリもスキーマ定義も別で、片方に登録してももう片方には現れない。

| 系統 | 使う場面 | 登録先 | 手順 |
| --- | --- | --- | --- |
| エージェントツール | エージェントモード（ReAct / Function Calling ループ）で使う道具。`calculator` `rag_search` `ask_user` など | `js/core/agent/tools/agentToolManager.js` | 本文 A |
| チャットツール | 通常チャットの Function Calling で成果物を生成する。`generate_powerpoint` `process_excel` `render_canvas` | `js/core/tools/toolRegistry.js` | `references/chat-tool-registration.md` |

迷ったら「エージェント設定モーダルのツール一覧に出したいか」で判断する。出したいならエージェントツール。

## A. エージェントツールの追加手順

基底クラスは無い。`agentToolManager.js` 冒頭の `@typedef ToolInstance` を満たす自己完結シングルトンをダックタイピングで書く。雛形は `references/agent-tool-template.md`。

1. **ツールクラスを作る**: `app/public/js/core/agent/tools/{camel}Tool.js`。`calculatorTool.js` を手本に、次を必ず持たせる
   - `name`: snake_case。LLM に渡る関数名で、以降の登録はすべてこの文字列で行う
   - `description`: エージェント設定モーダルの一覧にそのまま表示される
   - `parameters`: JSON Schema `{ type: 'object', properties, required }`
   - `keywords`: string[]。`AgentToolSelector` の自動選択が参照する
   - `async execute(params)`: 必ず `{ success: boolean, ..., error?: string }` を返す。内部で try/catch し、throw しない
   - `getToolDefinition()`: `{ name, description, parameters }` を返す
   - シングルトン定型と、末尾の `window.XxxTool = XxxTool;`
2. **マネージャーに登録**: `agentToolManager.js` の `#registerBuiltInTools()` に既存と同じガード付きで追加
   ```javascript
   if (window.XxxTool) {
       this.registerTool(XxxTool.getInstance);
   }
   ```
   同ファイルの `#categorizeTools()` にある `information / processing / execution / interaction` のうち該当する配列に `name` を足す（統計表示用）。
3. **自動選択の対象にする**: `js/core/agent/agentToolSelector.js` の `#categoryKeywords` で、該当カテゴリの `tools` 配列に `name` を足す。ここに無いと `AUTO_SELECT` 時に選ばれにくい。
4. **既定の有効ツールに入れる**: `js/core/config.js` の `AGENT.TOOLS.BUILTIN` 配列に `name` を足す。localStorage に設定が無い初回起動時はこの配列が有効ツールになる。ツール固有の設定値は `AGENT` 配下に追加する（例: `AGENT.CUSTOM_TOOLS`）。
5. **スクリプトを読み込む**: `app/public/index.html` の `<!-- エージェントツール -->` ブロック内に `<script>` を足す。`agentToolManager.js` より前に置く。
6. **サーバー側が要る場合**: 外部 API を叩くなら `app/server/index.js` に `app.post('/xxx-proxy', ...)` を追加する。書き方は `/confluence-proxy` が最新例。手順は chatbot-api の `references/server-proxy-setup.md`。
7. UI 側の作業は不要。`modals/agentSettings/agentSettingsModal.js` が `getAllTools()` を回して一覧を自動生成する。

## 動作確認

1. `cd app && npm start` でサーバーを起動し http://localhost:50000 を開く
2. ブラウザコンソールに `[AgentToolManager] ツール登録: {name}` が出る
3. エージェント設定モーダルのツール一覧に新ツールが出て、有効化できる
4. エージェントモードで `keywords` に含めた語を使った依頼を出し、ツールが呼ばれてコンソールに `[XxxTool]` ログが出る
5. `execute` に不正パラメータを渡したとき `{ success: false, error }` が返り、ループが止まらない

## 参照ファイル

| ファイル | 読むタイミング |
| --- | --- |
| `references/agent-tool-template.md` | 手順 A-1 でクラスを書くとき。雛形と登録差分3箇所のコード片 |
| `references/chat-tool-registration.md` | チャットツール系統（`js/core/tools/`）に追加するとき |
