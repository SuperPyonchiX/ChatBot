/**
 * openaiApi.js
 * OpenAI/Azure OpenAI API専用の通信機能を提供します
 */
class OpenAIAPI {
    static #instance = null;

    constructor() {
        if (OpenAIAPI.#instance) {
            return OpenAIAPI.#instance;
        }
        OpenAIAPI.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!OpenAIAPI.#instance) {
            OpenAIAPI.#instance = new OpenAIAPI();
        }
        return OpenAIAPI.#instance;
    }

    /**
     * OpenAI/Azure OpenAI APIを呼び出して応答を得る
     * @param {Array} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名
     * @param {Array} attachments - 添付ファイルの配列（任意）
     * @param {Object} options - 追加オプション
     * @param {boolean} options.stream - ストリーミングを使用するかどうか
     * @param {Function} options.onChunk - ストリーミング時のチャンク受信コールバック関数
     * @param {Function} options.onComplete - ストリーミング完了時のコールバック関数
     * @param {boolean} options.enableTools - ツール機能を使用するかどうか
     * @param {Array} options.tools - ツール定義（OpenAI形式）
     * @param {Function} options.onToolCall - ツール呼び出し検出時のコールバック関数（任意）
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async callOpenAIAPI(messages, model, attachments = [], options = { stream: false, onChunk: null, onComplete: null }) {
        try {
            // API設定を確認
            this.#validateAPISettings();

            // 添付ファイルがある場合はメッセージを処理
            const processedMessages = this.#processMessagesWithAttachments(messages, attachments);

            // APIリクエストを準備
            const { endpoint, headers, body } = this.#prepareOpenAIRequest(processedMessages, model, options.stream, options);

            console.log(`OpenAI APIリクエスト送信 (${model}):`, endpoint);
            console.log('📡 ストリーミング有効:', options.stream);

            // APIリクエストを実行
            if (options.stream) {
                return await this.#executeStreamOpenAIRequest(
                    endpoint,
                    headers,
                    body,
                    options.onChunk,
                    options.onComplete,
                    options.onToolCall,
                    options.signal
                );
            } else {
                return await this.#executeOpenAIRequest(endpoint, headers, body, options.signal);
            }

        } catch (error) {
            console.error('OpenAI API呼び出しエラー:', error);
            throw error;
        }
    }

    /**
     * API設定を検証
     */
    #validateAPISettings() {
        // @ts-ignore - apiSettingsはAppStateで初期化されるグローバルプロパティ
        if (window.apiSettings.apiType === 'azure') {
            // @ts-ignore
            if (!window.apiSettings.azureApiKey) {
                throw new Error('Azure OpenAI APIキーが設定されていません');
            }
        } else {
            // @ts-ignore
            if (!window.apiSettings.openaiApiKey) {
                throw new Error('OpenAI APIキーが設定されていません。設定画面で設定してください。');
            }
        }
    }

    /**
     * 添付ファイルを含むメッセージを処理
     */
    #processMessagesWithAttachments(messages, attachments) {
        if (!attachments || attachments.length === 0) {
            return messages;
        }

        const processedMessages = [...messages];
        const lastMessageIndex = processedMessages.length - 1;
        const lastMessage = processedMessages[lastMessageIndex];

        if (lastMessage && lastMessage.role === 'user') {
            const content = [];

            // テキスト部分を追加
            if (typeof lastMessage.content === 'string' && lastMessage.content.trim()) {
                content.push({
                    type: "text",
                    text: lastMessage.content
                });
            }

            // 添付ファイルを追加
            for (const attachment of attachments) {
                if (attachment.type === 'image') {
                    content.push({
                        type: "image_url",
                        image_url: {
                            url: attachment.data
                        }
                    });
                }
            }

            // メッセージの内容を更新
            processedMessages[lastMessageIndex] = {
                ...lastMessage,
                content: content
            };
        }

        return processedMessages;
    }

    /**
     * OpenAI APIリクエストを準備
     */
    #prepareOpenAIRequest(messages, model, stream = false, options = {}) {
        let endpoint, headers = {}, body = {};

        // APIボディの共通パラメータを構築
        const apiBody = {
            model: model,
            messages: messages,
            stream: stream,
            // 必須プロパティ（デフォルト値）
            max_completion_tokens: undefined,
            temperature: undefined,
            max_tokens: undefined,
            top_p: undefined,
            frequency_penalty: undefined,
            presence_penalty: undefined
        };

        // ツール機能を追加
        if (options.enableTools && options.tools && options.tools.length > 0) {
            apiBody.tools = options.tools;
            apiBody.tool_choice = 'auto';
        }

        // GPT-5系モデルの場合は特別な処理が必要
        const isGPT5Model = model.startsWith('gpt-5');
        if (isGPT5Model) {
            // GPT-5系モデルはmax_completion_tokensを使用
            apiBody.max_completion_tokens = window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens;
            // temperatureはデフォルト値(1)のみサポートされているため、
            // デフォルト値以外の場合は省略する（デフォルト値が使用される）
            if (window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature === 1) {
                apiBody.temperature = 1;
            }
            // GPT-5系モデルでは他のパラメータ（top_p, frequency_penalty, presence_penalty）も
            // 制限がある可能性があるため省略
        } else {
            // GPT-4系などの従来モデル
            apiBody.max_tokens = window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens;
            apiBody.temperature = window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature;
            apiBody.top_p = window.CONFIG.AIAPI.DEFAULT_PARAMS.top_p;
            apiBody.frequency_penalty = window.CONFIG.AIAPI.DEFAULT_PARAMS.frequency_penalty;
            apiBody.presence_penalty = window.CONFIG.AIAPI.DEFAULT_PARAMS.presence_penalty;
        }

        // @ts-ignore
        if (window.apiSettings.apiType === 'azure') {
            // Azure OpenAI API - プロキシ経由
            // @ts-ignore
            const azureEndpoint = window.apiSettings.azureEndpoints[model];
            if (!azureEndpoint) {
                throw new Error(`Azure OpenAI: モデル ${model} のエンドポイントが設定されていません`);
            }

            // プロキシエンドポイントを使用
            endpoint = '/azure-openai';
            headers = {
                'Content-Type': 'application/json'
            };

            // プロキシ用のボディ構造
            body = {
                targetUrl: azureEndpoint,
                // @ts-ignore
                apiKey: window.apiSettings.azureApiKey,
                body: apiBody
            };
        } else {
            // OpenAI API
            endpoint = window.CONFIG.AIAPI.ENDPOINTS.OPENAI;
            // @ts-ignore
            headers = {
                // @ts-ignore
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
            body = apiBody;
        }

        return { endpoint, headers, body };
    }

    /**
     * 非ストリーミングでOpenAI APIリクエストを実行
     * @param {string} endpoint - APIエンドポイント
     * @param {Object} headers - リクエストヘッダー
     * @param {Object} body - リクエストボディ
     * @param {AbortSignal} [externalSignal] - 外部からのAbortSignal
     */
    async #executeOpenAIRequest(endpoint, headers, body, externalSignal = null) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, window.CONFIG.AIAPI.REQUEST_TIMEOUT);

        // 外部signalが中断された場合、内部controllerも中断
        if (externalSignal) {
            externalSignal.addEventListener('abort', () => controller.abort());
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenAI APIエラー:', errorText);
                const error = new Error(`OpenAI API error: ${response.status} ${errorText}`);
                error.status = response.status;
                throw error;
            }

            const responseData = await response.json();
            return this.#extractTextFromOpenAIResponse(responseData);

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                // 外部signalによる中断かタイムアウトかを判定
                if (externalSignal?.aborted) {
                    throw error; // AbortErrorをそのまま投げる
                }
                throw new Error('OpenAI APIリクエストがタイムアウトしました');
            }
            throw error;
        }
    }

    /**
     * ストリーミングでOpenAI APIリクエストを実行
     * @param {string} endpoint - APIエンドポイント
     * @param {Object} headers - リクエストヘッダー
     * @param {Object} body - リクエストボディ
     * @param {Function} onChunk - チャンク受信時のコールバック
     * @param {Function} onComplete - 完了時のコールバック
     * @param {Function} [onToolCall] - ツール呼び出し時のコールバック
     * @param {AbortSignal} [externalSignal] - 外部からのAbortSignal
     */
    async #executeStreamOpenAIRequest(endpoint, headers, body, onChunk, onComplete, onToolCall = null, externalSignal = null) {
        const controller = new AbortController();
        let timeoutId;
        let fullText = '';
        let chunkCount = 0;

        // 外部signalが中断された場合、内部controllerも中断
        if (externalSignal) {
            externalSignal.addEventListener('abort', () => controller.abort());
        }

        // ツール呼び出し用の変数
        let currentToolCalls = new Map();
        let toolArgumentBuffers = new Map();

        const resetTimeout = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                controller.abort();
            }, window.CONFIG.AIAPI.STREAM_TIMEOUT);
        };

        resetTimeout();

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenAI APIストリーミングエラー:', errorText);
                throw new Error(`OpenAI API streaming error: ${response.status} ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                
                if (value) {
                    resetTimeout();
                    buffer += decoder.decode(value, { stream: true });
                    
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    
                    for (const line of lines) {
                        if (!line || line === 'data: [DONE]') continue;

                        if (line.startsWith('data: ')) {
                            try {
                                const jsonData = JSON.parse(line.substring(6));

                                // ツール呼び出しの検出
                                if (jsonData.choices && jsonData.choices[0]?.delta?.tool_calls) {
                                    for (const toolCallDelta of jsonData.choices[0].delta.tool_calls) {
                                        const index = toolCallDelta.index || 0;

                                        // 新しいツール呼び出しの開始
                                        if (toolCallDelta.id) {
                                            const toolCall = {
                                                id: toolCallDelta.id,
                                                name: toolCallDelta.function?.name || '',
                                                arguments: {},
                                                status: 'started',
                                                provider: 'openai'
                                            };
                                            currentToolCalls.set(index, toolCall);
                                            toolArgumentBuffers.set(index, '');

                                            if (onToolCall && typeof onToolCall === 'function') {
                                                try {
                                                    onToolCall({ type: 'start', toolCall });
                                                } catch (error) {
                                                    console.warn('ツール呼び出しコールバックエラー:', error);
                                                }
                                            }
                                        }

                                        // 引数のデルタを蓄積
                                        if (toolCallDelta.function?.arguments) {
                                            const buffer = toolArgumentBuffers.get(index) || '';
                                            toolArgumentBuffers.set(index, buffer + toolCallDelta.function.arguments);

                                            if (onToolCall && typeof onToolCall === 'function') {
                                                try {
                                                    onToolCall({
                                                        type: 'delta',
                                                        toolCallId: currentToolCalls.get(index)?.id,
                                                        partialJson: toolCallDelta.function.arguments
                                                    });
                                                } catch (error) {
                                                    console.warn('ツールデルタコールバックエラー:', error);
                                                }
                                            }
                                        }
                                    }
                                }

                                // finish_reason が tool_calls の場合、ツール呼び出し完了
                                if (jsonData.choices && jsonData.choices[0]?.finish_reason === 'tool_calls') {
                                    for (const [index, toolCall] of currentToolCalls.entries()) {
                                        const argBuffer = toolArgumentBuffers.get(index) || '';
                                        try {
                                            toolCall.arguments = argBuffer ? JSON.parse(argBuffer) : {};
                                        } catch (e) {
                                            console.warn('ツール引数のJSONパースに失敗:', e);
                                            toolCall.arguments = {};
                                        }
                                        toolCall.status = 'complete';

                                        if (onToolCall && typeof onToolCall === 'function') {
                                            try {
                                                onToolCall({ type: 'complete', toolCall });
                                            } catch (error) {
                                                console.warn('ツール完了コールバックエラー:', error);
                                            }
                                        }
                                    }
                                    currentToolCalls.clear();
                                    toolArgumentBuffers.clear();
                                }

                                // テキストの抽出
                                const extractedText = this.#extractStreamingText(jsonData);

                                if (extractedText) {
                                    onChunk(extractedText);
                                    fullText += extractedText;
                                    chunkCount++;
                                }
                            } catch (parseError) {
                                console.warn('OpenAI APIストリーミングパースエラー:', parseError, line);
                            }
                        }
                    }
                }
                
                if (done) break;
            }

            clearTimeout(timeoutId);
            
            onComplete(fullText);
            return '';

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                // 外部signalによる中断かタイムアウトかを判定
                if (externalSignal?.aborted) {
                    // 中断時も受信済みのテキストで完了コールバックを呼ぶ
                    if (fullText && onComplete) {
                        onComplete(fullText);
                    }
                    throw error; // AbortErrorをそのまま投げる
                }
                throw new Error('OpenAI APIストリーミングがタイムアウトしました');
            }
            throw error;
        }
    }

    /**
     * OpenAI APIレスポンスからテキストを抽出
     */
    #extractTextFromOpenAIResponse(responseData) {
        if (!responseData.choices || responseData.choices.length === 0) {
            return '';
        }

        const choice = responseData.choices[0];
        if (choice.message && choice.message.content) {
            return choice.message.content;
        }

        return '';
    }

    /**
     * ストリーミングレスポンスからテキストを抽出
     */
    #extractStreamingText(jsonData) {
        if (jsonData.choices && jsonData.choices.length > 0) {
            const choice = jsonData.choices[0];
            if (choice.delta && choice.delta.content) {
                return choice.delta.content;
            }
        }
        return '';
    }
}
