/**
 * chatActions.js
 * チャット関連のアクション（メッセージ送信、会話管理など）を担当するモジュール
 */
class ChatActions {
    // シングルトンインスタンス
    static #instance = null;

    // DOM要素
    #webSearchToggle;
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

            // ユーザー入力をクリア
            userInput.value = '';
            UIUtils.getInstance.autoResizeTextarea(userInput);

            let titleUpdated = false;
            const timestamp = Date.now();

            // 添付ファイルの処理
            let attachmentContent = '';
            let displayAttachments = attachments || [];

            // ユーザーメッセージを表示
            await ChatRenderer.getInstance.addUserMessage(userText, chatMessages, displayAttachments, timestamp);

            // WEB検索の実行判断
            let searchPerformed = false;
            let messageWithSearchResults = userText;
            const currentModel = window.AppState.getCurrentModel();
            const webExtractor = WebContentExtractor.getInstance;
            const isWebSearchEnabled = webExtractor && webExtractor.isWebSearchEnabled();

            // GPT-5シリーズはResponses API内蔵Web検索を使用
            if (isWebSearchEnabled && window.CONFIG.MODELS.OPENAI_WEB_SEARCH_COMPATIBLE.includes(currentModel)) {
                // Responses APIの内蔵Web検索を使用（APIレベルで自動処理）
                console.log(`Responses API Web検索機能を有効にします: ${currentModel}`);
            } else if (isWebSearchEnabled && window.CONFIG.MODELS.CLAUDE.includes(currentModel)) {
                // Claude Web検索機能を有効にする
                console.log(`Claude Web検索機能を有効にします: ${currentModel}`);
            } else if (isWebSearchEnabled) {
                // その他のモデルではWeb検索は利用できません
                console.log(`${currentModel}はWeb検索に対応していません。GPT-5シリーズまたはClaude 4系・3.5シリーズを使用してください。`);
            }

            if (attachments && attachments.length > 0) {
                displayAttachments = attachments.map(att => ({
                    ...att,
                    timestamp: timestamp
                }));

                attachmentContent = await this.#processAttachments(attachments);
            }

            // 添付ファイルの内容を含めた最終的なメッセージを作成
            const finalMessage = (attachmentContent ? `${messageWithSearchResults}\n\n${attachmentContent}` : messageWithSearchResults);

            const userMessage = {
                role: 'user',
                content: finalMessage,
                timestamp: timestamp
            };

            conversation.messages.push(userMessage);

            // チャットタイトルの更新
            if (conversation.title === '新しいチャット' && 
                conversation.messages.filter(m => m.role === 'user').length === 1) {
                conversation.title = userText.substring(0, 30) + (userText.length > 30 ? '...' : '');
                titleUpdated = true;
            }

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
            let isFirstChunk = true;

            // 思考過程データを収集（ページ更新時の復元用）
            let thinkingData = {
                webSearchQueries: [],
                ragSources: ragSources.length > 0 ? ragSources : []
            };

            // ストリーミングAPI呼び出し
            await AIAPI.getInstance.callAIAPI(
                messagesWithSystem,
                conversation.model,
                displayAttachments,
                {
                    stream: true,
                    enableWebSearch: isWebSearchEnabled && (window.CONFIG.MODELS.OPENAI_WEB_SEARCH_COMPATIBLE.includes(currentModel) || window.CONFIG.MODELS.CLAUDE.includes(currentModel)),
                    thinkingContainer: thinkingContainer, // Web検索用に渡す
                    onWebSearchQuery: (query) => {
                        // Web検索クエリを収集（復元用）
                        if (query && !thinkingData.webSearchQueries.includes(query)) {
                            thinkingData.webSearchQueries.push(query);
                        }
                    },
                    onChunk: (chunk) => {
                        fullResponseText += chunk;
                        // ストリーミング中のメッセージ更新
                        ChatRenderer.getInstance.updateStreamingBotMessage(contentContainer, chunk, fullResponseText, isFirstChunk);
                        isFirstChunk = false;
                    },
                    onComplete: (fullText) => {
                        // ストリーミング完了時の処理
                        ChatRenderer.getInstance.finalizeStreamingBotMessage(messageDiv, contentContainer, fullText);
                        fullResponseText = fullText;
                    },
                    onToolCall: async (event) => {
                        // ツール呼び出しハンドリング
                        await this.#handleToolCall(event, thinkingContainer, contentContainer);
                    }
                }
            );

            // 思考過程データがあるかどうかを判定
            const hasThinkingData = thinkingData.webSearchQueries.length > 0 || thinkingData.ragSources.length > 0;

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

            return { titleUpdated, response: fullResponseText };

        } catch (error) {
            // エラーメッセージを表示
            const errorMessage = error.message || 'APIリクエスト中にエラーが発生しました';
            this.#showErrorMessage(errorMessage, chatMessages);

            return { titleUpdated: false, error: error.message || '内部エラーが発生しました' };
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
            <div class="message-content">
                <p>エラーが発生しました: ${errorMessage || '不明なエラー'}</p>
                <button id="showApiSettings" class="error-action">API設定を確認する</button>
            </div>
        `;
        chatMessages.appendChild(errorMessageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * 添付ファイルの内容を処理する
     * @param {Array} attachments - 添付ファイルの配列
     * @returns {Promise<string>} 処理された添付ファイルの内容
     */
    async #processAttachments(attachments) {
        if (!attachments || !Array.isArray(attachments)) {
            return '';
        }

        let content = '';
        for (const attachment of attachments) {
            if (!attachment || !attachment.type) continue;

            if ((attachment.type === 'pdf' || 
                 attachment.type === 'office' || 
                 attachment.type === 'file') && 
                attachment.content) {
                content += `\n${attachment.content}\n`;
            }
        }
        return content;
    }

    /**
     * ツール呼び出しイベントを処理
     * @param {Object} event - ツールイベント（type: 'start' | 'delta' | 'complete' | 'error'）
     * @param {HTMLElement} thinkingContainer - 思考過程表示コンテナ
     * @param {HTMLElement} contentContainer - コンテンツ表示コンテナ
     */
    async #handleToolCall(event, thinkingContainer, contentContainer) {
        if (!event) return;

        const { type, toolCall } = event;

        // delta イベントは進捗のみ（特別な処理は不要）
        if (type === 'delta') {
            return;
        }

        // start イベント: 思考過程にツール呼び出しを表示
        if (type === 'start' && toolCall && thinkingContainer) {
            const toolName = this.#getToolDisplayName(toolCall.name);
            if (typeof ChatRenderer !== 'undefined') {
                ChatRenderer.getInstance.addThinkingItem(thinkingContainer, 'tool', `${toolName}を実行中...`);
            }
            console.log(`🔧 ツール開始: ${toolCall.name}`);
        }

        // ツール実行（complete時）
        if (type === 'complete' && toolCall && typeof ToolManager !== 'undefined') {
            try {
                console.log(`🔧 ツール実行: ${toolCall.name}`);
                const result = await ToolManager.getInstance.handleToolCall(toolCall, toolCall.provider);

                // 結果をUIに表示
                if (result && contentContainer) {
                    console.log(`🔧 ツール実行完了: ${result.type}`, result.filename || '');
                    this.#displayToolResult(result, contentContainer);
                } else {
                    console.warn(`🔧 結果またはコンテナがありません`);
                }

                // 思考過程を更新（完了表示）
                if (thinkingContainer && typeof ChatRenderer !== 'undefined') {
                    const toolName = this.#getToolDisplayName(toolCall.name);
                    ChatRenderer.getInstance.addThinkingItem(thinkingContainer, 'tool-complete', `${toolName}完了`);
                }
            } catch (error) {
                console.error('ツール実行エラー:', error);
                // エラーを思考過程に表示
                if (thinkingContainer && typeof ChatRenderer !== 'undefined') {
                    const toolName = this.#getToolDisplayName(toolCall.name);
                    ChatRenderer.getInstance.addThinkingItem(thinkingContainer, 'tool-error', `${toolName}エラー: ${error.message}`);
                }
            }
        }
    }

    /**
     * ツール名の表示名を取得
     * @param {string} name - ツール名
     * @returns {string} 表示名
     */
    #getToolDisplayName(name) {
        const toolNames = {
            'generate_powerpoint': 'PowerPointスライド生成',
            'process_excel': 'Excel処理',
            'render_canvas': 'Canvas描画'
        };
        return toolNames[name] || name;
    }

    /**
     * ツール実行結果をUIに表示
     * @param {Object} result - ツール実行結果
     * @param {HTMLElement} contentContainer - 表示先コンテナ
     */
    #displayToolResult(result, contentContainer) {
        if (!result || !contentContainer) return;

        // ファイル生成結果
        if (result.type === 'file' && typeof FileDownloader !== 'undefined') {
            const downloadCard = FileDownloader.getInstance.createDownloadCard(result);
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
}

// チャットアクションの初期化
document.addEventListener('DOMContentLoaded', () => {
    ChatActions.getInstance;
});