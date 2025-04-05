window.UI = window.UI || {};
window.UI.Core = window.UI.Core || {};
window.UI.Core.Modal = window.UI.Core.Modal || {};

/**
 * システムプロンプトモーダル
 */
Object.assign(window.UI.Core.Modal, {
    /**
     * システムプロンプト設定モーダルを表示します
     * @param {string} systemPrompt - 現在のシステムプロンプト
     * @param {Object} systemPromptTemplates - システムプロンプト集
     * @param {Function} onSelect - システムプロンプト選択時のコールバック
     * @param {Function} onDelete - システムプロンプト削除時のコールバック
     */
    showSystemPromptModal: function(systemPrompt, systemPromptTemplates, onSelect, onDelete) {
        window.UI.Utils.toggleModal('systemPromptModal', true);
        window.UI.Cache.get('systemPromptInput').value = systemPrompt;
        
        this.updateList(systemPromptTemplates, onSelect, onDelete);
    },
    
    /**
     * システムプロンプトモーダルを非表示にします
     */
    hideSystemPromptModal: function() {
        window.UI.Utils.toggleModal('systemPromptModal', false);
    },
    
    /**
     * システムプロンプト一覧を表示します
     * @param {Object} systemPromptTemplates - システムプロンプト集
     * @param {Function} onSelect - システムプロンプト選択時のコールバック
     * @param {Function} onDelete - システムプロンプト削除時のコールバック
     */
    updateList: function(systemPromptTemplates, onSelect, onDelete) {
        const listArea = window.UI.Cache.get('systemPromptListArea');
        if (!listArea) return;
        
        // 一覧をクリア
        listArea.innerHTML = '';
        
        // DocumentFragmentを使用してDOM操作を最適化
        const fragment = document.createDocumentFragment();

        // カテゴリごとにプロンプトを整理
        const categorizedPrompts = {};
        Object.entries(systemPromptTemplates).forEach(([promptName, template]) => {
            const category = template.category || '基本';
            if (!categorizedPrompts[category]) {
                categorizedPrompts[category] = [];
            }
            categorizedPrompts[category].push({
                name: promptName,
                content: template.content,
                description: template.description || '',
                tags: template.tags || []
            });
        });
        
        // カテゴリの表示順序を設定
        const defaultCategories = Object.keys(window.CONFIG.SYSTEM_PROMPTS.TEMPLATES.CATEGORIES);
        const sortedCategories = [...defaultCategories];
        console.log('systemPromptTemplates: ', systemPromptTemplates);
        console.log('categorizedPrompts: ', categorizedPrompts);
        console.log('defaultCategories: ', defaultCategories);
        console.log('sortedCategories: ', sortedCategories);
        // 設定されていないカテゴリを追加
        Object.keys(categorizedPrompts).forEach(category => {
            if (!sortedCategories.includes(category)) {
                sortedCategories.push(category);
            }
        });
        
        // カテゴリごとにシステムプロンプトを表示
        sortedCategories.forEach(category => {
            if (!categorizedPrompts[category]) return;
            
            const categoryElement = document.createElement('div');
            categoryElement.className = 'system-prompt-category';
            
            // 保存された展開状態を復元
            const isCategoryCollapsed = window.Storage.loadCategoryState(category);
            if (isCategoryCollapsed) {
                categoryElement.classList.add('collapsed');
            }
            
            // カテゴリヘッダー
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'system-prompt-category-header';
            categoryHeader.innerHTML = `
                <i class="fas fa-chevron-down"></i>
                <span class="category-title">${category}</span>
                <span class="category-count">${categorizedPrompts[category].length}</span>
            `;
            
            // カテゴリヘッダーのクリックイベント
            categoryHeader.addEventListener('click', () => {
                categoryElement.classList.toggle('collapsed');
                // 展開状態を保存
                window.Storage.saveCategoryState(
                    category, 
                    categoryElement.classList.contains('collapsed')
                );
            });
            
            // システムプロンプトリスト
            const promptList = document.createElement('div');
            promptList.className = 'system-prompt-list';
            
            // カテゴリ内のプロンプトをソート
            categorizedPrompts[category]
                .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
                .forEach(prompt => {
                    const item = this._createPromptItem(prompt, onSelect, onDelete);
                    promptList.appendChild(item);
                });
            
            categoryElement.appendChild(categoryHeader);
            categoryElement.appendChild(promptList);
            fragment.appendChild(categoryElement);
        });
        
        // 一度のDOM操作でフラグメントを追加
        listArea.appendChild(fragment);
    },

    /**
     * システムプロンプト項目要素を作成します
     * @private
     */
    _createPromptItem: function(prompt, onSelect, onDelete) {
        const promptItem = document.createElement('div');
        promptItem.className = 'system-prompt-item';
        
        // プロンプト名
        const nameElement = document.createElement('span');
        nameElement.className = 'system-prompt-name';
        nameElement.textContent = prompt.name;
        promptItem.appendChild(nameElement);
        
        // 説明文が存在する場合は表示
        if (prompt.description) {
            const descElement = document.createElement('div');
            descElement.className = 'system-prompt-description';
            descElement.textContent = prompt.description;
            promptItem.appendChild(descElement);
        }
        
        // タグの表示
        if (prompt.tags && prompt.tags.length > 0) {
            const tagsElement = document.createElement('div');
            tagsElement.className = 'system-prompt-tags';
            prompt.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'system-prompt-tag';
                tagElement.textContent = tag;
                tagsElement.appendChild(tagElement);
            });
            promptItem.appendChild(tagsElement);
        }

        // デフォルトプロンプトかどうかを判定
        const isDefaultPrompt = Object.values(window.CONFIG.SYSTEM_PROMPTS.TEMPLATES.CATEGORIES)
            .some(category => Object.keys(category).includes(prompt.name));

        // デフォルトプロンプト以外に削除ボタンを表示
        if (!isDefaultPrompt) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'system-prompt-delete-button';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'システムプロンプトを削除';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                onDelete(prompt.name);
            });
            promptItem.appendChild(deleteButton);
        }

        // クリックイベントの設定
        promptItem.addEventListener('click', () => onSelect(prompt.name));
        
        return promptItem;
    },

    /**
     * プロンプトをシステムプロンプトとして設定する
     * @public
     * @param {string} promptId - プロンプトID
     */
    setPromptAsSystemPrompt: function(promptId) {
        try {
            const customVariables = {};
            const systemPrompt = window.SystemPromptManager.setAsSystemPrompt(promptId, customVariables);
            window.UI.Core.Notification.show('システムプロンプトを更新しました', 'success');
            
            // プロンプトマネージャーモーダルを閉じる（表示されている場合）
            if (this.hidePromptManagerModal) {
                this.hidePromptManagerModal();
            }
        } catch (error) {
            console.error('システムプロンプトの設定に失敗しました:', error);
            window.UI.Core.Notification.show('システムプロンプトの設定に失敗しました', 'error');
        }
    },

    /**
     * プロンプトをシステムプロンプトテンプレートとして保存する
     * @public
     * @param {string} promptId - プロンプトID
     */
    savePromptAsSystemPromptTemplate: function(promptId) {
        const promptName = prompt('システムプロンプト名を入力してください:');
        if (!promptName) return;
        
        try {
            const success = window.SystemPromptManager.saveAsSystemPromptTemplate(promptId, promptName);
            
            if (success) {
                window.UI.Core.Notification.show(`システムプロンプト「${promptName}」を保存しました`, 'success');
            } else {
                window.UI.Core.Notification.show('システムプロンプトの保存に失敗しました', 'error');
            }
        } catch (error) {
            console.error('システムプロンプトの保存中にエラーが発生しました:', error);
            window.UI.Core.Notification.show(`エラー: ${error.message}`, 'error');
        }
    }
});