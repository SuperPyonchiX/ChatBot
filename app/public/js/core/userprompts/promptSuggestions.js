/**
 * プロンプト候補表示機能
 * ユーザー入力時にプロンプト候補を表示し、選択できるようにします
 */
class PromptSuggestions {
    static #instance = null;

    /**
     * プライベートフィールド
     */
    #selectedIndex = -1;
    #suggestions = [];
    #inputElement = null;
    #suggestionsElement = null;

    // 定数
    static TRIGGER_CHAR = '/';
    static MIN_CHARS_FOR_SUGGESTION = 1;
    static MAX_SUGGESTIONS = 7;

    constructor() {
        if (PromptSuggestions.#instance) {
            return PromptSuggestions.#instance;
        }
        PromptSuggestions.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!PromptSuggestions.#instance) {
            PromptSuggestions.#instance = new PromptSuggestions();
        }
        return PromptSuggestions.#instance;
    }

    /**
     * 候補表示を初期化します
     */
    init() {
        const inputElement = UICache.getInstance.get('userInput');
        const suggestionsElement = document.getElementById('promptSuggestions');
        if (!inputElement || !suggestionsElement) return;

        this.#inputElement = inputElement;
        this.#suggestionsElement = suggestionsElement;

        // 入力イベント
        this.#inputElement.addEventListener('input', this.#handleInput.bind(this));

        // キーボードイベント
        this.#inputElement.addEventListener('keydown', this.#handleKeyDown.bind(this));

        // フォーカスを得たときに候補を表示
        this.#inputElement.addEventListener('focus', () => {
            if (!this.#inputElement.value.trim()) {
                // 入力がない状態でフォーカスを得たら全候補を表示
                this.#showSuggestionsForQuery('');
            } else {
                // 入力がある場合は通常の入力処理を実行
                this.#handleInput();
            }
        });

        // フォーカスを失ったときに候補を非表示
        this.#inputElement.addEventListener('blur', () => {
            setTimeout(() => this.#hideSuggestions(), 100);
        });

        // クリックイベント（イベント委任）
        this.#suggestionsElement.addEventListener('click', this.#handleSuggestionClick.bind(this));
    }

    /**
     * 入力イベントを処理します

     */
    #handleInput() {
        const value = this.#inputElement.value.trim();
        const cursorPos = this.#inputElement.selectionStart;

        // 空入力の場合は全候補を表示
        if (!value) {
            this.#showSuggestionsForQuery('');
            return;
        }

        // カーソル位置より前のテキストを取得
        const textBeforeCursor = value.substring(0, cursorPos);

        // スラッシュから始まる入力の処理（従来の機能）
        const matchSlash = textBeforeCursor.match(/\/([^/\s]*)$/);
        if (matchSlash) {
            this.#showSuggestionsForQuery(matchSlash[1]);
            return;
        }

        // カーソル位置までの最後の単語を取得
        const lastWordMatch = textBeforeCursor.match(/(\S+)$/);
        const lastWord = lastWordMatch ? lastWordMatch[1] : '';

        // 最後の単語が最小文字数以上なら候補表示
        if (lastWord.length >= PromptSuggestions.MIN_CHARS_FOR_SUGGESTION) {
            this.#showSuggestionsForQuery(lastWord);
        } else {
            // それ以外の場合は通常の入力候補を表示
            this.#showSuggestionsForQuery(value);
        }
    }

    /**
     * キーボードイベントを処理します
     * @param {KeyboardEvent} e - キーボードイベント
     */
    #handleKeyDown(e) {
        // 候補が表示されていない場合は通常の動作
        if (!this.#suggestionsElement.classList.contains('show')) return;

        switch(e.key) {
            case 'ArrowDown':
                // 下キー: 次の候補を選択
                e.preventDefault();
                this.#selectNextSuggestion();
                break;

            case 'ArrowUp':
                // 上キー: 前の候補を選択
                e.preventDefault();
                this.#selectPrevSuggestion();
                break;

            case 'Enter':
                // Enterキーでは候補を適用しない（通常の改行動作を維持）
                break;

            case 'Escape':
                // Escキー: 候補を閉じる
                e.preventDefault();
                this.#hideSuggestions();
                break;

            case 'Tab':
                // Tabキー: 選択中の候補を適用
                if (this.#selectedIndex >= 0) {
                    e.preventDefault();
                    this.#applySuggestion(this.#suggestions[this.#selectedIndex]);
                }
                break;
        }
    }

    /**
     * 候補クリックイベントを処理します
     * @param {MouseEvent} e - マウスイベント
     */
    #handleSuggestionClick(e) {
        const item = /** @type {HTMLElement} */ (e.target).closest('.prompt-suggestion-item');
        if (!item) return;

        const index = parseInt(item.dataset.index, 10);
        if (isNaN(index) || index < 0 || index >= this.#suggestions.length) return;

        this.#applySuggestion(this.#suggestions[index]);
    }

    /**
     * 候補を表示します
     * @param {string} query - 検索クエリ
     */
    #showSuggestionsForQuery(query) {
        // プロンプトライブラリから候補を検索
        let suggestions = this.#searchPrompts(query);
        this.#suggestions = suggestions.slice(0, PromptSuggestions.MAX_SUGGESTIONS);

        if (this.#suggestions.length === 0) {
            this.#hideSuggestions();
            return;
        }

        // 候補リストをクリア
        this.#suggestionsElement.innerHTML = '';

        // 候補を表示
        this.#suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'prompt-suggestion-item';
            item.dataset.index = String(index);

            // お気に入りアイコン
            const favoriteIcon = suggestion.isFavorite ?
                '<i class="fas fa-star favorite-icon"></i>' : '';

            // 使用回数バッジ（0回以上の場合のみ表示）
            const useCountBadge = suggestion.useCount > 0 ?
                `<span class="use-count-badge">${suggestion.useCount}</span>` : '';

            item.innerHTML = `
                <div class="prompt-suggestion-name">${favoriteIcon}${suggestion.name}${useCountBadge}</div>
                <div class="prompt-suggestion-description">${suggestion.description || ''}</div>
            `;

            this.#suggestionsElement.appendChild(item);
        });

        // 候補を表示
        this.#suggestionsElement.classList.add('show');

        // 最初の候補を選択
        this.#selectedIndex = -1;
        this.#selectNextSuggestion();
    }

    /**
     * 候補を非表示にします
     */
    #hideSuggestions() {
        this.#suggestionsElement.classList.remove('show');
        this.#selectedIndex = -1;
        this.#suggestions = [];
    }

    /**
     * 次の候補を選択します
     */
    #selectNextSuggestion() {
        if (this.#suggestions.length === 0) return;

        // 全ての候補から選択クラスを削除
        const items = this.#suggestionsElement.querySelectorAll('.prompt-suggestion-item');
        items.forEach(item => item.classList.remove('selected'));

        // 次の候補を選択
        this.#selectedIndex = (this.#selectedIndex + 1) % this.#suggestions.length;

        // 選択された候補にクラスを追加
        items[this.#selectedIndex].classList.add('selected');

        // スクロール位置を調整
        this.#scrollToSelectedSuggestion();
    }

    /**
     * 前の候補を選択します
     */
    #selectPrevSuggestion() {
        if (this.#suggestions.length === 0) return;

        // 全ての候補から選択クラスを削除
        const items = this.#suggestionsElement.querySelectorAll('.prompt-suggestion-item');
        items.forEach(item => item.classList.remove('selected'));

        // 前の候補を選択
        this.#selectedIndex = (this.#selectedIndex - 1 + this.#suggestions.length) % this.#suggestions.length;

        // 選択された候補にクラスを追加
        items[this.#selectedIndex].classList.add('selected');

        // スクロール位置を調整
        this.#scrollToSelectedSuggestion();
    }

    /**
     * 選択された候補が見えるようにスクロールします
     */
    #scrollToSelectedSuggestion() {
        const selectedItem = this.#suggestionsElement.querySelector('.prompt-suggestion-item.selected');
        if (!selectedItem) return;

        const containerRect = this.#suggestionsElement.getBoundingClientRect();
        const selectedRect = selectedItem.getBoundingClientRect();

        if (selectedRect.top < containerRect.top) {
            // 選択項目が上に隠れている場合
            this.#suggestionsElement.scrollTop -= (containerRect.top - selectedRect.top);
        } else if (selectedRect.bottom > containerRect.bottom) {
            // 選択項目が下に隠れている場合
            this.#suggestionsElement.scrollTop += (selectedRect.bottom - containerRect.bottom);
        }
    }

    /**
     * 選択された候補を適用します
     * @param {Object} suggestion - 適用する候補
     */
    #applySuggestion(suggestion) {
        if (!suggestion) return;

        // 使用回数をインクリメント
        PromptManager.getInstance.incrementUseCount(suggestion.id);

        const value = this.#inputElement.value;
        const cursorPos = this.#inputElement.selectionStart;

        // カーソル位置より前のテキストを取得
        const textBeforeCursor = value.substring(0, cursorPos);

        // スラッシュから始まる場合の処理（従来の挙動）
        const matchSlash = textBeforeCursor.match(/\/([^/\s]*)$/);
        if (matchSlash) {
            // スラッシュから始まる部分を置き換え
            const startPos = cursorPos - matchSlash[0].length;
            const newText = suggestion.content || suggestion.name;

            // テキストエリアの内容を更新
            this.#inputElement.value =
                value.substring(0, startPos) +
                newText +
                value.substring(cursorPos);

            // カーソル位置を更新
            const newCursorPos = startPos + newText.length;
            this.#inputElement.setSelectionRange(newCursorPos, newCursorPos);
        } else {
            // 通常の入力の場合は、入力内容を候補内容で置き換え
            const lastWordMatch = textBeforeCursor.match(/(\S+)$/);

            if (lastWordMatch) {
                // 最後の単語を候補で置き換え
                const startPos = cursorPos - lastWordMatch[0].length;
                const newText = suggestion.content || suggestion.name;

                // テキストエリアの内容を更新
                this.#inputElement.value =
                    value.substring(0, startPos) +
                    newText +
                    value.substring(cursorPos);

                // カーソル位置を更新
                const newCursorPos = startPos + newText.length;
                this.#inputElement.setSelectionRange(newCursorPos, newCursorPos);
            } else {
                // 単語区切りがない場合は、入力内容全体を置き換える
                const newText = suggestion.content || suggestion.name;
                this.#inputElement.value = newText + value.substring(cursorPos);

                // カーソル位置を更新
                const newCursorPos = newText.length;
                this.#inputElement.setSelectionRange(newCursorPos, newCursorPos);
            }
        }

        // テキストエリアのサイズを自動調整
        if (UI.getInstance && UIUtils.getInstance.autoResizeTextarea) {
            UIUtils.getInstance.autoResizeTextarea(this.#inputElement);
        }

        // 候補を非表示
        this.#hideSuggestions();
    }

    /**
     * プロンプトライブラリから候補を検索します
     * @param {string} query - 検索クエリ
     * @returns {Array} 候補の配列
     */
    #searchPrompts(query) {
        // PromptManagerからソートされたプロンプトを取得
        // お気に入り優先、次に使用回数順
        let prompts = PromptManager.getInstance.getPromptsSorted('mostUsed');

        // クエリがない場合は全てのプロンプトを表示
        if (!query) return prompts.slice(0, PromptSuggestions.MAX_SUGGESTIONS);

        // 検索文字列を小文字に変換（大文字小文字を区別しない検索のため）
        const lowerQuery = query.toLowerCase();

        // 検索条件に一致するプロンプトを取得
        return prompts.filter(prompt => {
            return (
                prompt.name.toLowerCase().includes(lowerQuery) ||
                (prompt.description && prompt.description.toLowerCase().includes(lowerQuery)) ||
                prompt.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
            );
        });
    }
}
