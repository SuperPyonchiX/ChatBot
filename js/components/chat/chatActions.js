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
     * @private
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
     * @private
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
     * @private
     */
    #setupEventListeners() {
        if (this.#webSearchToggle) {
            this.#webSearchToggle.addEventListener('click', () => {
                const webContentExtractor = WebContentExtractor.getInstance;
                const currentState = webContentExtractor.isWebSearchEnabled();
                webContentExtractor.toggleWebSearch(!currentState);
                this.#updateToggleButtonState();
            });
        }
    }

    /**
     * トグルボタンの状態を更新します
     * @private
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
        const newConversation = {
            id: Date.now().toString(),
            title: '新しいチャット',
            messages: [
                {
                    role: 'system',
                    content: window.AppState.systemPrompt || ''
                }
            ],
            model: window.AppState.getCurrentModel()
        };
        
        window.AppState.conversations.unshift(newConversation);
        Storage.getInstance.saveConversations(window.AppState.conversations);
        
        window.AppState.currentConversationId = newConversation.id;
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
                    Storage.getInstance.removeAttachments(conversation.id);
                }
            });
            
            window.AppState.conversations = [];
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

            // WEB検索が有効で、GPTが必要と判断した場合に検索を実行
            let messageWithSearchResults = userText;
            let searchPerformed = false;

            const webExtractor = WebContentExtractor.getInstance;
            if (webExtractor && webExtractor.hasTavilyApiKey() && webExtractor.isWebSearchEnabled()) {
                try {
                    const model = window.AppState.getCurrentModel() || window.CONFIG.WEB_SEARCH.AUTO_SEARCH_MODEL;
                    
                    // 現在の会話からチャット履歴を取得
                    const chatHistory = conversation.messages || [];
                    
                    // チャット履歴を含めて検索判断を行う
                    const searchResult = await webExtractor.autoSearchWeb(userText, model, chatMessages, chatHistory);
                    
                    if (searchResult.searchPerformed && searchResult.hasResults) {
                        // 検索結果がある場合、メッセージを更新
                        messageWithSearchResults = searchResult.messageWithSearchResults;
                        searchPerformed = true;
                    }
                } catch (searchError) {
                    console.error('自動検索中にエラーが発生しました:', searchError);
                }
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
            const messagesWithSystem = [
                { role: 'system', content: effectiveSystemPrompt },
                ...conversation.messages.filter(m => m.role !== 'system')
            ];

            const botTimestamp = Date.now();
            // ストリーミング用のボットメッセージを表示
            const { messageDiv, contentContainer } = ChatRenderer.getInstance.addStreamingBotMessage(chatMessages, botTimestamp);

            let fullResponseText = '';
            let isFirstChunk = true;

            // ストリーミングAPI呼び出し
            await AIAPI.getInstance.callOpenAIAPI(
                messagesWithSystem,
                conversation.model,
                displayAttachments,
                {
                    stream: true,
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
                    }
                }
            );

            // 応答をメッセージ履歴に追加
            conversation.messages.push({
                role: 'assistant',
                content: fullResponseText,
                timestamp: botTimestamp
            });

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
     * @private
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
     * @private
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
     * 会話を切り替えます
     * 指定されたIDの会話に切り替え、UIを更新し、関連する添付ファイルを表示します
     * @private
     * @param {string} conversationId - 切り替え先の会話ID
     * @returns {void}
     */
    #switchConversation(conversationId) {
        if (!conversationId) return;
        
        window.AppState.currentConversationId = conversationId;
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
     * @private
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
        Storage.getInstance.saveConversations(window.AppState.conversations);
        
        // 添付ファイルも削除
        Storage.getInstance.removeAttachments(conversationId);
        
        // 削除したチャットが現在表示中だった場合、別のチャットに切り替える
        if (isCurrentChat) {
            if (window.AppState.conversations.length > 0) {
                // 最初のチャットに切り替え
                window.AppState.currentConversationId = window.AppState.conversations[0].id;
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
