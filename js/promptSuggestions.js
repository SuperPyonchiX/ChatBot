/**
 * プロンプト候補表示機能
 * ユーザー入力時にプロンプト候補を表示し、選択できるようにします
 * 
 * @namespace PromptSuggestions
 */
window.PromptSuggestions = {
    /**
     * 現在選択されている候補のインデックス
     * @type {number}
     * @private
     */
    _selectedIndex: -1,

    /**
     * 表示中の候補リスト
     * @type {Array}
     * @private
     */
    _suggestions: [],

    /**
     * 候補表示をトリガーする文字（廃止予定: 常に候補を表示するため）
     * @type {string}
     * @constant
     */
    TRIGGER_CHAR: '/',

    /**
     * 候補が表示されるまでの最小文字数
     * @type {number}
     * @constant
     */
    MIN_CHARS_FOR_SUGGESTION: 1,

    /**
     * 最大表示候補数
     * @type {number}
     * @constant
     */
    MAX_SUGGESTIONS: 7,

    /**
     * 候補表示を初期化します
     * @function init
     * @param {HTMLTextAreaElement} inputElement - チャット入力要素
     * @param {HTMLElement} suggestionsElement - 候補表示要素
     */
    init(inputElement, suggestionsElement) {
        if (!inputElement || !suggestionsElement) return;
        
        this.inputElement = inputElement;
        this.suggestionsElement = suggestionsElement;
        
        // 入力イベント
        this.inputElement.addEventListener('input', this._handleInput.bind(this));
        
        // キーボードイベント
        this.inputElement.addEventListener('keydown', this._handleKeyDown.bind(this));
        
        // フォーカスを得たときに候補を表示
        this.inputElement.addEventListener('focus', () => {
            if (!this.inputElement.value.trim()) {
                // 入力がない状態でフォーカスを得たら全候補を表示
                this._showSuggestionsForQuery('');
            } else {
                // 入力がある場合は通常の入力処理を実行
                this._handleInput();
            }
        });
        
        // フォーカスを失ったときに候補を非表示
        this.inputElement.addEventListener('blur', () => {
            setTimeout(() => this.hideSuggestions(), 100);
        });
        
        // クリックイベント（イベント委任）
        this.suggestionsElement.addEventListener('click', this._handleSuggestionClick.bind(this));
        
        console.log('プロンプト候補表示機能を初期化しました');
    },
    
    /**
     * 入力イベントを処理します
     * @function _handleInput
     * @param {Event} e - 入力イベント（省略可能）
     * @private
     */
    _handleInput(e) {
        const value = this.inputElement.value.trim();
        const cursorPos = this.inputElement.selectionStart;
        
        // 空入力の場合は全候補を表示
        if (!value) {
            this._showSuggestionsForQuery('');
            return;
        }
        
        // カーソル位置より前のテキストを取得
        const textBeforeCursor = value.substring(0, cursorPos);
        
        // スラッシュから始まる入力の処理（従来の機能）
        const matchSlash = textBeforeCursor.match(/\/([^/\s]*)$/);
        if (matchSlash) {
            this._showSuggestionsForQuery(matchSlash[1]);
            return;
        }
        
        // カーソル位置までの最後の単語を取得
        const lastWordMatch = textBeforeCursor.match(/(\S+)$/);
        const lastWord = lastWordMatch ? lastWordMatch[1] : '';
        
        // 最後の単語が最小文字数以上なら候補表示
        if (lastWord.length >= this.MIN_CHARS_FOR_SUGGESTION) {
            this._showSuggestionsForQuery(lastWord);
        } else {
            // それ以外の場合は通常の入力候補を表示
            this._showSuggestionsForQuery(value);
        }
    },
    
    /**
     * キーボードイベントを処理します
     * @function _handleKeyDown
     * @param {KeyboardEvent} e - キーボードイベント
     * @private
     */
    _handleKeyDown(e) {
        // 候補が表示されていない場合は通常の動作
        if (!this.suggestionsElement.classList.contains('show')) return;
        
        switch(e.key) {
            case 'ArrowDown':
                // 下キー: 次の候補を選択
                e.preventDefault();
                this._selectNextSuggestion();
                break;
                
            case 'ArrowUp':
                // 上キー: 前の候補を選択
                e.preventDefault();
                this._selectPrevSuggestion();
                break;
                
            case 'Enter':
                // Enterキー: 選択中の候補を適用
                if (this._selectedIndex >= 0) {
                    e.preventDefault();
                    this._applySuggestion(this._suggestions[this._selectedIndex]);
                }
                break;
                
            case 'Escape':
                // Escキー: 候補を閉じる
                e.preventDefault();
                this.hideSuggestions();
                break;
                
            case 'Tab':
                // Tabキー: 選択中の候補を適用
                if (this._selectedIndex >= 0) {
                    e.preventDefault();
                    this._applySuggestion(this._suggestions[this._selectedIndex]);
                }
                break;
        }
    },
    
    /**
     * 候補クリックイベントを処理します
     * @function _handleSuggestionClick
     * @param {MouseEvent} e - マウスイベント
     * @private
     */
    _handleSuggestionClick(e) {
        const item = e.target.closest('.prompt-suggestion-item');
        if (!item) return;
        
        const index = parseInt(item.dataset.index, 10);
        if (isNaN(index) || index < 0 || index >= this._suggestions.length) return;
        
        this._applySuggestion(this._suggestions[index]);
    },
    
    /**
     * 候補を表示します
     * @function _showSuggestionsForQuery
     * @param {string} query - 検索クエリ
     * @private
     */
    _showSuggestionsForQuery(query) {
        // プロンプトライブラリから候補を検索
        let suggestions = this._searchPrompts(query);
        this._suggestions = suggestions.slice(0, this.MAX_SUGGESTIONS); // 最大表示数を制限
        
        if (this._suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        // 候補リストをクリア
        this.suggestionsElement.innerHTML = '';
        
        // 候補を表示
        this._suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'prompt-suggestion-item';
            item.dataset.index = index;
            
            const categoryName = this._getCategoryName(suggestion.category);
            const categoryLabel = categoryName ? 
                `<span class="prompt-category-label">${categoryName}</span>` : '';
            
            item.innerHTML = `
                <div class="prompt-suggestion-name">${categoryLabel}${suggestion.name}</div>
                <div class="prompt-suggestion-description">${suggestion.description || ''}</div>
            `;
            
            this.suggestionsElement.appendChild(item);
        });
        
        // 候補を表示
        this.suggestionsElement.classList.add('show');
        
        // 最初の候補を選択
        this._selectedIndex = -1;
        this._selectNextSuggestion();
    },
    
    /**
     * 候補を非表示にします
     * @function hideSuggestions
     */
    hideSuggestions() {
        this.suggestionsElement.classList.remove('show');
        this._selectedIndex = -1;
        this._suggestions = [];
    },
    
    /**
     * 次の候補を選択します
     * @function _selectNextSuggestion
     * @private
     */
    _selectNextSuggestion() {
        if (this._suggestions.length === 0) return;
        
        // 全ての候補から選択クラスを削除
        const items = this.suggestionsElement.querySelectorAll('.prompt-suggestion-item');
        items.forEach(item => item.classList.remove('selected'));
        
        // 次の候補を選択
        this._selectedIndex = (this._selectedIndex + 1) % this._suggestions.length;
        
        // 選択された候補にクラスを追加
        items[this._selectedIndex].classList.add('selected');
        
        // スクロール位置を調整
        this._scrollToSelectedSuggestion();
    },
    
    /**
     * 前の候補を選択します
     * @function _selectPrevSuggestion
     * @private
     */
    _selectPrevSuggestion() {
        if (this._suggestions.length === 0) return;
        
        // 全ての候補から選択クラスを削除
        const items = this.suggestionsElement.querySelectorAll('.prompt-suggestion-item');
        items.forEach(item => item.classList.remove('selected'));
        
        // 前の候補を選択
        this._selectedIndex = (this._selectedIndex - 1 + this._suggestions.length) % this._suggestions.length;
        
        // 選択された候補にクラスを追加
        items[this._selectedIndex].classList.add('selected');
        
        // スクロール位置を調整
        this._scrollToSelectedSuggestion();
    },
    
    /**
     * 選択された候補が見えるようにスクロールします
     * @function _scrollToSelectedSuggestion
     * @private
     */
    _scrollToSelectedSuggestion() {
        const selectedItem = this.suggestionsElement.querySelector('.prompt-suggestion-item.selected');
        if (!selectedItem) return;
        
        const containerRect = this.suggestionsElement.getBoundingClientRect();
        const selectedRect = selectedItem.getBoundingClientRect();
        
        if (selectedRect.top < containerRect.top) {
            // 選択項目が上に隠れている場合
            this.suggestionsElement.scrollTop -= (containerRect.top - selectedRect.top);
        } else if (selectedRect.bottom > containerRect.bottom) {
            // 選択項目が下に隠れている場合
            this.suggestionsElement.scrollTop += (selectedRect.bottom - containerRect.bottom);
        }
    },
    
    /**
     * 選択された候補を適用します
     * @function _applySuggestion
     * @param {Object} suggestion - 適用する候補
     * @private
     */
    _applySuggestion(suggestion) {
        if (!suggestion) return;
        
        const value = this.inputElement.value;
        const cursorPos = this.inputElement.selectionStart;
        
        // カーソル位置より前のテキストを取得
        const textBeforeCursor = value.substring(0, cursorPos);
        
        // スラッシュから始まる場合の処理（従来の挙動）
        const matchSlash = textBeforeCursor.match(/\/([^/\s]*)$/);
        if (matchSlash) {
            // スラッシュから始まる部分を置き換え
            const startPos = cursorPos - matchSlash[0].length;
            const newText = suggestion.content || suggestion.name;
            
            // テキストエリアの内容を更新
            this.inputElement.value = 
                value.substring(0, startPos) + 
                newText + 
                value.substring(cursorPos);
            
            // カーソル位置を更新
            const newCursorPos = startPos + newText.length;
            this.inputElement.setSelectionRange(newCursorPos, newCursorPos);
        } else {
            // 通常の入力の場合は、入力内容を候補内容で置き換え
            const lastWordMatch = textBeforeCursor.match(/(\S+)$/);
            
            if (lastWordMatch) {
                // 最後の単語を候補で置き換え
                const startPos = cursorPos - lastWordMatch[0].length;
                const newText = suggestion.content || suggestion.name;
                
                // テキストエリアの内容を更新
                this.inputElement.value = 
                    value.substring(0, startPos) + 
                    newText + 
                    value.substring(cursorPos);
                
                // カーソル位置を更新
                const newCursorPos = startPos + newText.length;
                this.inputElement.setSelectionRange(newCursorPos, newCursorPos);
            } else {
                // 単語区切りがない場合は、入力内容全体を置き換える
                const newText = suggestion.content || suggestion.name;
                this.inputElement.value = newText + value.substring(cursorPos);
                
                // カーソル位置を更新
                const newCursorPos = newText.length;
                this.inputElement.setSelectionRange(newCursorPos, newCursorPos);
            }
        }
        
        // テキストエリアのサイズを自動調整
        if (window.UI && window.UI.autoResizeTextarea) {
            window.UI.autoResizeTextarea(this.inputElement);
        }
        
        // 候補を非表示
        this.hideSuggestions();
    },
    
    /**
     * プロンプトライブラリから候補を検索します
     * @function _searchPrompts
     * @param {string} query - 検索クエリ
     * @returns {Array} 候補の配列
     * @private
     */
    _searchPrompts(query) {
        // PromptManagerからプロンプトを検索
        const prompts = window.PromptManager ? window.PromptManager.loadPromptLibrary() : [];
        
        // クエリがない場合は全てのプロンプトを表示
        if (!query) return prompts.slice(0, this.MAX_SUGGESTIONS);
        
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
    },
    
    /**
     * カテゴリIDから表示名を取得します
     * @function _getCategoryName
     * @param {string} categoryId - カテゴリID
     * @returns {string} カテゴリ表示名
     * @private
     */
    _getCategoryName(categoryId) {
        if (!categoryId) return '';
        
        // カテゴリ情報を取得
        const categories = window.PromptManager ? window.PromptManager.loadCategories() : {};
        
        // カテゴリIDから名前を取得
        const category = categories[categoryId];
        return category ? category.name : categoryId;
    }
};