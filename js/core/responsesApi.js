/**
 * responsesApi.js
 * OpenAI Responses API専用の通信機能を提供します
 */
class ResponsesAPI {
    static #instance = null;

    constructor() {
        if (ResponsesAPI.#instance) {
            return ResponsesAPI.#instance;
        }
        ResponsesAPI.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ResponsesAPI.#instance) {
            ResponsesAPI.#instance = new ResponsesAPI();
        }
        return ResponsesAPI.#instance;
    }

    /**
     * OpenAI Responses APIを呼び出して応答を得る
     * @param {Array} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名
     * @param {Array} attachments - 添付ファイルの配列（任意）
     * @param {Object} options - 追加オプション
     * @param {boolean} options.stream - ストリーミングを使用するかどうか
     * @param {boolean} options.enableWebSearch - Web検索を有効にするかどうか
     * @param {Function} options.onChunk - ストリーミング時のチャンク受信コールバック関数
     * @param {Function} options.onComplete - ストリーミング完了時のコールバック関数
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async callResponsesAPI(messages, model, attachments = [], options = {}) {
        try {
            // API設定を確認
            this.#validateAPISettings();
            
            // GPT-4o/GPT-5シリーズをサポート
            if (!model.startsWith('gpt-4o') && !model.startsWith('gpt-5')) {
                throw new Error(`Responses APIはGPT-4o/GPT-5シリーズのみサポートしています: ${model}`);
            }
            
            // 添付ファイルがある場合はメッセージを処理
            const processedInput = this.#processInputForResponses(messages, attachments);
            
            // APIリクエストの準備
            const { endpoint, headers, body } = this.#prepareResponsesRequest(
                processedInput, 
                model, 
                options.enableWebSearch,
                options.stream
            );
            
            console.log(`Responses APIリクエスト送信 (${model}):`, endpoint);
            console.log('🔍 Web検索有効:', options.enableWebSearch);
            console.log('📡 ストリーミング有効:', options.stream);
            
            // APIリクエストを実行
            if (options.stream) {
                return await this.#executeStreamResponsesRequest(
                    endpoint, 
                    headers, 
                    body, 
                    options.onChunk, 
                    options.onComplete
                );
            } else {
                return await this.#executeResponsesRequest(endpoint, headers, body);
            }
            
        } catch (error) {
            console.error('Responses API呼び出しエラー:', error);
            throw error;
        }
    }

    /**
     * API設定を検証
     */
    #validateAPISettings() {
        if (!window.apiSettings || !window.apiSettings.openaiApiKey) {
            throw new Error('OpenAI APIキーが設定されていません。設定画面で設定してください。');
        }
    }

    /**
     * メッセージを Responses API の input 形式に変換
     */
    #processInputForResponses(messages, attachments) {
        // 最新のユーザーメッセージを取得
        const userMessages = messages.filter(msg => msg.role === 'user');
        const latestUserMessage = userMessages[userMessages.length - 1];
        
        if (!latestUserMessage) {
            throw new Error('ユーザーメッセージが見つかりません');
        }

        // 添付ファイルがある場合は content 配列形式に変換
        if (attachments && attachments.length > 0) {
            const content = [];
            
            // テキスト部分を追加
            if (typeof latestUserMessage.content === 'string') {
                content.push({
                    type: "input_text",
                    text: latestUserMessage.content
                });
            }
            
            // 添付ファイルを追加
            for (const attachment of attachments) {
                if (attachment.type === 'image') {
                    content.push({
                        type: "input_image",
                        image_url: attachment.data
                    });
                }
            }
            
            return [{
                role: "user",
                content: content
            }];
        }
        
        // シンプルなテキストメッセージの場合
        return latestUserMessage.content;
    }

    /**
     * Responses APIリクエストを準備
     */
    #prepareResponsesRequest(input, model, enableWebSearch, stream = false) {
        let endpoint, headers = {}, body = {};
        
        if (window.apiSettings.apiType === 'openai') {
            // OpenAI API
            endpoint = window.CONFIG.AIAPI.ENDPOINTS.RESPONSES;
            headers = {
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
        } else {
            // Azure OpenAI API - 新しいv1 API形式を使用
            const azureEndpoint = window.apiSettings.azureEndpoints[model];
            if (azureEndpoint) {
                // 既存のChat CompletionsエンドポイントをResponses APIに変換
                // https://xxx.openai.azure.com/openai/deployments/xxx/chat/completions?api-version=xxx
                // → https://xxx.openai.azure.com/openai/v1/responses?api-version=preview
                const baseUrl = azureEndpoint.split('/openai/')[0];
                endpoint = `${baseUrl}/openai/v1/responses?api-version=preview`;
                
                // エンドポイントURLからデプロイメント名を抽出
                const deploymentMatch = azureEndpoint.match(/\/deployments\/([^\/]+)\//);
                if (deploymentMatch) {
                    // デプロイメント名が見つかった場合は、それをモデル名として使用
                    model = deploymentMatch[1];
                }
            } else {
                throw new Error(`Azure OpenAI: モデル ${model} のエンドポイントが設定されていません`);
            }
            
            headers = {
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
        }
        
        body = {
            model: model,
            input: input
        };
        
        // ストリーミングを追加
        if (stream) {
            body.stream = true;
        }
        
        // Web検索ツールを追加
        if (enableWebSearch) {
            body.tools = [
                {
                    type: "web_search"
                }
            ];
        }
        
        return { endpoint, headers, body };
    }

    /**
     * 非ストリーミングでResponses APIリクエストを実行
     */
    async #executeResponsesRequest(endpoint, headers, body) {
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
                console.error('Responses APIエラー:', errorText);
                throw new Error(`Responses API error: ${response.status} ${errorText}`);
            }

            const responseData = await response.json();

            // レスポンスからテキストを抽出
            return this.#extractTextFromResponse(responseData);

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Responses APIリクエストがタイムアウトしました');
            }
            throw error;
        }
    }

    /**
     * ストリーミングでResponses APIリクエストを実行
     */
    async #executeStreamResponsesRequest(endpoint, headers, body, onChunk, onComplete) {
        const controller = new AbortController();
        let timeoutId;
        let fullText = '';
        let chunkCount = 0;
        let processedEvents = new Set(); // 重複イベント防止
        let webSearchStatusMessage = null; // Web検索ステータス管理

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
                console.error('Responses APIストリーミングエラー:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: errorText
                });
                throw new Error(`Responses API streaming error: ${response.status} ${errorText}`);
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
                                
                                // イベントIDがある場合は重複チェック
                                const eventId = jsonData.id || JSON.stringify(jsonData);
                                if (processedEvents.has(eventId)) {
                                    console.log('⏭️ 重複イベントをスキップ:', eventId);
                                    continue;
                                }
                                processedEvents.add(eventId);
                                
                                // Web検索ステータスのチェック
                                const statusResult = this.#handleWebSearchStatus(jsonData, webSearchStatusMessage);
                                if (statusResult.statusMessage !== undefined) {
                                    webSearchStatusMessage = statusResult.statusMessage;
                                }
                                if (statusResult.shouldSkip) {
                                    continue;
                                }
                                
                                const extractedText = this.#extractStreamingText(jsonData);
                                
                                if (extractedText) {
                                    onChunk(extractedText);
                                    fullText += extractedText;
                                    chunkCount++;
                                }
                            } catch (parseError) {
                                console.warn('Responses APIストリーミングパースエラー:', parseError, line);
                            }
                        }
                    }
                }
                
                if (done) break;
            }

            // Web検索ステータスメッセージをクリーンアップ
            if (webSearchStatusMessage) {
                if (window.ChatRenderer && window.ChatRenderer.getInstance && 
                    typeof window.ChatRenderer.getInstance.removeSystemMessage === 'function') {
                    try {
                        window.ChatRenderer.getInstance.removeSystemMessage(webSearchStatusMessage);
                    } catch (cleanupError) {
                        console.warn('ステータスメッセージクリーンアップエラー:', cleanupError);
                    }
                }
            }

            clearTimeout(timeoutId);
            
            onComplete(fullText);
            return '';

        } catch (error) {
            // エラー時もWeb検索ステータスメッセージをクリーンアップ
            if (webSearchStatusMessage) {
                if (window.ChatRenderer && window.ChatRenderer.getInstance && 
                    typeof window.ChatRenderer.getInstance.removeSystemMessage === 'function') {
                    try {
                        window.ChatRenderer.getInstance.removeSystemMessage(webSearchStatusMessage);
                    } catch (cleanupError) {
                        console.warn('ステータスメッセージクリーンアップエラー:', cleanupError);
                    }
                }
            }
            
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Responses APIストリーミングがタイムアウトしました');
            }
            throw error;
        }
    }

    /**
     * Responses APIレスポンスからテキストを抽出
     */
    #extractTextFromResponse(responseData) {
        if (!responseData.output || !responseData.output.length) {
            return '';
        }

        let text = '';
        for (const outputItem of responseData.output) {
            if (outputItem.type === 'message' && outputItem.content) {
                for (const contentItem of outputItem.content) {
                    if (contentItem.type === 'text' && contentItem.text) {
                        text += contentItem.text;
                    } else if (contentItem.type === 'output_text' && contentItem.text) {
                        text += contentItem.text;
                    }
                }
            }
        }

        return text;
    }

    /**
     * Web検索ステータスを処理する
     * @param {Object} jsonData - ストリーミングデータ
     * @param {HTMLElement|null} currentStatusMessage - 現在のステータスメッセージ
     * @returns {Object} {statusMessage: HTMLElement|null, shouldSkip: boolean}
     */
    #handleWebSearchStatus(jsonData, currentStatusMessage) {
        const chatMessages = document.querySelector('#chatMessages');

        if (!chatMessages) {
            return { statusMessage: currentStatusMessage, shouldSkip: false };
        }
        
        // ChatRendererの存在チェック（複数のパターンに対応）
        let chatRenderer = null;
        if (window.ChatRenderer) {
            if (typeof window.ChatRenderer.getInstance === 'function') {
                try {
                    chatRenderer = window.ChatRenderer.getInstance();
                } catch (error) {
                    // エラーは無視して継続
                }
            }
            
            if (!chatRenderer && typeof window.ChatRenderer.addSystemMessage === 'function') {
                // 静的メソッドとして直接使用
                chatRenderer = window.ChatRenderer;
            }
        }
        
        if (!chatRenderer) {
            return this.#handleWebSearchStatusDirect(jsonData, currentStatusMessage, chatMessages);
        }

        // Web検索開始の検出（複数パターンに対応）
        const isWebSearchStarting = jsonData.type === 'response.web_search_call.in_progress' ||
                                   jsonData.type === 'response.web_search_call.searching' ||
                                   (jsonData.output && jsonData.output.some(item => item.type === 'web_search_call'));
                                   
        if (isWebSearchStarting) {
            // 既存のThinkingメッセージを探して更新
            const existingThinkingMessage = chatMessages.querySelector('.message.bot:last-child');
            if (existingThinkingMessage) {
                try {
                    chatRenderer.updateSystemMessage(existingThinkingMessage, '🔍 Web検索を実行中');
                    return { statusMessage: existingThinkingMessage, shouldSkip: true };
                } catch (error) {
                    console.error('🔍 Thinkingメッセージ更新エラー:', error);
                    return this.#handleWebSearchStatusDirect(jsonData, currentStatusMessage, chatMessages);
                }
            }
            
            if (!currentStatusMessage) {
                try {
                    const statusResult = chatRenderer.addSystemMessage(chatMessages, '🔍 Web検索を実行中');
                    return { statusMessage: statusResult.messageDiv, shouldSkip: true };
                } catch (error) {
                    console.error('🔍 システムメッセージ作成エラー:', error);
                    return this.#handleWebSearchStatusDirect(jsonData, currentStatusMessage, chatMessages);
                }
            } else {
                try {
                    chatRenderer.updateSystemMessage(currentStatusMessage, '🔍 Web検索を実行中');
                } catch (error) {
                    console.error('🔍 システムメッセージ更新エラー:', error);
                }
                return { statusMessage: currentStatusMessage, shouldSkip: true };
            }
        }
        
        // Web検索完了の検出
        if (jsonData.type === 'response.web_search_call.completed') {
            if (currentStatusMessage) {
                try {
                    chatRenderer.updateSystemMessage(currentStatusMessage, 'Thinking');
                    return { statusMessage: currentStatusMessage, shouldSkip: true };
                } catch (error) {
                    console.error('🔍 システムメッセージ更新エラー:', error);
                    // 代替として直接DOM更新を試行
                    try {
                        const messageContent = currentStatusMessage.querySelector('.markdown-content');
                        if (messageContent) {
                            messageContent.innerHTML = `<p>Thinking<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>`;
                        }
                        return { statusMessage: currentStatusMessage, shouldSkip: true };
                    } catch (domError) {
                        console.error('🔍 DOM操作更新エラー:', domError);
                    }
                }
                return { statusMessage: currentStatusMessage, shouldSkip: true };
            }
        }
        
        return { statusMessage: currentStatusMessage, shouldSkip: false };
    }

    // 代替のWeb検索ステータス処理（直接DOM操作）
    #handleWebSearchStatusDirect(jsonData, currentStatusMessage, chatMessages) {
        const isWebSearchStarting = jsonData.type === 'response.web_search_call.in_progress' ||
                                   jsonData.type === 'response.web_search_call.searching';
                                   
        if (isWebSearchStarting) {
            // 既存のThinkingメッセージを探して更新
            const existingThinkingMessage = chatMessages.querySelector('.message.bot:last-child');
            if (existingThinkingMessage) {
                try {
                    const messageContent = existingThinkingMessage.querySelector('.markdown-content');
                    if (messageContent) {
                        messageContent.innerHTML = `<p>🔍 Web検索を実行中...<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>`;
                        return { statusMessage: existingThinkingMessage, shouldSkip: true };
                    }
                } catch (error) {
                    // エラーは無視して継続
                }
            }
            
            if (!currentStatusMessage) {
                try {
                    const statusElement = document.createElement('div');
                    statusElement.className = 'system-message web-search-status';
                    statusElement.textContent = '🔍 Web検索を実行中...';
                    statusElement.id = 'web-search-status-' + Date.now();
                    chatMessages.appendChild(statusElement);
                    return { statusMessage: statusElement, shouldSkip: true };
                } catch (error) {
                    console.error('🔍 直接DOM操作エラー:', error);
                    return { statusMessage: currentStatusMessage, shouldSkip: false };
                }
            }
        }
        
        if (jsonData.type === 'response.web_search_call.completed' && currentStatusMessage) {
            try {
                const messageContent = currentStatusMessage.querySelector('.markdown-content');
                if (messageContent) {
                    messageContent.innerHTML = `<p>Thinking<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>`;
                    return { statusMessage: currentStatusMessage, shouldSkip: true };
                } else {
                    // 独立したWeb検索ステータス要素の場合は削除
                    currentStatusMessage.remove();
                    return { statusMessage: null, shouldSkip: true };
                }
            } catch (error) {
                console.error('🔍 直接DOM削除エラー:', error);
                return { statusMessage: null, shouldSkip: true };
            }
        }
        
        return { statusMessage: currentStatusMessage, shouldSkip: false };
    }

    /**
     * ストリーミングレスポンスからテキストを抽出
     */
    #extractStreamingText(jsonData) {
        // 完了イベント（完全なテキスト）は処理しない（重複防止）
        if (jsonData.type === 'response.output_text.done' || 
            jsonData.type === 'response.content_part.done' ||
            jsonData.type === 'response.output_item.done') {
            return '';
        }
        
        // Responses APIストリーミング形式パターン0: response.output_text.delta
        if (jsonData.type === 'response.output_text.delta' && jsonData.delta) {
            return jsonData.delta;
        }
        
        // Responses APIのストリーミング形式パターン1: output配列形式（deltaのみ処理）
        if (jsonData.output && jsonData.output.length > 0) {
            for (const outputItem of jsonData.output) {
                // Web検索結果はシステムメッセージで処理されるため、ここではスキップ
                if (outputItem.type === 'web_search_call') {
                    continue;
                }
                
                // messageタイプでcontentがある場合（完全なメッセージは処理しない）
                if (outputItem.type === 'message' && outputItem.content) {
                    // 完全なメッセージではなく、差分のみ処理
                    if (outputItem.content.length === 1 && outputItem.content[0].type === 'text') {
                        const text = outputItem.content[0].text;
                        // 短いテキストチャンクのみ処理（長いテキストは重複の可能性）
                        if (text && text.length < 500) {
                            return text;
                        }
                    }
                }
            }
        }
        
        // パターン2: 直接的なdelta形式
        if (jsonData.delta && jsonData.delta.content) {
            return jsonData.delta.content;
        }
        
        // パターン3: choices配列形式（Chat Completionsライク）
        if (jsonData.choices && jsonData.choices.length > 0) {
            const choice = jsonData.choices[0];
            if (choice.delta && choice.delta.content) {
                return choice.delta.content;
            }
        }
        
        // パターン4: 直接テキスト形式（短いテキストのみ）
        if (jsonData.text && jsonData.text.length < 500) {
            return jsonData.text;
        }
        
        // パターン5: content直接形式（短いコンテンツのみ）
        if (jsonData.content && typeof jsonData.content === 'string' && jsonData.content.length < 500) {
            return jsonData.content;
        }
        
        return '';
    }
}

// グローバルに登録
window.ResponsesAPI = ResponsesAPI;
