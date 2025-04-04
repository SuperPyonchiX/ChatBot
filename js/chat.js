/**
 * chat.js
 * チャット機能を提供します
 */

// グローバルスコープに関数を公開
window.Chat = (function() {
    // プライベート変数とキャッシングメカニズム
    const _cache = {
        elements: new Map(),
        templates: new Map(),
        conversations: new Map()
    };

    // DOM要素を作成するヘルパー関数
    const _createElement = function(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.classList) {
            if (Array.isArray(options.classList)) {
                element.classList.add(...options.classList);
            } else {
                element.classList.add(options.classList);
            }
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                if (value !== undefined) {
                    element.setAttribute(key, value);
                }
            });
        }
        
        if (options.innerHTML !== undefined) {
            element.innerHTML = options.innerHTML;
        }
        
        if (options.textContent !== undefined) {
            element.textContent = options.textContent;
        }
        
        if (options.children && Array.isArray(options.children)) {
            options.children.forEach(child => {
                if (child) {
                    element.appendChild(child);
                }
            });
        }
        
        return element;
    };
    
    // パブリックAPI
    return {
        /**
         * ユーザーメッセージを追加する
         * @param {string} message - 表示するメッセージ
         * @param {HTMLElement} chatMessages - メッセージを追加する対象要素
         * @param {Array} attachments - 添付ファイルの配列（任意）
         * @param {number} timestamp - メッセージのタイムスタンプ（任意）
         */
        addUserMessage: async function(message, chatMessages, attachments = [], timestamp = null) {
            if (!chatMessages) return;
            
            const msgTimestamp = timestamp || Date.now();
            
            // DocumentFragmentを使用してDOM操作を最適化
            const fragment = document.createDocumentFragment();
            
            const messageDiv = _createElement('div', {
                classList: ['message', 'user'],
                attributes: {
                    'data-timestamp': msgTimestamp.toString(),
                    'role': 'region',
                    'aria-label': 'あなたのメッセージ'
                }
            });
            
            const contentDiv = _createElement('div', { classList: 'message-content' });
            
            // コピーボタンを追加
            const copyButton = this._createCopyButton(message || '');
            
            try {
                // 非同期レンダリングの結果を待機
                const renderedMarkdown = await window.Markdown.renderMarkdown(message || '');
                
                const markdownContent = _createElement('div', {
                    classList: 'markdown-content',
                    innerHTML: renderedMarkdown
                });
                
                contentDiv.appendChild(copyButton);
                contentDiv.appendChild(markdownContent);
                
                // 添付ファイルがあれば表示
                if (attachments && attachments.length > 0) {
                    contentDiv.appendChild(this._createAttachmentsElement(attachments));
                }
                
                messageDiv.appendChild(contentDiv);
                fragment.appendChild(messageDiv);
                
                // 一度の操作でDOMに追加
                chatMessages.appendChild(fragment);
                
                // コードブロックの処理とシンタックスハイライト
                this._applyCodeFormatting(messageDiv);
                
                // スクロール位置を更新
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } catch (e) {
                console.error('ユーザーメッセージのMarkdown解析エラー:', e);
                const markdownContent = _createElement('div', {
                    classList: 'markdown-content',
                    textContent: message || ''
                });
                
                contentDiv.appendChild(copyButton);
                contentDiv.appendChild(markdownContent);
                messageDiv.appendChild(contentDiv);
                fragment.appendChild(messageDiv);
                chatMessages.appendChild(fragment);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        },

        /**
         * ボットメッセージを追加する
         * @param {string} message - 表示するメッセージ
         * @param {HTMLElement} chatMessages - メッセージを追加する対象要素
         * @param {number} timestamp - メッセージのタイムスタンプ（任意）
         * @param {boolean} animate - タイピングアニメーションを使用するか（デフォルト:true）
         */
        addBotMessage: async function(message, chatMessages, timestamp = null, animate = true) {
            if (!chatMessages) return;
            
            const msgTimestamp = timestamp || Date.now();
            
            const messageDiv = _createElement('div', {
                classList: ['message', 'bot'],
                attributes: {
                    'data-timestamp': msgTimestamp.toString(),
                    'role': 'region',
                    'aria-label': 'AIからの返答'
                }
            });
            
            const contentDiv = _createElement('div', { classList: 'message-content' });
            
            // コピーボタンを追加
            const copyButton = this._createCopyButton(message || '');
            
            const messageContent = _createElement('div', { classList: 'markdown-content' });
            
            if (animate) {
                // 初期状態では空にしておく
                messageContent.innerHTML = '';
                contentDiv.appendChild(copyButton);
                contentDiv.appendChild(messageContent);
                messageDiv.appendChild(contentDiv);
                
                // メッセージを追加して表示する
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                // テキストを徐々に表示するアニメーション
                this._animateTyping(message, messageContent);
            } else {
                // アニメーションなしの場合はすぐに表示
                try {
                    // 非同期レンダリングの結果を待機
                    const renderedMarkdown = await window.Markdown.renderMarkdown(message || '');
                    messageContent.innerHTML = renderedMarkdown;
                    contentDiv.appendChild(copyButton);
                    contentDiv.appendChild(messageContent);
                    messageDiv.appendChild(contentDiv);
                    
                    // コードブロックの処理とメッセージの表示
                    chatMessages.appendChild(messageDiv);
                    this._applyCodeFormatting(messageDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                } catch (e) {
                    console.error('ボットメッセージのMarkdown解析エラー:', e);
                    messageContent.textContent = window.Markdown.formatMessage(message || '');
                    contentDiv.appendChild(copyButton);
                    contentDiv.appendChild(messageContent);
                    messageDiv.appendChild(contentDiv);
                    chatMessages.appendChild(messageDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
        },
        
        /**
         * ストリーミング用のボットメッセージを追加する
         * @param {HTMLElement} chatMessages - メッセージを追加する対象要素
         * @param {number} timestamp - メッセージのタイムスタンプ（任意）
         * @returns {Object} 作成されたメッセージ要素とコンテナ
         */
        addStreamingBotMessage: function(chatMessages, timestamp = null) {
            if (!chatMessages) return null;
            
            const msgTimestamp = timestamp || Date.now();
            
            const messageDiv = _createElement('div', {
                classList: ['message', 'bot'],
                attributes: {
                    'data-timestamp': msgTimestamp.toString(),
                    'role': 'region',
                    'aria-label': 'AIからの返答'
                }
            });
            
            const contentDiv = _createElement('div', { classList: 'message-content' });
            
            const messageContent = _createElement('div', {
                classList: 'markdown-content',
                innerHTML: '<p>Thinking<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>'
            });
            
            contentDiv.appendChild(messageContent);
            messageDiv.appendChild(contentDiv);
            
            // メッセージを追加して表示
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            return {
                messageDiv: messageDiv,
                contentContainer: messageContent
            };
        },
        
        /**
         * ストリーミング中にボットメッセージを更新する
         * @param {HTMLElement} container - 更新するコンテンツコンテナ
         * @param {string} chunk - 追加するチャンクテキスト
         * @param {string} currentFullText - 現在の完全なテキスト
         * @param {boolean} isFirstChunk - 最初のチャンクかどうか
         */
        updateStreamingBotMessage: async function(container, chunk, currentFullText, isFirstChunk = false) {
            if (!container) return;
            
            try {
                // 最新の完全なテキストをMarkdownとしてレンダリング
                const renderedHTML = await window.Markdown.renderMarkdown(currentFullText);
                
                const chatMessages = container.closest('.chat-messages');
                if (chatMessages) {
                    // スクロール位置を確認
                    const isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 50;
                    
                    // コンテンツを更新
                    container.innerHTML = renderedHTML;
                    
                    // シンタックスハイライトを適用
                    if (typeof Prism !== 'undefined') {
                        Prism.highlightAllUnder(container);
                    }
                    
                    // スクロール位置が下に近い場合のみ自動スクロール
                    if (isNearBottom) {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }
            } catch (e) {
                console.error('ストリーミング中のMarkdown解析エラー:', e);
                // エラーが発生した場合は単純テキストとして表示
                container.textContent = currentFullText;
            }
        },
        
        /**
         * ストリーミングが完了したらボットメッセージを完成させる
         * @param {HTMLElement} messageDiv - メッセージDIV要素
         * @param {HTMLElement} container - コンテンツコンテナ
         * @param {string} fullText - 完全なレスポンステキスト
         */
        finalizeStreamingBotMessage: async function(messageDiv, container, fullText) {
            if (!messageDiv || !container) return;
            
            try {
                // 最終的なテキストを設定
                const renderedHTML = await window.Markdown.renderMarkdown(fullText);
                container.innerHTML = renderedHTML;
                
                // コピーボタンを親のmessage-contentに追加
                const contentDiv = messageDiv.querySelector('.message-content');
                if (contentDiv) {
                    // 既存のコピーボタンがあれば削除
                    const existingButton = contentDiv.querySelector('.copy-button');
                    if (existingButton) {
                        contentDiv.removeChild(existingButton);
                    }
                    
                    // 新しいコピーボタンを作成して最初に挿入
                    const copyButton = this._createCopyButton(fullText);
                    if (contentDiv.firstChild) {
                        contentDiv.insertBefore(copyButton, contentDiv.firstChild);
                    } else {
                        contentDiv.appendChild(copyButton);
                    }
                }
                
                // シンタックスハイライトを適用
                if (typeof Prism !== 'undefined') {
                    Prism.highlightAllUnder(messageDiv);
                }
                
                // コードブロックのコピーボタンを追加
                window.Markdown.addCodeBlockCopyButtons(messageDiv);
                
            } catch (e) {
                console.error('ストリーミング完了時のMarkdown解析エラー:', e);
                container.textContent = fullText;
            }
        },
        
        /**
         * コードブロックのフォーマットとハイライトを適用する
         * @private
         * @param {HTMLElement} messageDiv - メッセージ要素
         */
        _applyCodeFormatting: function(messageDiv) {
            if (!messageDiv) return;
            
            requestAnimationFrame(() => {
                try {
                    window.Markdown.addCodeBlockCopyButtons(messageDiv);
                    if (typeof Prism !== 'undefined') {
                        Prism.highlightAllUnder(messageDiv);
                    }
                } catch (error) {
                    console.error('コードハイライト処理中にエラーが発生しました:', error);
                }
            });
        },
        
        /**
         * タイピングアニメーションを実行する
         * @private
         * @param {string} message - 表示するメッセージ
         * @param {HTMLElement} container - メッセージを表示する要素
         */
        _animateTyping: async function(message, container) {
            if (!message || !container) return;
            
            // 設定から値を取得（存在しない場合はデフォルト値を使用）
            const typingConfig = window.CONFIG?.UI?.TYPING_EFFECT || {};
            const typingEnabled = typingConfig.ENABLED !== undefined ? typingConfig.ENABLED : true;
            
            // タイピングエフェクトが無効な場合は即座に表示して終了
            if (!typingEnabled) {
                try {
                    // 非同期レンダリングの結果を待機
                    const renderedHTML = await window.Markdown.renderMarkdown(message);
                    container.innerHTML = renderedHTML;
                    
                    // シンタックスハイライトを適用
                    if (typeof Prism !== 'undefined') {
                        Prism.highlightAllUnder(container);
                    }
                    
                    // コピーボタンの追加
                    window.Markdown.addCodeBlockCopyButtons(container.closest('.message'));
                    
                    return;
                } catch (e) {
                    console.error('メッセージレンダリング中にエラーが発生しました:', e);
                    container.textContent = message;
                    return;
                }
            }
            
            // 処理中のmarkdownテキスト
            let markdownText = '';
            
            // 表示速度（ミリ秒）- 設定から取得またはデフォルト値を使用
            const typingSpeed = typingConfig.SPEED !== undefined ? typingConfig.SPEED : 5;
            
            // バッファサイズ（一度に処理する文字数）- 設定から取得またはデフォルト値を使用
            const bufferSize = typingConfig.BUFFER_SIZE !== undefined ? typingConfig.BUFFER_SIZE : 5;
            
            // テキストを一文字ずつ追加
            let currentIndex = 0;
            
            const typeNextCharacters = async () => {
                if (currentIndex < message.length) {
                    // バッファサイズ分の文字を追加（ただし残りが少ない場合はその分だけ）
                    const charsToAdd = Math.min(bufferSize, message.length - currentIndex);
                    markdownText += message.substring(currentIndex, currentIndex + charsToAdd);
                    currentIndex += charsToAdd;
                    
                    // 現在のテキストをMarkdownとしてレンダリング
                    try {
                        // 非同期レンダリングの結果を待機
                        const renderedHTML = await window.Markdown.renderMarkdown(markdownText);
                        container.innerHTML = renderedHTML;
                        
                        // シンタックスハイライトを適用
                        if (typeof Prism !== 'undefined') {
                            Prism.highlightAllUnder(container);
                        }
                        
                        // コピーボタンの追加
                        window.Markdown.addCodeBlockCopyButtons(container.closest('.message'));
                        
                        // 親要素のスクロール位置を更新
const chatMessages = container.closest('.chat-messages');
                        if (chatMessages) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    } catch (e) {
                        console.error('タイピング中のMarkdown解析エラー:', e);
                        container.textContent = markdownText;
                    }
                    
                    // 次の文字を表示
                    setTimeout(typeNextCharacters, typingSpeed);
                }
            };
            
            // アニメーション開始
            await typeNextCharacters();
        },
        
        /**
         * コピーボタンを作成する
         * @private
         * @param {string} textToCopy - コピーするテキスト
         * @returns {HTMLElement} 作成されたコピーボタン
         */
        _createCopyButton: function(textToCopy) {
            const copyButton = document.createElement('button');
            copyButton.classList.add('copy-button');
            copyButton.title = 'コピーする';
            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
            
            // コピーボタンのクリックイベント
            copyButton.addEventListener('click', () => {
                if (!textToCopy) {
                    console.warn('コピーするテキストが空です');
                    return;
                }
                
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        this._showCopySuccess(copyButton);
                    })
                    .catch(err => {
                        console.error('クリップボードへのコピーに失敗しました:', err);
                        this._showCopyError(copyButton);
                    });
            });
            
            return copyButton;
        },
        
        /**
         * コピー成功時の表示を更新
         * @private
         * @param {HTMLElement} button - 更新するボタン
         */
        _showCopySuccess: function(button) {
            if (!button) return;
            
            button.classList.add('copied');
            button.innerHTML = '<i class="fas fa-check"></i>';
            
            setTimeout(() => {
                if (button) {
                    button.classList.remove('copied');
                    button.innerHTML = '<i class="fas fa-copy"></i>';
                }
            }, 1500);
        },
        
        /**
         * コピー失敗時の表示を更新
         * @private
         * @param {HTMLElement} button - 更新するボタン
         */
        _showCopyError: function(button) {
            if (!button) return;
            
            button.classList.add('error');
            button.innerHTML = '<i class="fas fa-times"></i>';
            
            setTimeout(() => {
                if (button) {
                    button.classList.remove('error');
                    button.innerHTML = '<i class="fas fa-copy"></i>';
                }
            }, 1500);
        },
        
        /**
         * 添付ファイル表示要素を作成
         * @private
         * @param {Array} attachments - 添付ファイルの配列
         * @param {number} timestamp - タイムスタンプ（オプショナル）
         * @returns {HTMLElement} 添付ファイル表示要素
         */
        _createAttachmentsElement: function(attachments, timestamp = null) {
            if (!attachments || !Array.isArray(attachments)) {
                return document.createElement('div');
            }
            
            const attachmentsDiv = document.createElement('div');
            attachmentsDiv.classList.add('message-attachments');
            
            // タイムスタンプがあれば設定
            if (timestamp || (attachments.length > 0 && attachments[0].timestamp)) {
                // 配列内の最初の添付ファイルからタイムスタンプを取得するか、引数のタイムスタンプを使用
                const effectiveTimestamp = timestamp || attachments[0].timestamp;
                attachmentsDiv.dataset.timestamp = effectiveTimestamp;
            }
            
            attachments.forEach((attachment) => {
                if (!attachment || !attachment.type) return;
                
                if (attachment.type === 'image' && attachment.data) {
                    const imgContainer = document.createElement('div');
                    imgContainer.classList.add('attachment-image-container');
                    
                    const img = document.createElement('img');
                    img.src = attachment.data;
                    img.alt = attachment.name || '添付画像';
                    img.classList.add('attachment-image');
                    
                    // 画像クリックで拡大表示
                    img.addEventListener('click', () => {
                        this._showFullSizeImage(attachment.data, attachment.name);
                    });
                    
                    imgContainer.appendChild(img);
                    attachmentsDiv.appendChild(imgContainer);
                } else if (attachment.type === 'pdf' && attachment.data) {
                    // PDFファイルのプレビュー表示
                    const pdfContainer = document.createElement('div');
                    pdfContainer.classList.add('attachment-pdf-container');
                    
                    // PDFのサムネイル・プレビュー表示
                    const pdfPreview = document.createElement('div');
                    pdfPreview.classList.add('pdf-preview');
                    
                    // PDFアイコン
                    const pdfIcon = document.createElement('i');
                    pdfIcon.className = 'fas fa-file-pdf';
                    
                    // PDFファイル名
                    const pdfName = document.createElement('span');
                    pdfName.textContent = attachment.name || 'PDF文書';
                    pdfName.classList.add('attachment-file-name');
                    
                    // プレビューボタン
                    const previewButton = document.createElement('button');
                    previewButton.classList.add('pdf-preview-button');
                    previewButton.textContent = 'プレビュー';
                    previewButton.addEventListener('click', () => {
                        this._showPDFPreview(attachment.data, attachment.name);
                    });
                    
                    // 要素を追加
                    pdfPreview.appendChild(pdfIcon);
                    pdfPreview.appendChild(pdfName);
                    pdfPreview.appendChild(previewButton);
                    pdfContainer.appendChild(pdfPreview);
                    attachmentsDiv.appendChild(pdfContainer);
                } else if (attachment.type === 'office' && attachment.data) {
                    // Officeファイルのプレビュー表示
                    const officeContainer = document.createElement('div');
                    officeContainer.classList.add('attachment-office-container');
                    
                    // Officeファイルのサムネイル・プレビュー表示
                    const officePreview = document.createElement('div');
                    officePreview.classList.add('office-preview');
                    
                    // Officeアイコン（ファイルタイプに応じて変更）
                    const officeIcon = document.createElement('i');
                    
                    // MIMEタイプに基づいてアイコンを設定
                    if (attachment.mimeType) {
                        if (attachment.mimeType.includes('word')) {
                            officeIcon.className = 'fas fa-file-word';
                        } else if (attachment.mimeType.includes('excel') || attachment.mimeType.includes('sheet')) {
                            officeIcon.className = 'fas fa-file-excel';
                        } else if (attachment.mimeType.includes('powerpoint') || attachment.mimeType.includes('presentation')) {
                            officeIcon.className = 'fas fa-file-powerpoint';
                        } else {
                            officeIcon.className = 'fas fa-file';
                        }
                    } else {
                        officeIcon.className = 'fas fa-file';
                    }
                    
                    // ファイル名
                    const officeName = document.createElement('span');
                    officeName.textContent = attachment.name || 'Officeファイル';
                    officeName.classList.add('attachment-file-name');
                    
                    // プレビュー表示ボタン
                    const contentButton = document.createElement('button');
                    contentButton.classList.add('office-content-button');
                    contentButton.textContent = 'プレビュー';
                    contentButton.addEventListener('click', () => {
                        this._showOfficeContent(attachment.content, attachment.name);
                    });
                    
                    // 要素を追加
                    officePreview.appendChild(officeIcon);
                    officePreview.appendChild(officeName);
                    officePreview.appendChild(contentButton);
                    officeContainer.appendChild(officePreview);
                    attachmentsDiv.appendChild(officeContainer);
                } else if (attachment.type === 'file' && attachment.name) {
                    // その他のファイル添付表示
                    const fileContainer = document.createElement('div');
                    const fileIcon = document.createElement('i');
                    fileIcon.className = 'fas fa-file';
                    
                    const fileName = document.createElement('span');
                    fileName.textContent = attachment.name || '添付ファイル';
                    fileName.classList.add('attachment-file-name');
                    
                    // テキスト系のファイルの場合はプレビューボタンを追加
                    // if (attachment.mimeType && (
                    //     attachment.mimeType.startsWith('text/') || 
                    //     attachment.mimeType.includes('javascript') || 
                    //     attachment.mimeType.includes('json') ||
                    //     attachment.mimeType.includes('xml') ||
                    //     attachment.mimeType.includes('yaml') ||
                    //     attachment.mimeType.includes('markdown')
                    // )) 
                    {
                        const previewButton = document.createElement('button');
                        previewButton.classList.add('file-preview-button');
                        previewButton.textContent = 'プレビュー';
                        previewButton.addEventListener('click', () => {
                            this._showTextFileContent(attachment.content, attachment.name);
                        });
                        
                        fileContainer.appendChild(fileIcon);
                        fileContainer.appendChild(fileName);
                        fileContainer.appendChild(previewButton);
                    }
                    // else {
                    //     fileContainer.appendChild(fileIcon);
                    //     fileContainer.appendChild(fileName);
                    // }
                    
                    attachmentsDiv.appendChild(fileContainer);
                }
            });
            
            if (attachmentsDiv.children.length === 0) {
                return document.createElement('div');
            }
            
            return attachmentsDiv;
        },
        
        /**
         * PDFプレビューを表示する
         * @private
         * @param {string} src - PDFのDataURL
         * @param {string} name - PDFファイル名
         */
        _showPDFPreview: function(src, name) {
            if (!src) return;
            
            // すでに表示されている場合は削除
            const existingOverlay = document.querySelector('.pdf-overlay');
            if (existingOverlay) {
                document.body.removeChild(existingOverlay);
                return;
            }
            
            // オーバーレイを作成
            const overlay = document.createElement('div');
            overlay.classList.add('pdf-overlay');
            
            // PDFプレビューエリア
            const pdfViewer = document.createElement('div');
            pdfViewer.classList.add('pdf-viewer');
            
            // PDFオブジェクト
            const pdfObject = document.createElement('object');
            pdfObject.type = 'application/pdf';
            pdfObject.data = src;
            pdfObject.width = '100%';
            pdfObject.height = '100%';
            
            // PDFが表示できない場合のフォールバック
            const fallback = document.createElement('p');
            fallback.innerHTML = `<a href="${src}" target="_blank">PDFを表示できません。こちらをクリックして開いてください。</a>`;
            pdfObject.appendChild(fallback);
            
            // タイトルバー
            const titleBar = document.createElement('div');
            titleBar.classList.add('pdf-title-bar');
            const titleText = document.createElement('span');
            titleText.textContent = name || 'PDF文書';
            
            // 閉じるボタン
            const closeBtn = document.createElement('button');
            closeBtn.classList.add('overlay-close-btn');
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            
            // 閉じるボタンのクリックイベント
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
            });
            
            // オーバーレイのクリックでも閉じる
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                }
            });
            
            // 要素を追加
            titleBar.appendChild(titleText);
            titleBar.appendChild(closeBtn);
            pdfViewer.appendChild(pdfObject);
            overlay.appendChild(titleBar);
            overlay.appendChild(pdfViewer);
            document.body.appendChild(overlay);
        },

        /**
         * Officeファイルの内容を表示する
         * @private
         * @param {string} content - ファイルから抽出されたテキスト内容
         * @param {string} name - ファイル名
         */
        _showOfficeContent: function(content, name) {
            if (!content) {
                alert('ファイルの内容を表示できません。');
                return;
            }
            
            // すでに表示されている場合は削除
            const existingOverlay = document.querySelector('.office-overlay');
            if (existingOverlay) {
                document.body.removeChild(existingOverlay);
                return;
            }
            
            // オーバーレイを作成
            const overlay = document.createElement('div');
            overlay.classList.add('office-overlay');
            
            // コンテンツ表示エリア
            const contentViewer = document.createElement('div');
            contentViewer.classList.add('office-content-viewer');
            
            // テキスト表示
            const textContent = document.createElement('pre');
            textContent.classList.add('office-text-content');
            textContent.textContent = content;
            
            // タイトルバー
            const titleBar = document.createElement('div');
            titleBar.classList.add('office-title-bar');
            const titleText = document.createElement('span');
            titleText.textContent = name || 'ファイル内容';
            
            // 閉じるボタン
            const closeBtn = document.createElement('button');
            closeBtn.classList.add('overlay-close-btn');
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            
            // 閉じるボタンのクリックイベント
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
            });
            
            // オーバーレイのクリックでも閉じる
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                }
            });
            
            // 要素を追加
            titleBar.appendChild(titleText);
            titleBar.appendChild(closeBtn);
            contentViewer.appendChild(textContent);
            overlay.appendChild(titleBar);
            overlay.appendChild(contentViewer);
            document.body.appendChild(overlay);
        },
        
        /**
         * メッセージを処理して表示する
         * @private
         * @param {HTMLElement} messageDiv - メッセージ要素
         * @param {HTMLElement} chatMessages - メッセージを追加する対象要素
         */
        _processMessageAndAppend: function(messageDiv, chatMessages) {
            if (!messageDiv || !chatMessages) return;
            
            // コードブロックにコピーボタンを追加とシンタックスハイライトの適用
            setTimeout(() => {
                try {
                    window.Markdown.addCodeBlockCopyButtons(messageDiv);
                    if (typeof Prism !== 'undefined') {
                        Prism.highlightAllUnder(messageDiv);
                    }
                } catch (error) {
                    console.error('コードハイライト処理中にエラーが発生しました:', error);
                }
            }, 10);
            
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        },

        /**
         * 会話を表示
         * @param {Object} conversation - 表示する会話オブジェクト
         * @param {HTMLElement} chatMessages - メッセージを表示する要素
         * @param {HTMLSelectElement} modelSelect - モデル選択要素
         */
        displayConversation: async function(conversation, chatMessages, modelSelect) {
            if (!conversation || !chatMessages) return;
            
            chatMessages.innerHTML = '';
            
            // PDFファイル内容が含まれるメッセージを処理する補助関数
            const cleanFileContent = (messageContent) => {
                if (typeof messageContent !== 'string') return messageContent;
                
                // ファイル内容を示すマーカーパターン（複数のタイプに対応）
                const fileMarkerPatterns = [
                    // ファイル内容
                    /===\s*[^」]+ファイル「[^」]+」の内容\s*===[\s\S]*?(?=(===\s*|$))/g,
                ];
                
                // 各パターンについて内容を削除
                let cleanedContent = messageContent;
                for (const pattern of fileMarkerPatterns) {
                    cleanedContent = cleanedContent.replace(pattern, '');
                }
                
                return cleanedContent.trim();
            };
            
            // システムメッセージ以外を表示
            for (const message of conversation.messages) {
                if (!message || !message.role) continue;
                
                if (message.role === 'system') continue;
                
                if (message.role === 'user') {
                    let content = typeof message.content === 'string' 
                        ? message.content 
                        : this._processContentArray(message.content);
                    
                    // ファイルの内容を除外
                    const displayContent = cleanFileContent(content);
                    
                    // ユーザーメッセージを表示（添付ファイルは後で追加）
                    await this.addUserMessage(displayContent, chatMessages, [], message.timestamp);
                } else if (message.role === 'assistant') {
                    const content = typeof message.content === 'string' 
                        ? message.content 
                        : this._processContentArray(message.content);
                    // チャット履歴の表示時はタイピングエフェクトを使わない(false)
                    await this.addBotMessage(content, chatMessages, message.timestamp, false);
                }
            }
            
            // モデルを設定（存在する場合のみ）
            if (modelSelect) {
                try {
                    const model = conversation.model || 'gpt-4o-mini';
                    const modelExists = Array.from(modelSelect.options).some(option => option.value === model);
                    modelSelect.value = modelExists ? model : modelSelect.options[0].value;
                } catch (error) {
                    console.error('モデル選択の設定中にエラーが発生しました:', error);
                }
            }
            
            // 添付ファイルを読み込んで表示（正しいメッセージに関連付け）
            window.FileHandler.displaySavedAttachments(conversation.id, chatMessages);
            
            // シンタックスハイライトを再適用
            if (typeof Prism !== 'undefined') {
                try {
                    Prism.highlightAll();
                } catch (error) {
                    console.error('シンタックスハイライトの適用中にエラーが発生しました:', error);
                }
            }
        },
        
        /**
         * 配列型のコンテンツを処理する
         * @private
         * @param {Array|string} content - 処理するコンテンツ
         * @returns {string} 処理された文字列
         */
        _processContentArray: function(content) {
            if (typeof content === 'string') return content;
            if (!Array.isArray(content)) return '';
            
            let result = '';
            
            for (const item of content) {
                if (!item || !item.type) continue;
                
                if (item.type === 'text' && item.text) {
                    result += item.text;
                } else if (item.type === 'image_url' && item.image_url && item.image_url.url) {
                    result += `\n![画像](${item.image_url.url})\n`;
                }
            }
            
            return result;
        },

        /**
         * 安全に子要素を削除する
         * @private
         * @param {HTMLElement} parent - 親要素
         * @param {HTMLElement} child - 削除する子要素
         */
        _safeRemoveChild: function(parent, child) {
            if (!parent || !child) return;
            
            try {
                if (parent.contains(child)) {
                    parent.removeChild(child);
                }
            } catch (error) {
                console.error('子要素の削除中にエラーが発生しました:', error);
            }
        },

        /**
         * 「Thinking...」インジケーターを作成
         * @private
         * @returns {HTMLElement} 作成されたインジケーター要素
         */
        _createTypingIndicator: function() {
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('message', 'bot', 'typing-indicator');
            typingIndicator.innerHTML = `
                <div class="message-content">
                    <p>Thinking<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
                </div>
            `;
            return typingIndicator;
        },
        
        /**
         * エラーメッセージを表示
         * @private
         * @param {string} errorMessage - エラーメッセージ
         * @param {HTMLElement} chatMessages - メッセージ表示要素
         */
        _showErrorMessage: function(errorMessage, chatMessages) {
            if (!chatMessages) return;
            
            const errorMessageDiv = document.createElement('div');
            errorMessageDiv.classList.add('message', 'bot', 'error');
            errorMessageDiv.innerHTML = `
                <div class="message-content">
                    <p>エラーが発生しました: ${errorMessage || '不明なエラー'}</p>
                    <button id="showApiSettings" class="error-action">API設定を確認する</button>
                </div>
            `;
            chatMessages.appendChild(errorMessageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        },

        /**
         * 会話履歴を表示する
         * @param {Array} conversations - 会話オブジェクトの配列
         * @param {string} currentConversationId - 現在の会話ID
         * @param {HTMLElement} chatHistory - 履歴表示要素
         * @param {Function} onSwitchConversation - 会話切り替え時のコールバック
         * @param {Function} onShowRenameModal - 名前変更時のコールバック
         * @param {Function} onDeleteConversation - 会話削除時のコールバック
         */
        renderChatHistory: function(conversations, currentConversationId, chatHistory, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
            if (!chatHistory || !Array.isArray(conversations)) return;
            
            chatHistory.innerHTML = '';
            
            // 会話がない場合は空状態を表示
            if (conversations.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.classList.add('empty-history');
                emptyState.innerHTML = `
                    <p>会話履歴がありません</p>
                    <p>新しいチャットを開始してください</p>
                `;
                chatHistory.appendChild(emptyState);
                return;
            }
            
            // プロンプトごとにグループ化するための処理
            const promptGroups = this.groupConversationsByPrompt(conversations);
            
            // 各プロンプトグループごとにセクションを作成
            Object.entries(promptGroups).forEach(([promptKey, groupConversations]) => {
                if (!Array.isArray(groupConversations) || groupConversations.length === 0) return;
                
                // カテゴリーの状態を取得（展開/折りたたみ）
                const categoryStates = window.Storage.loadCategoryStates();
                const isExpanded = categoryStates[promptKey] !== false; // デフォルトは展開状態
                
                // カテゴリーセクションを作成
                const categorySection = this._createCategorySection(
                    promptKey, 
                    groupConversations,
                    isExpanded,
                    onSwitchConversation,
                    onShowRenameModal,
                    onDeleteConversation
                );
                
                // チャット履歴に追加
                chatHistory.appendChild(categorySection);
            });
            
            this.updateActiveChatInHistory(currentConversationId);
        },

        /**
         * カテゴリーセクションを作成する
         * @private
         * @param {string} promptKey - プロンプトカテゴリーキー
         * @param {Array} groupConversations - カテゴリーに属する会話の配列
         * @param {boolean} isExpanded - 展開状態か
         * @param {Function} onSwitchConversation - 会話切り替え時のコールバック
         * @param {Function} onShowRenameModal - 名前変更時のコールバック
         * @param {Function} onDeleteConversation - 会話削除時のコールバック
         * @returns {HTMLElement} 作成されたカテゴリーセクション
         */
        _createCategorySection: function(promptKey, groupConversations, isExpanded, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
            if (!promptKey || !Array.isArray(groupConversations)) {
                return document.createElement('div');
            }
            
            const categorySection = document.createElement('div');
            categorySection.classList.add('chat-category');
            categorySection.dataset.category = promptKey;
            
            // カテゴリーヘッダーを作成
            const categoryHeader = document.createElement('div');
            categoryHeader.classList.add('category-header');
            
            // 展開/折りたたみアイコン
            const toggleIcon = document.createElement('i');
            toggleIcon.classList.add('fas', isExpanded ? 'fa-chevron-down' : 'fa-chevron-right');
            
            // カテゴリー名
            const categoryName = document.createElement('span');
            categoryName.textContent = promptKey;
            
            // 会話数バッジ
            const countBadge = document.createElement('span');
            countBadge.classList.add('category-count');
            countBadge.textContent = groupConversations.length;
            
            // ヘッダーに要素を追加
            categoryHeader.appendChild(toggleIcon);
            categoryHeader.appendChild(categoryName);
            categoryHeader.appendChild(countBadge);
            
            // 会話リストコンテナを作成
            const conversationList = document.createElement('div');
            conversationList.classList.add('category-conversations');
            if (!isExpanded) {
                conversationList.style.display = 'none';
            }
            
            // ヘッダークリックで展開/折りたたみ
            categoryHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleCategoryExpansion(toggleIcon, conversationList, promptKey);
            });
            
            // カテゴリー内の会話を表示
            groupConversations.forEach(conversation => {
                if (!conversation) return;
                
                const historyItem = this._createHistoryItem(
                    conversation, 
                    onSwitchConversation, 
                    onShowRenameModal, 
                    onDeleteConversation
                );
                conversationList.appendChild(historyItem);
            });
            
            // カテゴリーセクションに追加
            categorySection.appendChild(categoryHeader);
            categorySection.appendChild(conversationList);
            
            return categorySection;
        },
        
        /**
         * カテゴリー展開/折りたたみを切り替え
         * @private
         * @param {HTMLElement} toggleIcon - トグルアイコン要素
         * @param {HTMLElement} conversationList - 会話リスト要素
         * @param {string} promptKey - プロンプトカテゴリーキー
         */
        _toggleCategoryExpansion: function(toggleIcon, conversationList, promptKey) {
            if (!toggleIcon || !conversationList || !promptKey) return;
            
            const isNowExpanded = toggleIcon.classList.contains('fa-chevron-down');
            
            if (isNowExpanded) {
                toggleIcon.classList.replace('fa-chevron-down', 'fa-chevron-right');
                conversationList.style.display = 'none';
            } else {
                toggleIcon.classList.replace('fa-chevron-right', 'fa-chevron-down');
                conversationList.style.display = 'block';
            }
            
            // 状態を保存
            window.Storage.saveCategoryState(promptKey, !isNowExpanded);
        },
        
        /**
         * 履歴アイテムを作成
         * @private
         * @param {Object} conversation - 会話オブジェクト
         * @param {Function} onSwitchConversation - 会話切り替え時のコールバック
         * @param {Function} onShowRenameModal - 名前変更時のコールバック
         * @param {Function} onDeleteConversation - 会話削除時のコールバック
         * @returns {HTMLElement} 作成された履歴アイテム
         */
        _createHistoryItem: function(conversation, onSwitchConversation, onShowRenameModal, onDeleteConversation) {
            if (!conversation || !conversation.id) {
                return document.createElement('div');
            }
            
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            historyItem.dataset.id = conversation.id;
            
            // コンテンツとアクションボタンを含むコンテナを作成
            const itemContent = document.createElement('div');
            itemContent.classList.add('history-item-content');
            itemContent.innerHTML = `
                <i class="fas fa-comments"></i>
                <span class="history-item-title">${conversation.title || '新しいチャット'}</span>
            `;
            
            // アクションボタンのコンテナ
            const actionButtons = document.createElement('div');
            actionButtons.classList.add('history-item-actions');
            
            // 編集ボタン
            const editButton = document.createElement('button');
            editButton.classList.add('history-action-button', 'edit-button');
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'チャットの名前を変更';
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();  // クリックイベントの伝播を止める
                if (typeof onShowRenameModal === 'function') {
                    onShowRenameModal(conversation);
                }
            });
            
            // 削除ボタン
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('history-action-button', 'delete-button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'チャットを削除';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();  // クリックイベントの伝播を止める
                if (typeof onDeleteConversation === 'function') {
                    onDeleteConversation(conversation.id);
                }
            });
            
            // ボタンをアクションコンテナに追加
            actionButtons.appendChild(editButton);
            actionButtons.appendChild(deleteButton);
            
            // 内容とアクションボタンをアイテムに追加
            historyItem.appendChild(itemContent);
            historyItem.appendChild(actionButtons);
            
            // チャットアイテムのクリックイベント（チャット切り替え）
            itemContent.addEventListener('click', () => {
                if (typeof onSwitchConversation === 'function') {
                    onSwitchConversation(conversation.id);
                }
            });
            
            return historyItem;
        },

        /**
         * 会話をシステムプロンプトでグループ化する
         * @param {Array} conversations - 会話オブジェクトの配列
         * @returns {Object} プロンプトカテゴリごとにグループ化された会話
         */
        groupConversationsByPrompt: function(conversations) {
            if (!Array.isArray(conversations)) {
                return { '未分類': [] };
            }
            
            const groups = {};
            
            conversations.forEach(conversation => {
                if (!conversation) return;
                
                // システムプロンプトを取得
                let systemPrompt = '未分類';
                
                // システムメッセージからプロンプトを取得
                const systemMessage = conversation.messages?.find(m => m?.role === 'system');
                if (systemMessage && systemMessage.content) {
                    systemPrompt = this.getPromptCategory(systemMessage.content);
                }
                
                // グループが存在しない場合は作成
                if (!groups[systemPrompt]) {
                    groups[systemPrompt] = [];
                }
                
                // 会話をグループに追加
                groups[systemPrompt].push(conversation);
            });
            
            // 未分類グループがない場合は作成
            if (!groups['未分類']) {
                groups['未分類'] = [];
            }
            
            return groups;
        },
        
        /**
         * システムプロンプトからカテゴリを判定
         * @param {string} promptText - システムプロンプトテキスト
         * @returns {string} カテゴリーキー
         */
        getPromptCategory: function(promptText) {
            if (!promptText) return '未分類';
            
            // プロンプトテンプレートを取得
            const templates = window.Storage.loadPromptTemplates();
            
            // テンプレートと照合
            for (const templateName in templates) {
                if (templates[templateName] === promptText) {
                    return templateName;
                }
            }
            
            // デフォルトは未分類
            return '未分類';
        },
        
        /**
         * アクティブなチャットを更新
         * @param {string} currentConversationId - 現在の会話ID
         */
        updateActiveChatInHistory: function(currentConversationId) {
            if (!currentConversationId) return;
            
            try {
                const historyItems = document.querySelectorAll('.history-item');
                historyItems.forEach(item => {
                    if (item.dataset.id === currentConversationId) {
                        item.classList.add('active');
                        
                        // アクティブな項目が含まれるカテゴリを見つけて展開
                        const categorySection = item.closest('.chat-category');
                        if (categorySection) {
                            const conversationList = categorySection.querySelector('.category-conversations');
                            const toggleIcon = categorySection.querySelector('.category-header .fas');
                            const promptKey = categorySection.dataset.category;
                            
                            if (conversationList && toggleIcon && promptKey && conversationList.style.display === 'none') {
                                this._toggleCategoryExpansion(toggleIcon, conversationList, promptKey);
                            }
                        }
                    } else {
                        item.classList.remove('active');
                    }
                });
            } catch (error) {
                console.error('アクティブチャットの更新中にエラーが発生しました:', error);
            }
        },

        /**
         * テキストファイルの内容を表示
         * @private
         * @param {string} content - ファイルの内容
         * @param {string} name - ファイル名
         */
        _showTextFileContent: function(content, name) {
            if (!content) {
                alert('ファイルの内容を表示できません。');
                return;
            }
            
            // すでに表示されている場合は削除
            const existingOverlay = document.querySelector('.text-file-overlay');
            if (existingOverlay) {
                document.body.removeChild(existingOverlay);
                return;
            }
            
            // オーバーレイを作成
            const overlay = document.createElement('div');
            overlay.classList.add('text-file-overlay');
            
            // コンテンツ表示エリア
            const contentViewer = document.createElement('div');
            contentViewer.classList.add('text-file-viewer');
            
            // テキスト表示
            const textContent = document.createElement('pre');
            textContent.classList.add('text-file-content');
            textContent.innerHTML = this._formatTextContent(content, name);
            
            // タイトルバー
            const titleBar = document.createElement('div');
            titleBar.classList.add('text-file-title-bar');
            const titleText = document.createElement('span');
            titleText.textContent = name || 'テキストファイル';
            
            // 閉じるボタン
            const closeBtn = document.createElement('button');
            closeBtn.classList.add('overlay-close-btn');
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            
            // 閉じるボタンのクリックイベント
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
            });
            
            // オーバーレイのクリックでも閉じる
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                }
            });
            
            // 要素を追加
            titleBar.appendChild(titleText);
            titleBar.appendChild(closeBtn);
            contentViewer.appendChild(textContent);
            overlay.appendChild(titleBar);
            overlay.appendChild(contentViewer);
            document.body.appendChild(overlay);
            
            // シンタックスハイライトを適用（可能な場合）
            if (typeof Prism !== 'undefined') {
                Prism.highlightElement(textContent);
            }
        },
        
        /**
         * テキストファイルの内容をフォーマット
         * @private
         * @param {string} content - ファイルの内容
         * @param {string} fileName - ファイル名
         * @returns {string} フォーマットされたテキスト
         */
        _formatTextContent: function(content, fileName) {
            if (!content) return '';
            
            // ファイルの拡張子を取得
            const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
            
            // 拡張子に基づいて言語クラスを設定
            let langClass = '';
            switch (ext) {
                case 'js':
                    langClass = 'language-javascript';
                    break;
                case 'json':
                    langClass = 'language-json';
                    break;
                case 'html':
                    langClass = 'language-html';
                    break;
                case 'css':
                    langClass = 'language-css';
                    break;
                case 'md':
                    langClass = 'language-markdown';
                    break;
                case 'xml':
                    langClass = 'language-xml';
                    break;
                case 'yaml':
                case 'yml':
                    langClass = 'language-yaml';
                    break;
                default:
                    langClass = 'language-plaintext';
            }
            
            // エスケープしてコードブロックとして表示
            const escapedContent = this._escapeHtml(content);
            return `<code class="${langClass}">${escapedContent}</code>`;
        },
        
        /**
         * HTMLの特殊文字をエスケープ
         * @private
         * @param {string} text - エスケープするテキスト
         * @returns {string} エスケープされたテキスト
         */
        _escapeHtml: function(text) {
            if (!text) return '';
            
            const escape = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            
            return text.replace(/[&<>"']/g, char => escape[char]);
        }
    };
})();