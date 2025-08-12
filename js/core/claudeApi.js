/**
 * claudeApi.js
 * Claude API専用のリクエスト処理クラス
 * Anthropic Claude Messages APIとの通信を管理
 */
class ClaudeAPI {
    static #instance = null;

    constructor() {
        if (ClaudeAPI.#instance) {
            return ClaudeAPI.#instance;
        }
        ClaudeAPI.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ClaudeAPI.#instance) {
            ClaudeAPI.#instance = new ClaudeAPI();
        }
        return ClaudeAPI.#instance;
    }

    /**
     * Claude APIを呼び出して応答を得る
     * @param {Array} messages - 会話メッセージの配列
     * @param {string} model - 使用するClaudeモデル名
     * @param {Array} attachments - 添付ファイルの配列（任意）
     * @param {Object} options - 追加オプション
     * @param {boolean} options.stream - ストリーミングを使用するかどうか
     * @param {Function} options.onChunk - ストリーミング時のチャンク受信コールバック関数
     * @param {Function} options.onComplete - ストリーミング完了時のコールバック関数
     * @returns {Promise<string>} APIからの応答テキスト（ストリーミングの場合は空文字列）
     * @throws {Error} API設定やリクエストに問題があった場合
     */
    async callClaudeAPI(messages, model, attachments = [], options = {}) {
        try {
            // API設定を確認
            this.#validateAPISettings();

            // ClaudeAPIリクエストを準備
            const { headers, body } = this.#prepareClaudeRequest(messages, model, attachments, options);

            console.log(`Claude APIリクエスト送信 (${model})`);
            console.log('📡 ストリーミング有効:', options.stream);

            // APIリクエストを実行
            if (options.stream) {
                return await this.#executeStreamClaudeRequest(
                    headers, 
                    body, 
                    options.onChunk, 
                    options.onComplete
                );
            } else {
                return await this.#executeClaudeRequest(headers, body);
            }

        } catch (error) {
            console.error('Claude API呼び出しエラー:', error);
            throw error;
        }
    }

    /**
     * API設定の妥当性を検証
     * @throws {Error} API設定に問題がある場合
     */
    #validateAPISettings() {
        const storage = window.Storage?.getInstance;
        if (!storage) {
            throw new Error('ストレージインスタンスが見つかりません');
        }

        const apiKey = storage.getItem(window.CONFIG.STORAGE.KEYS.CLAUDE_API_KEY);
        if (!apiKey) {
            throw new Error('Claude APIキーが設定されていません。設定画面からAPIキーを設定してください。');
        }
    }

    /**
     * Claude APIリクエストを準備
     * @param {Array} messages - メッセージ配列
     * @param {string} model - モデル名
     * @param {Array} attachments - 添付ファイル配列
     * @param {Object} options - オプション
     * @returns {Object} リクエストのheadersとbody
     */
    #prepareClaudeRequest(messages, model, attachments = [], options = {}) {
        const storage = window.Storage.getInstance;
        const apiKey = storage.getItem(window.CONFIG.STORAGE.KEYS.CLAUDE_API_KEY);
        const systemPrompt = storage.getItem(window.CONFIG.STORAGE.KEYS.SYSTEM_PROMPT) || 
                           window.CONFIG.SYSTEM_PROMPTS.DEFAULT_SYSTEM_PROMPT;

        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };

        // メッセージをClaude形式に変換
        const claudeMessages = this.#convertToClaudeMessages(messages, attachments);

        const body = {
            model: model,
            max_tokens: window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens,
            messages: claudeMessages,
            system: systemPrompt,
            stream: options.stream || false,
            temperature: window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature
        };

        return { headers, body };
    }

    /**
     * メッセージをClaude API形式に変換
     * @param {Array} messages - OpenAI形式のメッセージ
     * @param {Array} attachments - 添付ファイル
     * @returns {Array} Claude API形式のメッセージ
     */
    #convertToClaudeMessages(messages, attachments = []) {
        const claudeMessages = [];
        
        for (const message of messages) {
            if (message.role === 'system') {
                // Claude APIではsystemメッセージは別パラメータで送信するためスキップ
                continue;
            }

            const claudeMessage = {
                role: message.role,
                content: []
            };

            // テキストコンテンツを追加
            if (typeof message.content === 'string') {
                claudeMessage.content.push({
                    type: 'text',
                    text: message.content
                });
            } else if (Array.isArray(message.content)) {
                // OpenAI形式の複合コンテンツを変換
                for (const content of message.content) {
                    if (content.type === 'text') {
                        claudeMessage.content.push({
                            type: 'text',
                            text: content.text
                        });
                    } else if (content.type === 'image_url') {
                        // OpenAI形式の画像をClaude形式に変換
                        const imageData = content.image_url.url;
                        if (imageData.startsWith('data:')) {
                            const [header, base64Data] = imageData.split(',');
                            const mediaType = header.match(/data:(.+);base64/)[1];
                            
                            claudeMessage.content.push({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType,
                                    data: base64Data
                                }
                            });
                        }
                    }
                }
            }

            // 添付ファイルがあり、ユーザーメッセージの場合は画像を追加
            if (message.role === 'user' && attachments.length > 0) {
                for (const attachment of attachments) {
                    if (attachment.type === 'image' && attachment.base64Data) {
                        claudeMessage.content.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: attachment.mimeType,
                                data: attachment.base64Data
                            }
                        });
                    }
                }
            }

            claudeMessages.push(claudeMessage);
        }

        return claudeMessages;
    }

    /**
     * 非ストリーミングClaudeリクエストを実行
     * @param {Object} headers - リクエストヘッダー
     * @param {Object} body - リクエストボディ
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async #executeClaudeRequest(headers, body) {
        try {
            const response = await fetch(window.CONFIG.AIAPI.ENDPOINTS.CLAUDE, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Claude API Error ${response.status}: ${errorData?.error?.message || response.statusText}`);
            }

            const data = await response.json();
            
            // Claude APIのレスポンス形式から テキストを抽出
            let responseText = '';
            if (data.content && Array.isArray(data.content)) {
                for (const content of data.content) {
                    if (content.type === 'text') {
                        responseText += content.text;
                    }
                }
            }

            return responseText;

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('リクエストがタイムアウトしました。');
            }
            throw error;
        }
    }

    /**
     * ストリーミングClaudeリクエストを実行
     * @param {Object} headers - リクエストヘッダー
     * @param {Object} body - リクエストボディ
     * @param {Function} onChunk - チャンク受信時のコールバック
     * @param {Function} onComplete - 完了時のコールバック
     * @returns {Promise<string>} 空文字列（ストリーミングのため）
     */
    async #executeStreamClaudeRequest(headers, body, onChunk, onComplete) {
        try {
            const response = await fetch(window.CONFIG.AIAPI.ENDPOINTS.CLAUDE, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ ...body, stream: true })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Claude API Error ${response.status}: ${errorData?.error?.message || response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 未完成の行を保持

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            if (onComplete) onComplete(fullResponse);
                            return '';
                        }

                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.type === 'content_block_delta') {
                                if (parsed.delta && parsed.delta.type === 'text_delta') {
                                    const text = parsed.delta.text;
                                    fullResponse += text;
                                    if (onChunk) onChunk(text);
                                }
                            } else if (parsed.type === 'message_delta') {
                                if (parsed.delta && parsed.delta.stop_reason) {
                                    if (onComplete) onComplete(fullResponse);
                                    return '';
                                }
                            }
                        } catch (parseError) {
                            console.warn('Claude SSE解析エラー:', parseError, 'Data:', data);
                        }
                    }
                }
            }

            // ストリーミング完了
            if (onComplete) onComplete(fullResponse);
            return '';

        } catch (error) {
            console.error('Claude ストリーミングエラー:', error);
            throw error;
        }
    }
}
