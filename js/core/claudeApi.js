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
     * @param {boolean} options.enableWebSearch - Web検索機能を使用するかどうか
     * @returns {Promise<string>} APIからの応答テキスト（ストリーミングの場合は空文字列）
     * @throws {Error} API設定やリクエストに問題があった場合
     */
    async callClaudeAPI(messages, model, attachments = [], options = {}) {
        try {
            // API設定を確認
            this.#validateAPISettings();

            // ClaudeAPIリクエストを準備
            const { headers, body } = this.#prepareClaudeRequest(messages, model, attachments, options);

            console.log(`Claude API ${options.stream ? 'ストリーミング' : '通常'}リクエスト送信 (${model})`);
            console.log('Claude API 送信ヘッダー:', headers);
            console.log('Claude API 送信ボディ:', JSON.parse(body));
            
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
        const storage = Storage.getInstance;
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
        console.log('DEBUG: Claude API リクエスト準備開始', {
            messagesCount: messages.length,
            model: model,
            attachmentsCount: attachments.length,
            options: options
        });

        const storage = Storage.getInstance;
        const apiKey = storage.getItem(window.CONFIG.STORAGE.KEYS.CLAUDE_API_KEY);
        let systemPrompt = storage.getItem(window.CONFIG.STORAGE.KEYS.SYSTEM_PROMPT) || 
                          window.CONFIG.SYSTEM_PROMPTS.DEFAULT_SYSTEM_PROMPT;
        
        // Claude API 仕様: systemは文字列または複数ブロックの配列をサポート
        // 現在は文字列のみなので、そのまま文字列として使用
        if (typeof systemPrompt !== 'string') {
            systemPrompt = String(systemPrompt);
        }

        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': window.CONFIG.AIAPI.ANTHROPIC_API_VERSION,
            'anthropic-dangerous-direct-browser-access': 'true'
        };

        // メッセージをClaude形式に変換
        const claudeMessages = this.#convertToClaudeMessages(messages, attachments);

        const body = {
            model: model,
            max_tokens: window.CONFIG.AIAPI.DEFAULT_PARAMS.max_tokens,
            messages: claudeMessages,
            system: systemPrompt,
            temperature: window.CONFIG.AIAPI.DEFAULT_PARAMS.temperature
        };
        
        // Web検索ツールを追加
        if (options.enableWebSearch && this.#isWebSearchSupported(model)) {
            body.tools = this.#createWebSearchTool();
            console.log('DEBUG: Web検索ツールを追加', { toolsCount: body.tools.length });
        }
        
        // ストリーミングが有効な場合のみstreamパラメーターを追加（公式仕様準拠）
        if (options.stream) {
            body.stream = true;
        }

        return { headers, body: JSON.stringify(body) };
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
     * Web検索がサポートされているモデルかチェック
     * @param {string} model - モデル名
     * @returns {boolean} サポートされているかどうか
     */
    #isWebSearchSupported(model) {
        // Claudeモデルは全てWeb検索をサポート
        const supportedModels = window.CONFIG.MODELS.CLAUDE;
        const isSupported = supportedModels.includes(model);
        console.log('DEBUG: Web検索サポート確認', { model, isSupported, supportedModels });
        return isSupported;
    }

    /**
     * Web検索ツール設定を作成
     * @returns {Array} ツール配列
     */
    #createWebSearchTool() {
        const webSearchTool = {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: window.CONFIG.WEB_SEARCH.CLAUDE.DEFAULT_CONFIG.MAX_USES
        };

        console.log('DEBUG: Web検索ツール作成完了', webSearchTool);
        return [webSearchTool];
    }

    /**
     * 非ストリーミングClaudeリクエストを実行
     * @param {Object} headers - リクエストヘッダー
     * @param {Object} body - リクエストボディ
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async #executeClaudeRequest(headers, body) {
        try {
            console.log('DEBUG: Claude 通常リクエスト開始', {
                endpoint: window.CONFIG.AIAPI.ENDPOINTS.CLAUDE,
                bodySize: (typeof body === 'string' ? body.length : JSON.stringify(body).length)
            });

            const response = await fetch(window.CONFIG.AIAPI.ENDPOINTS.CLAUDE, {
                method: 'POST',
                headers: headers,
                body: (typeof body === 'string' ? body : JSON.stringify(body))
            });

            console.log('DEBUG: Claude API レスポンス受信（通常）', {
                status: response.status,
                ok: response.ok,
                contentType: response.headers.get('content-type')
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('DEBUG: Claude API エラーレスポンス（通常）', { status: response.status, errorData });
                throw new Error(`Claude API Error ${response.status}: ${errorData?.error?.message || response.statusText}`);
            }

            const data = await response.json();
            console.log('DEBUG: Claude API レスポンスデータ', {
                hasContent: !!data.content,
                contentCount: data.content ? data.content.length : 0,
                responseStructure: Object.keys(data)
            });
            
            // Claude APIのレスポンス形式から テキストを抽出
            let responseText = '';
            let citations = [];
            
            if (data.content && Array.isArray(data.content)) {
                for (const content of data.content) {
                    if (content.type === 'text') {
                        responseText += content.text;
                        
                        // 引用情報を収集
                        if (content.citations && Array.isArray(content.citations)) {
                            citations = citations.concat(content.citations);
                        }
                    }
                    // Web検索結果の処理
                    else if (content.type === 'web_search_tool_result') {
                        console.log('DEBUG: Web検索結果受信', {
                            toolUseId: content.tool_use_id,
                            resultsCount: content.content ? content.content.length : 0
                        });
                        
                        if (content.content && Array.isArray(content.content)) {
                            for (const result of content.content) {
                                if (result.type === 'web_search_result') {
                                    console.log('DEBUG: Web検索結果詳細', {
                                        url: result.url,
                                        title: result.title,
                                        pageAge: result.page_age
                                    });
                                }
                            }
                        }
                    }
                    // サーバーツール使用の処理
                    else if (content.type === 'server_tool_use') {
                        console.log('DEBUG: サーバーツール使用', {
                            toolId: content.id,
                            toolName: content.name,
                            input: content.input
                        });
                    }
                }
            }

            console.log('DEBUG: Claude テキスト抽出完了', {
                extractedLength: responseText.length,
                citationsCount: citations.length,
                preview: responseText.substring(0, 100) + (responseText.length > 100 ? '...' : '')
            });

            // 引用情報も含めて返す場合の処理（将来的な拡張用）
            if (citations.length > 0) {
                console.log('DEBUG: 引用情報あり', { citationsCount: citations.length });
                // TODO: 引用情報を適切に処理・表示する仕組みを実装
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
            console.log('Claude ストリーミングリクエスト開始:', window.CONFIG.AIAPI.ENDPOINTS.CLAUDE);

            // Ensure stream flag is present in payload
            const payloadStr = (function(){
                if (typeof body === 'string') {
                    try {
                        const obj = JSON.parse(body);
                        obj.stream = true;
                        return JSON.stringify(obj);
                    } catch (_) { return body; }
                }
                const obj2 = { ...(body || {}), stream: true };
                return JSON.stringify(obj2);
            })();

            const response = await fetch(window.CONFIG.AIAPI.ENDPOINTS.CLAUDE, {
                method: 'POST',
                headers: headers,
                body: payloadStr
            });

            console.log('Claude API レスポンス受信:', response.status, response.ok);

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('Claude API エラー:', response.status, errorData);
                throw new Error(`Claude API Error ${response.status}: ${errorData?.error?.message || response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';
            let chunkCount = 0;
            let webSearchInProgress = false;
            let webSearchQuery = '';
            let completedSearchQuery = '';
            let webSearchMessageUpdated = false;
            const chatMessages = document.querySelector('#chatMessages');
            const existingThinkingMessage = chatMessages?.querySelector('.message.bot:last-child');

            console.log('DEBUG: Claude ストリーミング読み込み開始');

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('DEBUG: Claude ストリーミング完了', { 
                        totalChunks: chunkCount, 
                        totalLength: fullResponse.length 
                    });
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 未完成の行を保持

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            console.log('DEBUG: Claude ストリーミング終了シグナル受信');
                            if (onComplete) onComplete(fullResponse);
                            return '';
                        }

                        try {
                            const parsed = JSON.parse(data);
                            console.log('DEBUG: Claude ストリーミングイベント', { type: parsed.type, hasContent: !!parsed.delta });
                            
                            // message_start イベント
                            if (parsed.type === 'message_start') {
                                console.log('DEBUG: Claude メッセージ開始', { messageId: parsed.message?.id });
                            }
                            // content_block_start イベント
                            else if (parsed.type === 'content_block_start') {
                                console.log('DEBUG: Claude コンテンツブロック開始', { 
                                    index: parsed.index, 
                                    blockType: parsed.content_block?.type 
                                });
                                
                                // Web検索ツール使用開始の検出
                                if (parsed.content_block?.type === 'server_tool_use' && 
                                    parsed.content_block?.name === 'web_search') {
                                    webSearchInProgress = true;
                                    webSearchQuery = '';
                                    completedSearchQuery = '';
                                    webSearchMessageUpdated = false;
                                    
                                    // 既存のThinkingメッセージを更新
                                    if (existingThinkingMessage) {
                                        ChatRenderer.getInstance.updateSystemMessage(
                                            existingThinkingMessage,
                                            '🔍 Web検索を実行しています...', 
                                            { status: 'searching', showDots: true }
                                        );
                                    }
                                }
                            }
                            // content_block_delta イベント（テキスト、ツール、思考など）
                            else if (parsed.type === 'content_block_delta') {
                                if (parsed.delta) {
                                    // テキストデルタ
                                    if (parsed.delta.type === 'text_delta') {
                                        const text = parsed.delta.text;
                                        fullResponse += text;
                                        chunkCount++;
                                        if (onChunk) onChunk(text);
                                    }
                                    // ツール使用の入力JSONデルタ
                                    else if (parsed.delta.type === 'input_json_delta') {
                                        console.log('DEBUG: ツール入力デルタ', { 
                                            index: parsed.index,
                                            partialJson: parsed.delta.partial_json 
                                        });
                                        
                                        // Web検索クエリの抽出
                                        if (webSearchInProgress && parsed.delta.partial_json) {
                                            webSearchQuery += parsed.delta.partial_json;
                                            
                                            // 完全なJSONが形成されたかチェック
                                            try {
                                                const queryData = JSON.parse(webSearchQuery);
                                                if (queryData.query && queryData.query !== completedSearchQuery) {
                                                    completedSearchQuery = queryData.query;
                                                    if (existingThinkingMessage) {
                                                        ChatRenderer.getInstance.updateSystemMessage(
                                                            existingThinkingMessage,
                                                            `🔍 "${completedSearchQuery}" を検索中...`,
                                                            { status: 'searching', showDots: true }
                                                        );
                                                    }
                                                }
                                            } catch (e) {
                                                // JSONが未完成の場合は無視
                                            }
                                        }
                                    }
                                    // 思考デルタ（Extended Thinking）
                                    else if (parsed.delta.type === 'thinking_delta') {
                                        console.log('DEBUG: 思考デルタ', { 
                                            thinkingLength: parsed.delta.thinking?.length || 0 
                                        });
                                    }
                                    // シグネチャデルタ
                                    else if (parsed.delta.type === 'signature_delta') {
                                        console.log('DEBUG: シグネチャデルタ受信');
                                    }
                                }
                            }
                            // content_block_stop イベント
                            else if (parsed.type === 'content_block_stop') {
                                console.log('DEBUG: コンテンツブロック終了', { index: parsed.index });
                                
                                // Web検索ツールの結果開始を検出
                                if (webSearchInProgress && completedSearchQuery && !webSearchMessageUpdated) {
                                    // 次のブロックがweb_search_tool_resultの場合の準備
                                    setTimeout(() => {
                                        if (webSearchInProgress && completedSearchQuery && !webSearchMessageUpdated) {
                                            if (existingThinkingMessage) {
                                                ChatRenderer.getInstance.updateSystemMessage(
                                                    existingThinkingMessage,
                                                    `🔍 検索結果を分析中: "${completedSearchQuery}"`,
                                                    { status: 'processing', showDots: true }
                                                );
                                                webSearchMessageUpdated = true;
                                            }
                                        }
                                    }, 100);
                                }
                            }
                            // message_delta イベント
                            else if (parsed.type === 'message_delta') {
                                if (parsed.delta && parsed.delta.stop_reason) {
                                    console.log('DEBUG: Claude メッセージ終了', { stop_reason: parsed.delta.stop_reason });
                                    
                                    // Web検索完了、通常のThinkingに戻す
                                    if (webSearchInProgress) {
                                        webSearchInProgress = false;
                                    }
                                    
                                    if (onComplete) onComplete(fullResponse);
                                    return '';
                                }
                                // 使用量の更新
                                if (parsed.usage) {
                                    console.log('DEBUG: トークン使用量更新', parsed.usage);
                                }
                            }
                            // message_stop イベント
                            else if (parsed.type === 'message_stop') {
                                console.log('DEBUG: Claude メッセージストップイベント');
                                
                                // Web検索完了、通常のThinkingに戻す
                                if (webSearchInProgress) {
                                    webSearchInProgress = false;
                                }
                                
                                if (onComplete) onComplete(fullResponse);
                                return '';
                            }
                            // ping イベント
                            else if (parsed.type === 'ping') {
                                console.log('DEBUG: Claude ping受信');
                            }
                            // error イベント
                            else if (parsed.type === 'error') {
                                console.error('DEBUG: Claude ストリーミングエラーイベント', parsed.error);
                                
                                // エラー時も通常のThinkingに戻す
                                if (webSearchInProgress) {
                                    const chatMessages = document.getElementById('chatMessages');
                                    const existingThinkingMessage = chatMessages?.querySelector('.message.bot:last-child');
                                    if (existingThinkingMessage) {
                                        ChatRenderer.getInstance.updateSystemMessage(
                                            existingThinkingMessage,
                                            'Thinking',
                                            { status: 'thinking', showDots: true }
                                        );
                                    }
                                    webSearchInProgress = false;
                                }
                                
                                throw new Error(`Claude Streaming Error: ${parsed.error.message}`);
                            }
                            // 未知のイベントタイプ
                            else {
                                console.warn('DEBUG: 未知のイベントタイプ', { type: parsed.type, data: parsed });
                            }
                        } catch (parseError) {
                            console.warn('Claude SSE解析エラー:', parseError, 'Data:', data);
                        }
                    }
                }
            }

            if (onComplete) onComplete(fullResponse);
            return '';

        } catch (error) {
            console.error('Claude ストリーミングエラー:', error);
            throw error;
        }
    }
}
