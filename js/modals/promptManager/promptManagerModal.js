/**
 * プロンプトマネージャーモーダルを管理するクラス
 * @class PromptManagerModal
 */
class PromptManagerModal {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {PromptManagerModal} PromptManagerModalのインスタンス
     */
    static get getInstance() {
        if (!PromptManagerModal.#instance) {
            PromptManagerModal.#instance = new PromptManagerModal();
        }
        return PromptManagerModal.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (PromptManagerModal.#instance) {
            throw new Error('PromptManagerModalクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
        
        // イベントリスナーの参照を保持する変数
        this._promptEditListeners = {
            save: null,
            cancel: null
        };
    }

    /**
     * プロンプトマネージャーモーダルを表示します
     */
    showPromptManagerModal() {
        console.log('プロンプトマネージャーモーダルを表示します');
        const modal = UICache.getInstance.get('promptManagerModal');
        if (!modal) {
            console.error('モーダル要素が見つかりません: promptManagerModal');
            return;
        }
        
        // モーダル表示
        modal.style.display = 'block';
        
        // カテゴリとプロンプト一覧を更新
        this.#updatePromptCategories();
        this.#updatePromptsList();
    }
    
    /**
     * プロンプトマネージャーモーダルを非表示にします
     */
    hidePromptManagerModal() {
        console.log('プロンプトマネージャーモーダルを閉じます');
        const modal = UICache.getInstance.get('promptManagerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * プロンプト編集モーダルを表示する
     * @param {Object} prompt - 編集するプロンプトデータ
     */
    showPromptEditModal(prompt) {
        const modal = UICache.getInstance.get('promptEditModal');
        if (!modal) {
            console.error('モーダル要素が見つかりません: promptEditModal');
            return;
        }

        // モーダルタイトルを設定
        const title = UICache.getInstance.get('promptEditTitle');
        if (title) {
            title.textContent = prompt ? 'プロンプト編集' : '新規プロンプト';
        }

        // フォームに値を設定
        const nameInput = UICache.getInstance.get('promptNameInput');
        const categorySelect = UICache.getInstance.get('promptCategorySelect');
        const tagsInput = UICache.getInstance.get('promptTagsInput');
        const descriptionInput = UICache.getInstance.get('promptDescriptionInput');
        const contentInput = UICache.getInstance.get('promptContentInput');

        if (prompt) {
            // 既存のプロンプトを編集する場合
            nameInput.value = prompt.name;
            tagsInput.value = prompt.tags.join(',');
            descriptionInput.value = prompt.description || '';
            contentInput.value = prompt.content;
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
        this.#updateCategorySelect(categorySelect, prompt ? prompt.category : null);

        // モーダルを表示
        modal.style.display = 'block';

        // イベントリスナーを設定
        const saveButton = UICache.getInstance.get('savePromptEdit');
        const cancelButton = UICache.getInstance.get('cancelPromptEdit');

        if (saveButton && cancelButton) {
            // 既存のイベントリスナーを削除
            if (this._promptEditListeners.save) {
                saveButton.removeEventListener('click', this._promptEditListeners.save);
            }
            if (this._promptEditListeners.cancel) {
                cancelButton.removeEventListener('click', this._promptEditListeners.cancel);
            }

            // 新しいイベントリスナーを保存
            const self = this;
            this._promptEditListeners.save = () => self.#savePromptEdit(modal);
            this._promptEditListeners.cancel = () => self.hidePromptEditModal();

            // イベントリスナーを設定
            saveButton.addEventListener('click', this._promptEditListeners.save);
            cancelButton.addEventListener('click', this._promptEditListeners.cancel);
        } else {
            console.error('保存またはキャンセルボタンが見つかりません');
        }
    }

    /**
     * プロンプト編集モーダルを非表示にする
     */
    hidePromptEditModal() {
        const modal = UICache.getInstance.get('promptEditModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * カテゴリ追加ボタンのクリックイベントを処理する
     * @private
     */
    handleAddCategory() {
        const categoryName = prompt('新しいカテゴリ名を入力してください:');
        if (!categoryName || !categoryName.trim()) return;

        try {
            const success = PromptManager.getInstance.addCategory(categoryName.trim());
            if (success) {
                UI.getInstance.Core.Notification.show('カテゴリを追加しました', 'success');
                this.#updatePromptCategories();
            } else {
                UI.getInstance.Core.Notification.show('カテゴリの追加に失敗しました', 'error');
            }
        } catch (error) {
            console.error('カテゴリ追加中にエラーが発生しました:', error);
            UI.getInstance.Core.Notification.show('エラー: ' + error.message, 'error');
        }
    }

    /**
     * プロンプトカテゴリ一覧を更新する
     */
    #updatePromptCategories() {
        console.log('カテゴリ一覧を更新します');
        const categoriesList = UICache.getInstance.get('promptCategoriesList');
        if (!categoriesList) {
            console.error('カテゴリリスト要素が見つかりません: promptCategoriesList');
            return;
        }
        
        // カテゴリリストをクリア
        categoriesList.innerHTML = '';
        
        // カテゴリを読み込む
        const categories = PromptManager.getInstance.loadCategories();
        
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
                    this.#editCategory(key, category.name);
                });
                
                const deleteButton = document.createElement('button');
                deleteButton.className = 'category-delete-button';
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.title = 'カテゴリを削除';
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.#deleteCategory(key);
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
                this.#updateCategoryCounts();
                this.#updatePromptsList({ category: key });
            });
            
            categoriesList.appendChild(categoryItem);
        });

        // 初期表示時のカウントとプロンプト一覧を更新
        this.#updateCategoryCounts();
        this.#updatePromptsList({ category: 'all' });
    }

    /**
     * プロンプト一覧を更新する
     * @param {Object} filter - フィルタリング条件
     */
    #updatePromptsList(filter = {}) {
        const promptsList = UICache.getInstance.get('promptsList');
        if (!promptsList) {
            console.error('プロンプトリスト要素が見つかりません: promptsList');
            return;
        }
        
        // プロンプトリストをクリア
        promptsList.innerHTML = '';
        
        // 検索条件でプロンプトを取得
        const prompts = PromptManager.getInstance.searchPrompts(filter);
        
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
            this.#setupPromptItemEventListeners(promptItem, prompt);
            
            promptsList.appendChild(promptItem);
        });
    }

    /**
     * プロンプト項目のイベントリスナーを設定する
     * @private
     */
    #setupPromptItemEventListeners(promptItem, prompt) {
        promptItem.querySelector('.edit-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPromptEditModal(prompt);
        });
        
        promptItem.querySelector('.use-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.#usePrompt(prompt.id);
        });
                
        promptItem.querySelector('.delete-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.#deletePrompt(prompt.id);
        });
        
        promptItem.addEventListener('click', () => {
            this.showPromptEditModal(prompt);
        });
    }
    
    /**
     * プロンプトを使用する
     * @private
     */
    #usePrompt(promptId) {
        try {
            const promptText = PromptManager.getInstance.buildPrompt(promptId);
            
            const userInput = UICache.getInstance.get('userInput');
            if (userInput) {
                userInput.value = promptText;
                UIUtils.getInstance.autoResizeTextarea(userInput);
            }
            
            this.hidePromptManagerModal();
            UI.getInstance.Core.Notification.show('プロンプトをセットしました', 'success');
        } catch (error) {
            console.error('プロンプト使用中にエラーが発生しました:', error);
            UI.getInstance.Core.Notification.show('プロンプトの使用に失敗しました', 'error');
        }
    }
    
    /**
     * カテゴリごとのプロンプト数を更新する
     * @private
     */
    #updateCategoryCounts() {
        const categories = document.querySelectorAll('.category-item');
        if (!categories.length) return;
        
        const prompts = PromptManager.getInstance.loadPromptLibrary();
        
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
    }

    /**
     * プロンプトを削除する
     * @private
     */
    #deletePrompt(promptId) {
        if (confirm('このプロンプトを削除してもよろしいですか？')) {
            try {
                const result = PromptManager.getInstance.deletePrompt(promptId);
                if (result) {
                    UI.getInstance.Core.Notification.show('プロンプトを削除しました', 'success');
                    
                    const activeCategory = document.querySelector('.category-item.active');
                    const filter = {};
                    if (activeCategory) {
                        filter.category = activeCategory.dataset.category;
                    }
                    
                    this.#updatePromptsList(filter);
                    this.#updateCategoryCounts();
                } else {
                    UI.getInstance.Core.Notification.show('プロンプトの削除に失敗しました', 'error');
                }
            } catch (error) {
                console.error('プロンプト削除中にエラーが発生しました:', error);
                UI.getInstance.Core.Notification.show('エラー: ' + error.message, 'error');
            }
        }
    }

    /**
     * カテゴリを編集する
     * @private
     */
    #editCategory(categoryKey, currentName) {
        const newName = prompt('新しいカテゴリ名を入力してください:', currentName);
        
        if (newName && newName.trim() && newName !== currentName) {
            try {
                const success = PromptManager.getInstance.updateCategory(categoryKey, {
                    name: newName.trim()
                });
                
                if (success) {
                    UI.getInstance.Core.Notification.show('カテゴリ名を更新しました', 'success');
                    this.#updatePromptCategories();
                } else {
                    UI.getInstance.Core.Notification.show('カテゴリの更新に失敗しました', 'error');
                }
            } catch (error) {
                console.error('カテゴリ更新中にエラーが発生しました:', error);
                UI.getInstance.Core.Notification.show('エラー: ' + error.message, 'error');
            }
        }
    }

    /**
     * カテゴリを削除する
     * @private
     */
    #deleteCategory(categoryKey) {
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
                    const success = PromptManager.getInstance.deleteCategory(categoryKey);
                    
                    if (success) {
                        UI.getInstance.Core.Notification.show('カテゴリを削除しました', 'success');
                        this.#updatePromptCategories();
                    } else {
                        UI.getInstance.Core.Notification.show('カテゴリの削除に失敗しました', 'error');
                    }
                } catch (error) {
                    console.error('カテゴリ削除中にエラーが発生しました:', error);
                    UI.getInstance.Core.Notification.show('エラー: ' + error.message, 'error');
                }
            }
        });
    }

    /**
     * カテゴリ選択肢を更新する
     * @private
     */
    #updateCategorySelect(select, currentCategory) {
        if (!select) return;

        // 選択肢をクリア
        select.innerHTML = '';

        // カテゴリ一覧を取得
        const categories = PromptManager.getInstance.loadCategories();
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
    }

    /**
     * プロンプトを保存する
     * @private
     */
    #savePromptEdit(modal) {
        const nameInput = UICache.getInstance.get('promptNameInput');
        const categorySelect = UICache.getInstance.get('promptCategorySelect');
        const tagsInput = UICache.getInstance.get('promptTagsInput');
        const descriptionInput = UICache.getInstance.get('promptDescriptionInput');
        const contentInput = UICache.getInstance.get('promptContentInput');

        // 入力値を取得
        const name = nameInput.value.trim();
        const category = categorySelect.value;
        const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
        const description = descriptionInput.value.trim();
        const content = contentInput.value.trim();

        // バリデーション
        if (!name || !content) {
                UI.getInstance.Core.Notification.show('名前とプロンプト内容は必須です', 'error');
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
                success = PromptManager.getInstance.updatePrompt(promptId, promptData);
            } else {
                // 新規プロンプトの追加
                success = PromptManager.getInstance.addPrompt(promptData);
            }

            if (success) {
                UI.getInstance.Core.Notification.show(promptId ? 'プロンプトを更新しました' : 'プロンプトを作成しました', 'success');
                this.hidePromptEditModal();
                
                // プロンプトリストを更新
                const activeCategory = document.querySelector('.category-item.active');
                const filter = activeCategory ? { category: activeCategory.dataset.category } : {};
                this.#updatePromptsList(filter);
                this.#updateCategoryCounts();
            } else {
                UI.getInstance.Core.Notification.show('プロンプトの保存に失敗しました', 'error');
            }
        } catch (error) {
            console.error('プロンプト保存中にエラーが発生しました:', error);
            UI.getInstance.Core.Notification.show('エラー: ' + error.message, 'error');
        }
    }
}
