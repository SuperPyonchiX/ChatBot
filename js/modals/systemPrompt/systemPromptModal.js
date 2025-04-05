window.UI = window.UI || {};
window.UI.Core = window.UI.Core || {};
window.UI.Core.Modal = window.UI.Core.Modal || {};

/**
 * システムプロンプトモーダル
 */
Object.assign(window.UI.Core.Modal, {
    /**
     * システムプロンプト設定モーダルを表示します
     * システムプロンプト編集モーダルを表示し、一覧も更新します
     * 
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
     * システムプロンプトの一覧を表示し、選択/削除機能を提供します
     * 
     * @param {Object} systemPromptTemplates - システムプロンプト集
     * @param {Function} onSelect - システムプロンプト選択時のコールバック関数
     * @param {Function} onDelete - システムプロンプト削除時のコールバック関数
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
        Object.entries(systemPromptTemplates).forEach(([promptName, content]) => {
            // configファイルからカテゴリを取得
            let category = '';
            for (const [cat, items] of Object.entries(window.CONFIG.SYSTEM_PROMPTS.TEMPLATES.CATEGORIES)) {
                if (items[promptName]) {
                    category = cat;
                    break;
                }
            }
            // カテゴリがない場合は「その他」に分類
            if (!category) category = 'その他';
            
            if (!categorizedPrompts[category]) {
                categorizedPrompts[category] = [];
            }
            categorizedPrompts[category].push({name: promptName, content: content});
        });
        
        // カテゴリの表示順序を取得
        const categoryOrder = window.CONFIG.SYSTEM_PROMPTS.TEMPLATES.CATEGORY_ORDER || [];
        const sortedCategories = [...categoryOrder];
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
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(({name: promptName}) => {
                    const item = this._createPromptItem(promptName, onSelect, onDelete);
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
    _createPromptItem: function(promptName, onSelect, onDelete) {
        // 削除ボタン（デフォルトプロンプトと設定ファイルで定義されたプロンプト以外のみ）
        const children = [
            window.UI.Utils.createElement('span', {
                textContent: promptName,
                classList: ['system-prompt-name']
            })
        ];
        
        // プロンプト名がデフォルトプロンプトかどうかを判定
        const isConfigPrompt = Object.values(window.CONFIG.SYSTEM_PROMPTS.TEMPLATES.CATEGORIES)
                                    .some(category => Object.keys(category).includes(promptName));

        // デフォルトプロンプトとconfig.jsで定義されたプロンプト以外に削除ボタンを表示
        if (!isConfigPrompt) {
            children.push(window.UI.Utils.createElement('button', {
                classList: ['system-prompt-delete-button'],
                innerHTML: '<i class="fas fa-trash"></i>',
                title: 'システムプロンプトを削除',
                events: {
                    click: (e) => {
                        e.stopPropagation();
                        onDelete(promptName);
                    }
                }
            }));
        }
        
        // プロンプト項目
        return window.UI.Utils.createElement('div', {
            classList: ['system-prompt-item'],
            children,
            events: {
                click: () => onSelect(promptName)
            }
        });
    }
});