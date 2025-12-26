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
    async callResponsesAPI(messages, model, attachments = [], options = { stream: false, enableWebSearch: false, onChunk: null, onComplete: null }) {
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
            // console.log('📦 リクエストボディ:', body);
            
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
        // AppStateで初期化されたキャッシュを使用（存在しない場合はフォールバック）
        // @ts-ignore - apiSettingsはAppStateで初期化されるグローバルプロパティ
        if (!window.apiSettings) {
            console.warn('window.apiSettingsが初期化されていません。Storageから再読み込みします。');
            // @ts-ignore - Storageはカスタムクラス（型定義あり）
            // @ts-ignore
            window.apiSettings = Storage.getInstance.loadApiSettings();
        }
        
        // @ts-ignore
        const apiType = window.apiSettings.apiType || 'openai';
        
        if (apiType === 'openai') {
            // @ts-ignore
            if (!window.apiSettings.openaiApiKey) {
                throw new Error('OpenAI APIキーが設定されていません');
            }
        } else if (apiType === 'azure') {
            // @ts-ignore
            if (!window.apiSettings.azureApiKey) {
                throw new Error('Azure OpenAI APIキーが設定されていません。設定画面で設定してください。');
            }
        } else {
            throw new Error(`Responses APIは現在OpenAIとAzure OpenAIのみサポートしています。現在のapiType: ${apiType}`);
        }
    }

    /**
     * メッセージを Responses API の input 形式に変換
     */
    #processInputForResponses(messages, attachments) {
        if (!messages || messages.length === 0) {
            throw new Error('メッセージが見つかりません');
        }

        // システムプロンプトとメッセージを分離
        const systemMessages = [];
        const conversationMessages = [];
        
        // システムメッセージと会話メッセージを分別
        for (const message of messages) {
            if (message.role === 'system') {
                systemMessages.push(message.content);
            } else {
                conversationMessages.push(message);
            }
        }
        
        // 会話メッセージを処理
        const processedInput = [];
        
        for (let i = 0; i < conversationMessages.length; i++) {
            const message = conversationMessages[i];
            const isLastUserMessage = i === conversationMessages.length - 1 && message.role === 'user';
            
            // アシスタントメッセージの処理
            if (message.role === 'assistant') {
                processedInput.push({
                    role: 'assistant',
                    content: message.content
                });
                continue;
            }
            
            // ユーザーメッセージの処理
            if (message.role === 'user') {
                // 最新のユーザーメッセージで添付ファイルがある場合
                if (isLastUserMessage && attachments && attachments.length > 0) {
                    const content = [];
                    
                    // テキスト部分を追加
                    if (typeof message.content === 'string' && message.content.trim()) {
                        content.push({
                            type: "text",
                            text: message.content
                        });
                    }
                    
                    // 添付ファイルを追加（画像のみサポート）
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
                    
                    processedInput.push({
                        role: 'user',
                        content: content
                    });
                } else {
                    // 通常のテキストメッセージ
                    processedInput.push({
                        role: 'user',
                        content: message.content
                    });
                }
            }
        }
        
        if (processedInput.length === 0) {
            throw new Error('処理可能なメッセージが見つかりません');
        }
        
        // システムプロンプトと入力配列を返す
        return {
            instructions: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
            input: processedInput
        };
    }

    /**
     * Responses APIリクエストを準備
     */
    #prepareResponsesRequest(processedData, model, enableWebSearch, stream = false) {
        let endpoint, headers = {}, body = {};
        
        // AppStateで初期化されたキャッシュを使用（存在しない場合はフォールバック）
        // @ts-ignore - apiSettingsはAppStateで初期化されるグローバルプロパティ
        if (!window.apiSettings) {
            console.warn('window.apiSettingsが初期化されていません。Storageから再読み込みします。');
            // @ts-ignore - Storageはカスタムクラス（型定義あり）
            window.apiSettings = Storage.getInstance.loadApiSettings();
        }
        
        // @ts-ignore
        const apiType = window.apiSettings.apiType || 'openai';
        
        if (apiType === 'openai') {
            // OpenAI API
            endpoint = window.CONFIG.AIAPI.ENDPOINTS.RESPONSES;
            // @ts-ignore
            headers = {
                // @ts-ignore
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
        } else if (apiType === 'azure') {
            // Azure OpenAI API - 新しいv1 API形式を使用
            // @ts-ignore
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
            
            // @ts-ignore
            headers = {
                // @ts-ignore
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
        } else {
            // apiTypeが'openai'でも'azure'でもない場合はエラー
            throw new Error(`Responses APIは現在OpenAIとAzure OpenAIのみサポートしています。現在のapiType: ${apiType}`);
        }
        
        // Responses API形式でボディを構築
        body = {
            model: model,
            input: processedData.input,
            // 必須プロパティ（デフォルト値）
            instructions: undefined,
            stream: false,
            tools: []
        };
        
        // システムプロンプトがある場合はinstructionsに設定
        if (processedData.instructions) {
            body.instructions = processedData.instructions;
        }
        
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
                    // @ts-ignore - headers.entriesはDOM APIで利用可能
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
                // @ts-ignore - ChatRendererはAppStateで初期化されるグローバルプロパティ
                if (window.ChatRenderer && window.ChatRenderer.getInstance && 
                    // @ts-ignore
                    typeof window.ChatRenderer.getInstance.removeSystemMessage === 'function') {
                    try {
                        // @ts-ignore
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
                // @ts-ignore - ChatRendererはAppStateで初期化されるグローバルプロパティ
                if (window.ChatRenderer && window.ChatRenderer.getInstance && 
                    // @ts-ignore
                    typeof window.ChatRenderer.getInstance.removeSystemMessage === 'function') {
                    try {
                        // @ts-ignore
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
        // 最新のResponses API形式: output配列内のmessageタイプを探索
        if (!responseData.output || !responseData.output.length) {
            return '';
        }

        let text = '';
        for (const outputItem of responseData.output) {
            // messageタイプのoutputアイテムを処理
            if (outputItem.type === 'message' && outputItem.content) {
                for (const contentItem of outputItem.content) {
                    // output_textタイプのコンテンツを抽出
                    if (contentItem.type === 'output_text' && contentItem.text) {
                        text += contentItem.text;
                    }
                    // 下位互換性のためtextタイプも処理
                    else if (contentItem.type === 'text' && contentItem.text) {
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
        // console.log('🔍 jsonData抽出:', jsonData);
        const chatMessages = document.querySelector('#chatMessages');

        if (!chatMessages) {
            return { statusMessage: currentStatusMessage, shouldSkip: false };
        }
        
        // ChatRendererの存在チェック（複数のパターンに対応）
        let chatRenderer = null;
        try {
            // ChatRendererクラスの存在確認
            // @ts-ignore - ChatRendererはAppStateで初期化されるグローバルプロパティ
            if (typeof ChatRenderer === 'undefined') {
                throw new Error('ChatRenderer class is not defined');
            }
            // getInstance は静的なgetter
            // @ts-ignore
            chatRenderer = ChatRenderer.getInstance;
        } catch (error) {
            console.warn('ChatRendererが見つかりません。Web検索ステータスの更新はスキップされます。');
        }

        // Web検索クエリを抽出する関数(OPENAI公式でまだ定義されていない)
        const extractSearchQuery = (jsonData) => {
            // output配列からweb_search_callを探す
            if (jsonData.output && Array.isArray(jsonData.output)) {
                const webSearchCall = jsonData.output.find(item => item.type === 'web_search_call');
                if (webSearchCall && webSearchCall.query) {
                    return webSearchCall.query;
                }
            }
            // 直接queryフィールドがある場合
            if (jsonData.query) {
                return jsonData.query;
            }
            return null;
        };

        // Web検索完了時のクエリ抽出関数
        const extractCompletedSearchQuery = (jsonData) => {
            // response.output_item.doneでのweb_search_callからクエリを取得
            if (jsonData.type === 'response.output_item.done' && 
                jsonData.item && 
                jsonData.item.type === 'web_search_call' &&
                jsonData.item.action &&
                jsonData.item.action.query) {
                return jsonData.item.action.query;
            }
            return null;
        };

        // Web検索開始の検出（複数パターンに対応）
        const isWebSearchStarting = jsonData.type === 'response.web_search_call.in_progress' ||
                                   jsonData.type === 'response.web_search_call.searching' ||
                                   (jsonData.output && jsonData.output.some(item => item.type === 'web_search_call'));
                                   
        if (isWebSearchStarting) {
            // 検索クエリを取得
            const searchQuery = extractSearchQuery(jsonData);
            const searchMessage = searchQuery ? 
                `🔍 Web検索を実行中: "${searchQuery}"` : 
                '🔍 Web検索を実行中';
            
            // 既存のThinkingメッセージを探して更新
            const existingThinkingMessage = /** @type {HTMLElement|null} */ (chatMessages.querySelector('.message.bot:last-child'));
            if (existingThinkingMessage) {
                try {
                    chatRenderer.updateSystemMessage(
                        existingThinkingMessage, 
                        searchMessage,
                        { 
                            status: 'searching', 
                            animate: true, 
                            showDots: true 
                        }
                    );
                    return { statusMessage: existingThinkingMessage, shouldSkip: true };
                } catch (error) {
                    console.error('🔍 Thinkingメッセージ更新エラー:', error);
                }
            }
            
            if (!currentStatusMessage) {
                try {
                    const statusResult = chatRenderer.addSystemMessage(
                        /** @type {HTMLElement} */ (chatMessages), 
                        searchMessage,
                        { 
                            status: 'searching', 
                            animation: 'gradient', 
                            showDots: true 
                        }
                    );
                    return { statusMessage: statusResult.messageDiv, shouldSkip: true };
                } catch (error) {
                    console.error('🔍 システムメッセージ作成エラー:', error);
                }
            } else {
                try {
                    chatRenderer.updateSystemMessage(
                        currentStatusMessage, 
                        searchMessage,
                        { 
                            status: 'searching', 
                            animate: true, 
                            showDots: true 
                        }
                    );
                } catch (error) {
                    console.error('🔍 システムメッセージ更新エラー:', error);
                }
                return { statusMessage: currentStatusMessage, shouldSkip: true };
            }
        }
        
        // Web検索完了の検出
        if (jsonData.type === 'response.web_search_call.completed') {
            if (currentStatusMessage) {
                // 直後にWeb検索完了後の結果処理中メッセージに移行するためここでは何もしない
                return { statusMessage: currentStatusMessage, shouldSkip: true };
            }
        }

        // Web検索完了後の結果処理中メッセージ
        const completedSearchQuery = extractCompletedSearchQuery(jsonData);
        if (completedSearchQuery) {
            if (currentStatusMessage) {
                try {
                    const processingMessage = `🔍 検索結果を分析中: "${completedSearchQuery}"`;
                    chatRenderer.updateSystemMessage(
                        currentStatusMessage, 
                        processingMessage,
                        { 
                            status: 'processing', 
                            animate: true, 
                            showDots: true 
                        }
                    );
                    return { statusMessage: currentStatusMessage, shouldSkip: true };
                } catch (error) {
                    console.error('🔍 検索結果処理メッセージ更新エラー:', error);
                    // 代替として直接DOM更新を試行
                    try {
                        const messageContent = /** @type {HTMLElement|null} */ (currentStatusMessage.querySelector('.markdown-content'));
                        if (messageContent) {
                            const processingMessage = `🔍 検索結果を分析中: "${completedSearchQuery}"`;
                            messageContent.innerHTML = `<p>${processingMessage}<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>`;
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
