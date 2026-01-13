/**
 * toolExecutor.js
 * ストリーミングレスポンスからツール呼び出しを検出し、実行するモジュール
 * 各プロバイダの異なるイベント形式を統一的に処理
 */
class ToolExecutor {
    static #instance = null;

    // イベントリスナー
    #listeners = {
        'tool:start': [],
        'tool:progress': [],
        'tool:complete': [],
        'tool:error': []
    };

    // 現在処理中のツール呼び出し（ストリーミング用）
    #pendingToolCalls = new Map();

    // 部分的なJSON入力を蓄積（ストリーミング用）
    #partialJsonBuffers = new Map();

    // 完了済みのツール呼び出しID（重複実行防止用）
    #completedToolCalls = new Set();

    constructor() {
        if (ToolExecutor.#instance) {
            return ToolExecutor.#instance;
        }
        ToolExecutor.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ToolExecutor.#instance) {
            ToolExecutor.#instance = new ToolExecutor();
        }
        return ToolExecutor.#instance;
    }

    /**
     * イベントリスナーを登録
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    on(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event].push(callback);
        }
    }

    /**
     * イベントリスナーを解除
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
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
            this.#listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`イベントハンドラエラー (${event}):`, error);
                }
            });
        }
    }

    /**
     * ストリーミングイベントからツール呼び出しを検出
     * @param {Object} streamEvent - ストリーミングイベント
     * @param {string} provider - プロバイダ名
     * @returns {Object|null} 検出されたツール呼び出し情報
     */
    detectToolCall(streamEvent, provider) {
        switch (provider) {
            case 'claude':
                return this.#detectClaudeToolCall(streamEvent);
            case 'openai':
                return this.#detectOpenAIToolCall(streamEvent);
            case 'openai-responses':
                return this.#detectResponsesToolCall(streamEvent);
            case 'gemini':
                return this.#detectGeminiToolCall(streamEvent);
            default:
                return null;
        }
    }

    /**
     * Claude tool_use イベントを検出
     * @param {Object} event - Claudeのストリーミングイベント
     * @returns {Object|null} ツール呼び出し情報
     */
    #detectClaudeToolCall(event) {
        // ツール使用開始
        if (event.type === 'content_block_start' &&
            event.content_block?.type === 'tool_use') {
            const toolCall = {
                id: event.content_block.id,
                name: event.content_block.name,
                arguments: {},
                status: 'started',
                provider: 'claude'
            };
            this.#pendingToolCalls.set(toolCall.id, toolCall);
            this.#partialJsonBuffers.set(toolCall.id, '');
            return { type: 'start', toolCall };
        }

        // JSON入力のデルタ
        if (event.type === 'content_block_delta' &&
            event.delta?.type === 'input_json_delta') {
            const partialJson = event.delta.partial_json || '';

            // 現在処理中のツール呼び出しを探す
            for (const [id, toolCall] of this.#pendingToolCalls.entries()) {
                if (toolCall.provider === 'claude' && toolCall.status === 'started') {
                    const buffer = this.#partialJsonBuffers.get(id) || '';
                    this.#partialJsonBuffers.set(id, buffer + partialJson);
                    return { type: 'delta', toolCallId: id, partialJson };
                }
            }
        }

        // コンテンツブロック終了
        if (event.type === 'content_block_stop') {
            // 完了したツール呼び出しを探す
            for (const [id, toolCall] of this.#pendingToolCalls.entries()) {
                if (toolCall.provider === 'claude' && toolCall.status === 'started') {
                    const jsonBuffer = this.#partialJsonBuffers.get(id) || '';
                    try {
                        toolCall.arguments = jsonBuffer ? JSON.parse(jsonBuffer) : {};
                    } catch (e) {
                        console.warn('ツール引数のJSONパースに失敗:', e);
                        toolCall.arguments = {};
                    }
                    toolCall.status = 'complete';
                    this.#partialJsonBuffers.delete(id);
                    return { type: 'complete', toolCall };
                }
            }
        }

        return null;
    }

    /**
     * OpenAI function_call イベントを検出
     * @param {Object} event - OpenAIのストリーミングイベント
     * @returns {Object|null} ツール呼び出し情報
     */
    #detectOpenAIToolCall(event) {
        if (!event.choices || !event.choices[0]) return null;

        const choice = event.choices[0];
        const delta = choice.delta;

        // ツール呼び出しの開始または継続
        if (delta?.tool_calls && delta.tool_calls.length > 0) {
            const toolCallDelta = delta.tool_calls[0];
            const index = toolCallDelta.index || 0;
            const toolCallId = toolCallDelta.id || `openai_tool_${index}`;

            // 新しいツール呼び出しの開始
            if (toolCallDelta.id) {
                const toolCall = {
                    id: toolCallId,
                    name: toolCallDelta.function?.name || '',
                    arguments: {},
                    status: 'started',
                    provider: 'openai'
                };
                this.#pendingToolCalls.set(toolCallId, toolCall);
                this.#partialJsonBuffers.set(toolCallId, '');
                return { type: 'start', toolCall };
            }

            // 引数のデルタ
            if (toolCallDelta.function?.arguments) {
                // 対応するツール呼び出しを探す
                for (const [id, toolCall] of this.#pendingToolCalls.entries()) {
                    if (toolCall.provider === 'openai' && toolCall.status === 'started') {
                        const buffer = this.#partialJsonBuffers.get(id) || '';
                        this.#partialJsonBuffers.set(id, buffer + toolCallDelta.function.arguments);
                        return { type: 'delta', toolCallId: id, partialJson: toolCallDelta.function.arguments };
                    }
                }
            }
        }

        // finish_reason が tool_calls の場合、ツール呼び出し完了
        if (choice.finish_reason === 'tool_calls') {
            const completedToolCalls = [];
            for (const [id, toolCall] of this.#pendingToolCalls.entries()) {
                if (toolCall.provider === 'openai' && toolCall.status === 'started') {
                    const jsonBuffer = this.#partialJsonBuffers.get(id) || '';
                    try {
                        toolCall.arguments = jsonBuffer ? JSON.parse(jsonBuffer) : {};
                    } catch (e) {
                        console.warn('ツール引数のJSONパースに失敗:', e);
                        toolCall.arguments = {};
                    }
                    toolCall.status = 'complete';
                    this.#partialJsonBuffers.delete(id);
                    completedToolCalls.push(toolCall);
                }
            }
            if (completedToolCalls.length > 0) {
                return { type: 'complete', toolCalls: completedToolCalls };
            }
        }

        return null;
    }

    /**
     * OpenAI Responses API イベントを検出
     * @param {Object} event - Responses APIのストリーミングイベント
     * @returns {Object|null} ツール呼び出し情報
     */
    #detectResponsesToolCall(event) {
        // response.output_item.added: function_callアイテムの追加（開始）
        if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
            const callId = event.item.call_id || event.item.id || `resp_${Date.now()}`;
            const toolCall = {
                id: callId,
                name: event.item.name || '',
                arguments: {},
                status: 'started',
                provider: 'openai-responses'
            };
            this.#pendingToolCalls.set(callId, toolCall);
            this.#partialJsonBuffers.set(callId, '');
            return { type: 'start', toolCall };
        }

        // function_call_arguments.delta
        if (event.type === 'response.function_call_arguments.delta') {
            // call_idがない場合は、最後に開始されたpending tool callを使用
            let callId = event.call_id;
            if (!callId) {
                // 最後に追加されたツール呼び出しを取得
                const pendingCalls = Array.from(this.#pendingToolCalls.entries());
                if (pendingCalls.length > 0) {
                    callId = pendingCalls[pendingCalls.length - 1][0];
                }
            }

            if (callId && !this.#pendingToolCalls.has(callId)) {
                const toolCall = {
                    id: callId,
                    name: event.name || '',
                    arguments: {},
                    status: 'started',
                    provider: 'openai-responses'
                };
                this.#pendingToolCalls.set(callId, toolCall);
                this.#partialJsonBuffers.set(callId, '');
            }

            if (callId) {
                const buffer = this.#partialJsonBuffers.get(callId) || '';
                this.#partialJsonBuffers.set(callId, buffer + (event.delta || ''));
                return { type: 'delta', toolCallId: callId, partialJson: event.delta };
            }
            return null;
        }

        // function_call_arguments.done
        if (event.type === 'response.function_call_arguments.done') {
            // call_idがない場合は、最後に開始されたpending tool callを使用
            let callId = event.call_id;
            if (!callId) {
                const pendingCalls = Array.from(this.#pendingToolCalls.entries());
                if (pendingCalls.length > 0) {
                    callId = pendingCalls[pendingCalls.length - 1][0];
                }
            }
            const toolCall = this.#pendingToolCalls.get(callId);
            if (toolCall) {
                try {
                    toolCall.arguments = event.arguments ? JSON.parse(event.arguments) : {};
                } catch (e) {
                    const buffer = this.#partialJsonBuffers.get(callId) || '';
                    try {
                        toolCall.arguments = buffer ? JSON.parse(buffer) : {};
                    } catch (e2) {
                        toolCall.arguments = {};
                    }
                }
                toolCall.name = event.name || toolCall.name;
                toolCall.status = 'complete';
                // pendingから削除し、完了済みとしてマーク
                this.#pendingToolCalls.delete(callId);
                this.#partialJsonBuffers.delete(callId);
                this.#completedToolCalls.add(callId);
                return { type: 'complete', toolCall };
            }
        }

        // response.output_item.done: function_callアイテムの完了
        if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
            // call_idがない場合は、最後に開始されたpending tool callを使用
            let callId = event.item.call_id || event.item.id;
            if (!callId) {
                const pendingCalls = Array.from(this.#pendingToolCalls.entries());
                if (pendingCalls.length > 0) {
                    callId = pendingCalls[pendingCalls.length - 1][0];
                }
            }

            // 完了済みチェック（function_call_arguments.doneで既に処理済みの場合はスキップ）
            if (this.#completedToolCalls.has(callId)) {
                return null;
            }

            let toolCall = this.#pendingToolCalls.get(callId);

            if (!toolCall) {
                // 新規作成（deltaなしで完了した場合）
                toolCall = {
                    id: callId || `resp_${Date.now()}`,
                    name: event.item.name || '',
                    arguments: {},
                    status: 'complete',
                    provider: 'openai-responses'
                };
            }

            // 引数を解析
            if (event.item.arguments) {
                try {
                    toolCall.arguments = typeof event.item.arguments === 'string'
                        ? JSON.parse(event.item.arguments)
                        : event.item.arguments;
                } catch (e) {
                    console.warn('ツール引数のJSONパースに失敗:', e);
                }
            }

            toolCall.name = event.item.name || toolCall.name;
            toolCall.status = 'complete';
            this.#pendingToolCalls.delete(callId);
            this.#partialJsonBuffers.delete(callId);
            this.#completedToolCalls.add(callId);
            return { type: 'complete', toolCall };
        }

        return null;
    }

    /**
     * Gemini functionCall イベントを検出
     * @param {Object} event - Geminiのストリーミングイベント
     * @returns {Object|null} ツール呼び出し情報
     */
    #detectGeminiToolCall(event) {
        if (event.candidates && event.candidates[0]?.content?.parts) {
            for (const part of event.candidates[0].content.parts) {
                if (part.functionCall) {
                    const toolCall = {
                        id: `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: part.functionCall.name,
                        arguments: part.functionCall.args || {},
                        status: 'complete',
                        provider: 'gemini'
                    };
                    return { type: 'complete', toolCall };
                }
            }
        }
        return null;
    }

    /**
     * ツールを実行
     * @param {Object} toolCall - ツール呼び出し情報
     * @returns {Promise<Object>} 実行結果
     */
    async execute(toolCall) {
        this.#emit('tool:start', { toolCall });

        try {
            const tool = ToolRegistry.getInstance.get(toolCall.name);
            if (!tool) {
                throw new Error(`未登録のツール: ${toolCall.name}`);
            }

            // 進捗イベント
            this.#emit('tool:progress', {
                toolCall,
                message: `${toolCall.name} を実行中...`
            });

            // ツールを実行
            const result = await tool.executor.execute(toolCall.arguments);

            // 完了イベント
            this.#emit('tool:complete', { toolCall, result });

            // 処理済みのツール呼び出しをクリア
            this.#pendingToolCalls.delete(toolCall.id);

            return result;

        } catch (error) {
            console.error(`ツール実行エラー (${toolCall.name}):`, error);

            // エラーイベント
            this.#emit('tool:error', { toolCall, error });

            // 処理済みのツール呼び出しをクリア
            this.#pendingToolCalls.delete(toolCall.id);

            throw error;
        }
    }

    /**
     * 複数のツールを順次実行
     * @param {Array} toolCalls - ツール呼び出し情報の配列
     * @returns {Promise<Array>} 実行結果の配列
     */
    async executeAll(toolCalls) {
        const results = [];
        for (const toolCall of toolCalls) {
            try {
                const result = await this.execute(toolCall);
                results.push({ toolCall, result, success: true });
            } catch (error) {
                results.push({ toolCall, error, success: false });
            }
        }
        return results;
    }

    /**
     * 保留中のツール呼び出しをクリア
     */
    clearPending() {
        this.#pendingToolCalls.clear();
        this.#partialJsonBuffers.clear();
    }

    /**
     * 保留中のツール呼び出しを取得
     * @returns {Array} 保留中のツール呼び出しの配列
     */
    getPendingToolCalls() {
        return Array.from(this.#pendingToolCalls.values());
    }
}
