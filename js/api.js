/**
 * api.js
 * OpenAIおよびAzure OpenAI APIとの通信機能を提供します
 */

// グローバルスコープに関数を公開
window.API = {
    /**
     * OpenAIまたはAzure OpenAI APIを呼び出して応答を得る
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
    callOpenAIAPI: async function(messages, model, attachments = [], options = {}) {
        try {
            // API設定を確認
            this._validateAPISettings();
            this._validateModelSettings(model);
            
            // 添付ファイルがある場合はメッセージを処理
            const processedMessages = this._processAttachments(messages, attachments);
            
            // APIリクエストの準備
            const { endpoint, headers, body, useStream } = this._prepareAPIRequest(processedMessages, model, options.stream);
            
            // ストリーミングモードの場合
            if (useStream) {
                // ストリーミングモードでAPIリクエストを実行
                return await this._executeStreamAPIRequest(
                    endpoint, 
                    headers, 
                    body, 
                    options.onChunk, 
                    options.onComplete
                );
            } else {
                // 通常モードでAPIリクエストを実行（リトライロジック付き）
                return await this._executeAPIRequestWithRetry(endpoint, headers, body);
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
     * @param {boolean} useStream - ストリーミングを使用するかどうか
     * @returns {Object} エンドポイント、ヘッダー、ボディを含むオブジェクト
     */
    _prepareAPIRequest: function(messages, model, useStream) {
        let endpoint, headers = {}, body = {};
        
        if (window.apiSettings.apiType === 'openai') {
            // OpenAI API
            endpoint = window.CONFIG.API.ENDPOINTS.OPENAI;
            
            headers = {
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
            
            body = {
                model: model,
                messages: messages,
                temperature: window.CONFIG.API.DEFAULT_PARAMS.temperature,
                max_tokens: window.CONFIG.API.DEFAULT_PARAMS.max_tokens
            };
        } else {
            // Azure OpenAI API
            endpoint = window.apiSettings.azureEndpoints[model];
            
            // エンドポイントにクエリパラメータがない場合は追加
            if (endpoint && !endpoint.includes('?')) {
                endpoint += `?api-version=${window.CONFIG.API.AZURE_API_VERSION}`;
            }
            
            headers = {
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
            
            body = {
                messages: messages,
                temperature: window.CONFIG.API.DEFAULT_PARAMS.temperature,
                max_tokens: window.CONFIG.API.DEFAULT_PARAMS.max_tokens
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
            body: JSON.stringify(body),
            useStream
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
        
        while (retryCount <= window.CONFIG.API.MAX_RETRIES) {
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
                if (retryCount >= window.CONFIG.API.MAX_RETRIES) {
                    break;
                }
                
                // リトライ前に待機
                const delay = getRetryDelay(retryCount);
                console.warn(`APIリクエスト失敗 (${error.message})。${delay}ms後にリトライします (${retryCount + 1}/${window.CONFIG.API.MAX_RETRIES})`);
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
            const timeoutId = setTimeout(() => controller.abort(), window.CONFIG.API.TIMEOUT_MS);
            
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
            if (file.size > window.CONFIG.FILE.MAX_FILE_SIZE) {
                reject(new Error(`ファイルサイズが大きすぎます (${this._formatFileSize(file.size)}). 最大サイズは${this._formatFileSize(window.CONFIG.FILE.MAX_FILE_SIZE)}です。`));
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
    },

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
    _executeStreamAPIRequest: async function(endpoint, headers, bodyStr, onChunk, onComplete) {
        if (typeof onChunk !== 'function') {
            throw new Error('ストリーミングモードでは onChunk コールバック関数が必要です');
        }
        
        if (typeof onComplete !== 'function') {
            throw new Error('ストリーミングモードでは onComplete コールバック関数が必要です');
        }
        
        try {
            // ストリーミングフラグをリクエストに追加
            const body = JSON.parse(bodyStr);
            body.stream = true;
            
            // AbortControllerを使用してタイムアウトを設定
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), window.CONFIG.API.TIMEOUT_MS);
            
            const startTime = Date.now();
            
            console.log(`ストリーミングAPIリクエスト送信: ${endpoint}`);
            
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
                
                // レスポンスのJSONを取得して詳細なエラーメッセージを取得
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error.message || errorMessage;
                    }
                } catch (jsonError) {
                    // JSONパースに失敗した場合は元のエラーメッセージを使用
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
            
            // 受信したデータを順次処理
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                // バイナリデータを文字列に変換
                const chunk = decoder.decode(value, { stream: true });
                
                // Server-Sent Eventsの形式でデータを処理
                // 'data: '行を処理
                const lines = chunk.split('\n');
                
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
                                    // コールバックでデルタコンテンツを処理
                                    onChunk(delta.content);
                                    fullText += delta.content;
                                }
                            }
                        } catch (parseError) {
                            console.warn('JSON解析エラー:', parseError, line);
                        }
                    }
                }
            }
            
            const responseTime = Date.now() - startTime;
            console.log(`ストリーミングAPIレスポンス完了 (${responseTime}ms)`);
            
            // すべてのデータを受信した後、完了コールバックを呼び出す
            onComplete(fullText);
            
            // ストリーミングではPromiseの戻り値は使用されないが、
            // 一貫性のために空文字列を返す
            return '';
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('APIリクエストがタイムアウトしました');
            }
            
            throw error;
        }
    },
};