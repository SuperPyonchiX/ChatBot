window.UI = window.UI || {};

/**
 * システムプロンプトモーダル関連の機能
 */
Object.assign(window.UI, {
    /**
     * システムプロンプト設定モーダルを表示します
     * システムプロンプト編集モーダルを表示し、テンプレート一覧も更新します
     * 
     * @param {string} systemPrompt - 現在のシステムプロンプト
     * @param {Object} promptTemplates - プロンプトテンプレート集
     * @param {Function} onTemplateSelect - テンプレート選択時のコールバック
     * @param {Function} onTemplateDelete - テンプレート削除時のコールバック
     */
    showSystemPromptModal: function(systemPrompt, promptTemplates, onTemplateSelect, onTemplateDelete) {
        UIUtils.toggleModal('systemPromptModal', true);
        UICache.get('systemPromptInput').value = systemPrompt;
        
        // カテゴリ選択肢を設定
        const categorySelect = document.getElementById('newTemplateCategory');
        if (categorySelect) {
            const categories = window.CONFIG.PROMPTS.TEMPLATES.CATEGORY_ORDER || [];
            categorySelect.innerHTML = ''; // 既存の選択肢をクリア
            
            // デフォルトのカテゴリを追加
            const defaultOption = document.createElement('option');
            defaultOption.value = '基本';
            defaultOption.textContent = '基本';
            categorySelect.appendChild(defaultOption);
            
            // その他のカテゴリを追加
            categories.forEach(category => {
                if (category !== '基本') {  // デフォルトカテゴリは既に追加済み
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                }
            });
            
            // 「その他」カテゴリを最後に追加
            const otherOption = document.createElement('option');
            otherOption.value = 'その他';
            otherOption.textContent = 'その他';
            categorySelect.appendChild(otherOption);
        }
        
        // テンプレート一覧を表示（不要なエントリを除外）
        const filteredTemplates = {};
        Object.entries(promptTemplates).forEach(([key, value]) => {
            // 'CATEGORIES'と'CATEGORY_ORDER'は除外
            if (key !== 'CATEGORIES' && key !== 'CATEGORY_ORDER') {
                filteredTemplates[key] = value;
            }
        });
        
        this.updateTemplateList(filteredTemplates, onTemplateSelect, onTemplateDelete);
    },

    /**
     * システムプロンプト設定モーダルを非表示にします
     */
    hideSystemPromptModal: function() {
        UIUtils.toggleModal('systemPromptModal', false);
    },

    /**
     * テンプレート一覧を表示します
     * システムプロンプトテンプレートの一覧を表示し、選択/削除機能を提供します
     * 
     * @param {Object} promptTemplates - プロンプトテンプレート集
     * @param {Function} onTemplateSelect - テンプレート選択時のコールバック関数
     * @param {Function} onTemplateDelete - テンプレート削除時のコールバック関数
     */
    updateTemplateList: function(promptTemplates, onTemplateSelect, onTemplateDelete) {
        const templateListArea = UICache.get('templateListArea');
        if (!templateListArea) return;
        
        // テンプレート一覧をクリア
        templateListArea.innerHTML = '';
        
        // DocumentFragmentを使用してDOM操作を最適化
        const fragment = document.createDocumentFragment();
        
        // カテゴリごとにテンプレートを整理
        const categorizedTemplates = {};
        Object.entries(promptTemplates).forEach(([templateName, content]) => {
            // configファイルからカテゴリを取得
            let category = '';
            for (const [cat, templates] of Object.entries(window.CONFIG.PROMPTS.TEMPLATES.CATEGORIES)) {
                if (templates[templateName]) {
                    category = cat;
                    break;
                }
            }
            // カテゴリがない場合は「その他」に分類
            if (!category) category = 'その他';
            
            if (!categorizedTemplates[category]) {
                categorizedTemplates[category] = [];
            }
            categorizedTemplates[category].push({name: templateName, content: content});
        });
        
        // カテゴリの表示順序を取得
        const categoryOrder = window.CONFIG.PROMPTS.TEMPLATES.CATEGORY_ORDER || [];
        const sortedCategories = [...categoryOrder];
        // 設定されていないカテゴリを追加
        Object.keys(categorizedTemplates).forEach(category => {
            if (!sortedCategories.includes(category)) {
                sortedCategories.push(category);
            }
        });
        
        // カテゴリごとにテンプレートを表示
        sortedCategories.forEach(category => {
            if (!categorizedTemplates[category]) return;
            
            const categoryElement = document.createElement('div');
            categoryElement.className = 'template-category';
            
            // 保存された展開状態を復元
            const isCategoryCollapsed = window.Storage.loadCategoryState(category);
            if (isCategoryCollapsed) {
                categoryElement.classList.add('collapsed');
            }
            
            // カテゴリヘッダー
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'template-category-header';
            categoryHeader.innerHTML = `
                <i class="fas fa-chevron-down"></i>
                <span class="category-title">${category}</span>
                <span class="category-count">${categorizedTemplates[category].length}</span>
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
            
            // テンプレートリスト
            const templateList = document.createElement('div');
            templateList.className = 'template-list';
            
            // カテゴリ内のテンプレートをソート
            categorizedTemplates[category]
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(({name: templateName}) => {
                    const item = this._createTemplateItem(templateName, onTemplateSelect, onTemplateDelete);
                    templateList.appendChild(item);
                });
            
            categoryElement.appendChild(categoryHeader);
            categoryElement.appendChild(templateList);
            fragment.appendChild(categoryElement);
        });
        
        // 一度のDOM操作でフラグメントを追加
        templateListArea.appendChild(fragment);
    },

    /**
     * テンプレート項目要素を作成します
     * @private
     */
    _createTemplateItem: function(templateName, onTemplateSelect, onTemplateDelete) {
        // 削除ボタン（デフォルトテンプレートと設定ファイルで定義されたテンプレート以外のみ）
        const children = [
            UIUtils.createElement('span', {
                textContent: templateName,
                classList: ['template-name']
            })
        ];
        
        // config.jsで定義されたテンプレートの判定
        const isConfigTemplate = Object.keys(window.CONFIG.PROMPTS.TEMPLATES).includes(templateName);
        
        // デフォルトテンプレートとconfig.jsで定義されたテンプレート以外に削除ボタンを表示
        if (!isConfigTemplate) {
            children.push(UIUtils.createElement('button', {
                classList: ['template-delete-button'],
                innerHTML: '<i class="fas fa-trash"></i>',
                title: 'テンプレートを削除',
                events: {
                    click: (e) => {
                        e.stopPropagation();
                        onTemplateDelete(templateName);
                    }
                }
            }));
        }
        
        // テンプレート項目
        return UIUtils.createElement('div', {
            classList: ['template-item'],
            children,
            events: {
                click: () => onTemplateSelect(templateName)
            }
        });
    }
});