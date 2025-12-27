/**
 * プロンプトマネージャーモーダルを管理するクラス
 * @class PromptManagerModal
 */
class PromptManagerModal {
    static #instance = null;

    // 現在のソート・フィルター状態
    #currentSortBy = 'recent';
    #currentFavoriteOnly = false;
    #currentSearchText = '';

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

        // 状態をリセット
        this.#currentSortBy = 'recent';
        this.#currentFavoriteOnly = false;
        this.#currentSearchText = '';

        // UIを初期状態に設定
        const sortSelect = document.getElementById('promptSortSelect');
        if (sortSelect) sortSelect.value = 'recent';

        const showAllBtn = document.getElementById('showAllPrompts');
        const showFavoritesBtn = document.getElementById('showFavorites');
        if (showAllBtn) showAllBtn.classList.add('active');
        if (showFavoritesBtn) showFavoritesBtn.classList.remove('active');

        const searchInput = UICache.getInstance.get('promptSearchInput');
        if (searchInput) searchInput.value = '';

        // プロンプト一覧を更新
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
     * ソート変更を処理する
     * @param {string} sortBy - ソート方法
     */
    handleSortChange(sortBy) {
        this.#currentSortBy = sortBy;
        this.#updatePromptsList();
    }

    /**
     * フィルター変更を処理する（すべて/お気に入り）
     * @param {boolean} favoriteOnly - お気に入りのみ表示するか
     */
    handleFilterChange(favoriteOnly) {
        this.#currentFavoriteOnly = favoriteOnly;

        // ボタンのアクティブ状態を更新
        const showAllBtn = document.getElementById('showAllPrompts');
        const showFavoritesBtn = document.getElementById('showFavorites');

        if (favoriteOnly) {
            showAllBtn?.classList.remove('active');
            showFavoritesBtn?.classList.add('active');
        } else {
            showAllBtn?.classList.add('active');
            showFavoritesBtn?.classList.remove('active');
        }

        this.#updatePromptsList();
    }

    /**
     * 検索テキスト変更を処理する
     * @param {string} searchText - 検索テキスト
     */
    handleSearchChange(searchText) {
        this.#currentSearchText = searchText;
        this.#updatePromptsList();
    }

    /**
     * プロンプト一覧を更新する
     */
    #updatePromptsList() {
        const promptsList = UICache.getInstance.get('promptsList');
        if (!promptsList) {
            console.error('プロンプトリスト要素が見つかりません: promptsList');
            return;
        }

        // プロンプトリストをクリア
        promptsList.innerHTML = '';

        // ソートされたプロンプトを取得
        let prompts = PromptManager.getInstance.getPromptsSorted(this.#currentSortBy);

        // お気に入りフィルター
        if (this.#currentFavoriteOnly) {
            prompts = prompts.filter(p => p.isFavorite);
        }

        // テキスト検索
        if (this.#currentSearchText) {
            const searchText = this.#currentSearchText.toLowerCase();
            prompts = prompts.filter(prompt => {
                const matchesName = prompt.name.toLowerCase().includes(searchText);
                const matchesDescription = prompt.description?.toLowerCase().includes(searchText);
                const matchesContent = prompt.content.toLowerCase().includes(searchText);
                const matchesTags = prompt.tags?.some(tag => tag.toLowerCase().includes(searchText));
                return matchesName || matchesDescription || matchesContent || matchesTags;
            });
        }

        if (prompts.length === 0) {
            promptsList.innerHTML = '<div class="no-prompts-message">プロンプトが見つかりません</div>';
            return;
        }

        // プロンプトごとにリスト項目を作成
        prompts.forEach(prompt => {
            const promptItem = this.#createPromptItem(prompt);
            promptsList.appendChild(promptItem);
        });
    }

    /**
     * プロンプト項目のDOM要素を作成する
     * @param {Object} prompt - プロンプトデータ
     * @returns {HTMLElement} プロンプト項目要素
     */
    #createPromptItem(prompt) {
        const promptItem = document.createElement('div');
        promptItem.className = 'prompt-item';
        promptItem.dataset.promptId = prompt.id;

        const favoriteClass = prompt.isFavorite ? 'active' : '';
        const useCountText = prompt.useCount > 0 ? `使用: ${prompt.useCount}回` : '未使用';

        promptItem.innerHTML = `
            <div class="prompt-item-header">
                <span class="prompt-item-name">${prompt.name}</span>
                <div class="prompt-item-stats">
                    <span class="prompt-use-count">${useCountText}</span>
                </div>
                <div class="prompt-item-actions">
                    <button class="favorite-prompt-button ${favoriteClass}" title="お気に入り">
                        <i class="fas fa-star"></i>
                    </button>
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

        return promptItem;
    }

    /**
     * プロンプト項目のイベントリスナーを設定する
     */
    #setupPromptItemEventListeners(promptItem, prompt) {
        // お気に入りボタン
        promptItem.querySelector('.favorite-prompt-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.#toggleFavorite(prompt.id);
        });

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
     * お気に入りをトグルする
     * @param {string} promptId - プロンプトID
     */
    #toggleFavorite(promptId) {
        const success = PromptManager.getInstance.toggleFavorite(promptId);
        if (success) {
            this.#updatePromptsList();
        }
    }

    /**
     * プロンプトを使用する
     */
    #usePrompt(promptId) {
        try {
            const promptContent = PromptManager.getInstance.getPromptContent(promptId);

            if (!promptContent) {
                UI.getInstance.Core.Notification.show('プロンプトが見つかりません', 'error');
                return;
            }

            const userInput = UICache.getInstance.get('userInput');
            if (userInput) {
                userInput.value = promptContent;
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
     * プロンプトを削除する
     */
    #deletePrompt(promptId) {
        if (confirm('このプロンプトを削除してもよろしいですか？')) {
            try {
                const result = PromptManager.getInstance.deletePrompt(promptId);
                if (result) {
                    UI.getInstance.Core.Notification.show('プロンプトを削除しました', 'success');
                    this.#updatePromptsList();
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
     * プロンプトを保存する
     */
    #savePromptEdit(modal) {
        const nameInput = UICache.getInstance.get('promptNameInput');
        const tagsInput = UICache.getInstance.get('promptTagsInput');
        const descriptionInput = UICache.getInstance.get('promptDescriptionInput');
        const contentInput = UICache.getInstance.get('promptContentInput');

        // 入力値を取得
        const name = nameInput.value.trim();
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
                this.#updatePromptsList();
            } else {
                UI.getInstance.Core.Notification.show('プロンプトの保存に失敗しました', 'error');
            }
        } catch (error) {
            console.error('プロンプト保存中にエラーが発生しました:', error);
            UI.getInstance.Core.Notification.show('エラー: ' + error.message, 'error');
        }
    }
}
