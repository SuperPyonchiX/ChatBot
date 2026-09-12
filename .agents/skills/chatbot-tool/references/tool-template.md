# ツール雛形

`app/public/js/core/tools/builtin/urlFetchTool.js` を骨格化したもの。`{Xxx}` `{snake_name}` を置き換える。

## ツールクラス

```javascript
/**
 * {xxx}Tool.js
 * {ツールの1行説明}
 */

/**
 * @typedef {Object} {Xxx}Result
 * @property {boolean} success - 成功したかどうか
 * @property {*} [result] - 実行結果
 * @property {string} [error] - エラーメッセージ
 */

class {Xxx}Tool {
    static #instance = null;

    /** @type {string} */
    name = '{snake_name}';

    /** @type {string} */
    description = '{モデルがいつ使うか判断できる説明。何を入れると何が返るか}';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: '{パラメータの説明。例も書く}'
            }
        },
        required: ['query']
    };

    constructor() {
        if ({Xxx}Tool.#instance) {
            return {Xxx}Tool.#instance;
        }
        {Xxx}Tool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {{Xxx}Tool}
     */
    static get getInstance() {
        if (!{Xxx}Tool.#instance) {
            {Xxx}Tool.#instance = new {Xxx}Tool();
        }
        return {Xxx}Tool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params - パラメータ
     * @param {string} params.query - {説明}
     * @param {Object} [context] - 実行コンテキスト（container: 応答本文の要素。進捗 UI を出すときに使う）
     * @returns {Promise<{Xxx}Result>}
     */
    async execute(params, context = {}) {
        const { query } = params || {};

        if (!query || typeof query !== 'string') {
            return { success: false, error: 'query が指定されていません' };
        }

        try {
            const result = await this.#run(query);
            return { success: true, result };
        } catch (error) {
            console.error('[{Xxx}Tool] 実行エラー:', error);
            return { success: false, error: `実行エラー: ${error.message}` };
        }
    }

    /**
     * @param {string} query
     * @returns {Promise<*>}
     */
    async #run(query) {
        // 本体
    }
}

// グローバルに公開
window.{Xxx}Tool = {Xxx}Tool;
```

ファイルを返すツールは `{ success: true, type: 'file', blob, filename, mimeType, size }` を返す。`chatActions.js#displayToolResult` がダウンロードカードを出し、モデルにはファイル名とサイズだけが返る。

## 登録差分

### 1. `js/core/tools/toolManager.js`

`#registerAgentTools()` のクラス名配列に追加:

```javascript
const classes = [
    'WebSearchTool', 'UrlFetchTool', 'RagSearchTool', 'CalculatorTool',
    'CodeExecuteTool', 'CodexTaskTool', 'FileWriteTool', 'ShellExecuteTool',
    '{Xxx}Tool'
];
```

### 2. `js/core/config.js`

```javascript
TOOLS: {
    // ホスト OS に触るツールだけ
    DEFAULT_DISABLED: ['codex_task', 'file_write', 'shell_execute', '{snake_name}'],
    DISPLAY_NAMES: {
        ...,
        {snake_name}: '{表示名}'
    },
    CATEGORIES: {
        ...,
        {snake_name}: 'info'   // generate / info / exec / workspace
    },
```

### 3. `index.html`

```html
<!-- 情報取得・実行系ツール（モデルが必要に応じて呼ぶ） -->
<script src="js/core/tools/builtin/webSearchTool.js"></script>
...
<script src="js/core/tools/builtin/{xxx}Tool.js"></script>
<!-- カスタムツール（ユーザー定義） -->
```

## 既存ツールの役割（重複を避けるため）

| name | ファイル | 分類 | 役割 |
| --- | --- | --- | --- |
| `generate_powerpoint` | executors/PowerPointGenerator.js | generate | PPTX 生成（inline スキーマ、歴史的形式） |
| `process_excel` | executors/ExcelProcessor.js | generate | XLSX 生成・分析 |
| `render_canvas` | executors/CanvasRenderer.js | generate | PNG 描画 |
| `web_search` | builtin/webSearchTool.js | info | プロバイダ組み込み Web 検索（Responses API / Claude）をラップ |
| `url_fetch` | builtin/urlFetchTool.js | info | URL 取得（`/api/fetch-url` 経由） |
| `rag_search` | builtin/ragSearchTool.js | info | ナレッジベース検索 |
| `calculator` | builtin/calculatorTool.js | exec | 数式評価・単位変換 |
| `code_execute` | builtin/codeExecuteTool.js | exec | コード実行（CodeExecutor 経由） |
| `codex_task` | builtin/codexTaskTool.js | workspace | Codex CLI をサブエージェントとして起動（`CodexClient` 経由、並列可）。既定無効 |
| `file_write` | builtin/fileWriteTool.js | workspace | ワークスペースへ書き込み（`POST /api/workspace/file`）。既定無効 |
| `shell_execute` | builtin/shellExecuteTool.js | workspace | ワークスペースでコマンド実行（`POST /api/workspace/exec`）。既定無効 |
| （カスタム） | custom/customToolStorage.js + customToolExecutor.js | custom | ユーザーがツール設定モーダルから作る JavaScript ツール。`ToolManager#registerCustomTools()` が自動登録 |
