/**
 * api.js
 * OpenAIおよびAzure OpenAI APIとの通信機能を提供します
 */
class AIAPI {
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
     * AI APIを呼び出して応答を得る（統合エントリーポイント）
     * @param {Array} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名
     * @param {Array} attachments - 添付ファイルの配列（任意）
     * @param {Object} options - 追加オプション
     * @param {boolean} options.stream - ストリーミングを使用するかどうか
     * @param {boolean} options.enableWebSearch - Web検索を有効にするかどうか
     * @param {Function} options.onChunk - ストリーミング時のチャンク受信コールバック関数
     * @param {Function} options.onComplete - ストリーミング完了時のコールバック関数
     * @returns {Promise<string>} APIからの応答テキスト（ストリーミングの場合は空文字列）
     * @throws {Error} API設定やリクエストに問題があった場合
     */
    async callAIAPI(messages, model, attachments = [], options = {}) {
        try {
            // サポートされているモデルかチェック
            const allSupportedModels = [...window.CONFIG.MODELS.OPENAI, ...window.CONFIG.MODELS.GEMINI];
            if (!allSupportedModels.includes(model)) {
                throw new Error(`サポートされていないモデルです: ${model}`);
            }
            
            // モデルに応じて適切なAPIを選択
            if (window.CONFIG.MODELS.GEMINI.includes(model)) {
                return await this.callGeminiAPI(messages, model, attachments, options);
            } else {
                return await this.callOpenAIAPI(messages, model, attachments, options);
            }
        } catch (error) {
            console.error('AI API呼び出しエラー:', error);
            throw error;
        }
    }

    /**
     * OpenAIまたはAzure OpenAI APIを呼び出して応答を得る
     * @param {Array} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名
     * @param {Array} attachments - 添付ファイルの配列（任意）
     * @param {Object} options - 追加オプション
     * @param {boolean} options.stream - ストリーミングを使用するかどうか
     * @param {boolean} options.enableWebSearch - GPT-5内蔵Web検索を有効にするかどうか
     * @param {Function} options.onChunk - ストリーミング時のチャンク受信コールバック関数
     * @param {Function} options.onComplete - ストリーミング完了時のコールバック関数
     * @returns {Promise<string>} APIからの応答テキスト（ストリーミングの場合は空文字列）
     * @throws {Error} API設定やリクエストに問題があった場合
     */
    async callOpenAIAPI(messages, model, attachments = [], options = {}) {
        try {
            // GPT-4o/GPT-5シリーズはResponses APIを使用（OpenAI/Azure共通）
            if (model.startsWith('gpt-4o') || model.startsWith('gpt-5')) {
                const responsesApi = ResponsesAPI.getInstance;
                return await responsesApi.callResponsesAPI(messages, model, attachments, options);
            }
            
            // API設定を確認
            this.#validateAPISettings();
            this.#validateModelSettings(model);
            
            // 添付ファイルがある場合はメッセージを処理
            const processedMessages = this.#processAttachments(messages, attachments);
            
            // APIリクエストの準備
            const { endpoint, headers, body, useStream } = this.#prepareAPIRequest(
                processedMessages, 
                model, 
                options.stream, 
                options.enableWebSearch
            );
            
            // ストリーミングモードの場合
            if (useStream) {
                try {
                    // ストリーミングモードでAPIリクエストを実行
                    return await this.#executeStreamAPIRequest(
                        endpoint, 
                        headers, 
                        body, 
                        options.onChunk, 
                        options.onComplete
                    );
                } catch (streamError) {
                    // 組織認証エラーの場合は1回だけリトライを試行
                    if (streamError.message.includes('organization must be verified')) {
                        console.warn(`モデル ${model} でストリーミング組織認証エラーが発生しました。3秒後にリトライします。`);
                        
                        try {
                            // 3秒待機してからリトライ
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            
                            console.log(`モデル ${model} でストリーミングをリトライします。`);
                            return await this.#executeStreamAPIRequest(
                                endpoint, 
                                headers, 
                                body, 
                                options.onChunk, 
                                options.onComplete
                            );
                        } catch (retryError) {
                            console.error(`モデル ${model} でストリーミングリトライも失敗しました:`, retryError);
                            
                            // リトライでも失敗した場合は詳細なメッセージを表示
                            throw new Error(`${model}モデルのストリーミング機能で一時的な問題が発生しています。\n\n【対処法】\n1. 少し時間をおいてから再試行してください\n2. 組織認証状況を確認: https://platform.openai.com/settings/organization/general\n3. 問題が継続する場合は、他のモデル（gpt-4o、gpt-4o-mini）をお試しください\n\n※組織認証完了後も一時的にこのエラーが発生することがあります。`);
                        }
                    }
                    
                    // その他のストリーミングエラーはそのまま投げる
                    console.error(`モデル ${model} でストリーミングエラー:`, streamError);
                    throw streamError;
                }
            } else {
                // 通常モードでAPIリクエストを実行（リトライロジック付き）
                return await this.#executeAPIRequestWithRetry(endpoint, headers, body);
            }
        } catch (error) {
            console.error('API呼び出しエラー:', error);
            
            // より詳細なエラーメッセージを返す
            if (error.name === 'AbortError') {
                throw new Error('APIリクエストがタイムアウトしました。インターネット接続を確認するか、後でもう一度お試しください。');
            } else if (error.message.includes('429')) {
                throw new Error('APIリクエストの頻度が高すぎます。しばらく待ってから再試行してください。');
            } else if (error.message.includes('401')) {
                throw new Error('APIキーが無効です。API設定を確認してください。');
            } else if (error.message.includes('403')) {
                throw new Error('APIキーに十分な権限がありません。API設定を確認してください。');
            } else if (error.message.includes('404')) {
                throw new Error('指定されたモデルまたはエンドポイントが見つかりません。API設定を確認してください。');
            } else if (error.message.includes('organization must be verified')) {
                const model = window.AppState?.getCurrentModel?.() || 'unknown';
                if (model.startsWith('gpt-5') || model.startsWith('o1')) {
                    throw new Error(`${model}モデルを使用するには組織の認証が必要です。\n\n【解決手順】\n1. https://platform.openai.com/settings/organization/general にアクセス\n2. 「Verify Organization」をクリックして組織認証を完了\n3. 認証後、反映まで最大15分お待ちください\n\n一時的に他のモデル（gpt-4o、gpt-4o-mini）のご利用をお勧めします。`);
                } else {
                    throw new Error('このモデルを使用するには組織の認証が必要です。https://platform.openai.com/settings/organization/general にアクセスして「Verify Organization」をクリックしてください。認証後、反映まで最大15分かかる場合があります。');
                }
            } else if (error.message.includes('Unsupported parameter')) {
                const model = window.AppState?.getCurrentModel?.() || 'unknown';
                throw new Error(`モデル "${model}" でサポートされていないパラメータが使用されています: ${error.message}`);
            }
            
            throw error;
        }
    }

    /**
     * API設定を検証する
     * @private
     * @throws {Error} API設定に問題があった場合
     */
    #validateAPISettings() {
        if (!window.apiSettings) {
            throw new Error('API設定が見つかりません。設定画面でAPIキーを設定してください。');
        }
        
        // apiTypeが設定されていない場合のデフォルト値
        window.apiSettings.apiType = window.apiSettings.apiType || 'openai';
        
        // 必要なAPIキーが設定されているか確認
        if (window.apiSettings.apiType === 'azure') {
            if (!window.apiSettings.azureApiKey || window.apiSettings.azureApiKey.trim() === '') {
                throw new Error('Azure APIキーが設定されていません。設定画面でAPIキーを入力してください。');
            }
            
            if (!window.apiSettings.azureEndpoints) {
                throw new Error('Azure OpenAIエンドポイントが設定されていません。設定画面でエンドポイントを入力してください。');
            }
        } else {
            if (!window.apiSettings.openaiApiKey || window.apiSettings.openaiApiKey.trim() === '') {
                throw new Error('OpenAI APIキーが設定されていません。設定画面でAPIキーを入力してください。');
            }
        }
    }

    /**
     * モデル設定を検証する
     * @private
     * @param {string} model - 使用するモデル名
     * @throws {Error} モデル設定に問題があった場合
     */
    #validateModelSettings(model) {
        if (!model) {
            throw new Error('モデルが指定されていません。設定画面でモデルを選択してください。');
        }
        
        if (window.apiSettings.apiType === 'azure') {
            if (!window.apiSettings.azureEndpoints) {
                throw new Error('Azure OpenAIエンドポイントが設定されていません。設定画面でエンドポイントを入力してください。');
            }
            
            const azureEndpoint = window.apiSettings.azureEndpoints[model];
            if (!azureEndpoint || azureEndpoint.trim() === '') {
                throw new Error(`モデル "${model}" のAzure OpenAIエンドポイントが設定されていません。設定画面でエンドポイントを入力してください。`);
            }
            
            // URLの形式を検証
            if (!this.#isValidUrl(azureEndpoint)) {
                throw new Error(`モデル "${model}" のAzure OpenAIエンドポイントのURLが無効です。正しいURLを入力してください。`);
            }
        }
    }
    
    /**
     * 有効なURLかどうかをチェック
     * @private
     * @param {string} url - 検証するURL
     * @returns {boolean} URLが有効な場合はtrue
     */
    #isValidUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    /**
     * 添付ファイルを処理してメッセージに統合する
     * @private
     * @param {Array} messages - 元のメッセージ配列
     * @param {Array} attachments - 添付ファイルの配列
     * @returns {Array} 処理されたメッセージ配列
     */
    #processAttachments(messages, attachments) {
        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('有効なメッセージが指定されていません');
        }
        
        // o1/o1-mini/gpt-5/gpt-5-miniモデルの場合はシステムメッセージをユーザーメッセージに変換
        // 注: GPT-4oシリーズはシステムメッセージをサポートするため変換不要
        const model = window.AppState.getCurrentModel();
        if (model && (model === 'o1' || model === 'o1-mini' || model === 'gpt-5' || model === 'gpt-5-mini')) {
            messages = this.#convertSystemToUserMessage(messages);
        }
        
        if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
            return messages;
        }

        // 配列をディープコピーして元のメッセージを変更しないようにする
        const processedMessages = JSON.parse(JSON.stringify(messages));
        
        // 最後のユーザーメッセージを見つける
        let lastUserMessageIndex = -1;
        for (let i = processedMessages.length - 1; i >= 0; i--) {
            if (processedMessages[i]?.role === 'user') {
                lastUserMessageIndex = i;
                break;
            }
        }
        
        // ユーザーメッセージが見つからない場合は何もせず返す
        if (lastUserMessageIndex === -1) {
            return processedMessages;
        }
        
        // 添付ファイルを持つメッセージを作成
        const userMessage = processedMessages[lastUserMessageIndex];
        const contentItems = [];
        
        // 基本テキストコンテンツ
        let textContent = typeof userMessage.content === 'string' ? userMessage.content : '';
        
        // 添付ファイルのタイプ別に処理
        const validImageAttachments = attachments.filter(
            att => att && att.type === 'image' && att.data && 
            (!att.size || att.size <= window.CONFIG.FILE.MAX_FILE_SIZE || 10 * 1024 * 1024)
        );
        
        const validFileAttachments = attachments.filter(
            att => att && att.type === 'file' && att.name && att.data && att.mimeType &&
            (!att.size || att.size <= window.CONFIG.FILE.MAX_FILE_SIZE || 10 * 1024 *1024)
        );
        
        // 画像添付ファイルをcontent_urlタイプとして追加
        validImageAttachments.forEach(attachment => {
            contentItems.push({
                type: "image_url",
                image_url: {
                    url: attachment.data,
                    detail: "auto"
                }
            });
        });
                
        // テキストコンテンツを追加
        if (textContent || contentItems.length === 0) {
            contentItems.unshift({
                type: "text",
                text: textContent
            });
        }
        
        // メッセージを更新
        if (contentItems.length > 1) {
            // 複数のコンテンツアイテムがある場合は配列形式で設定
            processedMessages[lastUserMessageIndex].content = contentItems;
        } else if (contentItems.length === 1 && contentItems[0].type === "text") {
            // テキストのみの場合は単純な文字列として設定
            processedMessages[lastUserMessageIndex].content = contentItems[0].text;
        }

        return processedMessages;
    }

    /**
     * システムメッセージをユーザーメッセージに変換する
     * @private
     * @param {Array} messages - 元のメッセージ配列
     * @returns {Array} 変換後のメッセージ配列
     */
    #convertSystemToUserMessage(messages) {
        const convertedMessages = [];
        let systemContent = '';
        
        for (const message of messages) {
            if (message.role === 'system') {
                // システムメッセージの内容を蓄積
                systemContent = (systemContent ? systemContent + '\n\n' : '') + message.content;
            } else if (message.role === 'user' && systemContent) {
                // ユーザーメッセージの前にシステムメッセージを追加
                convertedMessages.push({
                    role: 'user',
                    content: systemContent + '\n\n' + message.content
                });
                systemContent = ''; // システムメッセージをクリア
            } else {
                convertedMessages.push(message);
            }
        }
        
        // 最後に残っているシステムメッセージがあれば、ユーザーメッセージとして追加
        if (systemContent) {
            convertedMessages.push({
                role: 'user',
                content: systemContent
            });
        }
        return convertedMessages;
    }
    
    /**
     * ファイルサイズを読みやすい形式に変換
     * @private
     * @param {number} sizeInBytes - バイト単位のサイズ
     * @returns {string} 変換されたサイズ文字列
     */
    #formatFileSize(sizeInBytes) {
        if (!sizeInBytes) return '不明';
        
        if (sizeInBytes < 1024) {
            return sizeInBytes + 'B';
        } else if (sizeInBytes < 1024 * 1024) {
            return Math.round(sizeInBytes / 1024) + 'KB';
        } else {
            return (sizeInBytes / (1024 * 1024)).toFixed(1) + 'MB';
        }
    }

    /**
     * APIリクエストの設定を準備する
     * @private
     * @param {Array} messages - 処理済みメッセージ配列
     * @param {string} model - 使用するモデル名
     * @param {boolean} useStream - ストリーミングを使用するかどうか
     * @param {boolean} enableWebSearch - Web検索機能を有効にするかどうか
     * @returns {Object} エンドポイント、ヘッダー、ボディを含むオブジェクト
     */
    #prepareAPIRequest(messages, model, useStream, enableWebSearch = false) {
        let endpoint, headers = {}, body = {};
        
        // o1/o1-mini/gpt-5/gpt-5-miniモデルかどうかをチェック
        const isSpecialModel = model.startsWith('o1') || model.startsWith('gpt-5');

        // 共通のボディパラメータを設定
        body = {
            messages: messages
        };

        // Web検索機能設定はResponses APIに移行（GPT-4o/GPT-5はResponses APIで処理される）
        if (enableWebSearch && !model.startsWith('gpt-4o') && !model.startsWith('gpt-5')) {
            console.log(`Chat Completions APIではWeb検索を無効化: ${model}`);
        }

        // モデルに応じて適切なパラメータを設定
        if (isSpecialModel) {
            // 推論モデルは最小限のパラメータのみサポート
            body.max_completion_tokens = window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens;
            // temperature, top_p, presence_penalty, frequency_penalty等は送信しない
        } else {
            // 通常のGPTモデルは全パラメータをサポート
            body.temperature = window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature;
            body.max_tokens = window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens;
            body.top_p = window.CONFIG.AIAPI.DEFAULT_PARAMS.top_p;
            body.frequency_penalty = window.CONFIG.AIAPI.DEFAULT_PARAMS.frequency_penalty;
            body.presence_penalty = window.CONFIG.AIAPI.DEFAULT_PARAMS.presence_penalty;
        }
        
        if (window.apiSettings.apiType === 'openai') {
            // OpenAI API
            endpoint = window.CONFIG.AIAPI.ENDPOINTS.OPENAI;
            headers = {
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
            body.model = model;
        } else {
            // Azure OpenAI API
            endpoint = window.apiSettings.azureEndpoints[model];
            
            // エンドポイントにクエリパラメータがない場合は追加
            if (endpoint && !endpoint.includes('?')) {
                endpoint += `?api-version=${window.CONFIG.AIAPI.AZURE_API_VERSION}`;
            }
            
            headers = {
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
        }
        
        return { 
            endpoint, 
            headers, 
            body: JSON.stringify(body),
            useStream
        };
    }

    /**
     * リトライロジックを使用してAPIリクエストを実行
     * @private
     * @param {string} endpoint - APIエンドポイントURL
     * @param {Object} headers - リクエストヘッダー
     * @param {string} body - リクエストボディ（JSON文字列）
     * @returns {Promise<string>} APIからの応答テキスト
     * @throws {Error} すべてのリトライに失敗した場合
     */
    async #executeAPIRequestWithRetry(endpoint, headers, body) {
        let lastError = null;
        let retryCount = 0;
        
        // リトライ時の待機時間を計算（指数バックオフ）
        const getRetryDelay = (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 10000);
        
        while (retryCount <= window.CONFIG.AIAPI.MAX_RETRIES) {
            try {
                // タイムアウト付きでリクエストを実行
                return await this.#executeAPIRequest(endpoint, headers, body);
            } catch (error) {
                lastError = error;
                
                // 一時的なエラー（リトライ可能）かどうかをチェック
                const isRetryable = 
                    error.name === 'AbortError' || // タイムアウト
                    error.message.includes('429') || // レート制限
                    error.message.includes('500') || // サーバーエラー
                    error.message.includes('502') || // Bad Gateway
                    error.message.includes('503') || // Service Unavailable
                    error.message.includes('504'); // Gateway Timeout
                
                // リトライ不可能なエラーは即座に失敗
                if (!isRetryable) {
                    break;
                }
                
                // 最大リトライ回数に達した場合は失敗
                if (retryCount >= window.CONFIG.AIAPI.MAX_RETRIES) {
                    break;
                }
                
                // リトライ前に待機
                const delay = getRetryDelay(retryCount);
                console.warn(`APIリクエスト失敗 (${error.message})。${delay}ms後にリトライします (${retryCount + 1}/${window.CONFIG.AIAPI.MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                retryCount++;
            }
        }
        
        // すべてのリトライに失敗した場合
        throw lastError || new Error('APIリクエストに失敗しました');
    }

    /**
     * APIリクエストを実行して応答を処理する
     * @private
     * @param {string} endpoint - APIエンドポイントURL
     * @param {Object} headers - リクエストヘッダー
     * @param {string} body - リクエストボディ（JSON文字列）
     * @returns {Promise<string>} APIからの応答テキスト
     * @throws {Error} リクエストに失敗した場合
     */
    async #executeAPIRequest(endpoint, headers, body) {
        let response = null;
        
        try {
            // AbortControllerを使用してタイムアウトを設定
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), window.CONFIG.AIAPI.TIMEOUT_MS);
            
            const startTime = Date.now();
            
            console.log(`APIリクエスト送信: ${endpoint}`);
            
            response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: body,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const responseTime = Date.now() - startTime;
            
            // 非本番環境の場合はレスポンスタイムを出力
            console.log(`APIレスポンス: ${response.status} (${responseTime}ms)`);
            
            if (!response.ok) {
                let errorMessage = `API Error: ${response.status} ${response.statusText}`;
                
                // レスポンスのJSONを取得して詳細なエラーメッセージを取得
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error.message || errorMessage;
                    }
                    console.error('APIエラーの詳細:', errorData);
                } catch (jsonError) {
                    // JSONパースに失敗しても元のエラーメッセージを使用
                    console.error('APIエラーの詳細を取得できませんでした:', jsonError);
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            
            // レスポンスの検証
            if (!data) {
                throw new Error('APIからの応答が空です');
            }
            
            if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
                throw new Error('APIレスポンスに選択肢がありません');
            }
            
            if (!data.choices[0].message) {
                throw new Error('APIレスポンスにメッセージがありません');
            }
            
            return data.choices[0].message.content || '';
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('APIリクエストがタイムアウトしました');
            }
            
            // レスポンスエラーメッセージに詳細を追加
            if (response) {
                error.message = `${error.message} (Status: ${response.status})`;
            }
            
            throw error;
        }
    }
    
    /**
     * ストリーミングモードでAPIリクエストを実行
     * @private
     * @param {string} endpoint - APIエンドポイントURL
     * @param {Object} headers - リクエストヘッダー
     * @param {string} bodyStr - リクエストボディ（JSON文字列）
     * @param {Function} onChunk - 各チャンク受信時のコールバック関数
     * @param {Function} onComplete - ストリーミング完了時のコールバック関数
     * @returns {Promise<string>} 常に空文字を返す（実際の結果はコールバックで処理）
     * @throws {Error} リクエストに失敗した場合
     */
    async #executeStreamAPIRequest(endpoint, headers, bodyStr, onChunk, onComplete) {
        if (typeof onChunk !== 'function') {
            throw new Error('ストリーミングモードでは onChunk コールバック関数が必要です');
        }
        
        if (typeof onComplete !== 'function') {
            throw new Error('ストリーミングモードでは onComplete コールバック関数が必要です');
        }
        
        let chunkCount = 0;
        let lastChunkTime = Date.now();
        
        try {
            // ストリーミングフラグをリクエストに追加
            const body = JSON.parse(bodyStr);
            body.stream = true;
            
            // AbortControllerを使用してタイムアウトを設定
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), window.CONFIG.AIAPI.TIMEOUT_MS);
            
            const startTime = Date.now();
            const modelName = body.model || 'unknown';
            console.log(`ストリーミングAPIリクエスト送信 (${modelName}): ${endpoint}`);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: controller.signal
            });
            
            // リクエスト自体のタイムアウトを解除
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                let errorMessage = `API Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error.message || errorMessage;
                    }
                    console.error('ストリーミングAPIエラーの詳細:', errorData);
                } catch (jsonError) {
                    console.error('ストリーミングAPIエラーの詳細を取得できませんでした:', jsonError);
                }
                throw new Error(errorMessage);
            }
            
            if (!response.body) {
                throw new Error('このブラウザはストリーミングレスポンスをサポートしていません');
            }
            
            // ReadableStreamに変換
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullText = '';
            let buffer = '';  // 不完全なJSONを処理するためのバッファ
            
            // チャンク処理のタイムアウトを設定
            const chunkTimeoutMs = 10000; // 10秒
            
            // 受信したデータを順次処理
            while (true) {
                // チャンク間のタイムアウトをチェック
                const currentTime = Date.now();
                if (chunkCount > 0 && (currentTime - lastChunkTime) > chunkTimeoutMs) {
                    throw new Error('ストリーミングのタイムアウト: チャンク間の時間が長すぎます');
                }
                
                // バイナリデータを文字列に変換し、バッファに追加
                const { done, value } = await reader.read();
                
                // データがある場合は処理
                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                    
                    // バッファを行に分割して処理
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // 最後の不完全な行をバッファに戻す
                    
                    for (const line of lines) {
                        // 空行または'data: [DONE]'は無視
                        if (!line || line === 'data: [DONE]') continue;
                        
                        if (line.startsWith('data: ')) {
                            try {
                                // 'data: ' 接頭辞を削除してJSONをパース
                                const jsonData = JSON.parse(line.substring(6));
                                
                                // チャンクからデルタコンテンツを抽出
                                if (jsonData.choices && jsonData.choices.length > 0) {
                                    const delta = jsonData.choices[0].delta;
                                    
                                    // content属性がある場合のみ処理
                                    if (delta && delta.content) {
                                        onChunk(delta.content);
                                        fullText += delta.content;
                                        chunkCount++;
                                        lastChunkTime = Date.now();
                                    }
                                    
                                    // tool_callsがある場合も処理（GPT-5のWeb検索結果用）
                                    if (delta && delta.tool_calls) {
                                        console.log('Tool calls受信:', delta.tool_calls);
                                        // Web検索結果をテキストに含める
                                        for (const toolCall of delta.tool_calls) {
                                            if (toolCall.function) {
                                                if (toolCall.function.name === 'web_search') {
                                                    console.log('Web検索実行中...');
                                                    // Web検索実行中のメッセージを表示
                                                    onChunk('\n🌐 Web検索を実行中...\n');
                                                    chunkCount++;
                                                } else if (toolCall.function.arguments) {
                                                    // ツール呼び出しの結果をコンテンツに追加
                                                    const toolContent = toolCall.function.arguments;
                                                    if (toolContent) {
                                                        onChunk(toolContent);
                                                        fullText += toolContent;
                                                        chunkCount++;
                                                        lastChunkTime = Date.now();
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                // Web検索結果が直接含まれる場合も処理
                                if (jsonData.web_search_results) {
                                    console.log('Web検索結果を受信:', jsonData.web_search_results);
                                    const searchResults = `\n🌐 Web検索結果:\n${JSON.stringify(jsonData.web_search_results, null, 2)}\n`;
                                    onChunk(searchResults);
                                    fullText += searchResults;
                                    chunkCount++;
                                }
                            } catch (parseError) {
                                console.warn('JSONパースエラー:', parseError, line);
                                // パースエラーは無視して続行
                            }
                        }
                    }
                }
                
                if (done) break;
            }
            
            const responseTime = Date.now() - startTime;
            console.log(`ストリーミングAPIレスポンス完了: ${responseTime}ms, ${chunkCount}チャンク`);
            
            // すべてのデータを受信した後、完了コールバックを呼び出す
            onComplete(fullText);
            return '';
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('ストリーミングAPIリクエストがタイムアウトしました');
            }
            
            // エラー情報にチャンク数を追加
            error.message = `${error.message} (処理済みチャンク数: ${chunkCount})`;
            throw error;
        }
    }

    /**
     * 画像ファイルをbase64エンコードする
     * @param {File} file - 画像ファイル
     * @returns {Promise<string>} base64エンコードされた画像データ
     */
    #encodeImageToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file || !(file instanceof File)) {
                reject(new Error('有効なファイルが指定されていません'));
                return;
            }
            
            // サイズチェック
            if (file.size > window.CONFIG.FILE.MAX_FILE_SIZE) {
                reject(new Error(`ファイルサイズが大きすぎます (${this.#formatFileSize(file.size)}). 最大サイズは${this.#formatFileSize(window.CONFIG.FILE.MAX_FILE_SIZE)}です。`));
                return;
            }
            
            // タイプチェック
            if (!file.type.startsWith('image/')) {
                reject(new Error(`ファイルタイプ ${file.type} は画像ではありません`));
                return;
            }
            
            const reader = new FileReader();
            
            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                reader.abort();
                reject(new Error('ファイル読み込みがタイムアウトしました'));
            }, window.CONFIG.FILE.FILE_READ_TIMEOUT);
            
            reader.onload = () => {
                clearTimeout(timeoutId);
                resolve(reader.result);
            };
            
            reader.onerror = (error) => {
                clearTimeout(timeoutId);
                console.error('ファイルのエンコードに失敗しました:', error);
                reject(new Error('ファイルの読み込みに失敗しました'));
            };
            
            reader.readAsDataURL(file);
        });
    }

    /**
     * Google Gemini APIを呼び出して応答を得る
     * @param {Array} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名
     * @param {Array} attachments - 添付ファイルの配列（任意）
     * @param {Object} options - 追加オプション
     * @param {boolean} options.stream - ストリーミングを使用するかどうか
     * @param {Function} options.onChunk - ストリーミング時のチャンク受信コールバック関数
     * @param {Function} options.onComplete - ストリーミング完了時のコールバック関数
     * @returns {Promise<string>} APIからの応答テキスト（ストリーミングの場合は空文字列）
     * @throws {Error} API設定やリクエストに問題があった場合
     */
    async callGeminiAPI(messages, model, attachments = [], options = {}) {
        try {
            // Gemini API設定を確認
            this.#validateGeminiSettings();
            
            // メッセージをGemini形式に変換
            const geminiContents = this.#convertToGeminiFormat(messages, attachments);
            
            // システムインストラクションを抽出
            const systemInstruction = this.#extractSystemInstruction(messages);
            
            // APIリクエストの準備
            const { endpoint, headers, body } = this.#prepareGeminiRequest(
                model, 
                geminiContents, 
                systemInstruction, 
                options
            );
            
            console.log(`Gemini APIリクエスト送信 (${model}):`, endpoint);
            console.log('📡 ストリーミング有効:', options.stream);
            
            // ストリーミングモードかどうかで分岐
            if (options.stream) {
                return await this.#executeStreamGeminiRequest(
                    endpoint, 
                    headers, 
                    body, 
                    options.onChunk, 
                    options.onComplete
                );
            } else {
                return await this.#executeGeminiRequest(endpoint, headers, body);
            }
            
        } catch (error) {
            console.error('Gemini API呼び出しエラー:', error);
            
            // より詳細なエラーメッセージを返す
            if (error.name === 'AbortError') {
                throw new Error('Gemini APIリクエストがタイムアウトしました。インターネット接続を確認するか、後でもう一度お試しください。');
            } else if (error.message.includes('429')) {
                throw new Error('Gemini APIリクエストの頻度が高すぎます。しばらく待ってから再試行してください。');
            } else if (error.message.includes('400')) {
                throw new Error('Gemini APIリクエストが無効です。メッセージ内容やモデル設定を確認してください。');
            } else if (error.message.includes('401') || error.message.includes('403')) {
                throw new Error('Gemini APIキーが無効です。API設定を確認してください。');
            }
            
            throw error;
        }
    }

    /**
     * Gemini API設定を検証する
     * @private
     * @throws {Error} API設定に問題があった場合
     */
    #validateGeminiSettings() {
        if (!window.apiSettings || !window.apiSettings.geminiApiKey || window.apiSettings.geminiApiKey.trim() === '') {
            throw new Error('Gemini APIキーが設定されていません。設定画面でAPIキーを入力してください。');
        }
    }

    /**
     * メッセージをGemini API形式に変換する
     * @private
     * @param {Array} messages - 元のメッセージ配列
     * @param {Array} attachments - 添付ファイルの配列
     * @returns {Array} Gemini形式のコンテンツ配列
     */
    #convertToGeminiFormat(messages, attachments = []) {
        const contents = [];
        
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            
            // システムメッセージはスキップ（別途system_instructionとして処理）
            if (message.role === 'system') {
                continue;
            }
            
            const isLastUserMessage = i === messages.length - 1 && message.role === 'user';
            const parts = [];
            
            // テキスト部分を追加
            if (message.content && typeof message.content === 'string' && message.content.trim()) {
                parts.push({
                    text: message.content
                });
            } else if (Array.isArray(message.content)) {
                // OpenAI形式の複数コンテンツを処理
                for (const contentItem of message.content) {
                    if (contentItem.type === 'text' && contentItem.text) {
                        parts.push({
                            text: contentItem.text
                        });
                    } else if (contentItem.type === 'image_url' && contentItem.image_url) {
                        // base64画像をGemini形式に変換
                        const imageData = contentItem.image_url.url;
                        if (imageData.startsWith('data:')) {
                            const [header, base64Data] = imageData.split(',');
                            const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
                            
                            parts.push({
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Data
                                }
                            });
                        }
                    }
                }
            }
            
            // 最後のユーザーメッセージで添付ファイルがある場合
            if (isLastUserMessage && attachments && attachments.length > 0) {
                for (const attachment of attachments) {
                    if (attachment.type === 'image' && attachment.data) {
                        // base64画像をGemini形式に変換
                        const imageData = attachment.data;
                        if (imageData.startsWith('data:')) {
                            const [header, base64Data] = imageData.split(',');
                            const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
                            
                            parts.push({
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Data
                                }
                            });
                        }
                    }
                }
            }
            
            if (parts.length > 0) {
                contents.push({
                    role: message.role === 'assistant' ? 'model' : 'user',
                    parts: parts
                });
            }
        }
        
        return contents;
    }

    /**
     * システムインストラクションを抽出する
     * @private
     * @param {Array} messages - メッセージ配列
     * @returns {Object|null} システムインストラクション
     */
    #extractSystemInstruction(messages) {
        const systemMessages = messages.filter(msg => msg.role === 'system');
        if (systemMessages.length === 0) {
            return null;
        }
        
        const combinedSystemContent = systemMessages
            .map(msg => msg.content)
            .join('\n\n');
            
        return {
            parts: [
                {
                    text: combinedSystemContent
                }
            ]
        };
    }

    /**
     * Gemini APIリクエストを準備する
     * @private
     * @param {string} model - モデル名
     * @param {Array} contents - Gemini形式のコンテンツ
     * @param {Object|null} systemInstruction - システムインストラクション
     * @param {Object} options - オプション
     * @returns {Object} エンドポイント、ヘッダー、ボディを含むオブジェクト
     */
    #prepareGeminiRequest(model, contents, systemInstruction, options) {
        const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        const action = options.stream ? 'streamGenerateContent' : 'generateContent';
        const endpoint = `${baseUrl}/models/${model}:${action}`;
        
        const headers = {
            'x-goog-api-key': window.apiSettings.geminiApiKey,
            'Content-Type': 'application/json'
        };
        
        const body = {
            contents: contents
        };
        
        // システムインストラクションを追加
        if (systemInstruction) {
            body.system_instruction = systemInstruction;
        }
        
        // 生成設定を追加
        body.generationConfig = {
            temperature: window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature || 0.7,
            topP: window.CONFIG.AIAPI.DEFAULT_PARAMS.top_p || 0.8,
            topK: window.CONFIG.AIAPI.DEFAULT_PARAMS.top_k || 40,
            maxOutputTokens: window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens || 2048,
        };
        
        return { endpoint, headers, body };
    }

    /**
     * 非ストリーミングでGemini APIリクエストを実行
     * @private
     * @param {string} endpoint - APIエンドポイントURL
     * @param {Object} headers - リクエストヘッダー
     * @param {Object} body - リクエストボディ
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async #executeGeminiRequest(endpoint, headers, body) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, window.CONFIG.AIAPI.REQUEST_TIMEOUT || 60000);

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
                console.error('Gemini APIエラー:', errorText);
                throw new Error(`Gemini API error: ${response.status} ${errorText}`);
            }

            const responseData = await response.json();

            // レスポンスからテキストを抽出
            if (responseData.candidates && responseData.candidates.length > 0) {
                const candidate = responseData.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    return candidate.content.parts
                        .filter(part => part.text)
                        .map(part => part.text)
                        .join('');
                }
            }

            return '';

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Gemini APIリクエストがタイムアウトしました');
            }
            throw error;
        }
    }

    /**
     * ストリーミングでGemini APIリクエストを実行
     * @private
     * @param {string} endpoint - APIエンドポイントURL
     * @param {Object} headers - リクエストヘッダー
     * @param {Object} body - リクエストボディ
     * @param {Function} onChunk - チャンク受信コールバック
     * @param {Function} onComplete - 完了コールバック
     * @returns {Promise<string>} 空文字列
     */
    async #executeStreamGeminiRequest(endpoint, headers, body, onChunk, onComplete) {
        const controller = new AbortController();
        let timeoutId;
        let fullText = '';
        let chunkCount = 0;

        const resetTimeout = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                controller.abort();
            }, window.CONFIG.AIAPI.STREAM_TIMEOUT || 30000);
        };

        resetTimeout();

        try {
            // console.log(`Gemini APIストリーミングリクエスト送信: ${JSON.stringify(body)}`);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gemini APIストリーミングエラー:', errorText);
                throw new Error(`Gemini API streaming error: ${response.status} ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let braceCount = 0;
            let bracketCount = 0;
            let currentJson = '';
            let isInJson = false;

            while (true) {
                const { done, value } = await reader.read();
                
                if (value) {
                    resetTimeout();
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    
                    // 文字ごとに処理してJSONオブジェクトを組み立て
                    for (let i = 0; i < chunk.length; i++) {
                        const char = chunk[i];
                        currentJson += char;
                        
                        if (char === '[') {
                            bracketCount++;
                            if (!isInJson) isInJson = true;
                        } else if (char === ']') {
                            bracketCount--;
                        } else if (char === '{') {
                            braceCount++;
                            if (!isInJson) isInJson = true;
                        } else if (char === '}') {
                            braceCount--;
                        }
                        
                        // 完全なJSONが完成した場合（配列またはオブジェクト）
                        if (isInJson && braceCount === 0 && bracketCount === 0 && currentJson.trim()) {
                            try {
                                // console.log('� 完成したJSON:', currentJson.trim());
                                const jsonData = JSON.parse(currentJson.trim());
                                
                                // Gemini APIは配列形式で応答するため、最初の要素を取得
                                const responseData = Array.isArray(jsonData) ? jsonData[0] : jsonData;
                                // console.log('📋 処理対象データ:', responseData);
                                
                                if (responseData.candidates && responseData.candidates.length > 0) {
                                    const candidate = responseData.candidates[0];
                                    if (candidate.content && candidate.content.parts) {
                                        for (const part of candidate.content.parts) {
                                            if (part.text) {
                                                onChunk(part.text);
                                                fullText += part.text;
                                                chunkCount++;
                                            }
                                        }
                                    }
                                }
                            } catch (parseError) {
                                console.warn('Gemini JSONパースエラー:', parseError, 'JSON:', currentJson.trim());
                            }
                            
                            // 次のJSONオブジェクトのためにリセット
                            currentJson = '';
                            isInJson = false;
                            braceCount = 0;
                            bracketCount = 0;
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
                throw new Error('Gemini APIストリーミングがタイムアウトしました');
            }
            throw error;
        }
    }
}
