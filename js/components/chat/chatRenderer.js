window.Chat = window.Chat || {};
window.Chat.Renderer = window.Chat.Renderer || {};
/**
 * chatRenderer.js
 * チャットメッセージのレンダリング機能を提供します
 */

Object.assign(window.Chat.Renderer, (function() {
    return {
        /**
         * ユーザーメッセージを追加する
         */
        addUserMessage: async function(message, chatMessages, attachments = [], timestamp = null) {
            if (!chatMessages) return;
            
            const msgTimestamp = timestamp || Date.now();
            const fragment = document.createDocumentFragment();
            
            const messageDiv = window.Chat.UI.createElement('div', {
                classList: ['message', 'user'],
                attributes: {
                    'data-timestamp': msgTimestamp.toString(),
                    'role': 'region',
                    'aria-label': 'あなたのメッセージ'
                }
            });
            
            const contentDiv = window.Chat.UI.createElement('div', { classList: 'message-content' });
            const copyButton = this._createCopyButton(message || '');
            
            try {
                const renderedMarkdown = await window.Markdown.renderMarkdown(message || '');
                const markdownContent = window.Chat.UI.createElement('div', {
                    classList: 'markdown-content',
                    innerHTML: renderedMarkdown
                });
                
                contentDiv.appendChild(copyButton);
                contentDiv.appendChild(markdownContent);
                
                if (attachments && attachments.length > 0) {
                    contentDiv.appendChild(window.Chat.AttachmentViewer.createAttachmentsElement(attachments));
                }
                
                messageDiv.appendChild(contentDiv);
                fragment.appendChild(messageDiv);
                chatMessages.appendChild(fragment);
                
                this._applyCodeFormatting(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } catch (e) {
                console.error('ユーザーメッセージのMarkdown解析エラー:', e);
                const markdownContent = window.Chat.UI.createElement('div', {
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
         */
        addBotMessage: async function(message, chatMessages, timestamp = null, animate = true) {
            if (!chatMessages) return;
            
            const msgTimestamp = timestamp || Date.now();
            const messageDiv = window.Chat.UI.createElement('div', {
                classList: ['message', 'bot'],
                attributes: {
                    'data-timestamp': msgTimestamp.toString(),
                    'role': 'region',
                    'aria-label': 'AIからの返答'
                }
            });
            
            const contentDiv = window.Chat.UI.createElement('div', { classList: 'message-content' });
            const copyButton = this._createCopyButton(message || '');
            const messageContent = window.Chat.UI.createElement('div', { classList: 'markdown-content' });
            
            if (animate) {
                messageContent.innerHTML = '';
                contentDiv.appendChild(copyButton);
                contentDiv.appendChild(messageContent);
                messageDiv.appendChild(contentDiv);
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                this._animateTyping(message, messageContent);
            } else {
                try {
                    const renderedMarkdown = await window.Markdown.renderMarkdown(message || '');
                    messageContent.innerHTML = renderedMarkdown;
                    contentDiv.appendChild(copyButton);
                    contentDiv.appendChild(messageContent);
                    messageDiv.appendChild(contentDiv);
                    
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
         */
        addStreamingBotMessage: function(chatMessages, timestamp = null) {
            if (!chatMessages) return null;
            
            const msgTimestamp = timestamp || Date.now();
            const messageDiv = window.Chat.UI.createElement('div', {
                classList: ['message', 'bot'],
                attributes: {
                    'data-timestamp': msgTimestamp.toString(),
                    'role': 'region',
                    'aria-label': 'AIからの返答'
                }
            });
            
            const contentDiv = window.Chat.UI.createElement('div', { classList: 'message-content' });
            const messageContent = window.Chat.UI.createElement('div', {
                classList: 'markdown-content',
                innerHTML: '<p>Thinking<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>'
            });
            
            contentDiv.appendChild(messageContent);
            messageDiv.appendChild(contentDiv);
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            return {
                messageDiv: messageDiv,
                contentContainer: messageContent
            };
        },
        
        /**
         * ストリーミング中にボットメッセージを更新する
         */
        updateStreamingBotMessage: async function(container, chunk, currentFullText, isFirstChunk = false) {
            if (!container) return;
            
            try {
                const renderedHTML = await window.Markdown.renderMarkdown(currentFullText);
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
        },
        
        /**
         * ストリーミングが完了したらボットメッセージを完成させる
         */
        finalizeStreamingBotMessage: async function(messageDiv, container, fullText) {
            if (!messageDiv || !container) return;
            
            try {
                const renderedHTML = await window.Markdown.renderMarkdown(fullText);
                container.innerHTML = renderedHTML;
                
                const contentDiv = messageDiv.querySelector('.message-content');
                if (contentDiv) {
                    const existingButton = contentDiv.querySelector('.copy-button');
                    if (existingButton) {
                        contentDiv.removeChild(existingButton);
                    }
                    
                    const copyButton = this._createCopyButton(fullText);
                    if (contentDiv.firstChild) {
                        contentDiv.insertBefore(copyButton, contentDiv.firstChild);
                    } else {
                        contentDiv.appendChild(copyButton);
                    }
                }
                
                if (typeof Prism !== 'undefined') {
                    Prism.highlightAllUnder(messageDiv);
                }
                
                window.Markdown.addCodeBlockCopyButtons(messageDiv);
                
            } catch (e) {
                console.error('ストリーミング完了時のMarkdown解析エラー:', e);
                container.textContent = fullText;
            }
        },

        /**
         * コードブロックのフォーマットとハイライトを適用する
         * @private
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
         */
        _animateTyping: async function(message, container) {
            if (!message || !container) return;
            
            const typingConfig = window.CONFIG?.UI?.TYPING_EFFECT || {};
            const typingEnabled = typingConfig.ENABLED !== undefined ? typingConfig.ENABLED : true;
            
            if (!typingEnabled) {
                try {
                    const renderedHTML = await window.Markdown.renderMarkdown(message);
                    container.innerHTML = renderedHTML;
                    
                    if (typeof Prism !== 'undefined') {
                        Prism.highlightAllUnder(container);
                    }
                    
                    window.Markdown.addCodeBlockCopyButtons(container.closest('.message'));
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
                        const renderedHTML = await window.Markdown.renderMarkdown(markdownText);
                        container.innerHTML = renderedHTML;
                        
                        if (typeof Prism !== 'undefined') {
                            Prism.highlightAllUnder(container);
                        }
                        
                        window.Markdown.addCodeBlockCopyButtons(container.closest('.message'));
                        
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
        },
        
        /**
         * コピーボタンを作成する
         * @private
         */
        _createCopyButton: function(textToCopy) {
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
        }
    };
})());