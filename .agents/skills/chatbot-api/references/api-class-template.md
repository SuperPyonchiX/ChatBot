# APIクラステンプレート

## 完全なテンプレート

```javascript
/**
 * newApi.js
 * 新しいAPI専用の通信機能を提供します
 */
class NewAPI {
    static #instance = null;

    constructor() {
        if (NewAPI.#instance) {
            return NewAPI.#instance;
        }
        NewAPI.#instance = this;
    }

    static get getInstance() {
        if (!NewAPI.#instance) {
            NewAPI.#instance = new NewAPI();
        }
        return NewAPI.#instance;
    }

    /**
     * 新しいAPIを呼び出して応答を得る
     * @param {Array} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名
     * @param {Array} attachments - 添付ファイルの配列（任意）
     * @param {Object} options - 追加オプション
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async callNewAPI(messages, model, attachments = [], options = {}) {
        try {
            this.#validateAPISettings();

            const { endpoint, headers, body } = this.#prepareNewRequest(
                messages, model, attachments, options
            );

            console.log(`[NewAPI] リクエスト送信 (${model}):`, endpoint);

            if (options.stream) {
                return await this.#executeStreamNewRequest(
                    endpoint, headers, body,
                    options.onChunk, options.onComplete
                );
            } else {
                return await this.#executeNewRequest(endpoint, headers, body);
            }

        } catch (error) {
            console.error('[NewAPI] 呼び出しエラー:', error);
            throw error;
        }
    }

    #validateAPISettings() {
        const storage = Storage.getInstance;
        const apiKey = storage.getItem(window.CONFIG.STORAGE.KEYS.NEW_API_KEY);

        if (!apiKey) {
            throw new Error('新しいAPIのAPIキーが設定されていません。');
        }
    }

    #prepareNewRequest(messages, model, attachments = [], options = {}) {
        const storage = Storage.getInstance;
        const apiKey = storage.getItem(window.CONFIG.STORAGE.KEYS.NEW_API_KEY);
        const systemPrompt = storage.getItem(window.CONFIG.STORAGE.KEYS.SYSTEM_PROMPT) ||
                            window.CONFIG.SYSTEM_PROMPTS.DEFAULT_SYSTEM_PROMPT;

        const endpoint = window.CONFIG.AIAPI.ENDPOINTS.NEW_API;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };

        const convertedMessages = this.#convertMessages(messages, attachments);

        const body = {
            model: model,
            messages: convertedMessages,
            system: systemPrompt,
            max_tokens: window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens,
            temperature: window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature,
            stream: options.stream || false
        };

        return { endpoint, headers, body: JSON.stringify(body) };
    }

    #convertMessages(messages, attachments = []) {
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    async #executeNewRequest(endpoint, headers, body) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, window.CONFIG.AIAPI.REQUEST_TIMEOUT);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: body,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`New API Error ${response.status}: ${
                    errorData?.error?.message || response.statusText
                }`);
            }

            const data = await response.json();
            return this.#extractTextFromResponse(data);

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('リクエストがタイムアウトしました。');
            }
            throw error;
        }
    }

    async #executeStreamNewRequest(endpoint, headers, body, onChunk, onComplete) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: body
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`New API Error ${response.status}: ${
                    errorData?.error?.message || response.statusText
                }`);
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
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            if (onComplete) onComplete(fullResponse);
                            return '';
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const text = this.#extractStreamingText(parsed);

                            if (text) {
                                fullResponse += text;
                                if (onChunk) onChunk(text);
                            }
                        } catch (parseError) {
                            console.warn('[NewAPI] SSE解析エラー:', parseError);
                        }
                    }
                }
            }

            if (onComplete) onComplete(fullResponse);
            return '';

        } catch (error) {
            console.error('[NewAPI] ストリーミングエラー:', error);
            throw error;
        }
    }

    #extractTextFromResponse(data) {
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message?.content || '';
        }
        return '';
    }

    #extractStreamingText(parsed) {
        if (parsed.choices && parsed.choices.length > 0) {
            return parsed.choices[0].delta?.content || '';
        }
        return '';
    }
}
```

## api.jsへの統合

```javascript
// AIAPI.callAIAPI メソッド内に追加
async callAIAPI(messages, model, attachments = [], options = {}) {
    // 既存のルーティング
    if (this.#isGeminiModel(model)) {
        return GeminiAPI.getInstance.callGeminiAPI(...);
    }
    if (this.#isClaudeModel(model)) {
        return ClaudeAPI.getInstance.callClaudeAPI(...);
    }
    // 新しいAPIのルーティング
    if (this.#isNewAPIModel(model)) {
        return NewAPI.getInstance.callNewAPI(messages, model, attachments, options);
    }
    // デフォルト: OpenAI
    return OpenAIAPI.getInstance.callOpenAIAPI(...);
}

#isNewAPIModel(model) {
    return model.startsWith('new-');  // または適切な判定ロジック
}
```
