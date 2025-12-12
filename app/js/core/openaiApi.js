/**
 * openaiApi.js
 * OpenAI/Azure OpenAI API専用の通信機能を提供します
 */
class OpenAIAPI {
    constructor() {
        if (OpenAIAPI._instance) {
            return OpenAIAPI._instance;
        }
        OpenAIAPI._instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!OpenAIAPI._instance) {
            OpenAIAPI._instance = new OpenAIAPI();
        }
        return OpenAIAPI._instance;
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
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async callOpenAIAPI(messages, model, attachments = [], options = {}) {
        try {
            // API設定を確認
            this.#validateAPISettings();

            // 添付ファイルがある場合はメッセージを処理
            const processedMessages = this.#processMessagesWithAttachments(messages, attachments);

            // APIリクエストを準備
            const { endpoint, headers, body } = this.#prepareOpenAIRequest(processedMessages, model, options.stream);

            console.log(`OpenAI APIリクエスト送信 (${model}):`, endpoint);
            console.log('📡 ストリーミング有効:', options.stream);

            // APIリクエストを実行
            if (options.stream) {
                return await this.#executeStreamOpenAIRequest(
                    endpoint, 
                    headers, 
                    body, 
                    options.onChunk, 
                    options.onComplete
                );
            } else {
                return await this.#executeOpenAIRequest(endpoint, headers, body);
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
        if (window.apiSettings.apiType === 'azure') {
            if (!window.apiSettings.azureApiKey) {
                throw new Error('Azure OpenAI APIキーが設定されていません。設定画面で設定してください。');
            }
        } else {
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
    #prepareOpenAIRequest(messages, model, stream = false) {
        let endpoint, headers = {}, body = {};

        if (window.apiSettings.apiType === 'azure') {
            // Azure OpenAI API
            const azureEndpoint = window.apiSettings.azureEndpoints[model];
            if (azureEndpoint) {
                endpoint = azureEndpoint;
            } else {
                throw new Error(`Azure OpenAI: モデル ${model} のエンドポイントが設定されていません`);
            }

            headers = {
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
        } else {
            // OpenAI API
            endpoint = window.CONFIG.AIAPI.ENDPOINTS.OPENAI;
            headers = {
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
        }

        // リクエストボディを構築
        body = {
            model: model,
            messages: messages,
            stream: stream
        };

        // GPT-5系モデルの場合は特別な処理が必要
        const isGPT5Model = model.startsWith('gpt-5');
        if (isGPT5Model) {
            // GPT-5系モデルはmax_completion_tokensを使用
            body.max_completion_tokens = window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens;
            // temperatureはデフォルト値(1)のみサポートされているため、
            // デフォルト値以外の場合は省略する（デフォルト値が使用される）
            if (window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature === 1) {
                body.temperature = 1;
            }
            // GPT-5系モデルでは他のパラメータ（top_p, frequency_penalty, presence_penalty）も
            // 制限がある可能性があるため省略
        } else {
            // GPT-4系などの従来モデル
            body.max_tokens = window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens;
            body.temperature = window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature;
            body.top_p = window.CONFIG.AIAPI.DEFAULT_PARAMS.top_p;
            body.frequency_penalty = window.CONFIG.AIAPI.DEFAULT_PARAMS.frequency_penalty;
            body.presence_penalty = window.CONFIG.AIAPI.DEFAULT_PARAMS.presence_penalty;
        }

        return { endpoint, headers, body };
    }

    /**
     * 非ストリーミングでOpenAI APIリクエストを実行
     */
    async #executeOpenAIRequest(endpoint, headers, body) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, window.CONFIG.AIAPI.REQUEST_TIMEOUT);

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
                throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
            }

            const responseData = await response.json();
            return this.#extractTextFromOpenAIResponse(responseData);

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('OpenAI APIリクエストがタイムアウトしました');
            }
            throw error;
        }
    }

    /**
     * ストリーミングでOpenAI APIリクエストを実行
     */
    async #executeStreamOpenAIRequest(endpoint, headers, body, onChunk, onComplete) {
        const controller = new AbortController();
        let timeoutId;
        let fullText = '';
        let chunkCount = 0;

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
