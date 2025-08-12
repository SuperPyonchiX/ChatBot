/**
 * geminiApi.js
 * Google Gemini API専用の通信機能を提供します
 */
class GeminiAPI {
    static #instance = null;

    constructor() {
        if (GeminiAPI.#instance) {
            return GeminiAPI.#instance;
        }
        GeminiAPI.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!GeminiAPI.#instance) {
            GeminiAPI.#instance = new GeminiAPI();
        }
        return GeminiAPI.#instance;
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
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async callGeminiAPI(messages, model, attachments = [], options = {}) {
        try {
            // API設定を確認
            this.#validateAPISettings();

            // GeminiAPIリクエストを準備
            const { endpoint, headers, body } = this.#prepareGeminiRequest(messages, model, attachments);

            console.log(`Gemini APIリクエスト送信 (${model}):`, endpoint);
            console.log('📡 ストリーミング有効:', options.stream);

            // APIリクエストを実行
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
            throw error;
        }
    }

    /**
     * API設定を検証
     */
    #validateAPISettings() {
        if (!window.apiSettings || !window.apiSettings.geminiApiKey) {
            throw new Error('Gemini APIキーが設定されていません。設定画面で設定してください。');
        }
    }

    /**
     * Gemini APIリクエストを準備
     */
    #prepareGeminiRequest(messages, model, attachments = []) {
        const endpoint = `${window.CONFIG.AIAPI.ENDPOINTS.GEMINI}/${model}:streamGenerateContent`;
        
        const headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': window.apiSettings.geminiApiKey
        };

        // メッセージをGemini形式に変換
        const geminiContents = this.#convertMessagesToGeminiFormat(messages, attachments);

        const body = {
            contents: geminiContents,
            generationConfig: {
                temperature: window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature,
                topK: window.CONFIG.AIAPI.GEMINI_PARAMS.topK,
                topP: window.CONFIG.AIAPI.GEMINI_PARAMS.topP,
                maxOutputTokens: window.CONFIG.AIAPI.GEMINI_PARAMS.maxOutputTokens,
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        };

        return { endpoint, headers, body };
    }

    /**
     * メッセージをGemini形式に変換
     */
    #convertMessagesToGeminiFormat(messages, attachments = []) {
        const geminiContents = [];
        let systemPrompt = '';

        // システムプロンプトを抽出
        for (const message of messages) {
            if (message.role === 'system') {
                systemPrompt += message.content + '\n';
                continue;
            }

            if (message.role === 'user' || message.role === 'assistant') {
                const role = message.role === 'assistant' ? 'model' : 'user';
                
                // 最後のユーザーメッセージで添付ファイルがある場合
                const isLastUserMessage = message.role === 'user' && 
                    messages.indexOf(message) === messages.length - 1;
                
                if (isLastUserMessage && attachments && attachments.length > 0) {
                    const parts = [];
                    
                    // テキスト部分を追加
                    if (message.content && message.content.trim()) {
                        parts.push({ text: systemPrompt + message.content });
                    } else {
                        parts.push({ text: systemPrompt + "画像について説明してください。" });
                    }
                    
                    // 画像を追加
                    for (const attachment of attachments) {
                        if (attachment.type === 'image') {
                            const mimeType = this.#getMimeTypeFromDataUrl(attachment.data);
                            const base64Data = attachment.data.split(',')[1];
                            
                            parts.push({
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Data
                                }
                            });
                        }
                    }
                    
                    geminiContents.push({
                        role: role,
                        parts: parts
                    });
                } else {
                    // 通常のテキストメッセージ
                    const content = role === 'user' && systemPrompt ? 
                        systemPrompt + message.content : message.content;
                    
                    geminiContents.push({
                        role: role,
                        parts: [{ text: content }]
                    });
                }
                
                // システムプロンプトは最初のユーザーメッセージにのみ適用
                systemPrompt = '';
            }
        }

        return geminiContents;
    }

    /**
     * Data URLからMIMEタイプを抽出
     */
    #getMimeTypeFromDataUrl(dataUrl) {
        const match = dataUrl.match(/data:([^;]+);/);
        return match ? match[1] : 'image/jpeg';
    }

    /**
     * 非ストリーミングでGemini APIリクエストを実行
     */
    async #executeGeminiRequest(endpoint, headers, body) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, window.CONFIG.AIAPI.REQUEST_TIMEOUT);

        try {
            // 非ストリーミング用のエンドポイントに変更
            const nonStreamEndpoint = endpoint.replace(':streamGenerateContent', ':generateContent');
            
            const response = await fetch(nonStreamEndpoint, {
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
            return this.#extractTextFromGeminiResponse(responseData);

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
            }, window.CONFIG.AIAPI.STREAM_TIMEOUT);
        };

        resetTimeout();

        try {
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
                                const jsonData = JSON.parse(currentJson.trim());
                                
                                // Gemini APIは配列形式で応答するため、最初の要素を取得
                                const responseData = Array.isArray(jsonData) ? jsonData[0] : jsonData;
                                
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

    /**
     * Gemini APIレスポンスからテキストを抽出
     */
    #extractTextFromGeminiResponse(responseData) {
        if (!responseData.candidates || responseData.candidates.length === 0) {
            return '';
        }

        const candidate = responseData.candidates[0];
        if (!candidate.content || !candidate.content.parts) {
            return '';
        }

        let text = '';
        for (const part of candidate.content.parts) {
            if (part.text) {
                text += part.text;
            }
        }

        return text;
    }
}
