/**
 * markdown.js
 * マークダウンのレンダリングとコードハイライト関連の機能を提供します
 */

// グローバルスコープに関数を公開
window.Markdown = {
    /**
     * Markdownテキストをレンダリングします
     * @param {string} text - レンダリングするマークダウンテキスト
     * @returns {string} レンダリングされたHTML
     */
    renderMarkdown: function(text) {
        try {
            if (typeof marked !== 'undefined') {
                return marked.parse(text);
            } else {
                console.warn('Marked library is not loaded yet');
                return this.escapeHtml(text).replace(/\n/g, '<br>');
            }
        } catch (e) {
            console.error('Markdown rendering error:', e);
            return this.escapeHtml(text).replace(/\n/g, '<br>');
        }
    },
    
    /**
     * コードブロックにコピーボタンを追加します
     * @param {HTMLElement} messageElement - コードブロックを含むメッセージ要素
     */
    addCodeBlockCopyButtons: function(messageElement) {
        const codeBlocks = messageElement.querySelectorAll('pre code');
        codeBlocks.forEach((codeBlock, index) => {
            const pre = codeBlock.parentElement;
            
            // すでにラッパーがある場合はスキップ
            if (pre.parentNode.classList.contains('code-block')) {
                return;
            }
            
            // ラッパーでコードブロックを囲む
            const wrapper = document.createElement('div');
            wrapper.classList.add('code-block');
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            
            // コピーボタンを追加
            const copyButton = this._createCopyButton(index, codeBlock);
            wrapper.appendChild(copyButton);
        });
    },

    /**
     * コードブロック用のコピーボタンを作成します
     * @private
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @returns {HTMLElement} 作成されたコピーボタン要素
     */
    _createCopyButton: function(index, codeBlock) {
        const copyButton = document.createElement('button');
        copyButton.classList.add('code-copy-button');
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.title = 'コピーする';
        copyButton.setAttribute('data-code-index', index);
        
        // コピーボタンのクリックイベント
        copyButton.addEventListener('click', () => {
            this._handleCopyButtonClick(copyButton, codeBlock);
        });
        
        return copyButton;
    },
    
    /**
     * コピーボタンのクリックイベントを処理します
     * @private
     * @param {HTMLElement} button - クリックされたボタン
     * @param {HTMLElement} codeBlock - コピー対象のコードブロック
     */
    _handleCopyButtonClick: function(button, codeBlock) {
        const codeText = codeBlock.textContent;
        navigator.clipboard.writeText(codeText)
            .then(() => {
                this._showCopySuccess(button);
            })
            .catch(err => {
                console.error('コードのコピーに失敗しました:', err);
            });
    },
    
    /**
     * コピー成功時のボタン表示を更新します
     * @private
     * @param {HTMLElement} button - 更新するボタン
     */
    _showCopySuccess: function(button) {
        button.classList.add('copied');
        button.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = '<i class="fas fa-copy"></i>';
        }, 1500);
    },

    /**
     * 特殊文字をHTMLエスケープします
     * @param {string} text - エスケープするテキスト
     * @returns {string} エスケープされたテキスト
     */
    escapeHtml: function(text) {
        if (!text) return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    /**
     * メッセージをフォーマットします（改行やコードブロックを処理）
     * @param {string} message - フォーマットするメッセージ
     * @returns {string} フォーマットされたメッセージHTML
     */
    formatMessage: function(message) {
        if (!message) return '';
        
        let formattedMessage = this.escapeHtml(message);
        
        // 改行を<br>に変換
        formattedMessage = formattedMessage.replace(/\n/g, '<br>');
        
        // コードブロックを処理
        formattedMessage = formattedMessage.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        return formattedMessage;
    },

    /**
     * 外部スクリプトを動的に読み込みます
     * @param {string} src - スクリプトのURL
     * @returns {Promise} スクリプト読み込み後に解決するPromise
     */
    loadScript: function(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    },

    /**
     * マークダウンライブラリを初期化します
     * 構文ハイライトなどの設定を行います
     */
    initializeMarkdown: function() {
        // マークダウンが未ロードの場合は何もしない
        if (typeof marked === 'undefined') {
            console.warn('Marked library is not loaded yet. Call this method after loading the library.');
            return;
        }
        
        // マークダウンのレンダリングオプション設定
        marked.setOptions({
            breaks: true,        // 改行を認識
            gfm: true,           // GitHub Flavored Markdown
            headerIds: false,    // ヘッダーIDを無効化
            mangle: false,       // リンクを難読化しない
            sanitize: false,     // HTMLタグを許可
            highlight: this._highlightCode
        });
    },
    
    /**
     * コードブロックの構文ハイライトを行います
     * @private
     * @param {string} code - ハイライトするコード
     * @param {string} lang - 言語識別子
     * @returns {string} ハイライトされたHTML
     */
    _highlightCode: function(code, lang) {
        if (typeof Prism !== 'undefined' && Prism.languages && Prism.languages[lang]) {
            try {
                return Prism.highlight(code, Prism.languages[lang], lang);
            } catch (e) {
                console.error('Syntax highlighting error:', e);
                return code;
            }
        }
        return code;
    }
};