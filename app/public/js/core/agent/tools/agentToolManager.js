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

    /** @type {Set<string>} */
    #enabledTools = new Set();

    /** @type {Set<string>} */
    #builtinToolNames = new Set();

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
     * 初期化（ビルトイン + カスタムツールを登録）
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) {
            return;
        }

        console.log('[AgentToolManager] 初期化開始');

        // ビルトインツールを登録
        this.#registerBuiltInTools();

        // カスタムツールを読み込み
        await this.#loadCustomTools();

        // 有効ツール設定を読み込み
        this.#loadEnabledToolsConfig();

        this.#initialized = true;
        console.log(`[AgentToolManager] 初期化完了: ${this.#tools.size}個のツール登録（ビルトイン: ${this.#builtinToolNames.size}, カスタム: ${this.#tools.size - this.#builtinToolNames.size}）`);
    }

    /**
     * カスタムツールを読み込み
     * @returns {Promise<void>}
     */
    async #loadCustomTools() {
        const config = window.CONFIG?.AGENT?.CUSTOM_TOOLS;
        if (!config?.ENABLED) {
            console.log('[AgentToolManager] カスタムツールは無効');
            return;
        }

        try {
            // CustomToolStorageの初期化
            if (window.CustomToolStorage) {
                await CustomToolStorage.getInstance.initialize();
                const customTools = await CustomToolStorage.getInstance.getAll({ enabledOnly: true });

                for (const tool of customTools) {
                    this.#registerCustomTool(tool);
                }

                console.log(`[AgentToolManager] ${customTools.length}個のカスタムツールを読み込み`);
            }
        } catch (error) {
            console.error('[AgentToolManager] カスタムツール読み込みエラー:', error);
        }
    }

    /**
     * カスタムツールを登録
     * @param {Object} toolDefinition
     */
    #registerCustomTool(toolDefinition) {
        const toolInstance = {
            name: toolDefinition.name,
            description: toolDefinition.description,
            parameters: toolDefinition.parameters,
            keywords: toolDefinition.keywords || [],
            isCustom: true,
            execute: async (params) => {
                if (window.CustomToolExecutor) {
                    return await CustomToolExecutor.getInstance.execute(toolDefinition, params);
                }
                return {
                    success: false,
                    error: 'CustomToolExecutorが利用できません'
                };
            },
            getToolDefinition: function() {
                return {
                    name: this.name,
                    description: this.description,
                    parameters: this.parameters
                };
            }
        };

        this.registerTool(toolInstance);
    }

    /**
     * 有効ツール設定を読み込み
     */
    #loadEnabledToolsConfig() {
        try {
            const stored = localStorage.getItem('agent_settings');
            if (stored) {
                const settings = JSON.parse(stored);
                if (settings.enabledBuiltinTools) {
                    this.#enabledTools = new Set(settings.enabledBuiltinTools);
                    return;
                }
            }
        } catch (error) {
            console.warn('[AgentToolManager] 有効ツール設定読み込みエラー:', error);
        }

        // デフォルト: 全ツール有効
        this.#enabledTools = new Set(this.getToolNames());
    }

    /**
     * ビルトインツールを登録
     */
    #registerBuiltInTools() {
        // Calculator
        if (window.WebSearchTool) {
            this.registerTool(WebSearchTool.getInstance);
        }

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

        // Codex サブエージェント
        if (window.CodexTaskTool) {
            this.registerTool(CodexTaskTool.getInstance);
        }

        // File Write（ワークスペース）
        if (window.FileWriteTool) {
            this.registerTool(FileWriteTool.getInstance);
        }

        // Shell Execute（ワークスペース）
        if (window.ShellExecuteTool) {
            this.registerTool(ShellExecuteTool.getInstance);
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
     * @param {boolean} [isBuiltin=false] - ビルトインツールかどうか
     */
    registerTool(tool, isBuiltin = false) {
        if (!tool || !tool.name) {
            console.error('[AgentToolManager] 無効なツール:', tool);
            return;
        }

        this.#tools.set(tool.name, tool);

        // ビルトインツール名を記録
        if (isBuiltin || !tool.isCustom) {
            this.#builtinToolNames.add(tool.name);
        }

        // デフォルトで有効にする
        this.#enabledTools.add(tool.name);

        console.log(`[AgentToolManager] ツール登録: ${tool.name}${tool.isCustom ? ' (カスタム)' : ''}`);
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

            if (['web_search', 'url_fetch', 'rag_search', 'file_read'].includes(name)) {
                categories.information.push(name);
            } else if (['calculator', 'text_analyzer', 'file_write'].includes(name)) {
                categories.processing.push(name);
            } else if (['code_execute', 'codex_task', 'shell_execute'].includes(name)) {
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

    // ========================================
    // 有効ツール管理
    // ========================================

    /**
     * ツールが有効かどうか確認
     * @param {string} name - ツール名
     * @returns {boolean}
     */
    isToolEnabled(name) {
        return this.#enabledTools.has(name);
    }

    /**
     * 有効なツールのみを取得
     * @returns {ToolInstance[]}
     */
    getEnabledTools() {
        return this.getAllTools().filter(tool => this.#enabledTools.has(tool.name));
    }

    /**
     * 有効ツールを設定
     * @param {string[]} toolNames - 有効にするツール名の配列
     */
    setEnabledTools(toolNames) {
        this.#enabledTools = new Set(toolNames);
        console.log(`[AgentToolManager] 有効ツールを更新: ${toolNames.join(', ')}`);
    }

    /**
     * ツールの有効/無効を切り替え
     * @param {string} name - ツール名
     * @param {boolean} enabled - 有効/無効
     */
    setToolEnabled(name, enabled) {
        if (enabled) {
            this.#enabledTools.add(name);
        } else {
            this.#enabledTools.delete(name);
        }
    }

    /**
     * ビルトインツールかどうか確認
     * @param {string} name - ツール名
     * @returns {boolean}
     */
    isBuiltinTool(name) {
        return this.#builtinToolNames.has(name);
    }

    /**
     * ビルトインツール一覧を取得
     * @returns {ToolInstance[]}
     */
    getBuiltinTools() {
        return this.getAllTools().filter(tool => this.#builtinToolNames.has(tool.name));
    }

    /**
     * カスタムツール一覧を取得
     * @returns {ToolInstance[]}
     */
    getCustomTools() {
        return this.getAllTools().filter(tool => !this.#builtinToolNames.has(tool.name));
    }

    // ========================================
    // カスタムツール管理
    // ========================================

    /**
     * カスタムツールを再読み込み
     * @returns {Promise<void>}
     */
    async reloadCustomTools() {
        // 既存のカスタムツールを削除
        for (const tool of this.getCustomTools()) {
            this.unregisterTool(tool.name);
        }

        // カスタムツールを再読み込み
        await this.#loadCustomTools();

        console.log('[AgentToolManager] カスタムツールを再読み込みしました');
    }

    /**
     * カスタムツールを追加
     * @param {Object} toolDefinition - ツール定義
     * @returns {Promise<void>}
     */
    async addCustomTool(toolDefinition) {
        // ストレージに保存
        if (window.CustomToolStorage) {
            await CustomToolStorage.getInstance.save(toolDefinition);
        }

        // ツールマネージャーに登録
        this.#registerCustomTool(toolDefinition);

        console.log(`[AgentToolManager] カスタムツール追加: ${toolDefinition.name}`);
    }

    /**
     * カスタムツールを削除
     * @param {string} name - ツール名
     * @returns {Promise<boolean>}
     */
    async removeCustomTool(name) {
        const tool = this.getTool(name);
        if (!tool || this.isBuiltinTool(name)) {
            return false;
        }

        // ストレージから削除
        if (window.CustomToolStorage) {
            const stored = await CustomToolStorage.getInstance.getByName(name);
            if (stored) {
                await CustomToolStorage.getInstance.delete(stored.id);
            }
        }

        // ツールマネージャーから削除
        this.unregisterTool(name);

        console.log(`[AgentToolManager] カスタムツール削除: ${name}`);
        return true;
    }
}

// グローバルに公開
window.AgentToolManager = AgentToolManager;
