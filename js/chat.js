/**
 * chat.js
 * チャット機能を提供します
 */

// グローバルスコープに関数を公開
window.Chat = {
    // ユーザーメッセージを追加する関数
    addUserMessage: function(message, chatMessages, attachments = []) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        // コピーボタンを追加
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.title = 'コピーする';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        
        // コピーボタンのクリックイベント
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(message)
                .then(() => {
                    copyButton.classList.add('copied');
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyButton.classList.remove('copied');
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 1500);
                })
                .catch(err => console.error('クリップボードへのコピーに失敗しました:', err));
        });
        
        const markdownContent = document.createElement('div');
        markdownContent.classList.add('markdown-content');
        markdownContent.innerHTML = window.Markdown.renderMarkdown(message);
        
        contentDiv.appendChild(copyButton);
        contentDiv.appendChild(markdownContent);
        
        // 添付画像があれば表示
        if (attachments && attachments.length > 0) {
            const attachmentsDiv = document.createElement('div');
            attachmentsDiv.classList.add('message-attachments');
            
            attachments.forEach(attachment => {
                if (attachment.type === 'image') {
                    const imgContainer = document.createElement('div');
                    imgContainer.classList.add('attachment-image-container');
                    
                    const img = document.createElement('img');
                    img.src = attachment.data;
                    img.alt = attachment.name || '添付画像';
                    img.classList.add('attachment-image');
                    
                    imgContainer.appendChild(img);
                    attachmentsDiv.appendChild(imgContainer);
                }
            });
            
            contentDiv.appendChild(attachmentsDiv);
        }
        
        messageDiv.appendChild(contentDiv);
        
        // コードブロックにコピーボタンを追加とシンタックスハイライトの適用
        setTimeout(() => {
            window.Markdown.addCodeBlockCopyButtons(messageDiv);
            Prism.highlightAllUnder(messageDiv);
        }, 10);
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },

    // ボットメッセージを追加する関数
    addBotMessage: function(message, chatMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        // コピーボタンを追加
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.title = 'コピーする';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        
        // コピーボタンのクリックイベント
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(message)
                .then(() => {
                    copyButton.classList.add('copied');
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyButton.classList.remove('copied');
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 1500);
                })
                .catch(err => {
                    console.error('クリップボードへのコピーに失敗しました: ', err);
                });
        });
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('markdown-content');
        
        try {
            messageContent.innerHTML = window.Markdown.renderMarkdown(message);
        } catch (e) {
            console.error('Markdown parsing error:', e);
            messageContent.innerHTML = window.Markdown.formatMessage(message);
        }
        
        contentDiv.appendChild(copyButton);
        contentDiv.appendChild(messageContent);
        messageDiv.appendChild(contentDiv);
        
        // コードブロックにコピーボタンを追加とシンタックスハイライトの適用
        setTimeout(() => {
            window.Markdown.addCodeBlockCopyButtons(messageDiv);
            Prism.highlightAllUnder(messageDiv);
        }, 10);
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },

    // 会話を表示
    displayConversation: function(conversation, chatMessages, modelSelect) {
        if (!conversation) return;
        
        chatMessages.innerHTML = '';
        
        // システムメッセージ以外を表示
        conversation.messages.forEach(message => {
            if (message.role === 'system') return;
            
            if (message.role === 'user') {
                this.addUserMessage(message.content, chatMessages);
            } else if (message.role === 'assistant') {
                this.addBotMessage(message.content, chatMessages);
            }
        });
        
        // モデルを設定
        modelSelect.value = conversation.model || 'gpt-4o-mini';
        // シンタックスハイライトを再適用
        Prism.highlightAll();
    },

    // メッセージを送信する関数
    sendMessage: async function(userInput, chatMessages, currentConversation, apiSettings, systemPrompt, attachments = []) {
        const message = userInput.value.trim();
        
        if (message || attachments.length > 0) {
            // ユーザーメッセージを表示（添付ファイル付き）
            this.addUserMessage(message, chatMessages, attachments);
            userInput.value = '';
            userInput.style.height = 'auto';
            
            // 現在の会話にユーザーメッセージを追加
            currentConversation.messages.push({
                role: 'user',
                content: message  // 純粋なテキストメッセージ
            });
            
            // チャットタイトルがデフォルトの場合、最初のメッセージをタイトルに設定
            if (currentConversation.title === '新しいチャット' && currentConversation.messages.filter(m => m.role === 'user').length === 1) {
                currentConversation.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
            }
            
            // 「Thinking...」の表示
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('message', 'bot', 'typing-indicator');
            typingIndicator.innerHTML = `
                <div class="message-content">
                    <p>Thinking<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
                </div>
            `;
            chatMessages.appendChild(typingIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            try {
                // APIに送信するメッセージにシステムプロンプトを追加
                const messagesWithSystem = [
                    { role: 'system', content: systemPrompt },
                    ...currentConversation.messages.filter(m => m.role !== 'system')
                ];
                
                // API呼び出し
                const botResponse = await window.API.callOpenAIAPI(
                    messagesWithSystem, 
                    currentConversation.model,
                    attachments
                );
                
                // Thinkingの表示を削除
                chatMessages.removeChild(typingIndicator);
                
                // ボットの応答を表示
                this.addBotMessage(botResponse, chatMessages);
                
                // 応答をメッセージ履歴に追加
                currentConversation.messages.push({
                    role: 'assistant',
                    content: botResponse
                });
                
                return { titleUpdated: false, response: botResponse };
            } catch (error) {
                // Thinkingの表示を削除
                chatMessages.removeChild(typingIndicator);
                
                // エラーメッセージを表示
                const errorMessageDiv = document.createElement('div');
                errorMessageDiv.classList.add('message', 'bot', 'error');
                errorMessageDiv.innerHTML = `
                    <div class="message-content">
                        <p>エラーが発生しました: ${error.message}</p>
                        <button id="showApiSettings" class="error-action">API設定を確認する</button>
                    </div>
                `;
                chatMessages.appendChild(errorMessageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                // エラーを返す
                return { titleUpdated: false, error: error.message };
            }
        }
        
        return { titleUpdated: false, response: null };
    },

    // 会話履歴を表示する
    renderChatHistory: function(conversations, currentConversationId, chatHistory, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
        chatHistory.innerHTML = '';
        
        conversations.forEach(conversation => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            historyItem.dataset.id = conversation.id;
            
            // コンテンツとアクションボタンを含むコンテナを作成
            const itemContent = document.createElement('div');
            itemContent.classList.add('history-item-content');
            itemContent.innerHTML = `
                <i class="fas fa-comments"></i>
                <span class="history-item-title">${conversation.title || '新しいチャット'}</span>
            `;
            
            // アクションボタンのコンテナ
            const actionButtons = document.createElement('div');
            actionButtons.classList.add('history-item-actions');
            
            // 編集ボタン
            const editButton = document.createElement('button');
            editButton.classList.add('history-action-button', 'edit-button');
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'チャットの名前を変更';
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();  // クリックイベントの伝播を止める
                onShowRenameModal(conversation);
            });
            
            // 削除ボタン
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('history-action-button', 'delete-button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'チャットを削除';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();  // クリックイベントの伝播を止める
                onDeleteConversation(conversation.id);
            });
            
            // ボタンをアクションコンテナに追加
            actionButtons.appendChild(editButton);
            actionButtons.appendChild(deleteButton);
            
            // 内容とアクションボタンをアイテムに追加
            historyItem.appendChild(itemContent);
            historyItem.appendChild(actionButtons);
            
            // チャットアイテムのクリックイベント（チャット切り替え）
            itemContent.addEventListener('click', () => {
                onSwitchConversation(conversation.id);
            });
            
            chatHistory.appendChild(historyItem);
        });
        
        this.updateActiveChatInHistory(currentConversationId);
    },

    // アクティブなチャットを更新
    updateActiveChatInHistory: function(currentConversationId) {
        const historyItems = document.querySelectorAll('.history-item');
        historyItems.forEach(item => {
            if (item.dataset.id === currentConversationId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
};