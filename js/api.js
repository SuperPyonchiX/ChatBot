/**
 * api.js
 * OpenAIおよびAzure OpenAI APIとの通信機能を提供します
 */

// グローバルスコープに関数を公開
window.API = {
    callOpenAIAPI: async function(messages, model, attachments = []) {
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
    
        let endpoint, headers, body;
        
        // ファイル添付がある場合、メッセージを処理
        if (attachments.length > 0) {
            // 最後のユーザーメッセージを見つける
            let lastUserMessageIndex = messages.length - 1;
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    lastUserMessageIndex = i;
                    break;
                }
            }
            
            // 添付ファイルを持つメッセージを作成
            if (messages[lastUserMessageIndex].role === 'user') {
                const userMessage = messages[lastUserMessageIndex];
                const contentItems = [];
                
                // 基本テキストコンテンツ（後で追加されるファイル情報を含める場合のため変数に保存）
                let textContent = userMessage.content;
                let hasFileAttachments = false;
                
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
                        hasFileAttachments = true;
                        textContent += `\n\n添付ファイル:\n[${attachment.name}](data:${attachment.mimeType};${attachment.data})`;
                    }
                }
                
                // テキストコンテンツを最初に追加（添付ファイル情報を含む）
                contentItems.push({
                    type: "text",
                    text: textContent
                });
                
                // メッセージを更新
                messages[lastUserMessageIndex] = {
                    role: "user",
                    content: contentItems
                };
            }
        }
        
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
            const azureEndpoint = window.apiSettings.azureEndpoints[model];
            if (!azureEndpoint) {
                throw new Error(`モデル "${model}" のAzure OpenAIエンドポイントが設定されていません`);
            }
            
            endpoint = azureEndpoint;
            headers = {
                'api-key': window.apiSettings.azureApiKey,
                'Content-Type': 'application/json'
            };
            body = JSON.stringify({
                messages: messages,
                temperature: 0.7
            });
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: body
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
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
                const base64String = reader.result;
                resolve(base64String);
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsDataURL(file);
        });
    }
};