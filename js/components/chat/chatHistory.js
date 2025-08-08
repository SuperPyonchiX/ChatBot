/**
 * chatHistory.js
 * 会話履歴の管理機能を提供します
 */
class ChatHistory {
    // シングルトンインスタンス
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {ChatHistory} ChatHistoryのシングルトンインスタンス
     */
    static get getInstance() {
        if (!ChatHistory.#instance) {
            ChatHistory.#instance = new ChatHistory();
        }
        return ChatHistory.#instance;
    }

    /**
     * プライベートコンストラクタ
     * @private
     */
    constructor() {
        if (ChatHistory.#instance) {
            throw new Error('ChatHistoryクラスは直接インスタンス化できません。ChatHistory.instanceを使用してください。');
        }
    }

    /**
     * 会話を表示する
     */
    async displayConversation(conversation, chatMessages, modelSelect) {
        if (!conversation || !chatMessages) return;
        
        chatMessages.innerHTML = '';
        
        for (const message of conversation.messages) {
            if (!message || !message.role) continue;
            
            if (message.role === 'system') continue;
            
            if (message.role === 'user') {
                let content = typeof message.content === 'string' 
                    ? message.content 
                    : this.#processContentArray(message.content);
                
                // ファイル内容とWEB検索結果の表示を除去
                const displayContent = this.#cleanDisplayContent(content);
                
                // ChatRenderer のインスタンスが存在するか確認してから使用
                try {
                    if (typeof ChatRenderer !== 'undefined' && ChatRenderer.getInstance) {
                        await ChatRenderer.getInstance.addUserMessage(displayContent, chatMessages, [], message.timestamp);
                    } else {
                        console.warn('ChatRenderer が見つからないため、シンプルなレンダリングを使用します');
                        this.#renderSimpleUserMessage(displayContent, chatMessages, message.timestamp);
                    }
                } catch (error) {
                    console.error('メッセージ表示中にエラーが発生:', error);
                    this.#renderSimpleUserMessage(displayContent, chatMessages, message.timestamp);
                }
            } else if (message.role === 'assistant') {
                const content = typeof message.content === 'string' 
                    ? message.content 
                    : this.#processContentArray(message.content);
                
                // ChatRenderer のインスタンスが存在するか確認してから使用
                try {
                    if (typeof ChatRenderer !== 'undefined' && ChatRenderer.getInstance) {
                        await ChatRenderer.getInstance.addBotMessage(content, chatMessages, message.timestamp, false);
                    } else {
                        console.warn('ChatRenderer が見つからないため、シンプルなレンダリングを使用します');
                        this.#renderSimpleAssistantMessage(content, chatMessages, message.timestamp);
                    }
                } catch (error) {
                    console.error('メッセージ表示中にエラーが発生:', error);
                    this.#renderSimpleAssistantMessage(content, chatMessages, message.timestamp);
                }
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
        FileAttachment.getInstance.displaySavedAttachments(conversation.id, chatMessages);
        
        if (typeof Prism !== 'undefined') {
            try {
                Prism.highlightAll();
            } catch (error) {
                console.error('シンタックスハイライトの適用中にエラーが発生しました:', error);
            }
        }
    }

    /**
     * 会話履歴を表示する
     */
    renderChatHistory(conversations, currentConversationId, chatHistory, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
        if (!chatHistory || !Array.isArray(conversations)) return;
        
        chatHistory.innerHTML = '';
        
        if (conversations.length === 0) {
            const emptyState = ChatUI.getInstance.createElement('div', {
                classList: 'empty-history',
                innerHTML: `
                    <p>会話履歴がありません</p>
                    <p>新しいチャットを開始してください</p>
                `
            });
            chatHistory.appendChild(emptyState);
            return;
        }
        
        const promptGroups = this.#groupConversationsByPrompt(conversations);
        
        Object.entries(promptGroups).forEach(([promptKey, groupConversations]) => {
            if (!Array.isArray(groupConversations) || groupConversations.length === 0) return;
            
            const categoryStates = Storage.getInstance.loadCategoryStates();
            const isExpanded = categoryStates[promptKey] !== false;
            
            const categorySection = this.#createCategorySection(
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
    }

    /**
     * アクティブなチャットを更新する
     */
    updateActiveChatInHistory(currentConversationId) {
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
                            this.#toggleCategoryExpansion(toggleIcon, conversationList, promptKey);
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

    /**
     * メッセージ表示の内容をクリーンアップする
     * @private
     */
    #cleanDisplayContent(content) {
        if (!content) return '';
        // === ファイル名「...」の内容 === 以降のテキストをすべて削除
        let cleanContent = content.replace(/===\s+.*?ファイル「.*?」の内容\s+===[\s\S]*$/g, '').trim();
        // === 以下のWEB検索結果を参考に回答してください === 以降のテキストをすべて削除
        cleanContent = cleanContent.replace(/===\s+以下のWEB検索結果を参考に回答してください\s+===[\s\S]*$/g, '').trim();
        return cleanContent;
    }

    /**
     * 配列型のコンテンツを処理する
     * @private
     */
    #processContentArray(content) {
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
    }

    /**
     * カテゴリーセクションを作成する
     * @private
     */
    #createCategorySection(promptKey, groupConversations, isExpanded, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
        if (!promptKey || !Array.isArray(groupConversations)) {
            return document.createElement('div');
        }
        
        // DOMElementsクラスを使用して要素を作成
        const categorySection = document.createElement('div');
        categorySection.className = 'chat-category';
        categorySection.dataset.category = promptKey;
        
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        
        const toggleIcon = document.createElement('i');
        toggleIcon.className = `fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`;
        
        const categoryName = document.createElement('span');
        categoryName.textContent = promptKey;
        
        const countBadge = document.createElement('span');
        countBadge.className = 'category-count';
        countBadge.textContent = groupConversations.length;
        
        categoryHeader.appendChild(toggleIcon);
        categoryHeader.appendChild(categoryName);
        categoryHeader.appendChild(countBadge);
        
        const conversationList = document.createElement('div');
        conversationList.className = 'category-conversations';
        if (!isExpanded) {
            conversationList.style.display = 'none';
        }
        
        categoryHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            this.#toggleCategoryExpansion(toggleIcon, conversationList, promptKey);
        });
        
        groupConversations.forEach(conversation => {
            if (!conversation) return;
            
            const historyItem = this.#createHistoryItem(
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
    }
    
    /**
     * カテゴリー展開/折りたたみを切り替え
     * @private
     */
    #toggleCategoryExpansion(toggleIcon, conversationList, promptKey) {
        if (!toggleIcon || !conversationList || !promptKey) return;
        
        const isNowExpanded = toggleIcon.classList.contains('fa-chevron-down');
        
        if (isNowExpanded) {
            toggleIcon.classList.replace('fa-chevron-down', 'fa-chevron-right');
            conversationList.style.display = 'none';
        } else {
            toggleIcon.classList.replace('fa-chevron-right', 'fa-chevron-down');
            conversationList.style.display = 'block';
        }
        
        Storage.getInstance.saveCategoryState(promptKey, !isNowExpanded);
    }
    
    /**
     * 履歴アイテムを作成する
     * @private
     */
    #createHistoryItem(conversation, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
        if (!conversation || !conversation.id) {
            return document.createElement('div');
        }
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.dataset.id = conversation.id;
        
        const itemContent = document.createElement('div');
        itemContent.className = 'history-item-content';
        itemContent.innerHTML = `
            <i class="fas fa-comments"></i>
            <span class="history-item-title">${conversation.title || '新しいチャット'}</span>
        `;
        
        const actionButtons = document.createElement('div');
        actionButtons.className = 'history-item-actions';
        
        const editButton = document.createElement('button');
        editButton.className = 'history-action-button edit-button';
        editButton.innerHTML = '<i class="fas fa-edit"></i>';
        editButton.title = 'チャットの名前を変更';
        
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof onShowRenameModal === 'function') {
                onShowRenameModal(conversation);
            }
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'history-action-button delete-button';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.title = 'チャットを削除';
        
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
    }

    /**
     * 会話をシステムプロンプトでグループ化する
     * @private
     */
    #groupConversationsByPrompt(conversations) {
        if (!Array.isArray(conversations)) {
            return { '未分類': [] };
        }
        
        const groups = {};
        
        conversations.forEach(conversation => {
            if (!conversation) return;
            
            let systemPrompt = '未分類';
            
            const systemMessage = conversation.messages?.find(m => m?.role === 'system');
            if (systemMessage && systemMessage.content) {
                systemPrompt = this.#getPromptCategory(systemMessage.content);
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
    }
    
    /**
     * システムプロンプトからカテゴリを判定する
     * @private
     */
    #getPromptCategory(promptText) {
        if (!promptText) return '未分類';
        
        const templates = window.AppState.systemPromptTemplates;
        
        for (const templateName in templates) {
            if (templates[templateName].content === promptText) {
                return templateName;
            }
        }
        
        return '未分類';
    }
    
    /**
     * シンプルなユーザーメッセージを表示する（ChatRendererフォールバック）
     * @private
     */
    #renderSimpleUserMessage(content, container, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        if (timestamp) messageDiv.dataset.timestamp = timestamp.toString();
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'markdown-content';
        
        // シンプルなテキスト表示
        if (typeof Markdown !== 'undefined' && Markdown.getInstance) {
            Markdown.getInstance.renderMarkdown(content)
                .then(html => {
                    messageContent.innerHTML = html;
                })
                .catch(() => {
                    messageContent.textContent = content;
                });
        } else {
            messageContent.textContent = content;
        }
        
        contentDiv.appendChild(messageContent);
        messageDiv.appendChild(contentDiv);
        container.appendChild(messageDiv);
    }
    
    /**
     * シンプルなアシスタントメッセージを表示する（ChatRendererフォールバック）
     * @private
     */
    #renderSimpleAssistantMessage(content, container, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'assistant');
        if (timestamp) messageDiv.dataset.timestamp = timestamp.toString();
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'markdown-content';
        
        // シンプルなテキスト表示
        if (typeof Markdown !== 'undefined' && Markdown.getInstance) {
            Markdown.getInstance.renderMarkdown(content)
                .then(html => {
                    messageContent.innerHTML = html;
                })
                .catch(() => {
                    messageContent.textContent = content;
                });
        } else {
            messageContent.textContent = content;
        }
        
        contentDiv.appendChild(messageContent);
        messageDiv.appendChild(contentDiv);
        container.appendChild(messageDiv);
    }
}
