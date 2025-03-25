/**
 * markdown.js
 * マークダウンのレンダリングとコードハイライト関連の機能を提供します
 */

// グローバルスコープに関数を公開
window.Markdown = {
    // マークダウンライブラリの初期化
    initializeMarkdown: function() {
        if (typeof marked !== 'undefined') {
            console.log('Marked.js初期化開始');
            
            // marked.jsのレンダラーをカスタマイズ
            const renderer = new marked.Renderer();
            
            // コードブロックのレンダリング処理をカスタマイズ
            renderer.code = (code, lang, escaped) => {
                console.log('コードブロックのレンダリング:', { 言語: lang });
                
                // 言語名を小文字に変換
                let normalizedLang = lang ? lang.toLowerCase() : '';
                
                // シンタックスハイライトの適用
                let highlightedCode = code;
                if (normalizedLang && Prism.languages[normalizedLang]) {
                    try {
                        highlightedCode = Prism.highlight(code, Prism.languages[normalizedLang], normalizedLang);
                    } catch (e) {
                        console.error('シンタックスハイライト適用エラー:', e);
                    }
                }
                
                // コードブロックのHTML生成
                return `<pre class="language-${normalizedLang}"><code class="language-${normalizedLang}">${highlightedCode}</code></pre>`;
            };
            
            // marked.jsの設定を適用
            marked.setOptions({
                renderer: renderer,
                langPrefix: 'language-',
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false,
                sanitize: false
            });
            
            console.log('Marked.js初期化完了');
        }
    },
    
    // シンタックスハイライト適用関数
    highlight: function(code, lang) {
        if (!Prism || !lang || !Prism.languages[lang]) {
            return Prism.util.encode(code);
        }
        
        try {
            return Prism.highlight(code, Prism.languages[lang], lang);
        } catch (e) {
            console.error('ハイライト処理エラー:', e);
            return Prism.util.encode(code);
        }
    },

    // マークダウンをレンダリングする関数
    renderMarkdown: function(text) {
        try {
            if (typeof marked === 'undefined') {
                console.warn('Marked.jsが読み込まれていません');
                return this.escapeHtml(text).replace(/\n/g, '<br>');
            }
            
            // コードブロックの言語指定を抽出してログ出力
            const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
            let match;
            while ((match = codeBlockRegex.exec(text)) !== null) {
                console.log('コードブロック検出:', {
                    言語: match[1] || 'なし',
                    コードの一部: match[2].slice(0, 50) + '...'
                });
            }
            
            const result = marked.parse(text);
            return result;
        } catch (e) {
            console.error('Markdownレンダリングエラー:', e);
            return this.escapeHtml(text).replace(/\n/g, '<br>');
        }
    },
    
    // コードブロックにコピーボタンを追加する関数
    addCodeBlockCopyButtons: function(messageElement) {
        const codeBlocks = messageElement.querySelectorAll('pre code');
        console.log('コードブロック数:', codeBlocks.length);
        
        codeBlocks.forEach((codeBlock, index) => {
            console.log(`コードブロック${index + 1}のクラス:`, codeBlock.className);
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

    // 不明な言語でもコードブロックを適切に処理
    ensurePrismLanguages: function() {
        if (typeof Prism !== 'undefined') {
            // text言語が存在しない場合、空のオブジェクトを作成
            if (!Prism.languages.text) {
                Prism.languages.text = {};
            }
            
            // コードブロックがすでにレンダリングされている場合はハイライト
            Prism.highlightAll();
        }
    }
};