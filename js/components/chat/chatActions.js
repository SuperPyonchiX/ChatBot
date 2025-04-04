/**
 * chatActions.js
 * チャット関連のアクション（メッセージ送信、会話管理など）を担当するモジュール
 */

window.ChatActions = {
    /**
     * メッセージを送信します
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
            const apiAttachments = await window.FileHandler.getAttachmentsForAPI();
            
            // 添付ファイルの参照を保持
            const attachmentsToSend = apiAttachments.length > 0 ? apiAttachments : window.AppState.currentAttachments;
            
            // 送信前に添付ファイルをクリア
            window.AppState.currentAttachments = [];
            window.FileHandler.clearSelectedFiles();
            
            // 添付ファイルのプレビュー表示をクリア
            const filePreviewArea = document.querySelector('.file-preview');
            if (filePreviewArea) {
                filePreviewArea.remove();
            }
            
            const attachmentPreviewArea = document.querySelector('.attachment-preview-area');
            if (attachmentPreviewArea) {
                window.UI.FileAttachment.clearAttachments(attachmentPreviewArea);
            }
            
            // ストリーミングメソッドを使用してメッセージを送信
            const result = await window.Chat.sendMessage(
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
                window.Storage.saveConversations(window.AppState.conversations);
                
                // 添付ファイルを保存（正常送信時のみ）
                if (attachmentsToSend && attachmentsToSend.length > 0) {
                    // 最新のユーザーメッセージのタイムスタンプを取得
                    const latestUserMessage = currentConversation.messages
                        .filter(m => m.role === 'user')
                        .pop();
                    
                    // FileHandlerのタイムスタンプを優先
                    const timestamp = window.FileHandler.attachmentTimestamp || 
                                    (latestUserMessage ? latestUserMessage.timestamp : Date.now());
                    
                    window.FileHandler.saveAttachmentsForConversation(
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
    },

    /**
     * 新しい会話を作成します
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
        window.Storage.saveConversations(window.AppState.conversations);
        
        window.AppState.currentConversationId = newConversation.id;
        window.Storage.saveCurrentConversationId(window.AppState.currentConversationId);
        
        this.renderChatHistory();
        
        if (window.Elements.chatMessages && window.Elements.modelSelect) {
            window.Chat.displayConversation(newConversation, window.Elements.chatMessages, window.Elements.modelSelect);
        }
    },

    /**
     * 会話履歴を表示します
     */
    renderChatHistory() {
        if (!window.Elements.chatHistory) return;
        
        window.Chat.renderChatHistory(
            window.AppState.conversations, 
            window.AppState.currentConversationId, 
            window.Elements.chatHistory, 
            this.switchConversation.bind(this), 
            window.UI.Modal.RenameChat.showRenameChatModal, 
            this.deleteConversation.bind(this)
        );
    },

    /**
     * 会話を切り替えます
     */
    switchConversation(conversationId) {
        if (!conversationId) return;
        
        window.AppState.currentConversationId = conversationId;
        window.Storage.saveCurrentConversationId(window.AppState.currentConversationId);
        
        window.Chat.updateActiveChatInHistory(window.AppState.currentConversationId);
        
        if (window.Elements.chatMessages && window.Elements.modelSelect) {
            window.Chat.displayConversation(
                window.AppState.getConversationById(window.AppState.currentConversationId),
                window.Elements.chatMessages,
                window.Elements.modelSelect
            );
            
            // 添付ファイルを表示
            window.FileHandler.displaySavedAttachments(window.AppState.currentConversationId, window.Elements.chatMessages);
        }
    },

    /**
     * 会話を削除します
     */
    deleteConversation(conversationId) {
        // 確認ダイアログを表示
        if (!confirm('このチャットを削除してもよろしいですか？')) return;
            
        // 削除するチャットが現在表示中のチャットかどうか確認
        const isCurrentChat = conversationId === window.AppState.currentConversationId;
        
        // チャットを削除
        window.AppState.conversations = window.AppState.conversations.filter(conv => conv.id !== conversationId);
        window.Storage.saveConversations(window.AppState.conversations);
        
        // 添付ファイルも削除
        window.Storage.removeAttachments(conversationId);
        
        // 削除したチャットが現在表示中だった場合、別のチャットに切り替える
        if (isCurrentChat) {
            if (window.AppState.conversations.length > 0) {
                // 最初のチャットに切り替え
                window.AppState.currentConversationId = window.AppState.conversations[0].id;
                window.Storage.saveCurrentConversationId(window.AppState.currentConversationId);
                
                if (window.Elements.chatMessages && window.Elements.modelSelect) {
                    window.Chat.displayConversation(
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
    },

    /**
     * すべての履歴をクリアします
     */
    clearAllHistory() {
        if (confirm('すべての会話履歴を削除してもよろしいですか？')) {
            // すべての添付ファイルを削除
            window.AppState.conversations.forEach(conversation => {
                if (conversation.id) {
                    window.Storage.removeAttachments(conversation.id);
                }
            });
            
            window.AppState.conversations = [];
            window.Storage.saveConversations(window.AppState.conversations);
            this.createNewConversation();
        }
    }
};