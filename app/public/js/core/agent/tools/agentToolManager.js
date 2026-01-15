/**
 * agentToolManager.js
 * エージェントツールの統合管理
 * 全ツールの登録、取得、実行を一元管理
 */

/**
 * @typedef {Object} ToolInstance
 * @property {string} name - ツール名
 * @property {string} description - 説明
 * @property {Object} parameters - パラメータスキーマ
 * @property {string[]} keywords - キーワード
 * @property {Function} execute - 実行関数
 * @property {Function} getToolDefinition - ツール定義取得
 */

class AgentToolManager {
    static #instance = null;

    /** @type {Map<string, ToolInstance>} */
    #tools = new Map();

    /** @type {boolean} */
    #initialized = false;

    /**
     * @constructor
     */
    constructor() {
        if (AgentToolManager.#instance) {
            return AgentToolManager.#instance;
        }
        AgentToolManager.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {AgentToolManager}
     */
    static get getInstance() {
        if (!AgentToolManager.#instance) {
            AgentToolManager.#instance = new AgentToolManager();
        }
        return AgentToolManager.#instance;
    }

    /**
     * 初期化（ビルトインツールを登録）
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) {
            return;
        }

        console.log('[AgentToolManager] 初期化開始');

        // ビルトインツールを登録
        this.#registerBuiltInTools();

        this.#initialized = true;
        console.log(`[AgentToolManager] 初期化完了: ${this.#tools.size}個のツール登録`);
    }

    /**
     * ビルトインツールを登録
     */
    #registerBuiltInTools() {
        // Calculator
        if (window.CalculatorTool) {
            this.registerTool(CalculatorTool.getInstance);
        }

        // URL Fetch
        if (window.UrlFetchTool) {
            this.registerTool(UrlFetchTool.getInstance);
        }

        // Text Analyzer
        if (window.TextAnalyzerTool) {
            this.registerTool(TextAnalyzerTool.getInstance);
        }

        // RAG Search
        if (window.RagSearchTool) {
            this.registerTool(RagSearchTool.getInstance);
        }

        // Code Execute
        if (window.CodeExecuteTool) {
            this.registerTool(CodeExecuteTool.getInstance);
        }

        // File Read
        if (window.FileReadTool) {
            this.registerTool(FileReadTool.getInstance);
        }

        // ask_user ツール（組み込み）
        this.registerTool({
            name: 'ask_user',
            description: 'ユーザーに質問して追加情報を取得します。不明点や確認が必要な場合に使用します。',
            parameters: {
                type: 'object',
                properties: {
                    question: {
                        type: 'string',
                        description: 'ユーザーへの質問'
                    }
                },
                required: ['question']
            },
            keywords: ['質問', '確認', '聞く', 'ask', 'question', 'clarify'],
            execute: async (params) => {
                return {
                    success: true,
                    needsUserInput: true,
                    question: params.question
                };
            },
            getToolDefinition: function() {
                return {
                    name: this.name,
                    description: this.description,
                    parameters: this.parameters
                };
            }
        });
    }

    /**
     * ツールを登録
     * @param {ToolInstance} tool - ツールインスタンス
     */
    registerTool(tool) {
        if (!tool || !tool.name) {
            console.error('[AgentToolManager] 無効なツール:', tool);
            return;
        }

        this.#tools.set(tool.name, tool);
        console.log(`[AgentToolManager] ツール登録: ${tool.name}`);
    }

    /**
     * ツールを登録解除
     * @param {string} name - ツール名
     */
    unregisterTool(name) {
        if (this.#tools.delete(name)) {
            console.log(`[AgentToolManager] ツール登録解除: ${name}`);
        }
    }

    /**
     * ツールを取得
     * @param {string} name - ツール名
     * @returns {ToolInstance|null}
     */
    getTool(name) {
        return this.#tools.get(name) || null;
    }

    /**
     * 全ツールを取得
     * @returns {ToolInstance[]}
     */
    getAllTools() {
        return Array.from(this.#tools.values());
    }

    /**
     * ツール名一覧を取得
     * @returns {string[]}
     */
    getToolNames() {
        return Array.from(this.#tools.keys());
    }

    /**
     * ツールを実行
     * @param {string} name - ツール名
     * @param {Object} params - パラメータ
     * @returns {Promise<Object>}
     */
    async executeTool(name, params) {
        const tool = this.#tools.get(name);

        if (!tool) {
            return {
                success: false,
                error: `ツールが見つかりません: ${name}`
            };
        }

        try {
            console.log(`[AgentToolManager] ツール実行: ${name}`, params);
            const result = await tool.execute(params);
            console.log(`[AgentToolManager] ツール完了: ${name}`, result);
            return result;
        } catch (error) {
            console.error(`[AgentToolManager] ツール実行エラー: ${name}`, error);
            return {
                success: false,
                error: `ツール実行エラー: ${error.message}`
            };
        }
    }

    /**
     * Function Calling用のツール定義を取得
     * @param {string[]} [toolNames] - 取得するツール名（省略時は全ツール）
     * @returns {Array}
     */
    getToolDefinitions(toolNames) {
        const tools = toolNames
            ? toolNames.map(name => this.#tools.get(name)).filter(Boolean)
            : this.getAllTools();

        return tools.map(tool => {
            if (tool.getToolDefinition) {
                return tool.getToolDefinition();
            }
            return {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            };
        });
    }

    /**
     * OpenAI Function Calling形式でツール定義を取得
     * @param {string[]} [toolNames]
     * @returns {Array}
     */
    getToolDefinitionsForOpenAI(toolNames) {
        const definitions = this.getToolDefinitions(toolNames);

        return definitions.map(def => ({
            type: 'function',
            function: {
                name: def.name,
                description: def.description,
                parameters: def.parameters
            }
        }));
    }

    /**
     * Claude Tool Use形式でツール定義を取得
     * @param {string[]} [toolNames]
     * @returns {Array}
     */
    getToolDefinitionsForClaude(toolNames) {
        const definitions = this.getToolDefinitions(toolNames);

        return definitions.map(def => ({
            name: def.name,
            description: def.description,
            input_schema: def.parameters
        }));
    }

    /**
     * タスクに適したツールを選択
     * @param {string} task - タスク説明
     * @param {Object} [options] - オプション
     * @returns {ToolInstance[]}
     */
    selectToolsForTask(task, options = {}) {
        const toolSelector = window.AgentToolSelector?.getInstance;

        if (toolSelector) {
            // AgentToolSelectorを使用して選択
            return toolSelector.selectTools(task, this.getAllTools(), options);
        }

        // フォールバック: 全ツールを返す
        return this.getAllTools();
    }

    /**
     * ツールの統計情報を取得
     * @returns {Object}
     */
    getStats() {
        const tools = this.getAllTools();

        return {
            totalTools: tools.length,
            toolNames: tools.map(t => t.name),
            initialized: this.#initialized,
            categories: this.#categorizeTools(tools)
        };
    }

    /**
     * ツールをカテゴリ分け
     * @param {ToolInstance[]} tools
     * @returns {Object}
     */
    #categorizeTools(tools) {
        const categories = {
            information: [],  // 情報取得
            processing: [],   // データ処理
            execution: [],    // コード実行
            interaction: []   // ユーザー対話
        };

        for (const tool of tools) {
            const name = tool.name;

            if (['url_fetch', 'rag_search', 'file_read'].includes(name)) {
                categories.information.push(name);
            } else if (['calculator', 'text_analyzer'].includes(name)) {
                categories.processing.push(name);
            } else if (['code_execute'].includes(name)) {
                categories.execution.push(name);
            } else if (['ask_user'].includes(name)) {
                categories.interaction.push(name);
            }
        }

        return categories;
    }

    /**
     * 初期化が完了するまで待機
     * @returns {Promise<void>}
     */
    async waitForInitialization() {
        while (!this.#initialized) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}

// グローバルに公開
window.AgentToolManager = AgentToolManager;
