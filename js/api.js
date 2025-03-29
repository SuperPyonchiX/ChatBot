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
     * @returns {Promise<string>} APIからの応答テキスト
     * @throws {Error} API設定やリクエストに問題があった場合
     */
    callOpenAIAPI: async function(messages, model, attachments = []) {
        this._validateAPISettings();
        this._validateModelSettings(model);
        
        // 添付ファイルがある場合はメッセージを処理
        const processedMessages = this._processAttachments(messages, attachments);
        
        // APIリクエストの準備
        const { endpoint, headers, body } = this._prepareAPIRequest(processedMessages, model);
        
        // APIリクエストの実行と応答の処理
        return this._executeAPIRequest(endpoint, headers, body);
    },

    /**
     * API設定を検証する
     * @private
     * @throws {Error} API設定に問題があった場合
     */
    _validateAPISettings: function() {
        if (!window.apiSettings) {
            throw new Error('API設定が見つかりません');
        }
        
        if (!window.apiSettings.openaiApiKey && !window.apiSettings.azureApiKey) {
            throw new Error('APIキーが設定されていません');
        }
        
        if (window.apiSettings.apiType === 'azure' && !window.apiSettings.azureApiKey) {
            throw new Error('Azure APIキーが設定されていません');
        }
        
        if (window.apiSettings.apiType === 'openai' && !window.apiSettings.openaiApiKey) {
            throw new Error('OpenAI APIキーが設定されていません');
        }
    },

    /**
     * モデル設定を検証する
     * @private
     * @param {string} model - 使用するモデル名
     * @throws {Error} モデル設定に問題があった場合
     */
    _validateModelSettings: function(model) {
        if (window.apiSettings.apiType === 'azure') {
            const azureEndpoint = window.apiSettings.azureEndpoints[model];
            if (!azureEndpoint) {
                throw new Error(`モデル "${model}" のAzure OpenAIエンドポイントが設定されていません`);
            }
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
        if (attachments.length === 0) {
            return messages;
        }

        // 配列をコピーして元のメッセージを変更しないようにする
        const processedMessages = [...messages];
        
        // 最後のユーザーメッセージを見つける
        let lastUserMessageIndex = processedMessages.length - 1;
        for (let i = processedMessages.length - 1; i >= 0; i--) {
            if (processedMessages[i].role === 'user') {
                lastUserMessageIndex = i;
                break;
            }
        }
        
        // 添付ファイルを持つメッセージを作成
        if (processedMessages[lastUserMessageIndex].role === 'user') {
            const userMessage = processedMessages[lastUserMessageIndex];
            const contentItems = [];
            
            // 基本テキストコンテンツ
            let textContent = userMessage.content;
            
            // 画像添付ファイルと通常の添付ファイルを分けて処理
            for (const attachment of attachments) {
                if (attachment.type === 'image') {
                    // 画像はimage_urlタイプとして個別に追加
                    contentItems.push({
                        type: "image_url",
                        image_url: {
                            url: attachment.data
                        }
                    });
                } else if (attachment.type === 'file') {
                    // ファイルタイプの添付ファイルはテキストに統合
                    textContent += `\n\n添付ファイル:\n[${attachment.name}](data:${attachment.mimeType};${attachment.data})`;
                }
            }
            
            // テキストコンテンツを最初に追加（添付ファイル情報を含む）
            contentItems.push({
                type: "text",
                text: textContent
            });
            
            // メッセージを更新
            processedMessages[lastUserMessageIndex] = {
                role: "user",
                content: contentItems
            };
        }
        
        return processedMessages;
    },

    /**
     * APIリクエストの設定を準備する
     * @private
     * @param {Array} messages - 処理済みメッセージ配列
     * @param {string} model - 使用するモデル名
     * @returns {Object} エンドポイント、ヘッダー、ボディを含むオブジェクト
     */
    _prepareAPIRequest: function(messages, model) {
        let endpoint, headers, body;
        
        if (window.apiSettings.apiType === 'openai') {
            // OpenAI API
            endpoint = 'https://api.openai.com/v1/chat/completions';
            headers = {
                'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`,
                'Content-Type': 'application/json'
            };
            body = JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7
            });
        } else {
            // Azure OpenAI API
            endpoint = window.apiSettings.azureEndpoints[model];
            headers = {
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
            body = JSON.stringify({
                messages: messages,
                temperature: 0.7
            });
        }
        
        return { endpoint, headers, body };
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
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: body
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error?.message || `API Error: ${response.status}`;
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('API request failed:', error);
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
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = (error) => {
                console.error('File encoding failed:', error);
                reject(error);
            };
            reader.readAsDataURL(file);
        });
    }
};