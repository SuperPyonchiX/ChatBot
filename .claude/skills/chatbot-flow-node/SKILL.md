---
name: chatbot-flow-node
description: ChatBotプロジェクトのワークフロービルダー（`js/core/workflow/nodeRegistry.js`）またはチャットフロービルダー（`js/core/chatflow/chatFlowNodes.js`）にノードタイプを追加する工程スキル。最初にどちらの系か判定し、それぞれの登録API・ポート/プロパティの形・execute の戻り値契約・パレットのカテゴリ・プロパティパネルが描画できる型に合わせて実装し、ビルダーで配置と実行を確認する。「ワークフローに○○ノードを追加して」「チャットフローに△△ノードが欲しい」「ノードタイプを増やして」「フロービルダーのノードを作って」で使う。エージェントのツールは chatbot-agent-tool。
---

# フロービルダーのノード追加

## 1. 系統を判定する

ワークフローとチャットフローは名前が似ているが **完全に別の実装** で、登録 API も execute の契約も違う。依頼文に「ワークフロー」「チャットフロー」のどちらが出ているか、出ていなければどのモーダル（ワークフロービルダー / チャットフロービルダー）で使いたいかを確認してから進む。

| | ワークフロー | チャットフロー |
| --- | --- | --- |
| 用途 | DAG を一括実行し最終結果を得る | 会話の中で逐次遷移し、質問→回答を繰り返す |
| レジストリ | `js/core/workflow/nodeRegistry.js` `NodeRegistry.register({...})` | `js/core/chatflow/chatFlowNodes.js` `ChatFlowNodes.registerNode(type, {...})` |
| エンジン | `workflowEngine.js` | `chatFlowEngine.js` + `chatFlowSession.js` |
| ビルダー | `modals/workflowBuilder/` + `components/workflow/` | `modals/chatFlowBuilder/chatFlowBuilderModal.js` 単体 |
| ports の形 | オブジェクト `{ out: { type, label, optional } }` | 配列 `[{ id, name }]` |
| properties の形 | オブジェクト `{ key: { type, label, default, ... } }` | 配列 `[{ name, label, type, default }]` |
| execute | `async (inputs, properties, context) => ({ portName: value })` | `async (node, context) => ({ output, result?, waitForInput?, completed? })` |
| カテゴリ | `NodeRegistry.#categories`（control / ai / process / data）固定 | `chatFlowBuilderModal.js` の `categoryLabels`（control / ai / input / output / process）。未定義でも表示はされる |
| プロパティ UI | `components/workflow/propertiesPanel.js`: text / number / textarea / code / select / checkbox / object | `chatFlowBuilderModal.js` `#renderPropertyInput()`: text / textarea / code / number / checkbox / model-select |
| 変数展開 | ノード内で自前置換 | `engine.interpolateVariables(template, session, input)` / `engine.evaluateCondition()` |

どちらもビルトインノードはレジストリファイル内に直書き。`js/core/workflow/nodes/` は空ディレクトリで未使用。

## 2. 手順（共通）

1. 判定した系の references を読む
   - ワークフロー: `references/workflow-node.md`
   - チャットフロー: `references/chatflow-node.md`
2. レジストリファイルの `#registerBuiltInNodes()` 相当の末尾に、既存ノードと同じ形で `register` 呼び出しを追加する。新規ファイルは作らない（読み込み順の追加が不要になる）
3. `properties` の `type` は、その系のプロパティ UI が描画できる型だけを使う
4. `execute` の戻り値契約を守る。ワークフローは outputs のポート名をキーにしたオブジェクト、チャットフローは `output` に次のポート id
5. カテゴリは既存から選ぶ。新カテゴリが要るなら、ワークフローは `#categories`、チャットフローは `categoryLabels` に追記する
6. 設定値は `window.CONFIG.WORKFLOW` / `window.CONFIG.CHATFLOW` 配下に追加する

## 3. 動作確認

1. `cd app && npm start` → 対象ビルダーを開く
2. パレットの該当カテゴリに新ノードが出る（アイコン・色・名前）
3. キャンバスへドラッグして配置し、プロパティパネルに全項目が出て編集できる
4. `start` → 新ノード → `end`（チャットフローは `answer`）を接続して実行する
5. コンソールに `[NodeRegistry]` / `[WorkflowEngine]` / `[ChatFlowEngine]` のエラーが無い
6. 保存して再読み込み後もノードとプロパティが復元される（`workflowStorage.js` / `chatFlowStorage.js`）

## 参照ファイル

| ファイル | 読むタイミング |
| --- | --- |
| `references/workflow-node.md` | ワークフローに追加すると判定したとき |
| `references/chatflow-node.md` | チャットフローに追加すると判定したとき |
