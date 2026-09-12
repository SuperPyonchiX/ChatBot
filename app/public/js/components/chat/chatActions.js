/**
 * chatActions.js
 * チャット関連のアクション（メッセージ送信、会話管理など）を担当するモジュール
 */
class ChatActions {
    // シングルトンインスタンス
    static #instance = null;

    // DOM要素
    #webSearchToggle;
    #codexToggle;
    #toggleStatus;

    /**
     * シングルトンインスタンスを取得します
     * @returns {ChatActions} ChatActionsのシングルトンインスタンス
     */
    static get getInstance() {
        if (!ChatActions.#instance) {
            ChatActions.#instance = new ChatActions();
        }
        return ChatActions.#instance;
    }

    /**
     * プライベートコンストラクタ
     */
    constructor() {
        if (ChatActions.#instance) {
            throw new Error('ChatActionsクラスは直接インスタンス化できません。ChatActions.instanceを使用してください。');
        }
        this.#initializeElements();
        this.#setupEventListeners();
        this.#updateToggleButtonState();
    }

    /**
     * DOM要素を初期化します
     */
    #initializeElements() {
        this.#webSearchToggle = document.getElementById('webSearchToggle');
        // アクティブ状態を設定
        if (this.#webSearchToggle) {
            const isEnabled = WebContentExtractor.getInstance.isWebSearchEnabled();
            if (isEnabled) {
                this.#webSearchToggle.classList.add('active');
            }
        }

        // Codex トグル（ON のあいだはメッセージを Codex CLI に直接渡す）
        this.#codexToggle = document.getElementById('codexToggle');
        if (this.#codexToggle) {
            if (window.CONFIG?.CODEX?.ENABLED === false) {
                this.#codexToggle.hidden = true;
            }
            window.AppState.codexEnabled = this.#loadCodexEnabled();
            this.#codexToggle.classList.toggle('active', window.AppState.codexEnabled);
        }
    }

    /**
     * Codex トグルの保存状態を読む
     * @returns {boolean}
     */
    #loadCodexEnabled() {
        try {
            const key = window.CONFIG?.STORAGE?.KEYS?.CODEX_ENABLED || 'codexEnabled';
            return localStorage.getItem(key) === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Codex トグルの状態を保存する
     * @param {boolean} enabled
     */
    #saveCodexEnabled(enabled) {
        try {
            const key = window.CONFIG?.STORAGE?.KEYS?.CODEX_ENABLED || 'codexEnabled';
            localStorage.setItem(key, enabled ? 'true' : 'false');
        } catch { /* noop */ }
    }

    /**
     * イベントリスナーを設定します
     */
    #setupEventListeners() {
        if (this.#webSearchToggle) {
            this.#webSearchToggle.addEventListener('click', () => {
                const webContentExtractor = WebContentExtractor.getInstance;
                const currentState = webContentExtractor.isWebSearchEnabled();
                webContentExtractor.setWebSearchEnabled(!currentState);
                this.#updateToggleButtonState();
            });
        }
        if (this.#codexToggle) {
            this.#codexToggle.addEventListener('click', () => {
                const next = !window.AppState.codexEnabled;
                window.AppState.codexEnabled = next;
                this.#saveCodexEnabled(next);
                this.#codexToggle.classList.toggle('active', next);
                console.log(`[ChatActions] Codex トグル: ${next ? 'ON' : 'OFF'}`);
            });
        }
    }

    /**
     * トグルボタンの状態を更新します
     */
    #updateToggleButtonState() {
        if (!this.#webSearchToggle) return;
        const isEnabled = WebContentExtractor.getInstance.isWebSearchEnabled();
        this.#webSearchToggle.classList.toggle('active', isEnabled);
    }

    /**
     * メッセージを送信します
     * ユーザー入力、添付ファイルを取得し、AIへの送信処理を行います
     * @returns {Promise<void>} 送信処理の完了を示すPromise
     */
    async sendMessage() {
        const currentConversation = window.AppState.getConversationById(window.AppState.currentConversationId);
        if (!currentConversation || !window.Elements.userInput || !window.Elements.chatMessages) return;
        
        try {
            // 送信ボタンを無効化
            if (window.Elements.sendButton) {
                window.Elements.sendButton.disabled = true;
            }
            
            // FileHandlerから現在の添付ファイルを取得
            const apiAttachments = await FileAttachment.getInstance.getAttachmentsForAPI();
            
            // 添付ファイルの参照を保持
            const attachmentsToSend = apiAttachments.length > 0 ? apiAttachments : window.AppState.currentAttachments;
            
            // 送信前に添付ファイルをクリア
            window.AppState.currentAttachments = [];
            FileHandler.getInstance.clearSelectedFiles();
            
            // 添付ファイルのプレビュー表示をクリア
            const filePreviewArea = document.querySelector('.file-preview');
            if (filePreviewArea) {
                filePreviewArea.remove();
            }
            
            const attachmentPreviewArea = document.querySelector('.attachment-preview-area');
            if (attachmentPreviewArea) {
                FileAttachment.getInstance.clearAttachments(attachmentPreviewArea);
            }
            
            // ストリーミングメソッドを使用してメッセージを送信
            const result = await this.#processAndSendMessage(
                window.Elements.userInput, 
                window.Elements.chatMessages, 
                currentConversation, 
                window.AppState.apiSettings, 
                window.AppState.systemPrompt,
                attachmentsToSend
            );
            
            if (result?.titleUpdated) {
                this.renderChatHistory();
            }
            
            if (!result?.error) {
                // 会話を保存
                // @ts-ignore - Storageはカスタムクラス（型定義あり）
                Storage.getInstance.saveConversations(window.AppState.conversations);
                
                // 添付ファイルを保存（正常送信時のみ）
                if (attachmentsToSend && attachmentsToSend.length > 0) {
                    // 最新のユーザーメッセージのタイムスタンプを取得
                    const latestUserMessage = currentConversation.messages
                        .filter(m => m.role === 'user')
                        .pop();
                    
                    // FileHandlerのタイムスタンプを優先
                    const timestamp = FileHandler.getInstance.attachmentTimestamp || 
                                    (latestUserMessage ? latestUserMessage.timestamp : Date.now());
                    
                    FileAttachment.getInstance.saveAttachmentsForConversation(
                        currentConversation.id, 
                        attachmentsToSend
                    );
                }
            }
        } catch (error) {
            console.error('メッセージ送信中にエラーが発生しました:', error);
            // エラー表示
            const errorMsg = document.createElement('div');
            errorMsg.classList.add('error-message');
            errorMsg.textContent = 'メッセージ送信中にエラーが発生しました。';
            window.Elements.chatMessages.appendChild(errorMsg);
        } finally {
            // 送信ボタンを再有効化
            if (window.Elements.sendButton) {
                window.Elements.sendButton.disabled = false;
            }
        }
    }

    /**
     * 新しい会話を作成します
     * タイムスタンプをIDとして使用し、デフォルトのシステムプロンプトを含む新しい会話を生成します
     * 作成後は会話履歴を更新し、新しい会話を表示します
     * @returns {void}
     */
    createNewConversation() {
        // アーティファクトをクリアしてパネルを閉じる
        if (typeof ArtifactManager !== 'undefined') {
            ArtifactManager.getInstance.clearAll();
        }
        if (typeof ArtifactPanel !== 'undefined') {
            ArtifactPanel.getInstance.close();
        }

        /** @type {Conversation} */
        const newConversation = {
            id: Date.now().toString(),
            title: '新しいチャット',
            messages: [
                {
                    role: 'system',
                    content: window.AppState.systemPrompt || ''
                }
            ],
            model: window.AppState.getCurrentModel(),
            timestamp: Date.now()
        };
        
        window.AppState.conversations.unshift(newConversation);
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.saveConversations(window.AppState.conversations);
        
        window.AppState.currentConversationId = newConversation.id;
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.saveCurrentConversationId(window.AppState.currentConversationId);
        
        this.renderChatHistory();
        
        if (window.Elements.chatMessages && window.Elements.modelSelect) {
            // 会話を表示
            ChatHistory.getInstance.displayConversation(newConversation, window.Elements.chatMessages, window.Elements.modelSelect);
        }
    }

    /**
     * 会話履歴を表示します
     * ChatHistoryクラスを使用して、サイドバーに会話履歴のリストをレンダリングします
     * 会話の切り替え、名前変更、削除のコールバック関数も設定します
     * @returns {void}
     */
    renderChatHistory() {
        if (!window.Elements.chatHistory) return;
        
        // チャット履歴を更新
        ChatHistory.getInstance.renderChatHistory(
            window.AppState.conversations, 
            window.AppState.currentConversationId, 
            window.Elements.chatHistory, 
            this.#switchConversation.bind(this), 
            RenameChatModal.getInstance.showRenameChatModal, 
            this.#deleteConversation.bind(this)
        );
    }

    /**
     * すべての履歴をクリアします
     * ユーザーの確認後、すべての会話と関連する添付ファイルをストレージから削除し、
     * 新しい空の会話を作成します
     * @returns {void}
     */
    clearAllHistory() {
        if (confirm('すべての会話履歴を削除してもよろしいですか？')) {
            // すべての添付ファイルを削除
            window.AppState.conversations.forEach(conversation => {
                if (conversation.id) {
                    // @ts-ignore - Storageはカスタムクラス（型定義あり）
                    Storage.getInstance.removeAttachments(conversation.id);
                }
            });
            
            window.AppState.conversations = [];
            // @ts-ignore - Storageはカスタムクラス（型定義あり）
            Storage.getInstance.saveConversations(window.AppState.conversations);
            this.createNewConversation();
        }
    }

    /**
     * メッセージを処理して送信する
     * @param {Object} userInput - ユーザー入力要素
     * @param {HTMLElement} chatMessages - チャットメッセージ要素
     * @param {Object} conversation - 現在の会話オブジェクト
     * @param {Object} apiSettings - API設定
     * @param {string} systemPrompt - システムプロンプト
     * @param {Array} attachments - 添付ファイル配列
     * @returns {Promise<Object>} 送信結果
     */
    async #processAndSendMessage(userInput, chatMessages, conversation, apiSettings, systemPrompt, attachments = []) {
        if (!userInput || !chatMessages || !conversation) {
            return { error: 'Invalid parameters' };
        }

        try {
            const userText = userInput.value.trim();
            if (!userText && (!attachments || attachments.length === 0)) {
                return { error: 'No message content' };
            }

            // Codex トグルが ON ならメッセージを Codex CLI に直接渡す
            if (this.#isCodexModeEnabled()) {
                userInput.value = '';
                UIUtils.getInstance.autoResizeTextarea(userInput);
                ChatUI.getInstance.updateSendButtonState();
                return await this.#processWithCodex(userText, chatMessages, conversation, attachments);
            }

            const enterpriseUrl = (userText.match(/https?:\/\/[^\s<>]+/g) || []).some(url => window.EnterpriseClient?.getInstance.matchUrl(url));
            if ((enterpriseUrl || /jira|confluence/i.test(userText)) && (typeof ToolManager === 'undefined' || !ToolManager.getInstance.isModelCompatible(conversation.model))) {
                alert('このモデルはツール呼び出しに対応していないため、Jira／Confluenceを参照できません。対応モデルを選択してください。');
                return { error: 'Enterprise tools require a tool-compatible model' };
            }

            // ユーザー入力をクリア
            userInput.value = '';
            UIUtils.getInstance.autoResizeTextarea(userInput);
            ChatUI.getInstance.updateSendButtonState();

            let titleUpdated = false;
            const timestamp = Date.now();

            // 添付ファイルの処理
            let attachmentContent = '';
            let displayAttachments = attachments || [];

            // ユーザーメッセージを表示
            await ChatRenderer.getInstance.addUserMessage(userText, chatMessages, displayAttachments, timestamp, true);

            // WEB検索の実行判断
            let searchPerformed = false;
            let messageWithSearchResults = userText;
            const currentModel = window.AppState.getCurrentModel();
            const webExtractor = WebContentExtractor.getInstance;
            const isWebSearchEnabled = webExtractor && webExtractor.isWebSearchEnabled();

            // GPT-5シリーズはResponses API内蔵Web検索を使用
            // Claude 4系・3.5シリーズはClaude Web検索機能を使用
            // その他のモデルではWeb検索は利用できません

            if (attachments && attachments.length > 0) {
                const processedResult = await this.#processAttachments(attachments);
                attachmentContent = processedResult.content;

                // 元の添付ファイル + Officeファイルから抽出した画像を統合
                displayAttachments = [
                    ...attachments.map(att => ({
                        ...att,
                        timestamp: timestamp
                    })),
                    ...processedResult.extractedImages.map(img => ({
                        ...img,
                        timestamp: timestamp
                    }))
                ];
            }

            // 添付ファイルの内容を含めた最終的なメッセージを作成
            const finalMessage = (attachmentContent ? `${messageWithSearchResults}\n\n${attachmentContent}` : messageWithSearchResults);

            const userMessage = {
                role: 'user',
                content: finalMessage,
                timestamp: timestamp
            };

            conversation.messages.push(userMessage);

            // チャットタイトルの更新フラグ（AI生成は後で実行）
            const shouldGenerateTitle = conversation.title === '新しいチャット' &&
                conversation.messages.filter(m => m.role === 'user').length === 1;

            // APIリクエストの処理
            const effectiveSystemPrompt = systemPrompt || window.CONFIG.SYSTEM_PROMPTS.DEFAULT_SYSTEM_PROMPT;
            let messagesWithSystem = [
                { role: 'system', content: effectiveSystemPrompt },
                ...conversation.messages.filter(m => m.role !== 'system')
            ];

            const botTimestamp = Date.now();
            // ストリーミング用のボットメッセージを表示（thinkingContainerも取得）
            const { messageDiv, contentContainer, thinkingContainer } = ChatRenderer.getInstance.addStreamingBotMessage(chatMessages, botTimestamp);

            // RAGプロンプト拡張（augmentPrompt内部で有効/無効を判定）
            // returnSources: trueで参照資料情報も取得
            let ragSources = [];
            if (typeof RAGManager !== 'undefined') {
                try {
                    const ragResult = await RAGManager.getInstance.augmentPrompt(
                        messagesWithSystem,
                        userText,
                        { returnSources: true }
                    );

                    // 戻り値がオブジェクトの場合（returnSources: true）
                    if (ragResult && ragResult.messages) {
                        messagesWithSystem = ragResult.messages;
                        ragSources = ragResult.sources || [];
                    } else {
                        // 後方互換性：配列の場合
                        messagesWithSystem = ragResult;
                    }

                    // RAG参照資料を思考過程に表示
                    if (ragSources.length > 0 && thinkingContainer) {
                        ChatRenderer.getInstance.addThinkingItem(thinkingContainer, 'rag', ragSources);
                    }
                } catch (ragError) {
                    console.warn('RAGプロンプト拡張エラー:', ragError);
                    // RAGエラーは無視して続行
                }
            }

            let fullResponseText = '';

            // 思考過程データを収集（ページ更新時の復元用）
            let thinkingData = {
                webSearchQueries: [],
                ragSources: ragSources.length > 0 ? ragSources : [],
                toolCalls: []  // ツール実行情報
            };

            // AbortControllerを作成
            const abortController = window.AppState.createAbortController();
            window.AppState.isStreaming = true;

            // ツール呼び出しが続く限り往復する
            // モデルがツールを呼ぶ → ここで実行 → 結果をテキストで返す → 続きを生成、を MAX_ROUNDS まで繰り返す
            const maxRounds = (typeof ToolManager !== 'undefined') ? ToolManager.getInstance.getMaxRounds() : 1;
            const webSearchOption = isWebSearchEnabled && (window.CONFIG.MODELS.OPENAI_WEB_SEARCH_COMPATIBLE.includes(currentModel) || window.CONFIG.MODELS.CLAUDE.includes(currentModel));
            let roundMessages = messagesWithSystem;
            let round = 0;

            while (true) {
                round++;
                const isLastRound = round >= maxRounds;
                const textBefore = fullResponseText;
                const separator = textBefore ? '\n\n' : '';
                let roundText = '';
                /** @type {Promise<Object|null>[]} */
                const pendingTools = [];

                const returned = await AIAPI.getInstance.callAIAPI(
                    roundMessages,
                    conversation.model,
                    round === 1 ? displayAttachments : [],
                    {
                        stream: true,
                        signal: abortController.signal,
                        enableWebSearch: webSearchOption,
                        thinkingContainer: thinkingContainer, // Web検索用に渡す
                        onWebSearchQuery: (query) => {
                            if (query && !thinkingData.webSearchQueries.includes(query)) {
                                thinkingData.webSearchQueries.push(query);
                            }
                        },
                        onChunk: (chunk) => {
                            roundText += chunk;
                            fullResponseText = textBefore + (roundText ? separator : '') + roundText;
                            ChatRenderer.getInstance.updateStreamingBotMessage(contentContainer, chunk, fullResponseText);
                        },
                        onComplete: () => {
                            // 確定処理はループを抜けたあとにまとめて行う（途中往復ではツール結果を返して続きを生成する）
                        },
                        onToolCall: (event) => {
                            if (event?.type === 'complete' && event.toolCall) {
                                pendingTools.push(this.#handleToolCall(event, thinkingContainer, contentContainer, conversation.id, botTimestamp, thinkingData));
                            } else {
                                this.#handleToolCall(event, thinkingContainer, contentContainer, conversation.id, botTimestamp, thinkingData);
                            }
                        }
                    }
                );

                // 非ストリーミングで本文が返ってきた場合の保険
                if (!roundText && typeof returned === 'string' && returned) {
                    roundText = returned;
                    fullResponseText = textBefore + separator + roundText;
                    ChatRenderer.getInstance.updateStreamingBotMessage(contentContainer, returned, fullResponseText);
                }

                const executed = (await Promise.all(pendingTools)).filter(Boolean);
                if (executed.length === 0 || abortController.signal.aborted) {
                    break;
                }
                if (isLastRound) {
                    console.warn(`[ChatActions] ツール往復の上限（${maxRounds}）に達したため打ち切ります`);
                    break;
                }

                // 次の往復: プロバイダ非依存にするため、ツール結果はテキストとしてユーザー発言に載せる
                roundMessages = [
                    ...roundMessages,
                    {
                        role: 'assistant',
                        content: roundText || `(ツールを呼び出しました: ${executed.map(e => e.toolCall.name).join(', ')})`
                    },
                    { role: 'user', content: this.#buildToolResultsMessage(executed) }
                ];
            }

            ChatRenderer.getInstance.finalizeStreamingBotMessage(messageDiv, contentContainer, fullResponseText);

            // 思考過程データがあるかどうかを判定
            // elapsedMs は付随情報なので、これ単独では思考過程を作らない
            const hasThinkingData = thinkingData.webSearchQueries.length > 0 ||
                                   thinkingData.ragSources.length > 0 ||
                                   thinkingData.toolCalls.length > 0;

            if (hasThinkingData && messageDiv?.dataset?.streamStartedAt) {
                thinkingData.elapsedMs = Date.now() - Number(messageDiv.dataset.streamStartedAt);
            }

            // 応答をメッセージ履歴に追加（思考過程データを含む）
            const assistantMessage = {
                role: 'assistant',
                content: fullResponseText,
                timestamp: botTimestamp
            };

            // 思考過程データがある場合のみ追加
            if (hasThinkingData) {
                assistantMessage.thinkingData = thinkingData;
            }

            conversation.messages.push(assistantMessage);

            // ストリーミング完了後にAbortControllerをクリア
            window.AppState.clearAbortController();

            // タイトル自動生成（非同期で実行、UIをブロックしない）
            if (shouldGenerateTitle) {
                this.#generateAndUpdateTitle(conversation, userText).catch(err => {
                    console.warn('[ChatActions] タイトル自動生成エラー:', err.message);
                });
                titleUpdated = true;
            }

            return { titleUpdated, response: fullResponseText };

        } catch (error) {
            // AbortControllerをクリア
            window.AppState.clearAbortController();

            // 応答が来なかったので待機中のメッセージを片付ける。
            // これをしないと脈打つ丸が残り続ける
            this.#cleanupPendingMessage(chatMessages);

            // 中断エラーの場合は特別な処理
            if (error.name === 'AbortError') {
                console.log('[ChatActions] リクエストがユーザーによって中断されました');
                return { titleUpdated: false, aborted: true };
            }

            // エラーメッセージを表示
            const errorMessage = error.message || 'APIリクエスト中にエラーが発生しました';
            this.#showErrorMessage(errorMessage, chatMessages);

            return { titleUpdated: false, error: error.message || '内部エラーが発生しました' };
        }
    }

    /**
     * 応答が得られなかったストリーミングメッセージを片付けます
     * 本文が空のままなら要素ごと取り除き、内容があれば完了状態にします。
     * 対象は DOM から探す（呼び出し元の catch からは try 内の変数を参照できないため）
     * @param {HTMLElement} chatMessages - メッセージ表示要素
     * @returns {void}
     */
    #cleanupPendingMessage(chatMessages) {
        const messageDiv = chatMessages?.querySelector('.message.bot.streaming');
        if (!messageDiv) return;

        ChatRenderer.getInstance.cancelStreamingMessage(messageDiv);
        messageDiv.classList.remove('streaming');

        const thinkingContainer = messageDiv.querySelector('.thinking-process');
        if (thinkingContainer) {
            const startedAt = Number(messageDiv.dataset.streamStartedAt);
            ChatRenderer.getInstance.finalizeThinking(thinkingContainer, {
                elapsedMs: startedAt ? Date.now() - startedAt : undefined
            });
        }

        // 本文も思考過程も無い空の吹き出しは残さない
        const hasBody = (messageDiv.querySelector('.markdown-content')?.textContent ?? '').trim().length > 0;
        const hasThinking = thinkingContainer && thinkingContainer.style.display !== 'none';
        if (!hasBody && !hasThinking) {
            messageDiv.remove();
        }
    }

    /**
     * エラーメッセージを表示
     * @param {string} errorMessage - エラーメッセージ
     * @param {HTMLElement} chatMessages - メッセージ表示要素
     */
    #showErrorMessage(errorMessage, chatMessages) {
        if (!chatMessages) return;
        
        const errorMessageDiv = document.createElement('div');
        errorMessageDiv.classList.add('message', 'bot', 'error');
        errorMessageDiv.innerHTML = `
            <div class="message-body">
                <div class="message-content">
                    <p>エラーが発生しました: ${errorMessage || '不明なエラー'}</p>
                    <button id="showApiSettings" class="error-action">API設定を確認する</button>
                </div>
            </div>
        `;
        chatMessages.appendChild(errorMessageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * 添付ファイルの内容を処理する
     * @param {Array} attachments - 添付ファイルの配列
     * @returns {Promise<{content: string, extractedImages: Array}>} 処理結果（テキストと抽出画像）
     */
    async #processAttachments(attachments) {
        if (!attachments || !Array.isArray(attachments)) {
            return { content: '', extractedImages: [] };
        }

        let content = '';
        let extractedImages = [];

        for (const attachment of attachments) {
            if (!attachment || !attachment.type) continue;

            // テキスト抽出
            if ((attachment.type === 'pdf' ||
                 attachment.type === 'office' ||
                 attachment.type === 'file') &&
                attachment.content) {
                content += `\n${attachment.content}\n`;
            }

            // Officeファイルから抽出した画像を収集
            if (attachment.type === 'office' && attachment.images?.length > 0) {
                for (const img of attachment.images) {
                    extractedImages.push({
                        type: 'image',
                        name: `${attachment.name}_image`,
                        mimeType: img.mimeType || 'image/png',
                        data: img.data
                    });
                }
            }
        }

        return { content, extractedImages };
    }

    /**
     * タイトルを自動生成して更新
     * @param {Object} conversation - 会話オブジェクト
     * @param {string} userText - ユーザーの最初のメッセージ
     */
    async #generateAndUpdateTitle(conversation, userText) {
        try {
            // TitleGeneratorが利用可能か確認
            if (typeof TitleGenerator === 'undefined') {
                // フォールバック：先頭30文字を使用
                conversation.title = userText.substring(0, 30) + (userText.length > 30 ? '...' : '');
            } else {
                // AIでタイトルを生成
                const generatedTitle = await TitleGenerator.getInstance.generateTitle(userText, conversation.model);
                conversation.title = generatedTitle;
            }

            // 会話を保存
            Storage.getInstance.saveConversations(window.AppState.conversations);

            // サイドバーのチャット履歴を更新
            if (typeof ChatHistory !== 'undefined') {
                ChatHistory.getInstance.renderChatHistory(
                    window.AppState.conversations,
                    window.AppState.currentConversationId
                );
            }

            console.log('[ChatActions] タイトル自動生成完了:', conversation.title);
        } catch (error) {
            console.error('[ChatActions] タイトル生成エラー:', error);
            // エラー時はフォールバック
            conversation.title = userText.substring(0, 30) + (userText.length > 30 ? '...' : '');
            Storage.getInstance.saveConversations(window.AppState.conversations);
        }
    }

    /**
     * ツール呼び出しイベントを処理
     * @param {Object} event - ツールイベント（type: 'start' | 'delta' | 'complete' | 'error'）
     * @param {HTMLElement} thinkingContainer - 思考過程表示コンテナ
     * @param {HTMLElement} contentContainer - コンテンツ表示コンテナ
     * @param {string} conversationId - 会話ID
     * @param {number} messageTimestamp - メッセージのタイムスタンプ
     * @param {Object} thinkingData - 思考過程データ（復元用）
     * @returns {Promise<{toolCall: Object, result?: Object, error?: string}|null>} 実行結果（complete 時のみ）
     */
    /**
     * 思考過程アイテムの同一性を判定するキーを作ります
     * 実行中と完了を同じ行として扱うために使います
     * @param {Object} toolCall - ツール呼び出し情報
     * @returns {string} アイテムキー
     */
    #getToolItemKey(toolCall) {
        return `tool:${toolCall?.id ?? toolCall?.name ?? 'unknown'}`;
    }

    async #handleToolCall(event, thinkingContainer, contentContainer, conversationId, messageTimestamp, thinkingData) {
        if (!event) return null;

        const { type, toolCall } = event;

        // delta イベントは進捗のみ（特別な処理は不要）
        if (type === 'delta') {
            return null;
        }

        // start イベント: 思考過程にツール呼び出しを表示 & ストリーミングステータス更新
        if (type === 'start' && toolCall && thinkingContainer) {
            const toolName = this.#getToolDisplayName(toolCall.name);
            if (typeof ChatRenderer !== 'undefined') {
                ChatRenderer.getInstance.addThinkingItem(thinkingContainer, 'tool', `${toolName}を実行中...`, { key: this.#getToolItemKey(toolCall) });
                const streamingMessage = StreamingIndicator.getInstance.activeMessage;
                if (streamingMessage) {
                    ChatRenderer.getInstance.updateStreamingStatus(streamingMessage, 'tool-running', toolName);
                }
            }
            return null;
        }

        // ツール実行（complete時）。結果はモデルに返すため呼び出し元へ渡す
        if (type === 'complete' && toolCall && typeof ToolManager !== 'undefined') {
            const toolName = this.#getToolDisplayName(toolCall.name);
            if (thinkingContainer && typeof ChatRenderer !== 'undefined') {
                ChatRenderer.getInstance.addThinkingItem(thinkingContainer, 'tool', `${toolName}を実行中...`, { key: this.#getToolItemKey(toolCall) });
            }
            try {
                const result = await ToolManager.getInstance.handleToolCall(toolCall, toolCall.provider, { container: contentContainer });

                let fileId = null;
                if (result && contentContainer) {
                    fileId = await this.#displayToolResult(result, contentContainer, conversationId, messageTimestamp);
                }

                if (thinkingContainer && typeof ChatRenderer !== 'undefined') {
                    ChatRenderer.getInstance.addThinkingItem(thinkingContainer, 'tool-complete', `${toolName}完了`, { key: this.#getToolItemKey(toolCall) });
                }

                if (thinkingData && thinkingData.toolCalls) {
                    thinkingData.toolCalls.push({
                        id: toolCall.id ?? null,
                        name: toolCall.name,
                        displayName: toolName,
                        status: 'complete',
                        filename: result?.filename || null,
                        fileId: fileId,
                        params: this.#extractToolParams(toolCall)
                    });
                }

                return { toolCall, result };
            } catch (error) {
                console.error('ツール実行エラー:', error);
                if (thinkingContainer && typeof ChatRenderer !== 'undefined') {
                    ChatRenderer.getInstance.addThinkingItem(thinkingContainer, 'tool-error', `${toolName}エラー: ${error.message}`, { key: this.#getToolItemKey(toolCall) });
                }
                if (thinkingData && thinkingData.toolCalls) {
                    thinkingData.toolCalls.push({
                        id: toolCall.id ?? null,
                        name: toolCall.name,
                        displayName: toolName,
                        status: 'error',
                        params: this.#extractToolParams(toolCall)
                    });
                }
                return { toolCall, error: error.message };
            }
        }

        return null;
    }

    /**
     * ツール実行結果をモデルに返すためのメッセージ本文を組み立てる
     * @param {Array<{toolCall: Object, result?: Object, error?: string}>} executed
     * @returns {string}
     */
    #buildToolResultsMessage(executed) {
        const maxChars = window.CONFIG?.TOOLS?.RESULT_MAX_CHARS || 12000;
        const blocks = executed.map(({ toolCall, result, error }) => {
            const resultLimit = /^(jira_|confluence_)/.test(toolCall.name) || result?.notice
                ? window.CONFIG.ENTERPRISE.RESULT_LIMIT : maxChars;
            const payload = error
                ? { success: false, error }
                : this.#summarizeToolResultForModel(result);
            let text = JSON.stringify(payload, null, 0);
            if (text.length > resultLimit) {
                text = text.substring(0, resultLimit) + `... (${text.length - resultLimit} 文字省略)`;
            }
            return `<tool_result name="${toolCall.name}"${toolCall.id ? ` id="${toolCall.id}"` : ''}>\n${text}\n</tool_result>`;
        });
        return [
            '以下は、あなたが呼び出したツールの実行結果です。この結果を踏まえてユーザーへの回答を続けてください。',
            '結果をそのまま貼り付けず、必要な情報だけを使ってください。さらにツールが必要なら続けて呼び出して構いません。',
            '',
            ...blocks
        ].join('\n');
    }

    /**
     * モデルに返すツール結果を軽量化する（Blob や data URL は落とす）
     * @param {Object} result
     * @returns {Object}
     */
    #summarizeToolResultForModel(result) {
        if (result === null || result === undefined) return { success: true };
        if (typeof result !== 'object') return { success: true, result };
        if (result.type === 'file') {
            return {
                success: true, type: 'file', filename: result.filename, mimeType: result.mimeType, size: result.size,
                note: 'ファイルはユーザーの画面にダウンロードカードとして表示済み。ファイル名と内容の要点だけ伝えればよい'
            };
        }
        if (result.type === 'image') {
            return {
                success: true, type: 'image', filename: result.filename, width: result.width, height: result.height,
                note: '画像はユーザーの画面にプレビュー表示済み'
            };
        }
        const copy = {};
        for (const [key, value] of Object.entries(result)) {
            if (value instanceof Blob) continue;
            if (typeof value === 'string' && value.startsWith('data:')) continue;
            copy[key] = value;
        }
        return copy;
    }

    /**
     * ツール呼び出しからパラメータを抽出
     * @param {Object} toolCall - ツール呼び出し情報
     * @returns {Object} パラメータオブジェクト
     */
    #extractToolParams(toolCall) {
        if (!toolCall) return {};

        // 引数がJSON文字列の場合はパース
        if (typeof toolCall.arguments === 'string') {
            try {
                return JSON.parse(toolCall.arguments);
            } catch (e) {
                return {};
            }
        }

        return toolCall.arguments || toolCall.input || {};
    }

    /**
     * ツール名の表示名を取得
     * @param {string} name - ツール名
     * @returns {string} 表示名
     */
    #getToolDisplayName(name) {
        return window.CONFIG?.TOOLS?.DISPLAY_NAMES?.[name] ?? name;
    }

    /**
     * ツール実行結果をUIに表示し、ファイルを永続化
     * @param {Object} result - ツール実行結果
     * @param {HTMLElement} contentContainer - 表示先コンテナ
     * @param {string} conversationId - 会話ID
     * @param {number} messageTimestamp - メッセージのタイムスタンプ
     * @returns {Promise<string|null>} 保存したファイルID（ファイル以外の場合はnull）
     */
    async #displayToolResult(result, contentContainer, conversationId, messageTimestamp) {
        if (!result || !contentContainer) return null;

        let savedFileId = null;

        // ファイル生成結果
        if (result.type === 'file' && typeof FileDownloader !== 'undefined') {
            // ファイルをIndexedDBに永続化
            if (typeof FileStorage !== 'undefined' && result.blob) {
                try {
                    savedFileId = await FileStorage.getInstance.save(result, conversationId, messageTimestamp);
                } catch (error) {
                    // ファイル永続化エラーは無視して続行
                }
            }

            // ダウンロードカードを作成（fileIdを含める）
            const downloadCard = FileDownloader.getInstance.createDownloadCard(result, savedFileId);
            if (downloadCard) {
                contentContainer.appendChild(downloadCard);
            }
        }

        // 画像生成結果
        if (result.type === 'image' && typeof ToolPreview !== 'undefined') {
            const preview = ToolPreview.getInstance.createImagePreview(result);
            if (preview) {
                contentContainer.appendChild(preview);
            }
        }

        // 分析結果（テキスト）
        if (result.type === 'analysis' && result.summary) {
            const analysisDiv = document.createElement('div');
            analysisDiv.className = 'tool-analysis-result';
            analysisDiv.innerHTML = `<pre>${result.summary}</pre>`;
            contentContainer.appendChild(analysisDiv);
        }

        return savedFileId;
    }

    /**
     * 会話を切り替えます
     * 指定されたIDの会話に切り替え、UIを更新し、関連する添付ファイルを表示します
     * @param {string} conversationId - 切り替え先の会話ID
     * @returns {void}
     */
    #switchConversation(conversationId) {
        if (!conversationId) return;

        // アーティファクトをクリアしてパネルを閉じる
        if (typeof ArtifactManager !== 'undefined') {
            ArtifactManager.getInstance.clearAll();
        }
        if (typeof ArtifactPanel !== 'undefined') {
            ArtifactPanel.getInstance.close();
        }

        window.AppState.currentConversationId = conversationId;
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.saveCurrentConversationId(window.AppState.currentConversationId);
        
        // アクティブチャットを更新
        ChatHistory.getInstance.updateActiveChatInHistory(window.AppState.currentConversationId);
        
        if (window.Elements.chatMessages && window.Elements.modelSelect) {
            // 会話を表示
            ChatHistory.getInstance.displayConversation(
                window.AppState.getConversationById(window.AppState.currentConversationId),
                window.Elements.chatMessages,
                window.Elements.modelSelect
            );
            
            // 添付ファイルを表示
            FileAttachment.getInstance.displaySavedAttachments(window.AppState.currentConversationId, window.Elements.chatMessages);
        }
    }

    /**
     * 会話を削除します
     * 指定された会話IDの会話を削除し、関連する添付ファイルも削除します
     * 削除した会話が現在表示中だった場合、別のチャットに切り替えるか新しいチャットを作成します
     * @param {string} conversationId - 削除する会話ID
     * @returns {void}
     */
    #deleteConversation(conversationId) {
        // 確認ダイアログを表示
        if (!confirm('このチャットを削除してもよろしいですか？')) return;
            
        // 削除するチャットが現在表示中のチャットかどうか確認
        const isCurrentChat = conversationId === window.AppState.currentConversationId;
        
        // チャットを削除
        window.AppState.conversations = window.AppState.conversations.filter(conv => conv.id !== conversationId);
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.saveConversations(window.AppState.conversations);
        
        // 添付ファイルも削除
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.removeAttachments(conversationId);
        
        // 削除したチャットが現在表示中だった場合、別のチャットに切り替える
        if (isCurrentChat) {
            if (window.AppState.conversations.length > 0) {
                // 最初のチャットに切り替え
                window.AppState.currentConversationId = window.AppState.conversations[0].id;
                // @ts-ignore - Storageはカスタムクラス（型定義あり）
                Storage.getInstance.saveCurrentConversationId(window.AppState.currentConversationId);
                
                if (window.Elements.chatMessages && window.Elements.modelSelect) {
                    // 会話を表示
                    ChatHistory.getInstance.displayConversation(
                        window.AppState.getConversationById(window.AppState.currentConversationId),
                        window.Elements.chatMessages,
                        window.Elements.modelSelect
                    );
                }
            } else {
                // チャットがなくなった場合は新しいチャットを作成
                this.createNewConversation();
                return; // createNewConversation内でrenderChatHistoryを呼ぶので、ここでは不要
            }
        }
        
        // チャット履歴の表示を更新
        this.renderChatHistory();
    }

    // ========================================
    // Codex モード関連メソッド
    // ========================================

    /**
     * Codex トグルが ON かどうか
     * @returns {boolean}
     */
    #isCodexModeEnabled() {
        const configEnabled = window.CONFIG?.CODEX?.ENABLED === true;
        return configEnabled && window.AppState?.codexEnabled === true && typeof CodexClient !== 'undefined';
    }

    /**
     * Codex トグル ON 時の送信処理
     * サーバー側で Codex CLI を起動し、進捗カードを描画してから最終メッセージを表示する
     * @param {string} userText - ユーザー入力
     * @param {HTMLElement} chatMessages - チャットメッセージコンテナ
     * @param {Object} conversation - 会話オブジェクト
     * @param {Array} attachments - 添付ファイル
     * @returns {Promise<Object>} 処理結果
     */
    async #processWithCodex(userText, chatMessages, conversation, attachments = []) {
        console.log('[ChatActions] Codex に委譲して処理開始');

        let titleUpdated = false;
        const timestamp = Date.now();

        await ChatRenderer.getInstance.addUserMessage(userText, chatMessages, attachments, timestamp, true);

        let attachmentContent = '';
        if (attachments && attachments.length > 0) {
            const processedResult = await this.#processAttachments(attachments);
            attachmentContent = processedResult.content;
        }
        const prompt = attachmentContent ? `${userText}\n\n${attachmentContent}` : userText;

        conversation.messages.push({ role: 'user', content: prompt, timestamp });

        const shouldGenerateTitle = conversation.title === '新しいチャット' &&
            conversation.messages.filter(m => m.role === 'user').length === 1;

        const card = CodexRunCard.getInstance;
        const abortController = window.AppState.createAbortController();
        window.AppState.isStreaming = true;
        let jobId = null;

        const cardEl = card.create(chatMessages, {
            onStop: () => {
                if (jobId) CodexClient.getInstance.cancel(jobId);
                abortController.abort();
            }
        });

        const botTimestamp = Date.now();

        try {
            const runOnce = async (threadId) => CodexClient.getInstance.run({
                prompt,
                threadId,
                signal: abortController.signal,
                onJob: (id) => { jobId = id; },
                onEvent: (event) => card.appendEvent(cardEl, event),
                onStderr: (line) => card.appendStderr(cardEl, line),
                onError: (err) => card.showError(cardEl, err.message)
            });

            let result = await runOnce(conversation.codexThreadId || null);

            // resume 失敗（スレッドが見つからない等）は新規スレッドで 1 回だけやり直す
            if (!result.success && !result.aborted && conversation.codexThreadId &&
                /thread|session|resume|not found/i.test(result.error || '')) {
                console.warn('[ChatActions] Codex resume 失敗。新規スレッドで再実行:', result.error);
                conversation.codexThreadId = null;
                result = await runOnce(null);
            }

            card.finalize(cardEl, result);

            if (result.threadId) {
                conversation.codexThreadId = result.threadId;
            }

            let finalResponse = result.finalMessage || '';
            if (!finalResponse) {
                if (result.aborted) {
                    finalResponse = 'Codex の実行を中断しました。';
                } else if (result.error) {
                    finalResponse = `Codex 実行エラー: ${result.error}`;
                } else {
                    finalResponse = 'Codex の実行が完了しましたが、メッセージは返されませんでした。';
                }
            }

            conversation.messages.push({
                role: 'assistant',
                content: finalResponse,
                timestamp: botTimestamp,
                codexData: card.summarize(result)
            });

            // エージェント経路と同じく await しない（描画はフレーム単位でまとめられるため、
            // 非表示タブでは待つと戻ってこない）
            const { messageDiv, contentContainer } = ChatRenderer.getInstance.addStreamingBotMessage(chatMessages, botTimestamp);
            ChatRenderer.getInstance.updateStreamingBotMessage(contentContainer, finalResponse, finalResponse);
            ChatRenderer.getInstance.finalizeStreamingBotMessage(messageDiv, contentContainer, finalResponse);

            Storage.getInstance.saveConversations(window.AppState.conversations);

            if (shouldGenerateTitle) {
                this.#generateAndUpdateTitle(conversation, userText).catch(err => {
                    console.warn('[ChatActions] タイトル自動生成エラー:', err.message);
                });
                titleUpdated = true;
            }

            window.AppState.clearAbortController();
            return { titleUpdated };

        } catch (error) {
            console.error('[ChatActions] Codex 実行エラー:', error);
            card.showError(cardEl, error.message);
            card.finalize(cardEl, { success: false, error: error.message });
            window.AppState.clearAbortController();
            return { error: error.message };
        }
    }

}

// チャットアクションの初期化
document.addEventListener('DOMContentLoaded', () => {
    ChatActions.getInstance;
});
