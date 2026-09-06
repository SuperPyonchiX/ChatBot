# チャットフローノードの追加

対象: `app/public/js/core/chatflow/chatFlowNodes.js`

## 登録の完全例

`question` ノード（同ファイル内）を手本にしたもの。`#registerBuiltInNodes()` 相当の末尾に追加する。

```javascript
this.registerNode('confirm', {
    name: '確認',
    category: 'input',              // control | ai | input | output | process
    icon: '✅',
    color: '#ff9800',
    inputs: [{ id: 'input', name: '入力' }],
    outputs: [
        { id: 'yes', name: 'はい' },
        { id: 'no',  name: 'いいえ' }
    ],
    properties: [
        { name: 'message',      label: '確認メッセージ', type: 'textarea', default: '続けますか？' },
        { name: 'variableName', label: '保存先変数名',   type: 'text',     default: 'confirmed' }
    ],
    execute: async (node, context) => {
        const { input, session, engine } = context;

        // 1回目: 質問を出して入力待ちにする
        if (session.currentNodeId !== node.id) {
            engine.emit('output', {
                type: 'question',
                content: engine.interpolateVariables(node.properties.message, session, input),
                options: ['はい', 'いいえ']
            });
            await ChatFlowSession.getInstance.setStatus(session.sessionId, 'waiting_for_input');
            await ChatFlowSession.getInstance.setCurrentNode(session.sessionId, node.id);
            return { waitForInput: true, variableName: node.properties.variableName };
        }

        // 2回目: 回答で分岐
        const yes = /^(はい|y|yes)$/i.test(String(input).trim());
        return { output: yes ? 'yes' : 'no', result: input };
    }
});
```

## 契約

| 項目 | 内容 |
| --- | --- |
| `registerNode(type, definition)` | 検証なし。`type` は一意な id で保存データに残る |
| `inputs` / `outputs` | 配列。`id` が接続の識別子、`name` が表示名 |
| `properties` | 配列。`name` がキー、`default` が初期値。`node.properties[name]` で読む |
| `execute(node, context)` | `node.properties` にユーザー設定値。`context` は `{ input, session, engine }` |
| 戻り値 `output` | 次に進む **出力ポートの id**。エンジンはこの名前で接続を探す |
| 戻り値 `result` | 変数やログに残す値 |
| 戻り値 `waitForInput: true` | セッションを入力待ちにして中断。次のユーザー発言で同じノードの `execute` が再び呼ばれる（`input` に発言が入る）。`variableName` を添えると回答が `session.variables` に保存される |
| 戻り値 `completed: true` | フロー終了 |
| ユーザーへの表示 | `engine.emit('output', { type: 'message' \| 'question', content, options? })` |

## エンジンのヘルパー（`chatFlowEngine.js`）

| メソッド | 用途 |
| --- | --- |
| `interpolateVariables(template, session, input)` | `{{input}}` `{{変数名}}` `{{history}}` を置換 |
| `evaluateCondition(condition, session, input)` | 変数展開後に条件式を評価し boolean を返す |
| `emit(event, data)` / `on(event, cb)` | `output` イベントでチャット UI に表示 |
| `getSessionByConversationId(id)` | 会話に紐づく実行中セッション |

セッション状態の変更は `ChatFlowSession.getInstance` の `setStatus` / `setCurrentNode` / `setVariable` を使う。

## プロパティ UI が描画できる型（`modals/chatFlowBuilder/chatFlowBuilderModal.js` `#renderPropertyInput()`）

| `type` | 備考 |
| --- | --- |
| `text` | |
| `textarea` | |
| `code` | 等幅 |
| `number` | `min` `max` |
| `checkbox` | boolean |
| `model-select` | 利用可能モデル一覧の select |

`select`（任意の選択肢）は未対応。選択肢が要るなら `textarea` に改行区切りで入れる（`question` ノードの `options` と同じ）か、`#renderPropertyInput()` に型を足す。

## カテゴリ

パレットは `chatFlowBuilderModal.js` の `categoryLabels` でラベルを引く。未定義カテゴリはキー名がそのまま表示される。

```javascript
const categoryLabels = {
    control: '制御',
    ai: 'AI',
    input: '入力',
    output: '出力',
    process: '処理'
};
```

## 既存ノード

| type | category | 役割 |
| --- | --- | --- |
| `start` / `end` | control | 入口・出口 |
| `condition` | control | `evaluateCondition` で `true` / `false` に分岐 |
| `llm` | ai | AIAPI 呼び出し。`includeHistory` で `session.messageHistory` を付ける |
| `answer` | output | ユーザーへメッセージ表示 |
| `question` | input | 質問して入力待ち |
| `template` | process | 変数展開した文字列を作る |
| `code` | process | JavaScript 実行 |

## 実行モデル

単線の逐次遷移。1ノードずつ `execute` し、`output` の id で次の接続先を1つ選ぶ。`waitForInput` で会話に制御を返し、次の発言で再開する。並列実行は無い。
