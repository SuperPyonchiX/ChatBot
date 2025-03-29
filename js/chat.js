/**
 * chat.js
 * チャット機能を提供します
 */

// グローバルスコープに関数を公開
window.Chat = {
    /**
     * ユーザーメッセージを追加する
     * @param {string} message - 表示するメッセージ
     * @param {HTMLElement} chatMessages - メッセージを追加する対象要素
     * @param {Array} attachments - 添付ファイルの配列（任意）
     */
    addUserMessage: function(message, chatMessages, attachments = []) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        // コピーボタンを追加
        const copyButton = this._createCopyButton(message);
        
        const markdownContent = document.createElement('div');
        markdownContent.classList.add('markdown-content');
        markdownContent.innerHTML = window.Markdown.renderMarkdown(message);
        
        contentDiv.appendChild(copyButton);
        contentDiv.appendChild(markdownContent);
        
        // 添付ファイルがあれば表示
        if (attachments && attachments.length > 0) {
            contentDiv.appendChild(this._createAttachmentsElement(attachments));
        }
        
        messageDiv.appendChild(contentDiv);
        
        // コードブロックの処理とメッセージの表示
        this._processMessageAndAppend(messageDiv, chatMessages);
    },

    /**
     * ボットメッセージを追加する
     * @param {string} message - 表示するメッセージ
     * @param {HTMLElement} chatMessages - メッセージを追加する対象要素
     */
    addBotMessage: function(message, chatMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        // コピーボタンを追加
        const copyButton = this._createCopyButton(message);
        
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
        
        // コードブロックの処理とメッセージの表示
        this._processMessageAndAppend(messageDiv, chatMessages);
    },

    /**
     * コピーボタンを作成する
     * @private
     * @param {string} textToCopy - コピーするテキスト
     * @returns {HTMLElement} 作成されたコピーボタン
     */
    _createCopyButton: function(textToCopy) {
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.title = 'コピーする';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        
        // コピーボタンのクリックイベント
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    this._showCopySuccess(copyButton);
                })
                .catch(err => {
                    console.error('クリップボードへのコピーに失敗しました:', err);
                });
        });
        
        return copyButton;
    },
    
    /**
     * コピー成功時の表示を更新
     * @private
     * @param {HTMLElement} button - 更新するボタン
     */
    _showCopySuccess: function(button) {
        button.classList.add('copied');
        button.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = '<i class="fas fa-copy"></i>';
        }, 1500);
    },
    
    /**
     * 添付ファイル表示要素を作成
     * @private
     * @param {Array} attachments - 添付ファイルの配列
     * @returns {HTMLElement} 添付ファイル表示要素
     */
    _createAttachmentsElement: function(attachments) {
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
            } else if (attachment.type === 'file') {
                // 画像以外のファイル添付表示
                const fileContainer = document.createElement('div');
                fileContainer.classList.add('attachment-file-container');
                
                const fileIcon = document.createElement('i');
                fileIcon.className = 'fas fa-file';
                
                const fileName = document.createElement('span');
                fileName.textContent = attachment.name || '添付ファイル';
                fileName.classList.add('attachment-file-name');
                
                fileContainer.appendChild(fileIcon);
                fileContainer.appendChild(fileName);
                attachmentsDiv.appendChild(fileContainer);
            }
        });
        
        return attachmentsDiv;
    },
    
    /**
     * メッセージを処理して表示する
     * @private
     * @param {HTMLElement} messageDiv - メッセージ要素
     * @param {HTMLElement} chatMessages - メッセージを追加する対象要素
     */
    _processMessageAndAppend: function(messageDiv, chatMessages) {
        // コードブロックにコピーボタンを追加とシンタックスハイライトの適用
        setTimeout(() => {
            window.Markdown.addCodeBlockCopyButtons(messageDiv);
            Prism.highlightAllUnder(messageDiv);
        }, 10);
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },

    /**
     * 会話を表示
     * @param {Object} conversation - 表示する会話オブジェクト
     * @param {HTMLElement} chatMessages - メッセージを表示する要素
     * @param {HTMLSelectElement} modelSelect - モデル選択要素
     */
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

    /**
     * メッセージを送信する
     * @param {HTMLElement} userInput - ユーザー入力要素
     * @param {HTMLElement} chatMessages - メッセージ表示要素
     * @param {Object} currentConversation - 現在の会話オブジェクト
     * @param {Object} apiSettings - API設定
     * @param {string} systemPrompt - システムプロンプト
     * @param {Array} attachments - 添付ファイル配列
     * @returns {Promise<Object>} 処理結果
     */
    sendMessage: async function(userInput, chatMessages, currentConversation, apiSettings, systemPrompt, attachments = []) {
        const message = userInput.value.trim();
        let titleUpdated = false;
        
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
                titleUpdated = true;
            }
            
            // 「Thinking...」の表示
            const typingIndicator = this._createTypingIndicator();
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
                
                return { titleUpdated, response: botResponse };
            } catch (error) {
                // Thinkingの表示を削除
                chatMessages.removeChild(typingIndicator);
                
                // エラーメッセージを表示
                this._showErrorMessage(error.message, chatMessages);
                
                // エラーを返す
                return { titleUpdated, error: error.message };
            }
        }
        
        return { titleUpdated, response: null };
    },

    /**
     * 「Thinking...」インジケーターを作成
     * @private
     * @returns {HTMLElement} 作成されたインジケーター要素
     */
    _createTypingIndicator: function() {
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'bot', 'typing-indicator');
        typingIndicator.innerHTML = `
            <div class="message-content">
                <p>Thinking<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
            </div>
        `;
        return typingIndicator;
    },
    
    /**
     * エラーメッセージを表示
     * @private
     * @param {string} errorMessage - エラーメッセージ
     * @param {HTMLElement} chatMessages - メッセージ表示要素
     */
    _showErrorMessage: function(errorMessage, chatMessages) {
        const errorMessageDiv = document.createElement('div');
        errorMessageDiv.classList.add('message', 'bot', 'error');
        errorMessageDiv.innerHTML = `
            <div class="message-content">
                <p>エラーが発生しました: ${errorMessage}</p>
                <button id="showApiSettings" class="error-action">API設定を確認する</button>
            </div>
        `;
        chatMessages.appendChild(errorMessageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // API設定ボタンのイベントリスナーを追加
        const settingsButton = errorMessageDiv.querySelector('#showApiSettings');
        if (settingsButton) {
            settingsButton.addEventListener('click', () => {
                window.UI.showSettingsModal();
            });
        }
    },

    /**
     * 会話履歴を表示する
     * @param {Array} conversations - 会話オブジェクトの配列
     * @param {string} currentConversationId - 現在の会話ID
     * @param {HTMLElement} chatHistory - 履歴表示要素
     * @param {Function} onSwitchConversation - 会話切り替え時のコールバック
     * @param {Function} onShowRenameModal - 名前変更時のコールバック
     * @param {Function} onDeleteConversation - 会話削除時のコールバック
     */
    renderChatHistory: function(conversations, currentConversationId, chatHistory, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
        chatHistory.innerHTML = '';
        
        // プロンプトごとにグループ化するための処理
        const promptGroups = this.groupConversationsByPrompt(conversations);
        
        // 各プロンプトグループごとにセクションを作成
        Object.entries(promptGroups).forEach(([promptKey, groupConversations]) => {
            // カテゴリーの状態を取得（展開/折りたたみ）
            const categoryStates = window.Storage.loadCategoryStates();
            const isExpanded = categoryStates[promptKey] !== false; // デフォルトは展開状態
            
            // カテゴリーセクションを作成
            const categorySection = this._createCategorySection(
                promptKey, 
                groupConversations,
                isExpanded,
                onSwitchConversation,
                onShowRenameModal,
                onDeleteConversation
            );
            
            // チャット履歴に追加
            chatHistory.appendChild(categorySection);
        });
        
        this.updateActiveChatInHistory(currentConversationId);
    },

    /**
     * カテゴリーセクションを作成する
     * @private
     * @param {string} promptKey - プロンプトカテゴリーキー
     * @param {Array} groupConversations - カテゴリーに属する会話の配列
     * @param {boolean} isExpanded - 展開状態か
     * @param {Function} onSwitchConversation - 会話切り替え時のコールバック
     * @param {Function} onShowRenameModal - 名前変更時のコールバック
     * @param {Function} onDeleteConversation - 会話削除時のコールバック
     * @returns {HTMLElement} 作成されたカテゴリーセクション
     */
    _createCategorySection: function(promptKey, groupConversations, isExpanded, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
        const categorySection = document.createElement('div');
        categorySection.classList.add('chat-category');
        
        // カテゴリーヘッダーを作成
        const categoryHeader = document.createElement('div');
        categoryHeader.classList.add('category-header');
        
        // 展開/折りたたみアイコン
        const toggleIcon = document.createElement('i');
        toggleIcon.classList.add('fas', isExpanded ? 'fa-chevron-down' : 'fa-chevron-right');
        
        // カテゴリー名
        const categoryName = document.createElement('span');
        categoryName.textContent = this.getPromptNiceName(promptKey);
        
        // 会話数バッジ
        const countBadge = document.createElement('span');
        countBadge.classList.add('category-count');
        countBadge.textContent = groupConversations.length;
        
        // ヘッダーに要素を追加
        categoryHeader.appendChild(toggleIcon);
        categoryHeader.appendChild(categoryName);
        categoryHeader.appendChild(countBadge);
        
        // 会話リストコンテナを作成
        const conversationList = document.createElement('div');
        conversationList.classList.add('category-conversations');
        if (!isExpanded) {
            conversationList.style.display = 'none';
        }
        
        // ヘッダークリックで展開/折りたたみ
        categoryHeader.addEventListener('click', () => {
            this._toggleCategoryExpansion(toggleIcon, conversationList, promptKey);
        });
        
        // カテゴリー内の会話を表示
        groupConversations.forEach(conversation => {
            const historyItem = this._createHistoryItem(
                conversation, 
                onSwitchConversation, 
                onShowRenameModal, 
                onDeleteConversation
            );
            conversationList.appendChild(historyItem);
        });
        
        // カテゴリーセクションに追加
        categorySection.appendChild(categoryHeader);
        categorySection.appendChild(conversationList);
        
        return categorySection;
    },
    
    /**
     * カテゴリー展開/折りたたみを切り替え
     * @private
     * @param {HTMLElement} toggleIcon - トグルアイコン要素
     * @param {HTMLElement} conversationList - 会話リスト要素
     * @param {string} promptKey - プロンプトカテゴリーキー
     */
    _toggleCategoryExpansion: function(toggleIcon, conversationList, promptKey) {
        const isNowExpanded = toggleIcon.classList.contains('fa-chevron-down');
        if (isNowExpanded) {
            toggleIcon.classList.replace('fa-chevron-down', 'fa-chevron-right');
            conversationList.style.display = 'none';
        } else {
            toggleIcon.classList.replace('fa-chevron-right', 'fa-chevron-down');
            conversationList.style.display = 'block';
        }
        // 状態を保存
        window.Storage.saveCategoryState(promptKey, !isNowExpanded);
    },
    
    /**
     * 履歴アイテムを作成
     * @private
     * @param {Object} conversation - 会話オブジェクト
     * @param {Function} onSwitchConversation - 会話切り替え時のコールバック
     * @param {Function} onShowRenameModal - 名前変更時のコールバック
     * @param {Function} onDeleteConversation - 会話削除時のコールバック
     * @returns {HTMLElement} 作成された履歴アイテム
     */
    _createHistoryItem: function(conversation, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
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
        
        return historyItem;
    },

    /**
     * 会話をシステムプロンプトでグループ化する
     * @param {Array} conversations - 会話オブジェクトの配列
     * @returns {Object} プロンプトカテゴリごとにグループ化された会話
     */
    groupConversationsByPrompt: function(conversations) {
        const groups = {};
        
        conversations.forEach(conversation => {
            // システムプロンプトを取得
            let systemPrompt = '未分類';
            
            // システムメッセージからプロンプトを取得
            const systemMessage = conversation.messages.find(m => m.role === 'system');
            if (systemMessage && systemMessage.content) {
                systemPrompt = this.getPromptCategory(systemMessage.content);
            }
            
            // グループが存在しない場合は作成
            if (!groups[systemPrompt]) {
                groups[systemPrompt] = [];
            }
            
            // 会話をグループに追加
            groups[systemPrompt].push(conversation);
        });
        
        return groups;
    },
    
    /**
     * システムプロンプトからカテゴリを判定
     * @param {string} promptText - システムプロンプトテキスト
     * @returns {string} カテゴリーキー
     */
    getPromptCategory: function(promptText) {
        // プロンプトテンプレートを取得
        const templates = window.Storage.loadPromptTemplates();
        
        // テンプレートと照合
        for (const templateName in templates) {
            if (templates[templateName] === promptText) {
                return templateName;
            }
        }
        
        // 特定のキーワードで判定
        if (promptText.includes('開発者') || promptText.includes('エンジニア')) {
            return 'developer';
        } else if (promptText.includes('クリエイティブ') || promptText.includes('創造的')) {
            return 'creative';
        } else if (promptText.includes('技術的') || promptText.includes('technical')) {
            return 'technical';
        }
        
        // デフォルトは未分類
        return '未分類';
    },
    
    /**
     * プロンプトカテゴリの表示名を取得
     * @param {string} categoryKey - カテゴリーキー
     * @returns {string} 表示用カテゴリー名
     */
    getPromptNiceName: function(categoryKey) {
        const displayNames = {
            'default': 'デフォルト',
            'creative': 'クリエイティブ',
            'technical': '技術的',
            'developer': '開発者',
            '未分類': '未分類'
        };
        
        return displayNames[categoryKey] || categoryKey;
    },

    /**
     * アクティブなチャットを更新
     * @param {string} currentConversationId - 現在の会話ID
     */
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