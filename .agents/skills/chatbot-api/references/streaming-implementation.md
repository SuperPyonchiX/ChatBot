# ストリーミング実装ガイド

## SSE (Server-Sent Events) パターン

### 標準SSE形式（OpenAI互換）

```javascript
async #executeStreamRequest(endpoint, headers, body, onChunk, onComplete) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: body
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
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
                    const text = this.#extractText(parsed);

                    if (text) {
                        fullResponse += text;
                        if (onChunk) onChunk(text);
                    }
                } catch (e) {
                    console.warn('[API] 解析エラー:', e);
                }
            }
        }
    }

    if (onComplete) onComplete(fullResponse);
    return '';
}
```

### Claude SSE形式

```javascript
async #executeClaudeStreamRequest(headers, body, onChunk, onComplete) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: body
    });

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

                try {
                    const parsed = JSON.parse(data);

                    // イベントタイプ別処理
                    if (parsed.type === 'content_block_delta') {
                        if (parsed.delta?.type === 'text_delta') {
                            const text = parsed.delta.text;
                            fullResponse += text;
                            if (onChunk) onChunk(text);
                        }
                    } else if (parsed.type === 'message_stop') {
                        if (onComplete) onComplete(fullResponse);
                        return '';
                    }
                } catch (e) {
                    console.warn('[Claude] 解析エラー:', e);
                }
            }
        }
    }

    if (onComplete) onComplete(fullResponse);
    return '';
}
```

### Gemini JSON配列形式

```javascript
async #executeGeminiStreamRequest(endpoint, headers, body, onChunk, onComplete) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let braceCount = 0;
    let bracketCount = 0;
    let currentJson = '';
    let isInJson = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        for (const char of chunk) {
            currentJson += char;

            if (char === '[') bracketCount++;
            else if (char === ']') bracketCount--;
            else if (char === '{') { braceCount++; isInJson = true; }
            else if (char === '}') braceCount--;

            if (isInJson && braceCount === 0 && bracketCount === 0) {
                try {
                    const jsonData = JSON.parse(currentJson.trim());
                    const responseData = Array.isArray(jsonData) ? jsonData[0] : jsonData;

                    if (responseData.candidates?.[0]?.content?.parts) {
                        for (const part of responseData.candidates[0].content.parts) {
                            if (part.text) {
                                fullText += part.text;
                                if (onChunk) onChunk(part.text);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[Gemini] 解析エラー:', e);
                }

                currentJson = '';
                isInJson = false;
            }
        }
    }

    if (onComplete) onComplete(fullText);
    return '';
}
```

## タイムアウト処理

```javascript
async #executeWithTimeout(operation, timeout = 120000) {
    const controller = new AbortController();
    let timeoutId;

    const resetTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            controller.abort();
        }, timeout);
    };

    resetTimeout();

    try {
        return await operation(controller.signal, resetTimeout);
    } finally {
        clearTimeout(timeoutId);
    }
}
```

## UIへの反映

ChatRenderer.instanceを使用：

```javascript
// ストリーミング開始
const { messageDiv, contentContainer } = ChatRenderer.getInstance.addStreamingBotMessage(chatMessages);

// チャンク受信時
options.onChunk = (chunk) => {
    fullText += chunk;
    ChatRenderer.getInstance.updateStreamingBotMessage(contentContainer, chunk, fullText);
};

// 完了時
options.onComplete = (text) => {
    ChatRenderer.getInstance.finalizeStreamingBotMessage(messageDiv, contentContainer, text);
};
```

## エラーハンドリング

```javascript
async #executeStreamWithErrorHandling(endpoint, headers, body, onChunk, onComplete, onError) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: body
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const error = new Error(`API Error ${response.status}: ${
                errorData?.error?.message || response.statusText
            }`);
            if (onError) onError(error);
            throw error;
        }

        // ストリーミング処理...

    } catch (error) {
        console.error('[API] ストリーミングエラー:', error);
        if (onError) onError(error);
        throw error;
    }
}
```
