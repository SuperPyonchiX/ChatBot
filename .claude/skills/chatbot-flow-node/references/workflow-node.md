# ワークフローノードの追加

対象: `app/public/js/core/workflow/nodeRegistry.js`

## 登録の完全例

`http` ノード（同ファイル内）を短くしたもの。`#registerBuiltInNodes()` の末尾、`console.log('[NodeRegistry] ...')` の前に追加する。

```javascript
this.register({
    type: 'delay',                 // 一意な id。保存データに残るので後から変えない
    name: '遅延',                  // パレット表示名
    category: 'process',           // control | ai | process | data
    icon: '⏱️',
    color: '#9E9E9E',
    inputs: {
        value: { type: 'any', label: '入力', optional: true }
    },
    outputs: {
        value: { type: 'any', label: '出力' }
    },
    properties: {
        ms: {
            type: 'number',
            label: '待機時間（ms）',
            default: 1000,
            min: 0,
            max: 60000,
            step: 100
        },
        note: {
            type: 'text',
            label: 'メモ',
            default: '',
            placeholder: '任意'
        }
    },
    execute: async (inputs, properties, context) => {
        await new Promise((resolve, reject) => {
            const id = setTimeout(resolve, properties.ms);
            context.signal?.addEventListener('abort', () => {
                clearTimeout(id);
                reject(new Error('中断されました'));
            });
        });
        return { value: inputs.value };
    }
});
```

## 契約

| 項目 | 内容 |
| --- | --- |
| `register()` の必須 | `type` と `name`。`inputs` / `outputs` / `properties` は省略時 `{}` |
| `inputs` / `outputs` | キーがポート名。`type` は表示用（`any` / `string` / `number` / `object` など）で実行時の型検査はしない。`optional: true` の入力は未接続でも実行される |
| `properties` | キーがプロパティ名。`createNode()` が各 `default` を初期値として複製する。`default` は必ず書く |
| `execute(inputs, properties, context)` | `inputs` は接続元ノードの出力（ポート名キー）。戻り値は **outputs のポート名をキーにしたオブジェクト**。throw するとワークフロー全体が失敗扱い |
| `context` | `{ workflowId, executionId, nodeId, variables, signal }`。`signal` は AbortSignal、長い処理では監視する |
| `end` ノード | `{ _final: value }` を返し、エンジンはこれを実行結果にする。新ノードで最終値を返す場合も同じ形 |

## プロパティ UI が描画できる型（`components/workflow/propertiesPanel.js`）

| `type` | 使う追加キー | 備考 |
| --- | --- | --- |
| `text` | `placeholder` | |
| `number` | `min` `max` `step` | |
| `textarea` | `placeholder` | |
| `code` | | 等幅表示 |
| `select` | `options: string[]` | キー名が `model` のときは `options` を無視して利用可能モデル一覧に差し替わる |
| `checkbox` | | boolean |
| `object` | | JSON テキストとして編集。parse 失敗時は保存しない |

`description` を書くとラベル下に補足が出る。

## カテゴリ

`NodeRegistry.#categories` に固定。追加するときは `order` も指定する。

```javascript
#categories = {
    control: { name: 'コントロール', icon: '🎛️', order: 1 },
    ai:      { name: 'AI',           icon: '🤖', order: 2 },
    process: { name: '処理',         icon: '⚙️', order: 3 },
    data:    { name: 'データ',       icon: '📊', order: 4 }
};
```

## 既存ノード

| type | category | 役割 |
| --- | --- | --- |
| `start` / `end` | control | 入口・出口。`end` が `_final` を返す |
| `condition` | control | 条件分岐。`true` / `false` の2出力 |
| `llm` | ai | AIAPI 呼び出し。`model` プロパティは動的 select |
| `knowledge` | ai | RAG 検索 |
| `template` | process | `{{input}}` 置換 |
| `code` | process | JavaScript 実行 |
| `http` | data | fetch。サーバーの `/api/fetch-url` プロキシ経由 |

## 実行モデル

DAG。全入力接続元が完了したノードから順に実行し、`end` に到達したら終了。ループは作れない。会話とは独立しており、ユーザー入力待ちの概念は無い（それが要るならチャットフロー）。
