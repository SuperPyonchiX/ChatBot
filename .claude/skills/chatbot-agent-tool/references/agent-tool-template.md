# エージェントツール雛形

`app/public/js/core/agent/tools/calculatorTool.js` を骨格化したもの。`{Xxx}` `{snake_name}` を置き換える。

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
    description = '{LLM とユーザーに見せる説明。何を入れると何が返るか}';

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

    /** @type {string[]} */
    keywords = ['{日本語キーワード}', '{english keyword}'];

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
     * @returns {Promise<{Xxx}Result>}
     */
    async execute(params) {
        const { query } = params;

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

    /**
     * ツール定義を取得（Function Calling用）
     * @returns {Object}
     */
    getToolDefinition() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
}

// グローバルに公開
window.{Xxx}Tool = {Xxx}Tool;
```

## 登録差分

### 1. `js/core/agent/tools/agentToolManager.js`

`#registerBuiltInTools()` の既存ブロックの並びに追加:

```javascript
if (window.{Xxx}Tool) {
    this.registerTool({Xxx}Tool.getInstance);
}
```

`#categorizeTools()` の該当配列に `'{snake_name}'` を追加:

```javascript
if (['url_fetch', 'rag_search', 'file_read', '{snake_name}'].includes(name)) {
    categories.information.push(name);
}
```

### 2. `js/core/agent/agentToolSelector.js`

`#categoryKeywords` の該当カテゴリ（search / code / data / interaction / web / knowledge）に追加。カテゴリが合わなければ新カテゴリを足してよい:

```javascript
search: {
    keywords: [...],
    tools: ['web_search', 'rag_search', '{snake_name}']
},
```

### 3. `js/core/config.js`

```javascript
AGENT: {
    TOOLS: {
        BUILTIN: ['web_search', 'calculator', 'url_fetch', 'text_analyzer', 'rag_search', 'code_execute', 'file_read', 'ask_user', '{snake_name}'],
```

### 4. `index.html`

```html
<!-- エージェントツール -->
<script src="js/core/agent/tools/calculatorTool.js"></script>
...
<script src="js/core/agent/tools/{xxx}Tool.js"></script>
<!-- カスタムツール関連 -->
```

## 既存ツールの役割（重複を避けるため）

| name | ファイル | 役割 |
| --- | --- | --- |
| `web_search` | webSearchTool.js | プロバイダ組み込みWeb検索（Responses API / Claude）をラップ |
| `calculator` | calculatorTool.js | 数式評価・単位変換 |
| `url_fetch` | urlFetchTool.js | URL 取得（サーバープロキシ経由） |
| `text_analyzer` | textAnalyzerTool.js | テキスト統計・要約補助 |
| `rag_search` | ragSearchTool.js | ナレッジベース検索 |
| `code_execute` | codeExecuteTool.js | コード実行（CodeExecutor 経由） |
| `file_read` | fileReadTool.js | 添付・保存ファイルの読み取り |
| `codex_task` | codexTaskTool.js | Codex CLI をサブエージェントとして起動（`CodexClient` 経由、並列可） |
| `file_write` | fileWriteTool.js | サーバー側ワークスペースへ書き込み（`POST /api/workspace/file`） |
| `shell_execute` | shellExecuteTool.js | ワークスペースでコマンド実行（`POST /api/workspace/exec`） |
| `ask_user` | agentToolManager.js 内に直書き | ユーザーへの質問（askUserDialog） |
