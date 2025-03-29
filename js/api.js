/**
 * api.js
 * OpenAIおよびAzure OpenAI APIとの通信機能を提供します
 */

// グローバルスコープに関数を公開
window.API = {
    /**
     * デフォルト設定
     * @private
     * @type {Object}
     */
    _DEFAULTS: {
        MAX_RETRIES: 2,
        TIMEOUT_MS: 60000, // 60秒
        TEMPERATURE: 0.7,
        MAX_TOKENS: 2048,
        OPENAI_ENDPOINT: 'https://api.openai.com/v1/chat/completions'
    },
    
    /**
     * OpenAIまたはAzure OpenAI APIを呼び出して応答を得る
     * @param {Array} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名
     * @param {Array} attachments - 添付ファイルの配列（任意）
     * @returns {Promise<string>} APIからの応答テキスト
     * @throws {Error} API設定やリクエストに問題があった場合
     */
    callOpenAIAPI: async function(messages, model, attachments = []) {
        try {
            // API設定を確認
            this._validateAPISettings();
            this._validateModelSettings(model);
            
            // 添付ファイルがある場合はメッセージを処理
            const processedMessages = this._processAttachments(messages, attachments);
            
            // APIリクエストの準備
            const { endpoint, headers, body } = this._prepareAPIRequest(processedMessages, model);
            
            // リトライロジックでAPIリクエストを実行
            return await this._executeAPIRequestWithRetry(endpoint, headers, body);
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
            }
            
            throw error;
        }
    },

    /**
     * API設定を検証する
     * @private
     * @throws {Error} API設定に問題があった場合
     */
    _validateAPISettings: function() {
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
    },

    /**
     * モデル設定を検証する
     * @private
     * @param {string} model - 使用するモデル名
     * @throws {Error} モデル設定に問題があった場合
     */
    _validateModelSettings: function(model) {
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
            if (!this._isValidUrl(azureEndpoint)) {
                throw new Error(`モデル "${model}" のAzure OpenAIエンドポイントのURLが無効です。正しいURLを入力してください。`);
            }
        }
    },
    
    /**
     * 有効なURLかどうかをチェック
     * @private
     * @param {string} url - 検証するURL
     * @returns {boolean} URLが有効な場合はtrue
     */
    _isValidUrl: function(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch (e) {
            return false;
        }
    },

    /**
     * 添付ファイルを処理してメッセージに統合する
     * @private
     * @param {Array} messages - 元のメッセージ配列
     * @param {Array} attachments - 添付ファイルの配列
     * @returns {Array} 処理されたメッセージ配列
     */
    _processAttachments: function(messages, attachments) {
        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('有効なメッセージが指定されていません');
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
            (!att.size || att.size <= window.FileHandler?.MAX_FILE_SIZE || 10 * 1024 * 1024)
        );
        
        const validFileAttachments = attachments.filter(
            att => att && att.type === 'file' && att.name && att.data && att.mimeType &&
            (!att.size || att.size <= window.FileHandler?.MAX_FILE_SIZE || 10 * 1024 * 1024)
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
        
        // 非画像添付ファイルはテキストに統合
        if (validFileAttachments.length > 0) {
            const filesSummary = validFileAttachments.map(att => 
                `- ${att.name} (${att.mimeType}, ${this._formatFileSize(att.size)})`
            ).join('\n');
            
            textContent += `\n\n添付ファイル情報:\n${filesSummary}\n\n`;
            
            // 添付ファイルの内容を追加
            validFileAttachments.forEach(attachment => {
                textContent += `\n--- ${attachment.name} の内容 ---\n`;
                textContent += attachment.data;
                textContent += '\n--- 添付ファイルの内容ここまで ---\n';
            });
        }
        
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
    },
    
    /**
     * ファイルサイズを読みやすい形式に変換
     * @private
     * @param {number} sizeInBytes - バイト単位のサイズ
     * @returns {string} 変換されたサイズ文字列
     */
    _formatFileSize: function(sizeInBytes) {
        if (!sizeInBytes) return '不明';
        
        if (sizeInBytes < 1024) {
            return sizeInBytes + 'B';
        } else if (sizeInBytes < 1024 * 1024) {
            return Math.round(sizeInBytes / 1024) + 'KB';
        } else {
            return (sizeInBytes / (1024 * 1024)).toFixed(1) + 'MB';
        }
    },

    /**
     * APIリクエストの設定を準備する
     * @private
     * @param {Array} messages - 処理済みメッセージ配列
     * @param {string} model - 使用するモデル名
     * @returns {Object} エンドポイント、ヘッダー、ボディを含むオブジェクト
     */
    _prepareAPIRequest: function(messages, model) {
        let endpoint, headers = {}, body = {};
        
        if (window.apiSettings.apiType === 'openai') {
            // OpenAI API
            endpoint = this._DEFAULTS.OPENAI_ENDPOINT;
            
            headers = {
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
            
            body = {
                model: model,
                messages: messages,
                temperature: this._DEFAULTS.TEMPERATURE,
                max_tokens: this._DEFAULTS.MAX_TOKENS
            };
        } else {
            // Azure OpenAI API
            endpoint = window.apiSettings.azureEndpoints[model];
            
            // エンドポイントにクエリパラメータがない場合は追加
            if (endpoint && !endpoint.includes('?')) {
                endpoint += '?api-version=2023-05-15';
            }
            
            headers = {
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
            
            body = {
                messages: messages,
                temperature: this._DEFAULTS.TEMPERATURE,
                max_tokens: this._DEFAULTS.MAX_TOKENS
            };
        }
        
        // 非本番環境の場合はデバッグ情報を出力
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('APIリクエスト:', {
                endpoint: endpoint,
                model: model,
                apiType: window.apiSettings.apiType,
                messageCount: messages.length
            });
        }
        
        return { 
            endpoint, 
            headers, 
            body: JSON.stringify(body)
        };
    },

    /**
     * リトライロジックを使用してAPIリクエストを実行
     * @private
     * @param {string} endpoint - APIエンドポイントURL
     * @param {Object} headers - リクエストヘッダー
     * @param {string} body - リクエストボディ（JSON文字列）
     * @returns {Promise<string>} APIからの応答テキスト
     * @throws {Error} すべてのリトライに失敗した場合
     */
    _executeAPIRequestWithRetry: async function(endpoint, headers, body) {
        let lastError = null;
        let retryCount = 0;
        
        // リトライ時の待機時間を計算（指数バックオフ）
        const getRetryDelay = (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 10000);
        
        while (retryCount <= this._DEFAULTS.MAX_RETRIES) {
            try {
                // タイムアウト付きでリクエストを実行
                return await this._executeAPIRequest(endpoint, headers, body);
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
                if (retryCount >= this._DEFAULTS.MAX_RETRIES) {
                    break;
                }
                
                // リトライ前に待機
                const delay = getRetryDelay(retryCount);
                console.warn(`APIリクエスト失敗 (${error.message})。${delay}ms後にリトライします (${retryCount + 1}/${this._DEFAULTS.MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                retryCount++;
            }
        }
        
        // すべてのリトライに失敗した場合
        throw lastError || new Error('APIリクエストに失敗しました');
    },

    /**
     * APIリクエストを実行して応答を処理する
     * @private
     * @param {string} endpoint - APIエンドポイントURL
     * @param {Object} headers - リクエストヘッダー
     * @param {string} body - リクエストボディ（JSON文字列）
     * @returns {Promise<string>} APIからの応答テキスト
     * @throws {Error} リクエストに失敗した場合
     */
    _executeAPIRequest: async function(endpoint, headers, body) {
        let response = null;
        
        try {
            // AbortControllerを使用してタイムアウトを設定
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._DEFAULTS.TIMEOUT_MS);
            
            const startTime = Date.now();
            
            response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: body,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const responseTime = Date.now() - startTime;
            
            // 非本番環境の場合はレスポンスタイムを出力
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log(`APIレスポンス: ${response.status} (${responseTime}ms)`);
            }
            
            if (!response.ok) {
                let errorMessage = `API Error: ${response.status} ${response.statusText}`;
                
                // レスポンスのJSONを取得して詳細なエラーメッセージを取得
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error.message || errorMessage;
                    }
                } catch (jsonError) {
                    // JSONパースに失敗しても元のエラーメッセージを使用
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
    },
    
    /**
     * 画像ファイルをbase64エンコードする
     * @param {File} file - 画像ファイル
     * @returns {Promise<string>} base64エンコードされた画像データ
     */
    encodeImageToBase64: function(file) {
        return new Promise((resolve, reject) => {
            if (!file || !(file instanceof File)) {
                reject(new Error('有効なファイルが指定されていません'));
                return;
            }
            
            // サイズチェック
            const maxFileSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxFileSize) {
                reject(new Error(`ファイルサイズが大きすぎます (${this._formatFileSize(file.size)}). 最大サイズは${this._formatFileSize(maxFileSize)}です。`));
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
            }, 30000); // 30秒
            
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
};