window.Chat = window.Chat || {};
window.Chat.History = window.Chat.History || {};
/**
 * chatHistory.js
 * 会話履歴の管理機能を提供します
 */

Object.assign(window.Chat.History, (function() {
    return {
        /**
         * 会話を表示する
         */
        displayConversation: async function(conversation, chatMessages, modelSelect) {
            if (!conversation || !chatMessages) return;
            
            chatMessages.innerHTML = '';
            
            for (const message of conversation.messages) {
                if (!message || !message.role) continue;
                
                if (message.role === 'system') continue;
                
                if (message.role === 'user') {
                    let content = typeof message.content === 'string' 
                        ? message.content 
                        : this._processContentArray(message.content);
                    
                    // ファイル内容を除去
                    const displayContent = this._cleanFileContent(content);
                    await window.Chat.Renderer.addUserMessage(displayContent, chatMessages, [], message.timestamp);
                } else if (message.role === 'assistant') {
                    const content = typeof message.content === 'string' 
                        ? message.content 
                        : this._processContentArray(message.content);
                    await window.Chat.Renderer.addBotMessage(content, chatMessages, message.timestamp, false);
                }
            }
            
            if (modelSelect) {
                try {
                    const model = conversation.model || 'gpt-4o-mini';
                    const modelExists = Array.from(modelSelect.options).some(option => option.value === model);
                    modelSelect.value = modelExists ? model : modelSelect.options[0].value;
                } catch (error) {
                    console.error('モデル選択の設定中にエラーが発生しました:', error);
                }
            }
            
            // 添付ファイルの表示
            window.UI.Components.FileAttachment.displaySavedAttachments(conversation.id, chatMessages);
            
            if (typeof Prism !== 'undefined') {
                try {
                    Prism.highlightAll();
                } catch (error) {
                    console.error('シンタックスハイライトの適用中にエラーが発生しました:', error);
                }
            }
        },

        /**
         * ファイルの内容をクリーンアップする
         * @private
         */
        _cleanFileContent: function(content) {
            if (!content) return '';
            
            // === ファイル名「...」の内容 === 以降のテキストをすべて削除
            return content.replace(/===\s+.*?ファイル「.*?」の内容\s+===[\s\S]*$/g, '').trim();
        },


        /**
         * 配列型のコンテンツを処理する
         * @private
         */
        _processContentArray: function(content) {
            if (typeof content === 'string') return content;
            if (!Array.isArray(content)) return '';
            
            let result = '';
            
            for (const item of content) {
                if (!item || !item.type) continue;
                
                if (item.type === 'text' && item.text) {
                    result += item.text;
                } else if (item.type === 'image_url' && item.image_url && item.image_url.url) {
                    result += `\n![画像](${item.image_url.url})\n`;
                }
            }
            
            return result;
        },

        /**
         * 会話履歴を表示する
         */
        renderChatHistory: function(conversations, currentConversationId, chatHistory, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
            if (!chatHistory || !Array.isArray(conversations)) return;
            
            chatHistory.innerHTML = '';
            
            if (conversations.length === 0) {
                const emptyState = window.UI.Components.Chat.createElement('div', {
                    classList: 'empty-history',
                    innerHTML: `
                        <p>会話履歴がありません</p>
                        <p>新しいチャットを開始してください</p>
                    `
                });
                chatHistory.appendChild(emptyState);
                return;
            }
            
            const promptGroups = this._groupConversationsByPrompt(conversations);
            
            Object.entries(promptGroups).forEach(([promptKey, groupConversations]) => {
                if (!Array.isArray(groupConversations) || groupConversations.length === 0) return;
                
                const categoryStates = window.Storage.loadCategoryStates();
                const isExpanded = categoryStates[promptKey] !== false;
                
                const categorySection = this._createCategorySection(
                    promptKey, 
                    groupConversations,
                    isExpanded,
                    onSwitchConversation,
                    onShowRenameModal,
                    onDeleteConversation
                );
                
                chatHistory.appendChild(categorySection);
            });
            
            this.updateActiveChatInHistory(currentConversationId);
        },

        /**
         * カテゴリーセクションを作成する
         * @private
         */
        _createCategorySection: function(promptKey, groupConversations, isExpanded, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
            if (!promptKey || !Array.isArray(groupConversations)) {
                return document.createElement('div');
            }
            
            const categorySection = window.UI.Components.Chat.createElement('div', {
                classList: 'chat-category',
                attributes: {
                    'data-category': promptKey
                }
            });
            
            const categoryHeader = window.UI.Components.Chat.createElement('div', { classList: 'category-header' });
            const toggleIcon = window.UI.Components.Chat.createElement('i', {
                classList: ['fas', isExpanded ? 'fa-chevron-down' : 'fa-chevron-right']
            });
            
            const categoryName = window.UI.Components.Chat.createElement('span', {
                textContent: promptKey
            });
            
            const countBadge = window.UI.Components.Chat.createElement('span', {
                classList: 'category-count',
                textContent: groupConversations.length
            });
            
            categoryHeader.appendChild(toggleIcon);
            categoryHeader.appendChild(categoryName);
            categoryHeader.appendChild(countBadge);
            
            const conversationList = window.UI.Components.Chat.createElement('div', { classList: 'category-conversations' });
            if (!isExpanded) {
                conversationList.style.display = 'none';
            }
            
            categoryHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleCategoryExpansion(toggleIcon, conversationList, promptKey);
            });
            
            groupConversations.forEach(conversation => {
                if (!conversation) return;
                
                const historyItem = this._createHistoryItem(
                    conversation, 
                    onSwitchConversation, 
                    onShowRenameModal, 
                    onDeleteConversation
                );
                conversationList.appendChild(historyItem);
            });
            
            categorySection.appendChild(categoryHeader);
            categorySection.appendChild(conversationList);
            
            return categorySection;
        },
        
        /**
         * カテゴリー展開/折りたたみを切り替え
         * @private
         */
        _toggleCategoryExpansion: function(toggleIcon, conversationList, promptKey) {
            if (!toggleIcon || !conversationList || !promptKey) return;
            
            const isNowExpanded = toggleIcon.classList.contains('fa-chevron-down');
            
            if (isNowExpanded) {
                toggleIcon.classList.replace('fa-chevron-down', 'fa-chevron-right');
                conversationList.style.display = 'none';
            } else {
                toggleIcon.classList.replace('fa-chevron-right', 'fa-chevron-down');
                conversationList.style.display = 'block';
            }
            
            window.Storage.saveCategoryState(promptKey, !isNowExpanded);
        },
        
        /**
         * 履歴アイテムを作成する
         * @private
         */
        _createHistoryItem: function(conversation, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
            if (!conversation || !conversation.id) {
                return document.createElement('div');
            }
            
            const historyItem = window.UI.Components.Chat.createElement('div', {
                classList: 'history-item',
                attributes: {
                    'data-id': conversation.id
                }
            });
            
            const itemContent = window.UI.Components.Chat.createElement('div', {
                classList: 'history-item-content',
                innerHTML: `
                    <i class="fas fa-comments"></i>
                    <span class="history-item-title">${conversation.title || '新しいチャット'}</span>
                `
            });
            
            const actionButtons = window.UI.Components.Chat.createElement('div', { classList: 'history-item-actions' });
            
            const editButton = window.UI.Components.Chat.createElement('button', {
                classList: ['history-action-button', 'edit-button'],
                innerHTML: '<i class="fas fa-edit"></i>',
                attributes: {
                    title: 'チャットの名前を変更'
                }
            });
            
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onShowRenameModal === 'function') {
                    onShowRenameModal(conversation);
                }
            });
            
            const deleteButton = window.UI.Components.Chat.createElement('button', {
                classList: ['history-action-button', 'delete-button'],
                innerHTML: '<i class="fas fa-trash"></i>',
                attributes: {
                    title: 'チャットを削除'
                }
            });
            
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onDeleteConversation === 'function') {
                    onDeleteConversation(conversation.id);
                }
            });
            
            actionButtons.appendChild(editButton);
            actionButtons.appendChild(deleteButton);
            
            historyItem.appendChild(itemContent);
            historyItem.appendChild(actionButtons);
            
            itemContent.addEventListener('click', () => {
                if (typeof onSwitchConversation === 'function') {
                    onSwitchConversation(conversation.id);
                }
            });
            
            return historyItem;
        },

        /**
         * 会話をシステムプロンプトでグループ化する
         * @private
         */
        _groupConversationsByPrompt: function(conversations) {
            if (!Array.isArray(conversations)) {
                return { '未分類': [] };
            }
            
            const groups = {};
            
            conversations.forEach(conversation => {
                if (!conversation) return;
                
                let systemPrompt = '未分類';
                
                const systemMessage = conversation.messages?.find(m => m?.role === 'system');
                if (systemMessage && systemMessage.content) {
                    systemPrompt = this._getPromptCategory(systemMessage.content);
                }
                
                if (!groups[systemPrompt]) {
                    groups[systemPrompt] = [];
                }
                
                groups[systemPrompt].push(conversation);
            });
            
            if (!groups['未分類']) {
                groups['未分類'] = [];
            }
            
            return groups;
        },
        
        /**
         * システムプロンプトからカテゴリを判定する
         * @private
         */
        _getPromptCategory: function(promptText) {
            if (!promptText) return '未分類';
            
            const templates = window.AppState.systemPromptTemplates;
            
            for (const templateName in templates) {
                if (templates[templateName].content === promptText) {
                    return templateName;
                }
            }
            
            return '未分類';
        },
        
        /**
         * アクティブなチャットを更新する
         */
        updateActiveChatInHistory: function(currentConversationId) {
            if (!currentConversationId) return;
            
            try {
                const historyItems = document.querySelectorAll('.history-item');
                historyItems.forEach(item => {
                    if (item.dataset.id === currentConversationId) {
                        item.classList.add('active');
                        
                        const categorySection = item.closest('.chat-category');
                        if (categorySection) {
                            const conversationList = categorySection.querySelector('.category-conversations');
                            const toggleIcon = categorySection.querySelector('.category-header .fas');
                            const promptKey = categorySection.dataset.category;
                            
                            if (conversationList && toggleIcon && promptKey && conversationList.style.display === 'none') {
                                this._toggleCategoryExpansion(toggleIcon, conversationList, promptKey);
                            }
                        }
                    } else {
                        item.classList.remove('active');
                    }
                });
            } catch (error) {
                console.error('アクティブチャットの更新中にエラーが発生しました:', error);
            }
        }
    };
})());