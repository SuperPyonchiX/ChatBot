/**
 * api.js
 * AI API統合インターフェース - 各API専用クラスへのルーティングを提供します
 */
class AIAPI {

    // シングルトンインスタンス
    static #instance = null;

    constructor() {
        if (AIAPI.#instance) {
            return AIAPI.#instance;
        }
        AIAPI.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!AIAPI.#instance) {
            AIAPI.#instance = new AIAPI();
        }
        return AIAPI.#instance;
    }

    /**
     * 指定時間待機する
     * @param {number} ms - 待機時間（ミリ秒）
     * @returns {Promise<void>}
     */
    #sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * リトライ可能なエラーかどうかを判定
     * @param {Error} error - エラーオブジェクト
     * @returns {boolean} リトライ可能かどうか
     */
    #isRetryableError(error) {
        const retryConfig = window.CONFIG.AIAPI.RETRY;
        const status = error.status || error.response?.status;
        return retryConfig.RETRYABLE_STATUS_CODES.includes(status);
    }

    /**
     * 指数バックオフでリトライ実行
     * @param {Function} fn - 実行する非同期関数
     * @param {Object} options - オプション
     * @returns {Promise<*>} 関数の戻り値
     */
    async #callWithRetry(fn, options = {}) {
        const retryConfig = window.CONFIG.AIAPI.RETRY;
        const maxRetries = retryConfig.MAX_RETRIES;
        const baseDelay = retryConfig.BASE_DELAY;
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // 中断エラーはリトライしない
                if (error.name === 'AbortError') {
                    console.log('[AIAPI] リクエストが中断されました');
                    throw error;
                }

                // 最後の試行またはリトライ不可能なエラーの場合
                if (attempt >= maxRetries || !this.#isRetryableError(error)) {
                    throw error;
                }

                // 指数バックオフで待機
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`[AIAPI] リトライ ${attempt + 1}/${maxRetries} (${delay}ms後) - エラー: ${error.message}`);
                await this.#sleep(delay);
            }
        }

        throw lastError;
    }

    /**
     * AI APIを呼び出して応答を得る（統合エントリーポイント）
     * @async
     * @param {Message[]} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名 (例: 'gpt-4o', 'claude-sonnet-4-5', 'gemini-2.5-pro')
     * @param {Attachment[]} [attachments=[]] - 添付ファイルの配列（任意）
     * @param {ApiCallOptions} [options={}] - 追加オプション
     * @returns {Promise<string>} APIからの応答テキスト（ストリーミングの場合は空文字列）
     * @throws {Error} API設定やリクエストに問題があった場合（APIキー未設定、サポート外モデル等）
     */
    async callAIAPI(messages, model, attachments = [], options = {}) {
        // サポートされているモデルかチェック
        const allSupportedModels = [...window.CONFIG.MODELS.OPENAI, ...window.CONFIG.MODELS.GEMINI, ...window.CONFIG.MODELS.CLAUDE];
        if (!allSupportedModels.includes(model)) {
            throw new Error(`サポートされていないモデルです: ${model}`);
        }

        // ツール機能が利用可能な場合、ツール定義を追加
        if (this.#isToolsCompatibleModel(model)) {
            const provider = this.#getProviderForModel(model);
            options.enableTools = true;
            options.tools = this.#getToolsForProvider(provider);
        }

        // API呼び出し関数を定義
        const executeAPICall = async () => {
            // Web検索が有効でResponses API対応モデルの場合はResponses APIを使用
            if (options.enableWebSearch && this.#isWebSearchCompatibleModel(model)) {
                return await ResponsesAPI.getInstance.callResponsesAPI(messages, model, attachments, options);
            }

            // モデルに応じて適切なAPIクラスにルーティング
            if (window.CONFIG.MODELS.GEMINI.includes(model)) {
                return await GeminiAPI.getInstance.callGeminiAPI(messages, model, attachments, options);
            } else if (window.CONFIG.MODELS.CLAUDE.includes(model)) {
                return await ClaudeAPI.getInstance.callClaudeAPI(messages, model, attachments, options);
            } else {
                return await OpenAIAPI.getInstance.callOpenAIAPI(messages, model, attachments, options);
            }
        };

        // ストリーミングモードではリトライしない（状態管理が複雑になるため）
        // 非ストリーミングモードでのみリトライを適用
        if (options.stream) {
            try {
                return await executeAPICall();
            } catch (error) {
                console.error('[AIAPI] ストリーミングAPIエラー:', error);
                throw error;
            }
        } else {
            return await this.#callWithRetry(executeAPICall);
        }
    }

    /**
     * Web検索対応モデルかどうかを判定
     * @param {string} model - モデル名 (例: 'gpt-5', 'gpt-5-mini')
     * @returns {boolean} Web検索対応モデルかどうか
     */
    #isWebSearchCompatibleModel(model) {
        // OpenAIのResponses APIでWeb検索をサポートするモデル
        return window.CONFIG.MODELS.OPENAI_WEB_SEARCH_COMPATIBLE.includes(model);
    }

    /**
     * ツール機能対応モデルかどうかを判定
     * @param {string} model - モデル名
     * @returns {boolean} ツール機能対応モデルかどうか
     */
    #isToolsCompatibleModel(model) {
        if (typeof ToolManager === 'undefined') {
            return false;
        }
        return ToolManager.getInstance.isModelCompatible(model);
    }

    /**
     * モデルからプロバイダを判定
     * @param {string} model - モデル名
     * @returns {string} プロバイダ名 ('claude', 'openai', 'gemini')
     */
    #getProviderForModel(model) {
        if (typeof ToolManager === 'undefined') {
            return 'openai';
        }
        return ToolManager.getInstance.getProviderForModel(model);
    }

    /**
     * プロバイダ形式のツール定義を取得
     * @param {string} provider - プロバイダ名
     * @returns {Array} ツール定義の配列
     */
    #getToolsForProvider(provider) {
        if (typeof ToolManager === 'undefined') {
            return [];
        }
        return ToolManager.getInstance.getToolsForProvider(provider);
    }

    /**
     * ツール付きでAI APIを呼び出す（エージェントモード用）
     * Function Calling形式でツールを使用し、非ストリーミングで結果を取得
     * @async
     * @param {Message[]} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名
     * @param {Array} tools - ツール定義の配列（Function Calling形式）
     * @param {Object} [options={}] - 追加オプション
     * @returns {Promise<Object>} APIからの応答（content, toolCalls を含む）
     */
    async callAIAPIWithTools(messages, model, tools = [], options = {}) {
        const apiSettings = window.AppState?.apiSettings || window.apiSettings;

        // プロバイダを判定
        const provider = this.#getProviderForModel(model);

        try {
            let response;

            if (provider === 'claude') {
                response = await this.#callClaudeWithTools(messages, model, tools, options, apiSettings);
            } else if (provider === 'gemini') {
                response = await this.#callGeminiWithTools(messages, model, tools, options, apiSettings);
            } else {
                response = await this.#callOpenAIWithTools(messages, model, tools, options, apiSettings);
            }

            return response;

        } catch (error) {
            console.error('[AIAPI] ツール付きAPI呼び出しエラー:', error);
            throw error;
        }
    }

    /**
     * OpenAI API をツール付きで呼び出し
     * @param {Array} messages
     * @param {string} model
     * @param {Array} tools
     * @param {Object} options
     * @param {Object} apiSettings
     * @returns {Promise<Object>}
     */
    async #callOpenAIWithTools(messages, model, tools, options, apiSettings) {
        const endpoint = window.CONFIG.AIAPI.ENDPOINTS.OPENAI;

        const requestBody = {
            model: model,
            messages: messages,
            temperature: window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature,
            max_tokens: window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens
        };

        if (tools && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = 'auto';
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.openaiApiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: options.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API エラー: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message;

        return {
            content: message?.content || '',
            toolCalls: message?.tool_calls?.map(tc => ({
                id: tc.id,
                name: tc.function.name,
                parameters: JSON.parse(tc.function.arguments || '{}')
            })) || null
        };
    }

    /**
     * Claude API をツール付きで呼び出し
     * @param {Array} messages
     * @param {string} model
     * @param {Array} tools
     * @param {Object} options
     * @param {Object} apiSettings
     * @returns {Promise<Object>}
     */
    async #callClaudeWithTools(messages, model, tools, options, apiSettings) {
        const endpoint = window.CONFIG.AIAPI.ENDPOINTS.CLAUDE;

        // メッセージをClaude形式に変換
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');

        // ツールをClaude形式に変換
        const claudeTools = tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters
        }));

        const requestBody = {
            model: model,
            max_tokens: window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens,
            messages: conversationMessages.map(m => ({
                role: m.role,
                content: m.content
            }))
        };

        if (systemMessage) {
            requestBody.system = systemMessage.content;
        }

        if (claudeTools.length > 0) {
            requestBody.tools = claudeTools;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiSettings.claudeApiKey,
                'anthropic-version': window.CONFIG.AIAPI.ANTHROPIC_API_VERSION
            },
            body: JSON.stringify(requestBody),
            signal: options.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Claude API エラー: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // レスポンスを解析
        let content = '';
        let toolCalls = null;

        for (const block of data.content || []) {
            if (block.type === 'text') {
                content += block.text;
            } else if (block.type === 'tool_use') {
                if (!toolCalls) toolCalls = [];
                toolCalls.push({
                    id: block.id,
                    name: block.name,
                    parameters: block.input
                });
            }
        }

        return { content, toolCalls };
    }

    /**
     * Gemini API をツール付きで呼び出し
     * @param {Array} messages
     * @param {string} model
     * @param {Array} tools
     * @param {Object} options
     * @param {Object} apiSettings
     * @returns {Promise<Object>}
     */
    async #callGeminiWithTools(messages, model, tools, options, apiSettings) {
        const endpoint = `${window.CONFIG.AIAPI.ENDPOINTS.GEMINI}/${model}:generateContent?key=${apiSettings.geminiApiKey}`;

        // メッセージをGemini形式に変換
        const systemInstruction = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');

        const contents = conversationMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // ツールをGemini形式に変換
        const geminiTools = tools.length > 0 ? [{
            function_declarations: tools.map(t => ({
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
            }))
        }] : undefined;

        const requestBody = {
            contents,
            generationConfig: {
                temperature: window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature,
                maxOutputTokens: window.CONFIG.AIAPI.GEMINI_PARAMS.maxOutputTokens
            }
        };

        if (systemInstruction) {
            requestBody.systemInstruction = { parts: [{ text: systemInstruction.content }] };
        }

        if (geminiTools) {
            requestBody.tools = geminiTools;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: options.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API エラー: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        let content = '';
        let toolCalls = null;

        for (const part of parts) {
            if (part.text) {
                content += part.text;
            } else if (part.functionCall) {
                if (!toolCalls) toolCalls = [];
                toolCalls.push({
                    id: `gemini_${Date.now()}_${toolCalls.length}`,
                    name: part.functionCall.name,
                    parameters: part.functionCall.args || {}
                });
            }
        }

        return { content, toolCalls };
    }
}


