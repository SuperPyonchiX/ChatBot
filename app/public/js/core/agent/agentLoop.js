/**
 * agentLoop.js
 * ReAct推論ループの実装
 * observe -> think -> act -> observe サイクルを管理
 */

/**
 * エージェントアクションの型定義
 * @typedef {Object} AgentAction
 * @property {'tool_call'|'respond'|'ask_user'|'complete'} type - アクションタイプ
 * @property {string} [toolName] - ツール名
 * @property {Object} [parameters] - ツールパラメータ
 * @property {string} [reasoning] - 推論の説明
 * @property {string} [response] - 応答テキスト
 */

/**
 * イテレーション結果の型定義
 * @typedef {Object} IterationResult
 * @property {number} index - イテレーション番号
 * @property {Object} observation - 観察結果
 * @property {Object} thought - 思考結果
 * @property {AgentAction} action - 実行したアクション
 * @property {Object} result - アクション結果
 * @property {number} timestamp - タイムスタンプ
 * @property {boolean} isComplete - 完了フラグ
 */

class AgentLoop {
    static #instance = null;

    /** @type {'idle'|'observe'|'think'|'act'|'result'} */
    #phase = 'idle';

    /** @type {boolean} */
    #isRunning = false;

    /** @type {boolean} */
    #isPaused = false;

    /** @type {boolean} */
    #shouldAbort = false;

    /** @type {AbortController|null} */
    #abortController = null;

    /** @type {IterationResult[]} */
    #iterationHistory = [];

    /** @type {Object.<string, Function[]>} */
    #listeners = {
        'loop:start': [],
        'loop:observe': [],
        'loop:think': [],
        'loop:act': [],
        'loop:result': [],
        'loop:iteration': [],
        'loop:complete': [],
        'loop:error': [],
        'loop:pause': [],
        'loop:resume': [],
        'loop:abort': []
    };

    /**
     * @constructor
     */
    constructor() {
        if (AgentLoop.#instance) {
            return AgentLoop.#instance;
        }
        AgentLoop.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {AgentLoop}
     */
    static get getInstance() {
        if (!AgentLoop.#instance) {
            AgentLoop.#instance = new AgentLoop();
        }
        return AgentLoop.#instance;
    }

    // ========================================
    // メインループ実行
    // ========================================

    /**
     * ReActループを実行
     * @param {Object} options - 実行オプション
     * @param {string} options.task - タスク説明
     * @param {Object} options.context - 初期コンテキスト
     * @param {Array} options.tools - 利用可能なツール
     * @param {Function} options.apiCall - API呼び出し関数
     * @param {Function} options.toolExecutor - ツール実行関数
     * @param {number} [options.maxIterations] - 最大イテレーション数
     * @returns {Promise<Object>} 実行結果
     */
    async executeLoop(options) {
        const {
            task,
            context = {},
            tools = [],
            apiCall,
            toolExecutor,
            maxIterations = window.CONFIG?.AGENT?.MAX_ITERATIONS || 10
        } = options;

        if (this.#isRunning) {
            throw new Error('エージェントループは既に実行中です');
        }

        // 状態を初期化
        this.#isRunning = true;
        this.#isPaused = false;
        this.#shouldAbort = false;
        this.#phase = 'idle';
        this.#iterationHistory = [];
        this.#abortController = new AbortController();

        const memory = AgentMemory.getInstance;
        memory.initializeWorkingMemory({ goal: task });

        this.#emit('loop:start', { task, maxIterations });
        console.log(`[AgentLoop] ループ開始: ${task}`);

        try {
            let isComplete = false;
            let finalResult = null;

            while (!isComplete && memory.getCurrentIteration() < maxIterations) {
                // 中断チェック
                if (this.#shouldAbort) {
                    throw new Error('ループが中断されました');
                }

                // 一時停止チェック
                while (this.#isPaused) {
                    await this.#sleep(100);
                    if (this.#shouldAbort) {
                        throw new Error('ループが中断されました');
                    }
                }

                const iteration = memory.incrementIteration();
                console.log(`[AgentLoop] イテレーション ${iteration}/${maxIterations}`);

                // 1. Observe
                this.#phase = 'observe';
                const observation = await this.#observe(context, memory);
                this.#emit('loop:observe', { iteration, observation });

                // 2. Think
                this.#phase = 'think';
                const thought = await this.#think({
                    task,
                    observation,
                    memory,
                    tools,
                    apiCall
                });
                this.#emit('loop:think', { iteration, thought });

                // 3. Act
                this.#phase = 'act';
                const action = this.#parseAction(thought);
                this.#emit('loop:act', { iteration, action });

                // 4. Execute Action & Get Result
                this.#phase = 'result';
                const result = await this.#executeAction({
                    action,
                    toolExecutor,
                    memory
                });
                this.#emit('loop:result', { iteration, result });

                // イテレーション結果を保存
                const iterationResult = {
                    index: iteration,
                    observation,
                    thought,
                    action,
                    result,
                    timestamp: Date.now(),
                    isComplete: action.type === 'complete'
                };
                this.#iterationHistory.push(iterationResult);
                this.#emit('loop:iteration', iterationResult);

                // 完了チェック
                if (action.type === 'complete' || action.type === 'respond') {
                    isComplete = true;
                    finalResult = result;
                }
            }

            // 最大イテレーションに達した場合
            if (!isComplete) {
                console.warn(`[AgentLoop] 最大イテレーション数(${maxIterations})に達しました`);
                finalResult = {
                    success: false,
                    message: '最大イテレーション数に達しました。タスクを完了できませんでした。',
                    summary: memory.getExecutionSummary()
                };
            }

            this.#emit('loop:complete', {
                success: true,
                result: finalResult,
                iterations: this.#iterationHistory.length
            });

            return {
                success: true,
                result: finalResult,
                iterations: this.#iterationHistory,
                summary: memory.getExecutionSummary()
            };

        } catch (error) {
            console.error('[AgentLoop] ループエラー:', error);
            this.#emit('loop:error', { error: error.message });

            return {
                success: false,
                error: error.message,
                iterations: this.#iterationHistory,
                summary: memory.getExecutionSummary()
            };

        } finally {
            this.#isRunning = false;
            this.#phase = 'idle';
            this.#abortController = null;
        }
    }

    // ========================================
    // ループフェーズ
    // ========================================

    /**
     * 観察フェーズ
     * @param {Object} context - 現在のコンテキスト
     * @param {AgentMemory} memory - メモリ
     * @returns {Promise<Object>} 観察結果
     */
    async #observe(context, memory) {
        const observation = {
            currentState: context,
            previousResults: memory.getShortTermContext(5, 'result'),
            iteration: memory.getCurrentIteration(),
            timestamp: Date.now()
        };

        memory.addToShortTerm({
            type: 'observation',
            content: observation
        });

        return observation;
    }

    /**
     * 思考フェーズ
     * @param {Object} options
     * @returns {Promise<Object>} 思考結果
     */
    async #think(options) {
        const { task, observation, memory, tools, apiCall } = options;

        // プロンプトを構築
        const prompt = this.#buildThinkPrompt({
            task,
            observation,
            memory,
            tools
        });

        // LLMに問い合わせ
        const response = await apiCall({
            messages: prompt,
            signal: this.#abortController?.signal
        });

        const thought = {
            reasoning: response,
            timestamp: Date.now()
        };

        memory.addToShortTerm({
            type: 'thought',
            content: thought
        });

        return thought;
    }

    /**
     * 思考プロンプトを構築
     * @param {Object} options
     * @returns {Array} メッセージ配列
     */
    #buildThinkPrompt(options) {
        const { task, observation, memory, tools } = options;

        const toolDescriptions = tools.map(t =>
            `- ${t.name}: ${t.description}`
        ).join('\n');

        const systemPrompt = window.CONFIG?.AGENT?.PROMPTS?.REACT_SYSTEM
            .replace('{{tools}}', toolDescriptions)
            .replace('{{max_iterations}}', window.CONFIG?.AGENT?.MAX_ITERATIONS || 10);

        // 過去の会話履歴を取得
        const history = memory.toConversationHistory(10);

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            {
                role: 'user',
                content: `タスク: ${task}\n\n現在の観察:\n${JSON.stringify(observation, null, 2)}\n\n次のアクションを決定してください。`
            }
        ];

        return messages;
    }

    /**
     * 思考結果からアクションを解析
     * @param {Object} thought - 思考結果
     * @returns {AgentAction} アクション
     */
    #parseAction(thought) {
        const response = thought.reasoning;

        // Final Answer のパターンを検出
        const finalAnswerMatch = response.match(/Final Answer[:\s]*(.+?)$/is);
        if (finalAnswerMatch) {
            return {
                type: 'complete',
                response: finalAnswerMatch[1].trim(),
                reasoning: response
            };
        }

        // Action パターンを検出
        const actionMatch = response.match(/Action[:\s]*(\w+)(?:\[([^\]]*)\])?/i);
        if (actionMatch) {
            const toolName = actionMatch[1];
            let parameters = {};

            // パラメータを解析
            if (actionMatch[2]) {
                try {
                    // JSON形式を試す
                    parameters = JSON.parse(actionMatch[2]);
                } catch {
                    // シンプルな文字列パラメータ
                    parameters = { input: actionMatch[2] };
                }
            }

            // Action Input パターンも検出
            const inputMatch = response.match(/Action Input[:\s]*(.+?)(?=\n|$)/is);
            if (inputMatch) {
                try {
                    parameters = JSON.parse(inputMatch[1].trim());
                } catch {
                    parameters = { input: inputMatch[1].trim() };
                }
            }

            return {
                type: 'tool_call',
                toolName,
                parameters,
                reasoning: response
            };
        }

        // 特定のツール呼び出しパターンを検出
        const toolCallMatch = response.match(/Tool[:\s]*(\w+)/i);
        if (toolCallMatch) {
            return {
                type: 'tool_call',
                toolName: toolCallMatch[1],
                parameters: {},
                reasoning: response
            };
        }

        // デフォルトは応答として扱う
        return {
            type: 'respond',
            response: response,
            reasoning: response
        };
    }

    /**
     * アクションを実行
     * @param {Object} options
     * @returns {Promise<Object>} 結果
     */
    async #executeAction(options) {
        const { action, toolExecutor, memory } = options;

        memory.addToShortTerm({
            type: 'action',
            content: action
        });

        let result;

        switch (action.type) {
            case 'tool_call':
                try {
                    result = await toolExecutor(action.toolName, action.parameters);
                    result = {
                        success: true,
                        toolName: action.toolName,
                        output: result
                    };
                } catch (error) {
                    result = {
                        success: false,
                        toolName: action.toolName,
                        error: error.message
                    };
                }
                break;

            case 'respond':
            case 'complete':
                result = {
                    success: true,
                    response: action.response
                };
                break;

            case 'ask_user':
                result = {
                    success: true,
                    needsUserInput: true,
                    question: action.response
                };
                break;

            default:
                result = {
                    success: false,
                    error: `不明なアクションタイプ: ${action.type}`
                };
        }

        memory.addToShortTerm({
            type: 'result',
            content: result,
            metadata: { important: true }
        });

        return result;
    }

    // ========================================
    // ループ制御
    // ========================================

    /**
     * ループを一時停止
     */
    pause() {
        if (this.#isRunning && !this.#isPaused) {
            this.#isPaused = true;
            this.#emit('loop:pause', { iteration: AgentMemory.getInstance.getCurrentIteration() });
            console.log('[AgentLoop] ループを一時停止');
        }
    }

    /**
     * ループを再開
     */
    resume() {
        if (this.#isRunning && this.#isPaused) {
            this.#isPaused = false;
            this.#emit('loop:resume', { iteration: AgentMemory.getInstance.getCurrentIteration() });
            console.log('[AgentLoop] ループを再開');
        }
    }

    /**
     * ループを中断
     */
    abort() {
        if (this.#isRunning) {
            this.#shouldAbort = true;
            this.#isPaused = false;
            if (this.#abortController) {
                this.#abortController.abort();
            }
            this.#emit('loop:abort', { iteration: AgentMemory.getInstance.getCurrentIteration() });
            console.log('[AgentLoop] ループを中断');
        }
    }

    // ========================================
    // 状態アクセス
    // ========================================

    /**
     * 現在の状態を取得
     * @returns {Object}
     */
    getCurrentState() {
        return {
            phase: this.#phase,
            isRunning: this.#isRunning,
            isPaused: this.#isPaused,
            iteration: AgentMemory.getInstance.getCurrentIteration()
        };
    }

    /**
     * 現在のフェーズを取得
     * @returns {string}
     */
    getPhase() {
        return this.#phase;
    }

    /**
     * 実行中かどうか
     * @returns {boolean}
     */
    isRunning() {
        return this.#isRunning;
    }

    /**
     * 一時停止中かどうか
     * @returns {boolean}
     */
    isPaused() {
        return this.#isPaused;
    }

    /**
     * イテレーション履歴を取得
     * @returns {IterationResult[]}
     */
    getIterationHistory() {
        return [...this.#iterationHistory];
    }

    // ========================================
    // イベント処理
    // ========================================

    /**
     * イベントリスナーを追加
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック
     */
    on(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event].push(callback);
        }
    }

    /**
     * イベントリスナーを削除
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック
     */
    off(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event] = this.#listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * イベントを発火
     * @param {string} event - イベント名
     * @param {Object} data - イベントデータ
     */
    #emit(event, data) {
        if (this.#listeners[event]) {
            for (const callback of this.#listeners[event]) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[AgentLoop] イベントハンドラエラー (${event}):`, error);
                }
            }
        }
    }

    // ========================================
    // ユーティリティ
    // ========================================

    /**
     * 指定時間スリープ
     * @param {number} ms - ミリ秒
     * @returns {Promise<void>}
     */
    #sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// グローバルに公開
window.AgentLoop = AgentLoop;
