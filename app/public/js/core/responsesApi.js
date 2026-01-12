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
     * @param {HTMLElement} options.thinkingContainer - 思考過程コンテナ（任意）
     * @param {Function} options.onChunk - ストリーミング時のチャンク受信コールバック関数
     * @param {Function} options.onComplete - ストリーミング完了時のコールバック関数
     * @param {Function} options.onWebSearchQuery - Web検索クエリ取得時のコールバック関数（任意）
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async callResponsesAPI(messages, model, attachments = [], options = { stream: false, enableWebSearch: false, enableTools: false, tools: [], thinkingContainer: null, onChunk: null, onComplete: null, onWebSearchQuery: null, onToolCall: null }) {
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
                options.stream,
                options.enableTools,
                options.tools
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
                    options.onComplete,
                    options.thinkingContainer,
                    options.onWebSearchQuery,
                    options.onToolCall
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
     * Responses APIはOpenAI/Azure OpenAI専用（GPT-5/GPT-4oモデル）
     * apiTypeに関係なく、有効なAPIキーがあるかを確認
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

        // Azure OpenAIが完全に設定されている場合はAzureを使用
        // @ts-ignore
        if (window.apiSettings.azureApiKey && window.apiSettings.azureEndpoint) {
            return; // Azure設定OK
        }

        // OpenAI APIキーを確認
        // @ts-ignore
        if (!window.apiSettings.openaiApiKey) {
            throw new Error('OpenAI APIキーが設定されていません。設定画面からAPIキーを設定してください。');
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
    #prepareResponsesRequest(processedData, model, enableWebSearch, stream = false, enableTools = false, tools = []) {
        let endpoint, headers = {}, body = {};

        // AppStateで初期化されたキャッシュを使用（存在しない場合はフォールバック）
        // @ts-ignore - apiSettingsはAppStateで初期化されるグローバルプロパティ
        if (!window.apiSettings) {
            console.warn('window.apiSettingsが初期化されていません。Storageから再読み込みします。');
            // @ts-ignore - Storageはカスタムクラス（型定義あり）
            window.apiSettings = Storage.getInstance.loadApiSettings();
        }

        // Responses APIはOpenAI/Azure OpenAI専用
        // apiTypeに関係なく、利用可能なAPI設定を使用

        // @ts-ignore - Azure OpenAIが完全に設定されている場合はAzureを優先
        const useAzure = window.apiSettings.azureApiKey &&
                         window.apiSettings.azureEndpoints &&
                         window.apiSettings.azureEndpoints[model];

        if (useAzure) {
            // Azure OpenAI API - 新しいv1 API形式を使用
            // @ts-ignore
            const azureEndpoint = window.apiSettings.azureEndpoints[model];
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

            // @ts-ignore
            headers = {
                // @ts-ignore
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
        } else {
            // OpenAI API（デフォルト）
            endpoint = window.CONFIG.AIAPI.ENDPOINTS.RESPONSES;
            // @ts-ignore
            headers = {
                // @ts-ignore
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
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
        
        // ツールを追加
        const allTools = [];

        // Web検索ツールを追加
        if (enableWebSearch) {
            allTools.push({
                type: "web_search"
            });
        }

        // カスタムツール（PowerPoint、Excel、Canvas等）を追加
        // Responses APIはfunction形式のツールをサポート
        if (enableTools && tools && tools.length > 0) {
            console.log('🔧 Responses API: カスタムツールを追加中', tools.length, '個');
            for (const tool of tools) {
                // OpenAI Chat Completions形式からResponses API形式に変換
                if (tool.type === 'function' && tool.function) {
                    const responsesTool = {
                        type: 'function',
                        name: tool.function.name,
                        description: tool.function.description,
                        parameters: tool.function.parameters
                    };
                    allTools.push(responsesTool);
                    console.log('🔧 ツール追加:', responsesTool.name);
                }
            }
        }

        if (allTools.length > 0) {
            body.tools = allTools;
            console.log('🔧 Responses API: 最終ツール定義', JSON.stringify(allTools, null, 2));
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
     * @param {string} endpoint - APIエンドポイント
     * @param {Object} headers - リクエストヘッダー
     * @param {Object} body - リクエストボディ
     * @param {Function} onChunk - チャンク受信コールバック
     * @param {Function} onComplete - 完了コールバック
     * @param {HTMLElement|null} thinkingContainer - 思考過程コンテナ
     * @param {Function|null} onWebSearchQuery - Web検索クエリ取得時のコールバック
     * @param {Function|null} onToolCall - ツール呼び出し検出時のコールバック
     */
    async #executeStreamResponsesRequest(endpoint, headers, body, onChunk, onComplete, thinkingContainer = null, onWebSearchQuery = null, onToolCall = null) {
        const controller = new AbortController();
        let timeoutId;
        let fullText = '';
        let chunkCount = 0;
        let processedEvents = new Set(); // 重複イベント防止
        let webSearchStatusMessage = null; // Web検索ステータス管理
        let webSearchAddedToThinking = false; // 思考過程への追加フラグ

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
                                const statusResult = this.#handleWebSearchStatus(jsonData, webSearchStatusMessage, thinkingContainer, webSearchAddedToThinking, onWebSearchQuery);
                                if (statusResult.statusMessage !== undefined) {
                                    webSearchStatusMessage = statusResult.statusMessage;
                                }
                                if (statusResult.addedToThinking) {
                                    webSearchAddedToThinking = true;
                                }
                                if (statusResult.shouldSkip) {
                                    continue;
                                }

                                // ツール呼び出しの検出（PowerPoint、Excel、Canvas等）
                                if (onToolCall && typeof ToolExecutor !== 'undefined') {
                                    const toolCallResult = ToolExecutor.getInstance.detectToolCall(jsonData, 'openai-responses');
                                    if (toolCallResult) {
                                        console.log('🔧 Responses APIツール呼び出し検出:', toolCallResult);
                                        onToolCall(toolCallResult);
                                        // ツール呼び出しイベントはテキスト抽出をスキップ
                                        if (toolCallResult.type === 'complete') {
                                            continue;
                                        }
                                    }
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
     * @param {HTMLElement|null} thinkingContainer - 思考過程コンテナ
     * @param {boolean} alreadyAddedToThinking - 既に思考過程に追加済みかどうか
     * @param {Function|null} onWebSearchQuery - Web検索クエリ取得時のコールバック
     * @returns {Object} {statusMessage: HTMLElement|null, shouldSkip: boolean, addedToThinking: boolean}
     */
    #handleWebSearchStatus(jsonData, currentStatusMessage, thinkingContainer = null, alreadyAddedToThinking = false, onWebSearchQuery = null) {
        // console.log('🔍 jsonData抽出:', jsonData);
        const chatMessages = document.querySelector('#chatMessages');

        if (!chatMessages) {
            return { statusMessage: currentStatusMessage, shouldSkip: false, addedToThinking: false };
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

            // システムメッセージを「Web検索を実行中」に更新
            const searchMessage = searchQuery ?
                `🔍 Web検索を実行中: "${searchQuery}"` :
                '🔍 Web検索を実行中';

            // 既存のThinkingメッセージを探して更新（thinkingContainerの有無に関わらず）
            const existingThinkingMessage = /** @type {HTMLElement|null} */ (chatMessages.querySelector('.message.bot:last-child'));
            if (existingThinkingMessage && chatRenderer) {
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
                } catch (error) {
                    console.error('🔍 Thinkingメッセージ更新エラー:', error);
                }
            }

            // 思考過程コンテナがある場合
            // Web検索開始時はクエリがまだ取得できないので、思考過程への追加はcompletedSearchQueryで行う
            if (thinkingContainer) {
                // addedToThinkingはfalseのまま返す（クエリ確定時に追加するため）
                return { statusMessage: existingThinkingMessage, shouldSkip: true, addedToThinking: false };
            }

            // 思考過程コンテナがない場合の処理
            if (existingThinkingMessage) {
                return { statusMessage: existingThinkingMessage, shouldSkip: true, addedToThinking: false };
            }

            if (!currentStatusMessage && !thinkingContainer) {
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
                    return { statusMessage: statusResult.messageDiv, shouldSkip: true, addedToThinking: false };
                } catch (error) {
                    console.error('🔍 システムメッセージ作成エラー:', error);
                }
            } else if (!thinkingContainer) {
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
                return { statusMessage: currentStatusMessage, shouldSkip: true, addedToThinking: false };
            }

            // thinkingContainerがある場合はシステムメッセージは作成しない
            return { statusMessage: currentStatusMessage, shouldSkip: true, addedToThinking: alreadyAddedToThinking };
        }
        
        // Web検索完了の検出
        if (jsonData.type === 'response.web_search_call.completed') {
            // thinkingContainerがある場合はシステムメッセージをスキップ
            if (thinkingContainer) {
                return { statusMessage: currentStatusMessage, shouldSkip: true, addedToThinking: alreadyAddedToThinking };
            }
            if (currentStatusMessage) {
                // 直後にWeb検索完了後の結果処理中メッセージに移行するためここでは何もしない
                return { statusMessage: currentStatusMessage, shouldSkip: true, addedToThinking: false };
            }
        }

        // Web検索完了後の結果処理中メッセージ
        const completedSearchQuery = extractCompletedSearchQuery(jsonData);
        if (completedSearchQuery) {
            // Web検索クエリ収集コールバックを呼び出し（ページ更新時の復元用）
            if (onWebSearchQuery && typeof onWebSearchQuery === 'function') {
                try {
                    onWebSearchQuery(completedSearchQuery);
                } catch (error) {
                    console.warn('🔍 Web検索クエリコールバックエラー:', error);
                }
            }

            // thinkingContainerがある場合は思考過程に追加（まだ追加されていない場合）
            if (thinkingContainer && chatRenderer && !alreadyAddedToThinking) {
                try {
                    chatRenderer.addThinkingItem(thinkingContainer, 'web-search', completedSearchQuery);
                    console.log('🔍 Web検索を思考過程に追加（確定クエリ）:', completedSearchQuery);
                } catch (error) {
                    console.error('🔍 思考過程への追加エラー:', error);
                }
            }

            // システムメッセージを「検索結果を分析中」に更新（thinkingContainerの有無に関わらず）
            const existingMessage = currentStatusMessage || /** @type {HTMLElement|null} */ (chatMessages.querySelector('.message.bot:last-child'));
            if (existingMessage && chatRenderer) {
                try {
                    const processingMessage = `🔍 検索結果を分析中: "${completedSearchQuery}"`;
                    chatRenderer.updateSystemMessage(
                        existingMessage,
                        processingMessage,
                        {
                            status: 'processing',
                            animate: true,
                            showDots: true
                        }
                    );

                    // 少し遅延して「Thinking...」に戻す
                    setTimeout(() => {
                        try {
                            chatRenderer.updateSystemMessage(
                                existingMessage,
                                'Thinking',
                                {
                                    status: 'thinking',
                                    animate: true,
                                    showDots: true
                                }
                            );
                        } catch (e) {
                            console.warn('Thinkingへの復帰エラー:', e);
                        }
                    }, 1500);
                } catch (error) {
                    console.error('🔍 検索結果処理メッセージ更新エラー:', error);
                }
            }

            if (thinkingContainer) {
                return { statusMessage: existingMessage, shouldSkip: true, addedToThinking: true };
            }

            // thinkingContainerがない場合
            return { statusMessage: existingMessage, shouldSkip: true, addedToThinking: false };
        }

        return { statusMessage: currentStatusMessage, shouldSkip: false, addedToThinking: alreadyAddedToThinking };
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
