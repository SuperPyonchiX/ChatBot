/**
 * chatRenderer.js
 * チャットメッセージのレンダリング機能を提供します
 */
// @ts-ignore - グローバル型定義との競合
class ChatRenderer {
    // シングルトンインスタンス
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {ChatRenderer} ChatRendererのシングルトンインスタンス
     */
    static get getInstance() {
        if (!ChatRenderer.#instance) {
            ChatRenderer.#instance = new ChatRenderer();
        }
        return ChatRenderer.#instance;
    }

    /**
     * プライベートコンストラクタ
     */
    constructor() {
        if (ChatRenderer.#instance) {
            throw new Error('ChatRendererクラスは直接インスタンス化できません。ChatRenderer.instanceを使用してください。');
        }
    }

    /**
     * ユーザーメッセージを追加する
     * ユーザーのメッセージとその添付ファイルをチャット画面に表示します
     * @async
     * @param {string} message - ユーザーが入力したテキストメッセージ
     * @param {HTMLElement} chatMessages - メッセージを表示する親DOM要素
     * @param {Attachment[]} [attachments=[]] - 添付ファイルの配列
     * @param {number|null} [timestamp=null] - メッセージのタイムスタンプ、nullの場合は現在時刻を使用
     * @returns {Promise<void>}
     */
    async addUserMessage(message, chatMessages, attachments = [], timestamp = null) {
        if (!chatMessages) return;
        
        const msgTimestamp = timestamp || Date.now();
        const fragment = document.createDocumentFragment();
        
        // 直接DOMを操作して要素を作成
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        messageDiv.dataset.timestamp = msgTimestamp.toString();
        messageDiv.setAttribute('role', 'region');
        messageDiv.setAttribute('aria-label', 'あなたのメッセージ');
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        const copyButton = this.#createCopyButton(message || '');
        
        try {
            const renderedMarkdown = await Markdown.getInstance.renderMarkdown(message || '');
            const markdownContent = document.createElement('div');
            markdownContent.className = 'markdown-content';
            markdownContent.innerHTML = renderedMarkdown;
        
            contentDiv.appendChild(copyButton);
            contentDiv.appendChild(markdownContent);
            
            if (attachments && attachments.length > 0) {
                contentDiv.appendChild(ChatAttachmentViewer.getInstance.createAttachmentsElement(attachments));
            }
            
            messageDiv.appendChild(contentDiv);
            fragment.appendChild(messageDiv);
            chatMessages.appendChild(fragment);
        
            this.#applyCodeFormatting(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (e) {
            console.error('ユーザーメッセージのMarkdown解析エラー:', e);
            const markdownContent = document.createElement('div');
            markdownContent.className = 'markdown-content';
            markdownContent.textContent = message || '';
            
            contentDiv.appendChild(copyButton);
            contentDiv.appendChild(markdownContent);
            messageDiv.appendChild(contentDiv);
            fragment.appendChild(messageDiv);
            chatMessages.appendChild(fragment);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    /**
     * ボットメッセージを追加する
     * AIからの応答メッセージをチャット画面に表示します
     * @param {string} message - 表示するボットのメッセージ内容
     * @param {HTMLElement} chatMessages - メッセージを表示する親要素
     * @param {number|null} timestamp - メッセージのタイムスタンプ、nullの場合は現在時刻を使用
     * @param {boolean} animate - タイピングアニメーションを適用するかのフラグ
     * @returns {Promise<void>}
     */
    async addBotMessage(message, chatMessages, timestamp = null, animate = true) {
        if (!chatMessages) return;
        
        const msgTimestamp = timestamp || Date.now();
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        messageDiv.dataset.timestamp = msgTimestamp.toString();
        messageDiv.setAttribute('role', 'region');
        messageDiv.setAttribute('aria-label', 'AIからの返答');
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        const copyButton = this.#createCopyButton(message || '');
        const messageContent = document.createElement('div');
        messageContent.className = 'markdown-content';
        
        if (animate) {
            messageContent.innerHTML = '';
            contentDiv.appendChild(copyButton);
            contentDiv.appendChild(messageContent);
            messageDiv.appendChild(contentDiv);
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            this.#animateTyping(message, messageContent);
        } else {
            try {
                const renderedMarkdown = await Markdown.getInstance.renderMarkdown(message || '');
                messageContent.innerHTML = renderedMarkdown;
                contentDiv.appendChild(copyButton);
                contentDiv.appendChild(messageContent);
                messageDiv.appendChild(contentDiv);
                
                chatMessages.appendChild(messageDiv);
                this.#applyCodeFormatting(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } catch (e) {
                console.error('ボットメッセージのMarkdown解析エラー:', e);
                messageContent.textContent = this.#formatMessage(message || '');
                contentDiv.appendChild(copyButton);
                contentDiv.appendChild(messageContent);
                messageDiv.appendChild(contentDiv);
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    }

    /**
     * ストリーミング用のボットメッセージを追加する
     * チャットメッセージ領域に、AIの応答を表示するためのメッセージ要素を追加します
     * @param {HTMLElement} chatMessages - メッセージを表示する要素
     * @param {number|null} timestamp - メッセージのタイムスタンプ
     * @returns {{messageDiv: HTMLElement, contentContainer: HTMLElement}} メッセージ要素とコンテンツコンテナ
     */
    addStreamingBotMessage(chatMessages, timestamp = null) {
        if (!chatMessages) return null;

        const { messageDiv, contentContainer } = this.addSystemMessage(
            chatMessages, 
            'Thinking', 
            { 
                status: 'thinking', 
                animation: 'fade', 
                showDots: true 
            }
        );
        
        // システムメッセージのクラスを変更してボットメッセージに
        if (messageDiv) {
            messageDiv.classList.remove('system-message');
            if (timestamp) {
                messageDiv.setAttribute('data-timestamp', timestamp.toString());
            }
        }

        return {
            messageDiv: messageDiv,
            contentContainer: contentContainer
        };
    }

    /**
     * ストリーミング中にボットメッセージを更新する
     * ストリーミングAPIから返されるチャンクをリアルタイムに表示します
     * @param {HTMLElement} container - 更新するメッセージコンテナ
     * @param {string} chunk - 新しく受信したテキストチャンク
     * @param {string} currentFullText - これまでに受信したテキスト全体
     * @param {boolean} isFirstChunk - 最初のチャンクかどうかのフラグ
     * @returns {Promise<void>}
     */
    async updateStreamingBotMessage(container, chunk, currentFullText, isFirstChunk = false) {
        if (!container) return;
        
        try {
            const renderedHTML = await Markdown.getInstance.renderMarkdown(currentFullText);
            const chatMessages = container.closest('.chat-messages');
            if (chatMessages) {
                const isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 50;
                container.innerHTML = renderedHTML;
                
                if (typeof Prism !== 'undefined') {
                    Prism.highlightAllUnder(container);
                }
                
                if (isNearBottom) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
        } catch (e) {
            console.error('ストリーミング中のMarkdown解析エラー:', e);
            container.textContent = currentFullText;
        }
    }

    /**
     * ストリーミングが完了したらボットメッセージを完成させる
     * マークダウンレンダリングを適用し、コピーボタンを追加して最終的な表示を整えます
     * @param {HTMLElement} messageDiv - メッセージの親要素
     * @param {HTMLElement} container - 内容を表示するコンテナ要素
     * @param {string} fullText - 完全なレスポンステキスト
     * @returns {Promise<void>}
     */
    async finalizeStreamingBotMessage(messageDiv, container, fullText) {
        if (!messageDiv || !container) return;
        
        try {
            const renderedHTML = await Markdown.getInstance.renderMarkdown(fullText);
            container.innerHTML = renderedHTML;
            
            const contentDiv = messageDiv.querySelector('.message-content');
            if (contentDiv) {
                const existingButton = contentDiv.querySelector('.copy-button');
                if (existingButton) {
                    contentDiv.removeChild(existingButton);
                }
                
                const copyButton = this.#createCopyButton(fullText);
                if (contentDiv.firstChild) {
                    contentDiv.insertBefore(copyButton, contentDiv.firstChild);
                } else {
                    contentDiv.appendChild(copyButton);
                }
            }
            
            if (typeof Prism !== 'undefined') {
                Prism.highlightAllUnder(messageDiv);
            }
            
            this.#addCodeBlockCopyButtons(messageDiv);
            
        } catch (e) {
            console.error('ストリーミング完了時のMarkdown解析エラー:', e);
            container.textContent = fullText;
        }
    }

    /**
     * メッセージをフォーマットします（改行やコードブロックを処理）
     * @param {string} message - フォーマットするメッセージ
     * @returns {string} フォーマットされたメッセージHTML
     */
    #formatMessage(message) {
        if (!message) return '';
        
        try {
            let formattedMessage = Markdown.getInstance.escapeHtml(message);
            
            // 改行を<br>に変換
            formattedMessage = formattedMessage.replace(/\n/g, '<br>');
            
            // インラインコードを処理
            formattedMessage = formattedMessage.replace(/`([^`]+)`/g, '<code>$1</code>');
            
            // コードブロックを処理
            formattedMessage = formattedMessage.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
                const language = lang ? ` class="language-${lang}"` : '';
                return `<pre><code${language}>${code}</code></pre>`;
            });
            
            return formattedMessage;
        } catch (error) {
            console.error('メッセージフォーマットエラー:', error);
            return Markdown.getInstance.escapeHtml(message).replace(/\n/g, '<br>');
        }
    }
    

    /**
     * コードブロックのフォーマットとハイライトを適用する
     * メッセージ内のコードブロックにシンタックスハイライトとコピーボタンを追加します
     * @param {HTMLElement} messageDiv - コードブロックを含むメッセージ要素
     * @returns {void}
     */
    #applyCodeFormatting(messageDiv) {
        if (!messageDiv) return;
        
        requestAnimationFrame(() => {
            try {
                this.#addCodeBlockCopyButtons(messageDiv);
                if (typeof Prism !== 'undefined') {
                    Prism.highlightAllUnder(messageDiv);
                }
            } catch (error) {
                console.error('コードハイライト処理中にエラーが発生しました:', error);
            }
        });
    }

    /**
     * タイピングアニメーションを実行する
     * ボットのメッセージを文字単位で徐々に表示するアニメーション効果を適用します
     * @param {string} message - 表示するメッセージ内容
     * @param {HTMLElement} container - メッセージを表示する要素
     * @returns {Promise<void>}
     */
    async #animateTyping(message, container) {
        if (!message || !container) return;
        
        const typingConfig = window.CONFIG?.UI?.TYPING_EFFECT || {};
        const typingEnabled = typingConfig.ENABLED !== undefined ? typingConfig.ENABLED : true;
        
        if (!typingEnabled) {
            try {
                const renderedHTML = await Markdown.getInstance.renderMarkdown(message);
                container.innerHTML = renderedHTML;
                
                if (typeof Prism !== 'undefined') {
                    Prism.highlightAllUnder(container);
                }
                
                this.#addCodeBlockCopyButtons(container.closest('.message'));
                return;
            } catch (e) {
                console.error('メッセージレンダリング中にエラーが発生しました:', e);
                container.textContent = message;
                return;
            }
        }
        
        let markdownText = '';
        const typingSpeed = typingConfig.SPEED !== undefined ? typingConfig.SPEED : 5;
        const bufferSize = typingConfig.BUFFER_SIZE !== undefined ? typingConfig.BUFFER_SIZE : 5;
        let currentIndex = 0;
        
        const typeNextCharacters = async () => {
            if (currentIndex < message.length) {
                const charsToAdd = Math.min(bufferSize, message.length - currentIndex);
                markdownText += message.substring(currentIndex, currentIndex + charsToAdd);
                currentIndex += charsToAdd;
                
                try {
                    const renderedHTML = await Markdown.getInstance.renderMarkdown(markdownText);
                    container.innerHTML = renderedHTML;
                    
                    if (typeof Prism !== 'undefined') {
                        Prism.highlightAllUnder(container);
                    }
                    
                    this.#addCodeBlockCopyButtons(container.closest('.message'));
                    
                    const chatMessages = container.closest('.chat-messages');
                    if (chatMessages) {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                } catch (e) {
                    console.error('タイピング中のMarkdown解析エラー:', e);
                    container.textContent = markdownText;
                }
                
                setTimeout(typeNextCharacters, typingSpeed);
            }
        };
        
        await typeNextCharacters();
    }

    /**
     * コピーボタンを作成する
     * テキストをクリップボードにコピーするためのボタン要素を生成します
     * @param {string} textToCopy - コピー対象のテキスト
     * @returns {HTMLElement} 作成されたコピーボタン要素
     */
    #createCopyButton(textToCopy) {
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.title = 'コピーする';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        
        copyButton.addEventListener('click', () => {
            if (!textToCopy) {
                console.warn('コピーするテキストが空です');
                return;
            }
            
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    this.#showCopySuccess(copyButton);
                })
                .catch(err => {
                    console.error('クリップボードへのコピーに失敗しました:', err);
                    this.#showCopyError(copyButton);
                });
        });
        
        return copyButton;
    }

    
    /**
     * コードブロックにコピーボタン、編集ボタン、実行ボタンを追加します
     * @param {HTMLElement} messageElement - コードブロックを含むメッセージ要素
     */
    #addCodeBlockCopyButtons(messageElement) {
        if (!messageElement) return;
        
        try {
            const codeBlocks = messageElement.querySelectorAll('pre code');
            if (!codeBlocks || codeBlocks.length === 0) return;
            
            codeBlocks.forEach((codeBlock, index) => {
                const pre = codeBlock.parentElement;
                if (!pre) return;
                
                // すでにラッパーがある場合はスキップ
                if (pre.parentNode && /** @type {HTMLElement} */ (pre.parentNode).classList.contains('code-block')) {
                    return;
                }
                
                // 言語クラスからコード言語を特定
                const langClass = Array.from(codeBlock.classList)
                    .find(cls => cls.startsWith('language-'));
                const language = langClass ? langClass.replace('language-', '') : '';
                
                // ラッパーでコードブロックを囲む
                const wrapper = document.createElement('div');
                wrapper.classList.add('code-block');
                
                // 言語表示を追加
                if (language && language !== 'plaintext' && language !== 'none') {
                    const langLabel = document.createElement('div');
                    langLabel.classList.add('code-language');
                    langLabel.textContent = this.#getNiceLanguageName(language);
                    wrapper.appendChild(langLabel);
                }
                
                // ラッパーに元のpreを移動
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);
                
                // ツールバーを作成
                const toolbar = document.createElement('div');
                toolbar.classList.add('code-block-toolbar');
                
                // コピーボタンを追加
                const copyButton = this.#createCodeCopyButton(index, /** @type {HTMLElement} */ (codeBlock));
                toolbar.appendChild(copyButton);
                
                // 編集ボタンを追加
                const editButton = this.#createEditButton(index, /** @type {HTMLElement} */ (codeBlock), language);
                toolbar.appendChild(editButton);
                
                // 実行可能言語の場合は実行ボタンを追加
                if (this.#isExecutableLanguage(language)) {
                    const executeButton = this.#createExecuteButton(index, /** @type {HTMLElement} */ (codeBlock), language);
                    toolbar.appendChild(executeButton);
                }
                
                wrapper.appendChild(toolbar);
            });
        } catch (error) {
            console.error('コードブロックボタン追加エラー:', error);
        }
    }
    
    /**
     * 言語が実行可能かどうかを判定します
     * @param {string} language - 判定する言語
     * @returns {boolean} 実行可能な場合はtrue
     */
    #isExecutableLanguage(language) {
        if (!language) return false;
        return window.CONFIG.EXECUTABLE_LANGUAGES.includes(language.toLowerCase());
    }
    
    /**
     * コード実行ボタンを作成します
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @param {string} language - コードの言語
     * @returns {HTMLElement} 作成された実行ボタン要素
     */
    #createExecuteButton(index, codeBlock, language) {
        if (!codeBlock || !language) return document.createElement('button');
        
        const executeButton = document.createElement('button');
        executeButton.classList.add('code-execute-button');
        executeButton.innerHTML = '<i class="fas fa-play"></i>';
        executeButton.title = 'コードを実行';
        executeButton.setAttribute('data-code-index', String(index));
        executeButton.setAttribute('data-language', language);
        executeButton.setAttribute('aria-label', 'コードを実行');
        
        // 実行ボタンのクリックイベント
        executeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // イベント伝播を停止
            this.#handleExecuteButtonClick(executeButton, codeBlock, language);
        });
        
        return executeButton;
    }
    
    /**
     * 実行ボタンのクリックイベントを処理します
     * @param {HTMLElement} button - クリックされたボタン
     * @param {HTMLElement} codeBlock - 実行対象のコードブロック
     * @param {string} language - コードの言語
     */
    async #handleExecuteButtonClick(button, codeBlock, language) {
        if (!button || !codeBlock || !language || typeof CodeExecutor === 'undefined') {
            console.error('コード実行に必要な要素が見つかりません');
            return;
        }

        // ボタンの元の状態を保存（スコープ問題を防ぐために関数の上部に移動）
        const originalButtonHtml = button.innerHTML || '<i class="fas fa-play"></i>';

        try {
            // ボタンの状態を実行中に変更
            /** @type {HTMLButtonElement} */ (button).disabled = true;
            button.classList.add('code-executing');
            button.innerHTML = '<span class="executing-spinner"></span>';

            // 既存の実行結果を削除
            const parentBlock = codeBlock.closest('.code-block');
            if (parentBlock) {
                const existingResult = parentBlock.querySelector('.code-execution-result');
                if (existingResult) {
                    parentBlock.removeChild(existingResult);
                }
            }

            // リアルタイム出力用の要素を作成
            let resultElement = null;
            if (parentBlock) {
                resultElement = document.createElement('div');
                resultElement.classList.add('code-execution-result');

                // ステータス表示用の要素
                const statusElement = document.createElement('div');
                statusElement.classList.add('execution-status');
                statusElement.textContent = '実行準備中...';
                resultElement.appendChild(statusElement);

                // HTML言語の場合は特別なコンテナを用意
                if (language === 'html') {
                    const htmlContainer = document.createElement('div');
                    htmlContainer.classList.add('html-result-container');
                    resultElement.appendChild(htmlContainer);
                } else {
                    // 通常の言語の場合はリアルタイム出力表示用の要素
                    const outputElement = document.createElement('pre');
                    outputElement.classList.add('realtime-output');
                    resultElement.appendChild(outputElement);
                }

                parentBlock.appendChild(resultElement);
            }

            // コードを取得して実行
            const code = codeBlock.textContent;
            await CodeExecutor.getInstance.executeCode(code, language, resultElement);

        } catch (error) {
            console.error('コード実行中にエラーが発生しました:', error);
            
            // エラーメッセージを表示
            const errorMsg = {
                error: `実行エラー: ${error.message || '不明なエラー'}`,
                errorDetail: error.stack
            };
            
            const parentBlock = codeBlock.closest('.code-block');
            if (parentBlock) {
                const errorElement = document.createElement('div');
                errorElement.classList.add('code-execution-result');
                
                const errorDiv = document.createElement('div');
                errorDiv.classList.add('execution-error');
                errorDiv.textContent = errorMsg.error;
                
                if (errorMsg.errorDetail) {
                    const errorDetail = document.createElement('pre');
                    errorDetail.classList.add('error-details');
                    errorDetail.textContent = errorMsg.errorDetail;
                    errorDiv.appendChild(errorDetail);
                }
                
                errorElement.appendChild(errorDiv);
                parentBlock.appendChild(errorElement);
            }
        } finally {
            // ボタンを元の状態に戻す
            /** @type {HTMLButtonElement} */ (button).disabled = false;
            button.classList.remove('code-executing');
            button.innerHTML = originalButtonHtml;
        }
    }
    
    /**
     * 言語IDから表示用の言語名を取得
     * @param {string} langId - 言語ID
     * @returns {string} 表示用言語名
     */
    #getNiceLanguageName(langId) {
        if (!langId) return '';
        
        const languageMap = {
            'js': 'JavaScript',
            'javascript': 'JavaScript',
            'ts': 'TypeScript',
            'typescript': 'TypeScript',
            'python': 'Python',
            'py': 'Python',
            'html': 'HTML',
            'css': 'CSS',
            'json': 'JSON',
            'java': 'Java',
            'csharp': 'C#',
            'cs': 'C#',
            'c': 'C',
            'cpp': 'C++',
            'php': 'PHP',
            'ruby': 'Ruby',
            'rb': 'Ruby',
            'go': 'Go',
            'rust': 'Rust',
            'swift': 'Swift',
            'kotlin': 'Kotlin',
            'sql': 'SQL',
            'bash': 'Bash',
            'shell': 'Shell',
            'sh': 'Shell',
            'markdown': 'Markdown',
            'md': 'Markdown',
            'yaml': 'YAML',
            'yml': 'YAML',
            'xml': 'XML',
            'plaintext': 'Text'
        };
        
        return languageMap[langId.toLowerCase()] || langId;
    }

    /**
     * コードブロック用のコピーボタンを作成します
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @returns {HTMLElement} 作成されたコピーボタン要素
     */
    #createCodeCopyButton(index, codeBlock) {
        if (!codeBlock) return document.createElement('button');
        
        const copyButton = document.createElement('button');
        copyButton.classList.add('code-copy-button');
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.title = 'コードをコピー';
        copyButton.setAttribute('data-code-index', String(index));
        copyButton.setAttribute('aria-label', 'コードをクリップボードにコピー');
        
        // コピーボタンのクリックイベント
        copyButton.addEventListener('click', (e) => {
            e.stopPropagation(); // イベント伝播を停止
            this.#handleCopyButtonClick(copyButton, codeBlock);
        });
        
        return copyButton;
    }
    
    /**
     * コード編集ボタンを作成します
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @param {string} language - コードの言語
     * @returns {HTMLElement} 作成された編集ボタン要素
     */
    #createEditButton(index, codeBlock, language) {
        if (!codeBlock) return document.createElement('button');
        
        const editButton = document.createElement('button');
        editButton.classList.add('code-edit-button');
        editButton.innerHTML = '<i class="fas fa-edit"></i>';
        editButton.title = 'コードを編集';
        editButton.setAttribute('data-code-index', String(index));
        editButton.setAttribute('data-language', language);
        editButton.setAttribute('aria-label', 'コードを編集');
        
        // 編集ボタンのクリックイベント
        editButton.addEventListener('click', (e) => {
            e.stopPropagation(); // イベント伝播を停止
            this.#handleEditButtonClick(editButton, codeBlock, language);
        });
        
        return editButton;
    }
    
    /**
     * 編集ボタンのクリックイベントを処理します
     * @param {HTMLElement} button - クリックされたボタン
     * @param {HTMLElement} codeBlock - 編集対象のコードブロック
     * @param {string} language - コードの言語
     */
    #handleEditButtonClick(button, codeBlock, language) {
        if (!button || !codeBlock) {
            console.error('コード編集に必要な要素が見つかりません');
            return;
        }
        
        try {
            // コードを取得して前後の空白を整理
            const rawCode = codeBlock.textContent || '';
            const code = rawCode.trim();
                        
            // 実際にコードがあるか確認
            if (!code) {
                console.warn('編集するコードが空です');
            }
            
            // エディタにきちんとコードが渡るように少し遅延させる
            setTimeout(() => {
                // ChatUIのグローバル参照チェック
                if (typeof ChatUI !== 'undefined' && ChatUI.getInstance) {
                    ChatUI.getInstance.showCodeEditor(codeBlock, code, language);
                } else {
                    console.error('ChatUIが見つかりません。エディタは表示できません。');
                    alert('コードエディタを開けませんでした。ページを再読み込みしてからお試しください。');
                }
            }, 100);
            
        } catch (error) {
            console.error('コード編集の準備中にエラーが発生しました:', error);
        }
    }
    
    /**
     * コピーボタンのクリックイベントを処理します
     * @param {HTMLElement} button - クリックされたボタン
     * @param {HTMLElement} codeBlock - コピー対象のコードブロック
     */
    #handleCopyButtonClick(button, codeBlock) {
        if (!button || !codeBlock) return;
        
        try {
            // トリミングしてコピー（余分な空白行を削除）
            const codeText = this.#cleanCodeForCopy(codeBlock.textContent);
            
            navigator.clipboard.writeText(codeText)
                .then(() => {
                    this.#showCopySuccess(button);
                })
                .catch(err => {
                    console.error('コードのコピーに失敗しました:', err);
                    this.#showCopyError(button);
                });
        } catch (error) {
            console.error('コピー処理エラー:', error);
            this.#showCopyError(button);
        }
    }
    
    /**
     * コードをコピー用に整形する
     * @param {string} code - 整形するコード
     * @returns {string} 整形されたコード
     */
    #cleanCodeForCopy(code) {
        if (!code) return '';
        
        // 前後の空白を削除
        let cleanCode = code.trim();
        
        // 連続する空行を単一の空行に置換
        cleanCode = cleanCode.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        return cleanCode;
    }

    /**
     * コピー成功時の表示を更新
     */
    #showCopySuccess(button) {
        if (!button) return;
        
        button.classList.add('copied');
        button.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            if (button) {
                button.classList.remove('copied');
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }
        }, 1500);
    }

    /**
     * コピー失敗時の表示を更新
     */
    #showCopyError(button) {
        if (!button) return;
        
        button.classList.add('error');
        button.innerHTML = '<i class="fas fa-times"></i>';
        
        setTimeout(() => {
            if (button) {
                button.classList.remove('error');
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }
        }, 1500);
    }

    /**
     * システムメッセージを表示する
     * @param {HTMLElement} chatMessages - チャットメッセージコンテナ
     * @param {string} message - 表示するメッセージ
     * @param {Object} options - 表示オプション
     * @param {string} options.status - メッセージの状態 ('thinking', 'searching', 'processing', 'error')
     * @param {string} options.animation - アニメーション種類 ('fade', 'slide', 'pulse', 'gradient', 'ripple', 'particles')
     * @param {boolean} options.showDots - タイピングドットを表示するか
     * @returns {Object} メッセージ要素の参照
     */
    addSystemMessage(chatMessages, message, options = { status: 'info', animation: 'fade', showDots: false }) {
        if (!chatMessages) return null;
        
        const {
            status = 'thinking',
            animation = 'slide',
            showDots = true
        } = options;
        
        const messageDiv = ChatUI.getInstance.createElement('div', {
            classList: ['message', 'bot', 'system-message', `anim-${animation}`],
            attributes: {
                'role': 'status',
                'aria-live': 'polite',
                'data-status': status
            }
        });
        
        const contentDiv = ChatUI.getInstance.createElement('div', { classList: 'message-content' });
        
        const messageContent = ChatUI.getInstance.createElement('div', {
            classList: 'markdown-content',
            innerHTML: this.#formatSystemMessage(message, showDots)
        });
        
        contentDiv.appendChild(messageContent);
        messageDiv.appendChild(contentDiv);
        
        // DOMに追加
        chatMessages.appendChild(messageDiv);
        
        console.log(`📝 messageDiv classes: ${messageDiv.className}`);
        
        // アニメーション開始（次フレームで実行してCSSが確実に適用されるようにする）
        setTimeout(() => {
            messageDiv.classList.add('animate');
        }, 50);
        
        // スクロール調整
        this.#smoothScrollToBottom(chatMessages);
        
        return {
            messageDiv: messageDiv,
            contentContainer: messageContent
        };
    }

    /**
     * システムメッセージを更新する
     * @param {HTMLElement} messageDiv - メッセージ要素
     * @param {string} message - 新しいメッセージ
     * @param {Object} options - 更新オプション
     * @param {string} options.status - メッセージの新しい状態
     * @param {boolean} options.animate - 変更アニメーションを使用するか
     * @param {boolean} options.showDots - タイピングドットを表示するか
     */
    updateSystemMessage(messageDiv, message, options = { status: 'info', animate: true, showDots: false }) {
        if (!messageDiv) return;
        
        const {
            status = null,
            animate = true,
            showDots = true
        } = options;
        
        const messageContent = messageDiv.querySelector('.markdown-content');
        if (!messageContent) return;
        
        // ステータスを更新
        if (status && messageDiv.getAttribute('data-status') !== status) {
            // ステータス変更のアニメーション
            if (animate) {
                messageDiv.classList.add('system-message-pulse');
                setTimeout(() => {
                    messageDiv.classList.remove('system-message-pulse');
                }, 1200); // より長いパルスアニメーション時間
            }
            messageDiv.setAttribute('data-status', status);
        }
        
        if (animate && messageContent.innerHTML !== this.#formatSystemMessage(message, showDots)) {
            // より滑らかなコンテンツ変更アニメーション
            // CSS transitionsを設定
            messageContent.style.transition = 'transform 0.4s ease-in-out, opacity 0.4s ease-in-out';
            messageContent.style.transform = 'scale(0.95)';
            messageContent.style.opacity = '0.2';
            
            setTimeout(() => {
                messageContent.innerHTML = this.#formatSystemMessage(message, showDots);
                // 復帰アニメーション
                messageContent.style.transform = 'scale(1.02)'; // 少しオーバーシュート
                messageContent.style.opacity = '1';
                
                // オーバーシュート後の最終調整
                setTimeout(() => {
                    messageContent.style.transform = 'scale(1)';
                    
                    // トランジション完了後にスタイルをクリア
                    setTimeout(() => {
                        messageContent.style.transition = '';
                        messageContent.style.transform = '';
                        messageContent.style.opacity = '';
                    }, 200);
                }, 150);
            }, 300); // より長いフェードアウト時間
        } else if (!animate) {
            messageContent.innerHTML = this.#formatSystemMessage(message, showDots);
        }
    }

    /**
     * システムメッセージを削除する
     * @param {HTMLElement} messageDiv - 削除するメッセージ要素
     * @param {Object} options - 削除オプション
     * @param {string} options.animation - 削除アニメーション ('fade', 'slide')
     * @param {number} options.delay - 削除前の遅延時間（ミリ秒）
     */
    removeSystemMessage(messageDiv, options = { animation: 'fade', delay: 0 }) {
        if (!messageDiv || !messageDiv.parentNode) return;
        
        const {
            animation = 'fade',
            delay = 0
        } = options;
        
        const performRemoval = () => {
            // 削除アニメーションクラスを追加
            if (animation === 'slide') {
                messageDiv.classList.add('system-message-slide-out');
            } else {
                messageDiv.classList.add('system-message-fade-out');
            }
            
            // アニメーション完了後に要素を削除
            const animationDuration = animation === 'slide' ? 300 : 200;
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, animationDuration);
        };
        
        if (delay > 0) {
            setTimeout(performRemoval, delay);
        } else {
            performRemoval();
        }
    }

    /**
     * コードブロックからコードを取得します
     * @param {HTMLElement} codeBlock - コードブロック要素
     * @returns {string} 取得したコード
     */
    #getCodeFromBlock(codeBlock) {
        if (!codeBlock) return '';
        
        try {
            // preタグ内のcodeタグを検出
            const codeElement = codeBlock.tagName.toLowerCase() === 'code' ? 
                codeBlock : codeBlock.querySelector('code');
            
            if (codeElement) {
                // HTMLエンティティをデコード
                const text = codeElement.textContent || '';
                return this.#decodeHtmlEntities(text.trim());
            }
            
            // 直接テキストを取得
            return this.#decodeHtmlEntities((codeBlock.textContent || '').trim());
        } catch (error) {
            console.error('コードの取得に失敗:', error);
            return '';
        }
    }
    
    /**
     * HTMLエンティティをデコードします
     * @param {string} text - デコードするテキスト
     * @returns {string} デコードされたテキスト
     */
    #decodeHtmlEntities(text) {
        const element = document.createElement('div');
        element.innerHTML = text;
        return element.textContent || text;
    }

    /**
     * システムメッセージをフォーマットします
     * @param {string} message - メッセージ
     * @param {boolean} showDots - タイピングドットを表示するか
     * @returns {string} フォーマット済みメッセージHTML
     */
    #formatSystemMessage(message, showDots) {
        const dotsHtml = showDots ? 
            '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>' : '';
        return `<p>${message}${dotsHtml}</p>`;
    }

    /**
     * スムーズにスクロールして最下部に移動します
     * @param {HTMLElement} container - スクロール対象のコンテナ
     */
    #smoothScrollToBottom(container) {
        if (!container) return;
        
        // スムーズスクロールをサポートしている場合は使用
        if ('scrollBehavior' in document.documentElement.style) {
            setTimeout(() => {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }, 50);
        } else {
            // フォールバック：通常のスクロール
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }
    }
}