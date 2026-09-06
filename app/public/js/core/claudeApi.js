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
     * @param {boolean} options.enableTools - ツール機能を使用するかどうか
     * @param {Array} options.tools - カスタムツール定義（Claude形式）
     * @param {Function} options.onToolCall - ツール呼び出し検出時のコールバック関数（任意）
     * @param {HTMLElement} options.thinkingContainer - 思考過程コンテナ（任意）
     * @param {Function} options.onWebSearchQuery - Web検索クエリ取得時のコールバック関数（任意）
     * @returns {Promise<string>} APIからの応答テキスト（ストリーミングの場合は空文字列）
     * @throws {Error} API設定やリクエストに問題があった場合
     */
    async callClaudeAPI(messages, model, attachments = [], options = {}) {
        try {
            // API設定を確認
            this.#validateAPISettings();

            // ClaudeAPIリクエストを準備
            const { headers, body } = this.#prepareClaudeRequest(messages, model, attachments, options);

            // console.log(`Claude API ${options.stream ? 'ストリーミング' : '通常'}リクエスト送信 (${model})`);
            // console.log('Claude API 送信ヘッダー:', headers);
            // console.log('Claude API 送信ボディ:', JSON.parse(body));

            // APIリクエストを実行
            if (options.stream) {
                return await this.#executeStreamClaudeRequest(
                    headers,
                    body,
                    options.onChunk,
                    options.onComplete,
                    options.thinkingContainer,
                    options.onWebSearchQuery,
                    options.onToolCall,
                    options.signal
                );
            } else {
                return await this.#executeClaudeRequest(headers, body, options.signal);
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
        
        // ツールを追加
        let tools = [];

        // カスタムツール（エージェント機能）を追加
        if (options.enableTools && options.tools && options.tools.length > 0) {
            tools = [...tools, ...options.tools];
        }

        // Web検索ツールを追加
        if (options.enableWebSearch && this.#isWebSearchSupported(model)) {
            tools = [...tools, ...this.#createWebSearchTool()];
        }

        if (tools.length > 0) {
            body.tools = tools;
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

        return [webSearchTool];
    }

    /**
     * 非ストリーミングClaudeリクエストを実行
     * @param {Object} headers - リクエストヘッダー
     * @param {Object} body - リクエストボディ
     * @param {AbortSignal} [externalSignal] - 外部からのAbortSignal
     * @returns {Promise<string>} APIからの応答テキスト
     */
    async #executeClaudeRequest(headers, body, externalSignal = null) {
        try {
            const fetchOptions = {
                method: 'POST',
                headers: headers,
                body: (typeof body === 'string' ? body : JSON.stringify(body))
            };

            // 外部signalがある場合は追加
            if (externalSignal) {
                fetchOptions.signal = externalSignal;
            }

            const response = await fetch(window.CONFIG.AIAPI.ENDPOINTS.CLAUDE, fetchOptions).catch(error => {
                // ネットワークエラー（サーバー未起動など）の場合
                if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                    const endpoint = window.CONFIG.AIAPI.ENDPOINTS.CLAUDE;
                    throw new Error(
                        `ローカルサーバーに接続できません (${endpoint})\n\n` +
                        `以下のいずれかの方法でサーバーを起動してください:\n` +
                        `1. ChatBot.lnk をダブルクリック\n` +
                        `2. launcher\\StartChatBot.bat を実行\n` +
                        `3. コマンドライン: cd launcher\\server && node server.js --port=50000`
                    );
                }
                throw error;
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
                // 外部signalによる中断
                if (externalSignal?.aborted) {
                    throw error;
                }
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
     * @param {HTMLElement} thinkingContainer - 思考過程コンテナ（任意）
     * @param {Function|null} onWebSearchQuery - Web検索クエリ取得時のコールバック（任意）
     * @param {Function|null} onToolCall - ツール呼び出し時のコールバック（任意）
     * @param {AbortSignal} [externalSignal] - 外部からのAbortSignal
     * @returns {Promise<string>} 空文字列（ストリーミングのため）
     */
    async #executeStreamClaudeRequest(headers, body, onChunk, onComplete, thinkingContainer = null, onWebSearchQuery = null, onToolCall = null, externalSignal = null) {
        try {
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

            const fetchOptions = {
                method: 'POST',
                headers: headers,
                body: payloadStr
            };

            // 外部signalがある場合は追加
            if (externalSignal) {
                fetchOptions.signal = externalSignal;
            }

            const response = await fetch(window.CONFIG.AIAPI.ENDPOINTS.CLAUDE, fetchOptions).catch(error => {
                // 中断エラーはそのまま投げる
                if (error.name === 'AbortError') {
                    throw error;
                }
                // ネットワークエラー（サーバー未起動など）の場合
                if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                    const endpoint = window.CONFIG.AIAPI.ENDPOINTS.CLAUDE;
                    throw new Error(
                        `ローカルサーバーに接続できません (${endpoint})\n\n` +
                        `以下のいずれかの方法でサーバーを起動してください:\n` +
                        `1. ChatBot.lnk をダブルクリック\n` +
                        `2. launcher\\StartChatBot.bat を実行\n` +
                        `3. コマンドライン: cd launcher\\server && node server.js --port=50000`
                    );
                }
                throw error;
            });

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
            let webSearchAddedToThinking = false;

            // カスタムツール用の変数
            let currentToolCall = null;
            let toolInputBuffer = '';
            const chatMessages = document.querySelector('#chatMessages');

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

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
                            
                            // message_start イベント
                            if (parsed.type === 'message_start') {
                                // message_start処理
                            }
                            // content_block_start イベント
                            else if (parsed.type === 'content_block_start') {

                                // Web検索ツール使用開始の検出
                                if (parsed.content_block?.type === 'server_tool_use' &&
                                    parsed.content_block?.name === 'web_search') {
                                    webSearchInProgress = true;
                                    webSearchQuery = '';
                                    completedSearchQuery = '';
                                    webSearchMessageUpdated = false;

                                    // 待機インジケーターのラベルを差し替える。
                                    // クエリは確定後に思考過程アイテムへ追加する
                                    StreamingIndicator.getInstance.setActiveLabel(
                                        window.CONFIG?.UI?.STREAMING?.LABELS?.WEB_SEARCH ?? 'ウェブを検索しています'
                                    );
                                }

                                // カスタムツール使用開始の検出（tool_use タイプ）
                                if (parsed.content_block?.type === 'tool_use' &&
                                    parsed.content_block?.name !== 'web_search') {
                                    currentToolCall = {
                                        id: parsed.content_block.id,
                                        name: parsed.content_block.name,
                                        arguments: {},
                                        status: 'started',
                                        provider: 'claude'
                                    };
                                    toolInputBuffer = '';

                                    // ツール呼び出し開始コールバック
                                    if (onToolCall && typeof onToolCall === 'function') {
                                        try {
                                            onToolCall({ type: 'start', toolCall: currentToolCall });
                                        } catch (error) {
                                            console.warn('ツール呼び出しコールバックエラー:', error);
                                        }
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
                                        // Web検索クエリの抽出
                                        if (webSearchInProgress && parsed.delta.partial_json) {
                                            webSearchQuery += parsed.delta.partial_json;

                                            // 完全なJSONが形成されたかチェック
                                            try {
                                                const queryData = JSON.parse(webSearchQuery);
                                                if (queryData.query && queryData.query !== completedSearchQuery) {
                                                    completedSearchQuery = queryData.query;

                                                    // Web検索クエリ収集コールバックを呼び出し（ページ更新時の復元用）
                                                    if (onWebSearchQuery && typeof onWebSearchQuery === 'function') {
                                                        try {
                                                            onWebSearchQuery(completedSearchQuery);
                                                        } catch (error) {
                                                            console.warn('🔍 Web検索クエリコールバックエラー:', error);
                                                        }
                                                    }

                                                    // thinkingContainerがある場合は思考過程に追加（1回のみ）
                                                    if (thinkingContainer && !webSearchAddedToThinking) {
                                                        ChatRenderer.getInstance.addThinkingItem(
                                                            thinkingContainer,
                                                            'web-search',
                                                            completedSearchQuery
                                                        );
                                                        webSearchAddedToThinking = true;
                                                    }
                                                }
                                            } catch (e) {
                                                // JSONが未完成の場合は無視
                                            }
                                        }

                                        // カスタムツールの入力JSONを蓄積
                                        if (currentToolCall && parsed.delta.partial_json) {
                                            toolInputBuffer += parsed.delta.partial_json;

                                            // デルタコールバック
                                            if (onToolCall && typeof onToolCall === 'function') {
                                                try {
                                                    onToolCall({
                                                        type: 'delta',
                                                        toolCallId: currentToolCall.id,
                                                        partialJson: parsed.delta.partial_json
                                                    });
                                                } catch (error) {
                                                    console.warn('ツールデルタコールバックエラー:', error);
                                                }
                                            }
                                        }
                                    }
                                    // 思考デルタ（Extended Thinking）
                                    else if (parsed.delta.type === 'thinking_delta') {
                                        // 思考デルタ処理
                                    }
                                    // シグネチャデルタ
                                    else if (parsed.delta.type === 'signature_delta') {
                                        // シグネチャデルタ処理
                                    }
                                }
                            }
                            // content_block_stop イベント
                            else if (parsed.type === 'content_block_stop') {

                                // Web検索ツールの結果開始を検出
                                // thinkingContainerがある場合は思考過程に追加済みなのでスキップ
                                if (webSearchInProgress && completedSearchQuery && !webSearchMessageUpdated) {
                                    StreamingIndicator.getInstance.setActiveLabel(
                                        window.CONFIG?.UI?.STREAMING?.LABELS?.WEB_SEARCH_ANALYZE ?? '検索結果を読んでいます'
                                    );
                                    webSearchMessageUpdated = true;
                                }

                                // カスタムツール呼び出し完了の検出
                                if (currentToolCall) {
                                    try {
                                        currentToolCall.arguments = toolInputBuffer ? JSON.parse(toolInputBuffer) : {};
                                    } catch (e) {
                                        console.warn('ツール引数のJSONパースに失敗:', e);
                                        currentToolCall.arguments = {};
                                    }
                                    currentToolCall.status = 'complete';

                                    // ツール呼び出し完了コールバック
                                    if (onToolCall && typeof onToolCall === 'function') {
                                        try {
                                            onToolCall({ type: 'complete', toolCall: currentToolCall });
                                        } catch (error) {
                                            console.warn('ツール完了コールバックエラー:', error);
                                        }
                                    }

                                    // リセット
                                    currentToolCall = null;
                                    toolInputBuffer = '';
                                }
                            }
                            // message_delta イベント
                            else if (parsed.type === 'message_delta') {
                                if (parsed.delta && parsed.delta.stop_reason) {
                                    // Web検索完了、通常のThinkingに戻す
                                    if (webSearchInProgress) {
                                        webSearchInProgress = false;
                                    }
                                    
                                    if (onComplete) onComplete(fullResponse);
                                    return '';
                                }
                                // 使用量の更新
                                if (parsed.usage) {
                                    // 使用量更新処理
                                }
                            }
                            // message_stop イベント
                            else if (parsed.type === 'message_stop') {
                                // Web検索完了、通常のThinkingに戻す
                                if (webSearchInProgress) {
                                    webSearchInProgress = false;
                                }
                                
                                if (onComplete) onComplete(fullResponse);
                                return '';
                            }
                            // ping イベント
                            else if (parsed.type === 'ping') {
                                // ping受信処理
                            }
                            // error イベント
                            else if (parsed.type === 'error') {

                                // エラー時は待機表示をラベルなし（丸だけ）に戻す
                                if (webSearchInProgress) {
                                    StreamingIndicator.getInstance.clearActiveLabel();
                                }
                                webSearchInProgress = false;

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
