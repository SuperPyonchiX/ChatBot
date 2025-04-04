window.UI = window.UI || {};

/**
 * プロンプトマネージャー関連の機能
 */
Object.assign(window.UI, {
    /**
     * プロンプトマネージャーモーダルを表示する
     */
    showPromptManagerModal: function() {
        console.log('プロンプトマネージャーモーダルを表示します');
        const modal = document.getElementById('promptManagerModal');
        if (!modal) {
            console.error('モーダル要素が見つかりません: promptManagerModal');
            return;
        }
        
        // モーダル表示
        modal.style.display = 'block';
        
        // カテゴリとプロンプト一覧を更新
        this.updatePromptCategories();
        this.updatePromptsList();
    },
    
    /**
     * プロンプトマネージャーモーダルを非表示にする
     */
    hidePromptManagerModal: function() {
        console.log('プロンプトマネージャーモーダルを閉じます');
        const modal = document.getElementById('promptManagerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },
    
    /**
     * プロンプトカテゴリ一覧を更新する
     */
    updatePromptCategories: function() {
        console.log('カテゴリ一覧を更新します');
        const categoriesList = document.getElementById('promptCategoriesList');
        if (!categoriesList) {
            console.error('カテゴリリスト要素が見つかりません: promptCategoriesList');
            return;
        }
        
        // カテゴリリストをクリア
        categoriesList.innerHTML = '';
        
        // カテゴリを読み込む
        const categories = window.PromptManager.loadCategories();
        
        // カテゴリを並び替え
        const sortedCategories = Object.entries(categories)
            .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
        
        // カテゴリごとにリスト項目を作成
        sortedCategories.forEach(([key, category]) => {
            // カテゴリ項目
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';
            if (key === 'all') {
                categoryItem.classList.add('active');
            }
            categoryItem.dataset.category = key;
            
            // カテゴリ名とカウントを含むコンテナ
            const nameContainer = document.createElement('div');
            nameContainer.className = 'category-name-container';
            nameContainer.innerHTML = `
                <span>${category.name}</span>
                <span class="category-count">0</span>
            `;
            
            // アクションボタン
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'category-actions';
            
            if (key !== 'all' && key !== 'general') {
                const editButton = document.createElement('button');
                editButton.className = 'category-edit-button';
                editButton.innerHTML = '<i class="fas fa-edit"></i>';
                editButton.title = 'カテゴリを編集';
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._editCategory(key, category.name);
                });
                
                const deleteButton = document.createElement('button');
                deleteButton.className = 'category-delete-button';
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.title = 'カテゴリを削除';
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._deleteCategory(key);
                });
                
                actionsContainer.appendChild(editButton);
                actionsContainer.appendChild(deleteButton);
            }
            
            categoryItem.appendChild(nameContainer);
            categoryItem.appendChild(actionsContainer);
            
            // クリックイベント（カテゴリの選択）
            nameContainer.addEventListener('click', () => {
                document.querySelectorAll('.category-item.active').forEach(item => {
                    item.classList.remove('active');
                });
                
                categoryItem.classList.add('active');
                this._updateCategoryCounts();
                this.updatePromptsList({ category: key });
            });
            
            categoriesList.appendChild(categoryItem);
        });

        // 初期表示時のカウントとプロンプト一覧を更新
        this._updateCategoryCounts();
        this.updatePromptsList({ category: 'all' });
    },

    /**
     * プロンプト一覧を更新する
     * @param {Object} filter - フィルタリング条件
     */
    updatePromptsList: function(filter = {}) {
        const promptsList = document.getElementById('promptsList');
        if (!promptsList) {
            console.error('プロンプトリスト要素が見つかりません: promptsList');
            return;
        }
        
        // プロンプトリストをクリア
        promptsList.innerHTML = '';
        
        // 検索条件でプロンプトを取得
        const prompts = window.PromptManager.searchPrompts(filter);
        
        if (prompts.length === 0) {
            promptsList.innerHTML = '<div class="no-prompts-message">プロンプトが見つかりません</div>';
            return;
        }
        
        // 日付でソート（新しい順）
        prompts.sort((a, b) => b.updatedAt - a.updatedAt);
        
        // プロンプトごとにリスト項目を作成
        prompts.forEach(prompt => {
            const promptItem = document.createElement('div');
            promptItem.className = 'prompt-item';
            promptItem.dataset.promptId = prompt.id;
            
            promptItem.innerHTML = `
                <div class="prompt-item-header">
                    <span class="prompt-item-name">${prompt.name}</span>
                    <div class="prompt-item-actions">
                        <button class="edit-prompt-button" title="編集">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="use-prompt-button" title="プロンプトを使用">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                        <button class="system-prompt-button" title="システムプロンプトとして設定">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="template-save-button" title="テンプレートとして保存">
                            <i class="fas fa-save"></i>
                        </button>
                        <button class="delete-prompt-button" title="削除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="prompt-item-description">${prompt.description || ''}</div>
                <div class="prompt-item-tags">
                    ${prompt.tags.map(tag => `<span class="prompt-tag">${tag}</span>`).join('')}
                </div>
            `;
            
            // イベントリスナーの設定
            this._setupPromptItemEventListeners(promptItem, prompt);
            
            promptsList.appendChild(promptItem);
        });
    },

    /**
     * プロンプト項目のイベントリスナーを設定する
     * @private
     */
    _setupPromptItemEventListeners: function(promptItem, prompt) {
        promptItem.querySelector('.edit-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPromptEditModal(prompt);
        });
        
        promptItem.querySelector('.use-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this._usePrompt(prompt.id);
        });
        
        promptItem.querySelector('.system-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this._setAsSystemPrompt(prompt.id);
        });
        
        promptItem.querySelector('.template-save-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this._saveAsTemplate(prompt.id);
        });
        
        promptItem.querySelector('.delete-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this._deletePrompt(prompt.id);
        });
        
        promptItem.addEventListener('click', () => {
            this.showPromptEditModal(prompt);
        });
    },
    
    /**
     * プロンプトを使用する
     * @private
     */
    _usePrompt: function(promptId) {
        try {
            const promptText = window.PromptManager.buildPrompt(promptId);
            
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = promptText;
                window.UIUtils.autoResizeTextarea(userInput);
            }
            
            this.hidePromptManagerModal();
            this.notify('プロンプトをセットしました', 'success');
        } catch (error) {
            console.error('プロンプト使用中にエラーが発生しました:', error);
            this.notify('プロンプトの使用に失敗しました', 'error');
        }
    },
    
    /**
     * カテゴリごとのプロンプト数を更新する
     * @private
     */
    _updateCategoryCounts: function() {
        const categories = document.querySelectorAll('.category-item');
        if (!categories.length) return;
        
        const prompts = window.PromptManager.loadPromptLibrary();
        
        // カテゴリごとのカウントを集計
        const counts = {
            'all': prompts.length
        };
        
        prompts.forEach(prompt => {
            if (!prompt.category) return;
            counts[prompt.category] = (counts[prompt.category] || 0) + 1;
        });
        
        // カテゴリ要素のカウンタを更新
        categories.forEach(categoryEl => {
            const categoryKey = categoryEl.dataset.category;
            if (!categoryKey) return;
            
            const countEl = categoryEl.querySelector('.category-count');
            if (countEl) {
                countEl.textContent = counts[categoryKey] || 0;
            }
        });
    },

    /**
     * プロンプトを削除する
     * @private
     */
    _deletePrompt: function(promptId) {
        if (confirm('このプロンプトを削除してもよろしいですか？')) {
            try {
                const result = window.PromptManager.deletePrompt(promptId);
                if (result) {
                    this.notify('プロンプトを削除しました', 'success');
                    
                    const activeCategory = document.querySelector('.category-item.active');
                    const filter = {};
                    if (activeCategory) {
                        filter.category = activeCategory.dataset.category;
                    }
                    
                    this.updatePromptsList(filter);
                    this._updateCategoryCounts();
                } else {
                    this.notify('プロンプトの削除に失敗しました', 'error');
                }
            } catch (error) {
                console.error('プロンプト削除中にエラーが発生しました:', error);
                this.notify('エラー: ' + error.message, 'error');
            }
        }
    },

    /**
     * プロンプトをシステムプロンプトとして設定する
     * @private
     */
    _setAsSystemPrompt: function(promptId) {
        try {
            const customVariables = {};
            const systemPrompt = window.PromptManager.setAsSystemPrompt(promptId, customVariables);
            this.notify('システムプロンプトを更新しました', 'success');
            this.hidePromptManagerModal();
        } catch (error) {
            console.error('システムプロンプトの設定に失敗しました:', error);
            this.notify('システムプロンプトの設定に失敗しました', 'error');
        }
    },

    /**
     * プロンプトをテンプレートとして保存する
     * @private
     */
    _saveAsTemplate: function(promptId) {
        const templateName = prompt('テンプレート名を入力してください:');
        if (!templateName) return;
        
        try {
            const success = window.PromptManager.saveAsSystemPromptTemplate(promptId, templateName);
            
            if (success) {
                this.notify(`テンプレート「${templateName}」を保存しました`, 'success');
            } else {
                this.notify('テンプレートの保存に失敗しました', 'error');
            }
        } catch (error) {
            console.error('テンプレートの保存中にエラーが発生しました:', error);
            this.notify(`エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * カテゴリを編集する
     * @private
     */
    _editCategory: function(categoryKey, currentName) {
        const newName = prompt('新しいカテゴリ名を入力してください:', currentName);
        
        if (newName && newName.trim() && newName !== currentName) {
            try {
                const success = window.PromptManager.updateCategory(categoryKey, {
                    name: newName.trim()
                });
                
                if (success) {
                    this.notify('カテゴリ名を更新しました', 'success');
                    this.updatePromptCategories();
                } else {
                    this.notify('カテゴリの更新に失敗しました', 'error');
                }
            } catch (error) {
                console.error('カテゴリ更新中にエラーが発生しました:', error);
                this.notify('エラー: ' + error.message, 'error');
            }
        }
    },

    /**
     * カテゴリを削除する
     * @private
     */
    _deleteCategory: function(categoryKey) {
        this.confirm(
            'このカテゴリを削除してもよろしいですか？\nこのカテゴリ内のプロンプトは「一般」カテゴリに移動されます。',
            {
                title: 'カテゴリの削除',
                confirmText: '削除',
                cancelText: 'キャンセル'
            }
        ).then(confirmed => {
            if (confirmed) {
                try {
                    const success = window.PromptManager.deleteCategory(categoryKey);
                    
                    if (success) {
                        this.notify('カテゴリを削除しました', 'success');
                        this.updatePromptCategories();
                    } else {
                        this.notify('カテゴリの削除に失敗しました', 'error');
                    }
                } catch (error) {
                    console.error('カテゴリ削除中にエラーが発生しました:', error);
                    this.notify('エラー: ' + error.message, 'error');
                }
            }
        });
    },

    /**
     * プロンプト編集モーダルを表示する
     * @param {Object} prompt - 編集するプロンプトデータ
     */
    showPromptEditModal: function(prompt) {
        const modal = document.getElementById('promptEditModal');
        if (!modal) {
            console.error('モーダル要素が見つかりません: promptEditModal');
            return;
        }

        // モーダルタイトルを設定
        const title = document.getElementById('promptEditTitle');
        if (title) {
            title.textContent = prompt ? 'プロンプト編集' : '新規プロンプト';
        }

        // フォームに値を設定
        const nameInput = document.getElementById('promptNameInput');
        const categorySelect = document.getElementById('promptCategorySelect');
        const tagsInput = document.getElementById('promptTagsInput');
        const descriptionInput = document.getElementById('promptDescriptionInput');
        const contentInput = document.getElementById('promptContentInput');

        if (prompt) {
            nameInput.value = prompt.name || '';
            tagsInput.value = prompt.tags ? prompt.tags.join(', ') : '';
            descriptionInput.value = prompt.description || '';
            contentInput.value = prompt.content || '';
            modal.dataset.promptId = prompt.id;
        } else {
            // 新規プロンプトの場合は空にする
            nameInput.value = '';
            tagsInput.value = '';
            descriptionInput.value = '';
            contentInput.value = '';
            delete modal.dataset.promptId;
        }

        // カテゴリ選択肢を更新
        this._updateCategorySelect(categorySelect, prompt ? prompt.category : null);

        // モーダルを表示
        modal.style.display = 'block';

        // イベントリスナーを設定
        const saveButton = document.getElementById('savePromptEdit');
        const cancelButton = document.getElementById('cancelPromptEdit');

        // 既存のイベントリスナーを削除
        saveButton.replaceWith(saveButton.cloneNode(true));
        cancelButton.replaceWith(cancelButton.cloneNode(true));

        // 新しいイベントリスナーを追加
        document.getElementById('savePromptEdit').addEventListener('click', () => this._savePromptEdit(modal));
        document.getElementById('cancelPromptEdit').addEventListener('click', () => this.hidePromptEditModal());
    },

    /**
     * プロンプト編集モーダルを非表示にする
     */
    hidePromptEditModal: function() {
        const modal = document.getElementById('promptEditModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    /**
     * カテゴリ選択肢を更新する
     * @private
     */
    _updateCategorySelect: function(select, currentCategory) {
        if (!select) return;

        // 選択肢をクリア
        select.innerHTML = '';

        // カテゴリ一覧を取得
        const categories = window.PromptManager.loadCategories();
        const sortedCategories = Object.entries(categories)
            .filter(([key]) => key !== 'all')
            .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

        // カテゴリの選択肢を作成
        sortedCategories.forEach(([key, category]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = category.name;
            if (key === currentCategory) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    },

    /**
     * プロンプトを保存する
     * @private
     */
    _savePromptEdit: function(modal) {
        const nameInput = document.getElementById('promptNameInput');
        const categorySelect = document.getElementById('promptCategorySelect');
        const tagsInput = document.getElementById('promptTagsInput');
        const descriptionInput = document.getElementById('promptDescriptionInput');
        const contentInput = document.getElementById('promptContentInput');

        // 入力値を取得
        const name = nameInput.value.trim();
        const category = categorySelect.value;
        const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
        const description = descriptionInput.value.trim();
        const content = contentInput.value.trim();

        // バリデーション
        if (!name || !content) {
            this.notify('名前とプロンプト内容は必須です', 'error');
            return;
        }

        try {
            const promptData = {
                name,
                category,
                tags,
                description,
                content
            };

            const promptId = modal.dataset.promptId;
            let success;

            if (promptId) {
                // 既存プロンプトの更新
                success = window.PromptManager.updatePrompt(promptId, promptData);
            } else {
                // 新規プロンプトの追加
                success = window.PromptManager.addPrompt(promptData);
            }

            if (success) {
                this.notify(promptId ? 'プロンプトを更新しました' : 'プロンプトを作成しました', 'success');
                this.hidePromptEditModal();
                
                // プロンプトリストを更新
                const activeCategory = document.querySelector('.category-item.active');
                const filter = activeCategory ? { category: activeCategory.dataset.category } : {};
                this.updatePromptsList(filter);
                this._updateCategoryCounts();
            } else {
                this.notify('プロンプトの保存に失敗しました', 'error');
            }
        } catch (error) {
            console.error('プロンプト保存中にエラーが発生しました:', error);
            this.notify('エラー: ' + error.message, 'error');
        }
    }
});