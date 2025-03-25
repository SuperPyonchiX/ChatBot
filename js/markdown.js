/**
 * markdown.js
 * マークダウンのレンダリングとコードハイライト関連の機能を提供します
 */

// グローバルスコープに関数を公開
window.Markdown = {
    // Markdownをレンダリングする関数
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
    
    // コードブロックにコピーボタンを追加する関数
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
            const copyButton = document.createElement('button');
            copyButton.classList.add('code-copy-button');
            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
            copyButton.title = 'コピーする';
            copyButton.setAttribute('data-code-index', index);
            wrapper.appendChild(copyButton);
            
            // コピーボタンのクリックイベント
            copyButton.addEventListener('click', () => {
                const codeText = codeBlock.textContent;
                navigator.clipboard.writeText(codeText)
                    .then(() => {
                        copyButton.classList.add('copied');
                        copyButton.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            copyButton.classList.remove('copied');
                            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('コードのコピーに失敗しました:', err);
                    });
            });
        });
    },

    // HTMLエスケープ
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

    // メッセージをフォーマット（改行やコードブロックなどを処理）
    formatMessage: function(message) {
        if (!message) return '';
        
        let formattedMessage = this.escapeHtml(message);
        
        // 改行を<br>に変換
        formattedMessage = formattedMessage.replace(/\n/g, '<br>');
        
        // コードブロックを処理
        formattedMessage = formattedMessage.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        return formattedMessage;
    },

    // 外部スクリプトを動的に読み込む関数
    loadScript: function(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    },

    // マークダウンライブラリの初期化
    initializeMarkdown: function() {
        // マークダウンのレンダリングオプション設定
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,        // 改行を認識
                gfm: true,           // GitHub Flavored Markdown
                headerIds: false,    // ヘッダーIDを無効化
                mangle: false,       // リンクを難読化しない
                sanitize: false,     // HTMLタグを許可
                highlight: function(code, lang) {
                    if (Prism && Prism.languages && Prism.languages[lang]) {
                        try {
                            return Prism.highlight(code, Prism.languages[lang], lang);
                        } catch (e) {
                            console.error('Syntax highlighting error:', e);
                            return code;
                        }
                    }
                    return code;
            }
            });
        }
    }
};