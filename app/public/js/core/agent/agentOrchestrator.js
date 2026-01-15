/**
 * agentOrchestrator.js
 * エージェント機能の統合コントローラー
 * ReAct推論モードとFunction Callingモードを管理
 */

/**
 * エージェント実行結果の型定義
 * @typedef {Object} AgentResult
 * @property {boolean} success - 成功フラグ
 * @property {*} result - 結果データ
 * @property {string} [error] - エラーメッセージ
 * @property {Array} iterations - イテレーション履歴
 * @property {Object} summary - 実行サマリー
 */

/**
 * エージェント実行オプションの型定義
 * @typedef {Object} AgentOptions
 * @property {string} [mode] - 推論モード
 * @property {number} [maxIterations] - 最大イテレーション数
 * @property {Array} [tools] - 使用するツール
 * @property {Object} [context] - 初期コンテキスト
 * @property {Function} [onObserve] - 観察コールバック
 * @property {Function} [onThink] - 思考コールバック
 * @property {Function} [onAct] - アクションコールバック
 * @property {Function} [onResult] - 結果コールバック
 * @property {Function} [onComplete] - 完了コールバック
 * @property {Function} [onError] - エラーコールバック
 */

class AgentOrchestrator {
    static #instance = null;

    /**
     * エージェントモード定数
     */
    static MODES = {
        REACT: 'react',
        FUNCTION_CALLING: 'function_calling'
    };

    /** @type {string} */
    #mode;

    /** @type {number} */
    #maxIterations;

    /** @type {boolean} */
    #isRunning = false;

    /** @type {AbortController|null} */
    #abortController = null;

    /** @type {Object.<string, Function[]>} */
    #eventListeners = {};

    /** @type {Array} */
    #availableTools = [];

    /**
     * @constructor
     */
    constructor() {
        if (AgentOrchestrator.#instance) {
            return AgentOrchestrator.#instance;
        }
        AgentOrchestrator.#instance = this;

        const config = window.CONFIG?.AGENT || {};
        this.#mode = config.DEFAULT_MODE || AgentOrchestrator.MODES.REACT;
        this.#maxIterations = config.MAX_ITERATIONS || 10;

        this.#initializeBuiltInTools();
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {AgentOrchestrator}
     */
    static get getInstance() {
        if (!AgentOrchestrator.#instance) {
            AgentOrchestrator.#instance = new AgentOrchestrator();
        }
        return AgentOrchestrator.#instance;
    }

    // ========================================
    // メイン実行
    // ========================================

    /**
     * エージェントを実行
     * @param {string} userMessage - ユーザーメッセージ
     * @param {AgentOptions} [options={}] - オプション
     * @returns {Promise<AgentResult>} 実行結果
     */
    async runAgent(userMessage, options = {}) {
        if (this.#isRunning) {
            throw new Error('エージェントは既に実行中です');
        }

        const {
            mode = this.#mode,
            maxIterations = this.#maxIterations,
            tools = this.#availableTools,
            context = {},
            onObserve,
            onThink,
            onAct,
            onResult,
            onComplete,
            onError
        } = options;

        this.#isRunning = true;
        this.#abortController = new AbortController();

        console.log(`[AgentOrchestrator] エージェント開始: mode=${mode}, task="${userMessage.substring(0, 50)}..."`);

        try {
            // AgentLoopのイベントリスナーを設定
            const loop = AgentLoop.getInstance;

            if (onObserve) loop.on('loop:observe', onObserve);
            if (onThink) loop.on('loop:think', onThink);
            if (onAct) loop.on('loop:act', onAct);
            if (onResult) loop.on('loop:result', onResult);

            let result;

            if (mode === AgentOrchestrator.MODES.REACT) {
                result = await this.#runReActMode({
                    task: userMessage,
                    context,
                    tools,
                    maxIterations
                });
            } else {
                result = await this.#runFunctionCallingMode({
                    task: userMessage,
                    context,
                    tools,
                    maxIterations
                });
            }

            if (onComplete) {
                onComplete(result);
            }

            console.log('[AgentOrchestrator] エージェント完了');
            return result;

        } catch (error) {
            console.error('[AgentOrchestrator] エージェントエラー:', error);

            if (onError) {
                onError(error);
            }

            return {
                success: false,
                error: error.message,
                iterations: [],
                summary: null
            };

        } finally {
            this.#isRunning = false;
            this.#abortController = null;

            // イベントリスナーをクリーンアップ
            const loop = AgentLoop.getInstance;
            if (onObserve) loop.off('loop:observe', onObserve);
            if (onThink) loop.off('loop:think', onThink);
            if (onAct) loop.off('loop:act', onAct);
            if (onResult) loop.off('loop:result', onResult);
        }
    }

    /**
     * ReActモードで実行
     * @param {Object} options
     * @returns {Promise<AgentResult>}
     */
    async #runReActMode(options) {
        const { task, context, tools, maxIterations } = options;
        const loop = AgentLoop.getInstance;

        return await loop.executeLoop({
            task,
            context,
            tools,
            maxIterations,
            apiCall: async (params) => await this.#callAPI(params),
            toolExecutor: async (toolName, parameters) => await this.#executeTool(toolName, parameters)
        });
    }

    /**
     * Function Callingモードで実行
     * @param {Object} options
     * @returns {Promise<AgentResult>}
     */
    async #runFunctionCallingMode(options) {
        const { task, context, tools, maxIterations } = options;

        const memory = AgentMemory.getInstance;
        memory.initializeWorkingMemory({ goal: task });

        const iterations = [];
        let isComplete = false;
        let finalResult = null;

        // ツールスキーマをFunction Calling形式に変換
        const toolSchemas = this.#convertToolsToFunctionSchema(tools);

        const messages = [
            {
                role: 'system',
                content: window.CONFIG?.AGENT?.PROMPTS?.FC_SYSTEM
                    .replace('{{tools}}', tools.map(t => `- ${t.name}: ${t.description}`).join('\n'))
            },
            {
                role: 'user',
                content: task
            }
        ];

        while (!isComplete && memory.getCurrentIteration() < maxIterations) {
            const iteration = memory.incrementIteration();

            try {
                // APIを呼び出し（Function Calling）
                const response = await this.#callAPIWithTools({
                    messages,
                    tools: toolSchemas,
                    signal: this.#abortController?.signal
                });

                // ツール呼び出しがある場合
                if (response.toolCalls && response.toolCalls.length > 0) {
                    for (const toolCall of response.toolCalls) {
                        const result = await this.#executeTool(
                            toolCall.name,
                            toolCall.parameters
                        );

                        // 結果をメッセージに追加
                        messages.push({
                            role: 'assistant',
                            content: null,
                            tool_calls: [toolCall]
                        });
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result)
                        });

                        iterations.push({
                            index: iteration,
                            action: {
                                type: 'tool_call',
                                toolName: toolCall.name,
                                parameters: toolCall.parameters
                            },
                            result,
                            timestamp: Date.now()
                        });
                    }
                } else {
                    // ツール呼び出しがない場合は完了
                    isComplete = true;
                    finalResult = {
                        success: true,
                        response: response.content
                    };

                    iterations.push({
                        index: iteration,
                        action: { type: 'complete' },
                        result: finalResult,
                        timestamp: Date.now(),
                        isComplete: true
                    });
                }

            } catch (error) {
                console.error('[AgentOrchestrator] FC mode error:', error);
                iterations.push({
                    index: iteration,
                    action: { type: 'error' },
                    result: { error: error.message },
                    timestamp: Date.now()
                });

                if (this.#abortController?.signal.aborted) {
                    throw error;
                }
            }
        }

        return {
            success: isComplete,
            result: finalResult,
            iterations,
            summary: memory.getExecutionSummary()
        };
    }

    /**
     * エージェントを停止
     */
    stopAgent() {
        if (this.#isRunning) {
            console.log('[AgentOrchestrator] エージェントを停止');
            AgentLoop.getInstance.abort();
            if (this.#abortController) {
                this.#abortController.abort();
            }
        }
    }

    /**
     * エージェントを一時停止
     */
    pauseAgent() {
        if (this.#isRunning) {
            AgentLoop.getInstance.pause();
        }
    }

    /**
     * エージェントを再開
     */
    resumeAgent() {
        if (this.#isRunning) {
            AgentLoop.getInstance.resume();
        }
    }

    // ========================================
    // モード管理
    // ========================================

    /**
     * 推論モードを設定
     * @param {string} mode - モード
     */
    setMode(mode) {
        if (Object.values(AgentOrchestrator.MODES).includes(mode)) {
            this.#mode = mode;
            console.log(`[AgentOrchestrator] モードを設定: ${mode}`);
        } else {
            console.warn(`[AgentOrchestrator] 無効なモード: ${mode}`);
        }
    }

    /**
     * 現在のモードを取得
     * @returns {string}
     */
    getMode() {
        return this.#mode;
    }

    /**
     * 最大イテレーション数を設定
     * @param {number} max
     */
    setMaxIterations(max) {
        this.#maxIterations = Math.max(1, Math.min(max, 50));
    }

    /**
     * 最大イテレーション数を取得
     * @returns {number}
     */
    getMaxIterations() {
        return this.#maxIterations;
    }

    // ========================================
    // ツール管理
    // ========================================

    /**
     * ビルトインツールを初期化
     */
    async #initializeBuiltInTools() {
        // AgentToolManagerが利用可能な場合はそれを使用
        if (window.AgentToolManager) {
            const toolManager = AgentToolManager.getInstance;
            await toolManager.initialize();
            this.#availableTools = toolManager.getAllTools();
            console.log(`[AgentOrchestrator] AgentToolManagerからツールをロード: ${this.#availableTools.length}個`);
        } else {
            // フォールバック: 基本ツールを定義
            this.#availableTools = [
                {
                    name: 'web_search',
                    description: 'Webを検索して最新の情報を取得します。質問やトピックを入力してください。',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: '検索クエリ'
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'ask_user',
                    description: 'ユーザーに質問や確認を求めます。',
                    parameters: {
                        type: 'object',
                        properties: {
                            question: {
                                type: 'string',
                                description: 'ユーザーへの質問'
                            }
                        },
                        required: ['question']
                    }
                }
            ];
        }
    }

    /**
     * ツールを追加
     * @param {Object} tool - ツール定義
     */
    addTool(tool) {
        if (tool.name && tool.description) {
            this.#availableTools.push(tool);
            console.log(`[AgentOrchestrator] ツールを追加: ${tool.name}`);
        }
    }

    /**
     * 利用可能なツールを取得
     * @returns {Array}
     */
    getAvailableTools() {
        return [...this.#availableTools];
    }

    /**
     * ツールをFunction Callingスキーマに変換
     * @param {Array} tools
     * @returns {Array}
     */
    #convertToolsToFunctionSchema(tools) {
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters || {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        }));
    }

    // ========================================
    // API呼び出し
    // ========================================

    /**
     * AIAPIを呼び出し
     * @param {Object} params
     * @returns {Promise<string>}
     */
    async #callAPI(params) {
        const { messages, signal } = params;

        // AIPAIを使用してAPI呼び出し
        const api = window.AIAPI?.getInstance;
        if (!api) {
            throw new Error('AIAPI が利用できません');
        }

        const model = window.apiSettings?.model || 'gpt-5-mini';
        let fullResponse = '';

        await api.callAIAPI(messages, model, [], {
            stream: true,
            signal,
            onChunk: (chunk) => {
                fullResponse += chunk;
            }
        });

        return fullResponse;
    }

    /**
     * ツール付きでAPIを呼び出し
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async #callAPIWithTools(params) {
        const { messages, tools, signal } = params;

        const api = window.AIAPI?.getInstance;
        if (!api) {
            throw new Error('AIAPI が利用できません');
        }

        const model = window.apiSettings?.model || 'gpt-5-mini';

        // ツール付きのAPI呼び出し（非ストリーミング）
        const response = await api.callAIAPIWithTools(messages, model, tools, { signal });

        return response;
    }

    // ========================================
    // ツール実行
    // ========================================

    /**
     * ツールを実行
     * @param {string} toolName - ツール名
     * @param {Object} parameters - パラメータ
     * @returns {Promise<*>} 結果
     */
    async #executeTool(toolName, parameters) {
        console.log(`[AgentOrchestrator] ツール実行: ${toolName}`, parameters);

        // AgentToolManagerが利用可能な場合はそれを使用
        if (window.AgentToolManager) {
            const toolManager = window.AgentToolManager.getInstance;
            const tool = toolManager.getTool(toolName);

            if (tool && tool.execute) {
                try {
                    return await tool.execute(parameters);
                } catch (error) {
                    console.error(`[AgentOrchestrator] ツール実行エラー: ${toolName}`, error);
                    return {
                        success: false,
                        error: error.message
                    };
                }
            }
        }

        // フォールバック: 組み込みの実行ロジック
        switch (toolName) {
            case 'web_search':
                return await this.#executeWebSearch(parameters);

            case 'rag_search':
                return await this.#executeRAGSearch(parameters);

            case 'code_execute':
                return await this.#executeCode(parameters);

            case 'ask_user':
                return await this.#askUser(parameters);

            default:
                // 外部ツールを試す
                return await this.#executeExternalTool(toolName, parameters);
        }
    }

    /**
     * Web検索を実行
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async #executeWebSearch(params) {
        const { query } = params;

        // Web検索の実装（既存のWeb検索機能を使用）
        try {
            // ResponsesAPIまたはClaudeのWeb検索を使用
            const api = window.AIAPI?.getInstance;
            if (!api) {
                return { error: 'Web検索が利用できません' };
            }

            // 簡易的なWeb検索（モデル経由）
            const messages = [
                { role: 'user', content: `Web検索: ${query}` }
            ];

            const response = await api.callAIAPI(messages, 'gpt-5-mini', [], {
                stream: false,
                enableWebSearch: true
            });

            return {
                success: true,
                query,
                results: response
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * RAG検索を実行
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async #executeRAGSearch(params) {
        const { query } = params;

        try {
            const ragManager = window.RAGManager?.getInstance;
            if (!ragManager) {
                return { error: 'RAGが利用できません' };
            }

            const result = await ragManager.searchWithDetails(query);

            return {
                success: true,
                query,
                sources: result.sources,
                context: result.context
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * コードを実行
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async #executeCode(params) {
        const { language, code } = params;

        try {
            const executor = window.CodeExecutor?.getInstance;
            if (!executor) {
                return { error: 'コード実行機能が利用できません' };
            }

            const result = await executor.executeCode(code, language, null);

            return {
                success: true,
                language,
                output: result
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ユーザーに質問
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async #askUser(params) {
        const { question } = params;

        // ユーザー入力を待つ（この実装では単純に質問を返す）
        // 実際の実装ではUIを通じてユーザー入力を取得する
        return {
            success: true,
            needsUserInput: true,
            question
        };
    }

    /**
     * 外部ツールを実行
     * @param {string} toolName
     * @param {Object} parameters
     * @returns {Promise<Object>}
     */
    async #executeExternalTool(toolName, parameters) {
        // ToolExecutorを使用して外部ツールを実行
        try {
            const toolExecutor = window.ToolExecutor?.getInstance;
            if (toolExecutor) {
                const result = await toolExecutor.executeTool(toolName, parameters);
                return { success: true, result };
            }
        } catch (error) {
            console.error(`[AgentOrchestrator] 外部ツール実行エラー: ${toolName}`, error);
        }

        return {
            success: false,
            error: `ツール "${toolName}" は利用できません`
        };
    }

    // ========================================
    // 判定メソッド
    // ========================================

    /**
     * エージェントモードを使用すべきかどうかを判定
     * @param {string} userMessage - ユーザーメッセージ
     * @returns {boolean}
     */
    shouldUseAgent(userMessage) {
        if (!window.CONFIG?.AGENT?.ENABLED) {
            return false;
        }

        // 複雑なタスクを示すキーワード
        const agentKeywords = [
            '調べて', '検索して', '分析して', 'まとめて',
            '確認して', '実行して', '計算して', '処理して',
            '複数', 'ステップ', '段階的に',
            'analyze', 'search', 'execute', 'process',
            'multi-step', 'step by step'
        ];

        const messageLower = userMessage.toLowerCase();
        return agentKeywords.some(keyword => messageLower.includes(keyword));
    }

    /**
     * エージェントが実行中かどうか
     * @returns {boolean}
     */
    isRunning() {
        return this.#isRunning;
    }

    /**
     * 現在の状態を取得
     * @returns {Object}
     */
    getState() {
        return {
            isRunning: this.#isRunning,
            mode: this.#mode,
            maxIterations: this.#maxIterations,
            loopState: AgentLoop.getInstance.getCurrentState()
        };
    }

    // ========================================
    // イベント処理
    // ========================================

    /**
     * イベントリスナーを追加
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this.#eventListeners[event]) {
            this.#eventListeners[event] = [];
        }
        this.#eventListeners[event].push(callback);
    }

    /**
     * イベントリスナーを削除
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        if (this.#eventListeners[event]) {
            this.#eventListeners[event] = this.#eventListeners[event].filter(cb => cb !== callback);
        }
    }
}

// グローバルに公開
window.AgentOrchestrator = AgentOrchestrator;
