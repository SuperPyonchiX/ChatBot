/**
 * chatActions.js
 * チャット関連のアクション（メッセージ送信、会話管理など）を担当するモジュール
 */
class ChatActions {
    // シングルトンインスタンス
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {ChatActions} ChatActionsのシングルトンインスタンス
     */
    static get getInstance() {
        if (!ChatActions.#instance) {
            ChatActions.#instance = new ChatActions();
        }
        return ChatActions.#instance;
    }

    /**
     * プライベートコンストラクタ
     * @private
     */
    constructor() {
        if (ChatActions.#instance) {
            throw new Error('ChatActionsクラスは直接インスタンス化できません。ChatActions.instanceを使用してください。');
        }
    }

    /**
     * メッセージを送信します
     */
    async sendMessage() {
        const currentConversation = window.AppState.getConversationById(window.AppState.currentConversationId);
        if (!currentConversation || !window.Elements.userInput || !window.Elements.chatMessages) return;
        
        try {
            // 送信ボタンを無効化
            if (window.Elements.sendButton) {
                window.Elements.sendButton.disabled = true;
            }
            
            // FileHandlerから現在の添付ファイルを取得
            const apiAttachments = await FileAttachment.getInstance.getAttachmentsForAPI();
            
            // 添付ファイルの参照を保持
            const attachmentsToSend = apiAttachments.length > 0 ? apiAttachments : window.AppState.currentAttachments;
            
            // 送信前に添付ファイルをクリア
            window.AppState.currentAttachments = [];
            FileHandler.getInstance.clearSelectedFiles();
            
            // 添付ファイルのプレビュー表示をクリア
            const filePreviewArea = document.querySelector('.file-preview');
            if (filePreviewArea) {
                filePreviewArea.remove();
            }
            
            const attachmentPreviewArea = document.querySelector('.attachment-preview-area');
            if (attachmentPreviewArea) {
                FileAttachment.getInstance.clearAttachments(attachmentPreviewArea);
            }
            
            // ストリーミングメソッドを使用してメッセージを送信
            const result = await this.#processAndSendMessage(
                window.Elements.userInput, 
                window.Elements.chatMessages, 
                currentConversation, 
                window.AppState.apiSettings, 
                window.AppState.systemPrompt,
                attachmentsToSend
            );
            
            if (result?.titleUpdated) {
                this.renderChatHistory();
            }
            
            if (!result?.error) {
                // 会話を保存
                Storage.getInstance.saveConversations(window.AppState.conversations);
                
                // 添付ファイルを保存（正常送信時のみ）
                if (attachmentsToSend && attachmentsToSend.length > 0) {
                    // 最新のユーザーメッセージのタイムスタンプを取得
                    const latestUserMessage = currentConversation.messages
                        .filter(m => m.role === 'user')
                        .pop();
                    
                    // FileHandlerのタイムスタンプを優先
                    const timestamp = FileHandler.getInstance.attachmentTimestamp || 
                                    (latestUserMessage ? latestUserMessage.timestamp : Date.now());
                    
                    FileAttachment.getInstance.saveAttachmentsForConversation(
                        currentConversation.id, 
                        attachmentsToSend
                    );
                }
            }
        } catch (error) {
            console.error('メッセージ送信中にエラーが発生しました:', error);
            // エラー表示
            const errorMsg = document.createElement('div');
            errorMsg.classList.add('error-message');
            errorMsg.textContent = 'メッセージ送信中にエラーが発生しました。';
            window.Elements.chatMessages.appendChild(errorMsg);
        } finally {
            // 送信ボタンを再有効化
            if (window.Elements.sendButton) {
                window.Elements.sendButton.disabled = false;
            }
        }
    }

    /**
     * 新しい会話を作成します
     */
    createNewConversation() {
        const newConversation = {
            id: Date.now().toString(),
            title: '新しいチャット',
            messages: [
                {
                    role: 'system',
                    content: window.AppState.systemPrompt || ''
                }
            ],
            model: window.AppState.getCurrentModel()
        };
        
        window.AppState.conversations.unshift(newConversation);
        Storage.getInstance.saveConversations(window.AppState.conversations);
        
        window.AppState.currentConversationId = newConversation.id;
        Storage.getInstance.saveCurrentConversationId(window.AppState.currentConversationId);
        
        this.renderChatHistory();
        
        if (window.Elements.chatMessages && window.Elements.modelSelect) {
            // 会話を表示
            ChatHistory.getInstance.displayConversation(newConversation, window.Elements.chatMessages, window.Elements.modelSelect);
        }
    }

    /**
     * 会話履歴を表示します
     */
    renderChatHistory() {
        if (!window.Elements.chatHistory) return;
        
        // チャット履歴を更新
        ChatHistory.getInstance.renderChatHistory(
            window.AppState.conversations, 
            window.AppState.currentConversationId, 
            window.Elements.chatHistory, 
            this.#switchConversation.bind(this), 
            RenameChatModal.getInstance.showRenameChatModal, 
            this.#deleteConversation.bind(this)
        );
    }

    /**
     * すべての履歴をクリアします
     */
    clearAllHistory() {
        if (confirm('すべての会話履歴を削除してもよろしいですか？')) {
            // すべての添付ファイルを削除
            window.AppState.conversations.forEach(conversation => {
                if (conversation.id) {
                    Storage.getInstance.removeAttachments(conversation.id);
                }
            });
            
            window.AppState.conversations = [];
            Storage.getInstance.saveConversations(window.AppState.conversations);
            this.createNewConversation();
        }
    }

    /**
     * メッセージを処理して送信する
     * @param {Object} userInput - ユーザー入力要素
     * @param {HTMLElement} chatMessages - チャットメッセージ要素
     * @param {Object} conversation - 現在の会話オブジェクト
     * @param {Object} apiSettings - API設定
     * @param {string} systemPrompt - システムプロンプト
     * @param {Array} attachments - 添付ファイル配列
     * @returns {Promise<Object>} 送信結果
     */
    async #processAndSendMessage(userInput, chatMessages, conversation, apiSettings, systemPrompt, attachments = []) {
        if (!userInput || !chatMessages || !conversation) {
            return { error: 'Invalid parameters' };
        }

        try {
            const userText = userInput.value.trim();
            if (!userText && (!attachments || attachments.length === 0)) {
                return { error: 'No message content' };
            }

            // ユーザー入力をクリア
            userInput.value = '';
            UIUtils.getInstance.autoResizeTextarea(userInput);

            let titleUpdated = false;
            const timestamp = Date.now();

            // 添付ファイルの処理
            let attachmentContent = '';
            let displayAttachments = [];

            // メッセージの前処理（URL情報の取得など）を実行
            const { messageWithWebContents, hasWebContent } = await this.getWebContents(userText);

            if (attachments && attachments.length > 0) {
                displayAttachments = attachments.map(att => ({
                    ...att,
                    timestamp: timestamp
                }));

                attachmentContent = await this.#processAttachments(attachments);
            }

            // 添付ファイルの内容を含めた最終的なメッセージを作成
            const finalMessage = (attachmentContent ? `${messageWithWebContents}\n\n${attachmentContent}` : messageWithWebContents);

            const userMessage = {
                role: 'user',
                content: finalMessage,
                timestamp: timestamp
            };

            // ユーザーメッセージを表示
            await ChatRenderer.getInstance.addUserMessage(finalMessage, chatMessages, displayAttachments, timestamp);
            conversation.messages.push(userMessage);

            // チャットタイトルの更新
            if (conversation.title === '新しいチャット' && 
                conversation.messages.filter(m => m.role === 'user').length === 1) {
                conversation.title = userText.substring(0, 30) + (userText.length > 30 ? '...' : '');
                titleUpdated = true;
            }

            // APIリクエストの処理
            const effectiveSystemPrompt = systemPrompt || window.CONFIG.SYSTEM_PROMPTS.DEFAULT_SYSTEM_PROMPT;
            const messagesWithSystem = [
                { role: 'system', content: effectiveSystemPrompt },
                ...conversation.messages.filter(m => m.role !== 'system')
            ];

            const botTimestamp = Date.now();
            // ストリーミング用のボットメッセージを表示
            const { messageDiv, contentContainer } = ChatRenderer.getInstance.addStreamingBotMessage(chatMessages, botTimestamp);

            let fullResponseText = '';
            let isFirstChunk = true;

            // ストリーミングAPI呼び出し
            await AIAPI.getInstance.callOpenAIAPI(
                messagesWithSystem,
                conversation.model,
                displayAttachments,
                {
                    stream: true,
                    onChunk: (chunk) => {
                        fullResponseText += chunk;
                        ChatRenderer.getInstance.updateStreamingBotMessage(contentContainer, chunk, fullResponseText, isFirstChunk);
                        isFirstChunk = false;
                    },
                    onComplete: (fullText) => {
                        ChatRenderer.getInstance.finalizeStreamingBotMessage(messageDiv, contentContainer, fullText);
                        fullResponseText = fullText;
                    }
                }
            );

            // 応答をメッセージ履歴に追加
            conversation.messages.push({
                role: 'assistant',
                content: fullResponseText,
                timestamp: botTimestamp
            });

            return { titleUpdated, response: fullResponseText };

        } catch (error) {
            // エラーメッセージを表示
            const errorMessage = error.message || 'APIリクエスト中にエラーが発生しました';
            this.#showErrorMessage(errorMessage, chatMessages);

            return { titleUpdated: false, error: error.message || '内部エラーが発生しました' };
        }
    }

    /**
     * エラーメッセージを表示
     * @private
     * @param {string} errorMessage - エラーメッセージ
     * @param {HTMLElement} chatMessages - メッセージ表示要素
     */
    #showErrorMessage(errorMessage, chatMessages) {
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
    }

    /**
     * 添付ファイルの内容を処理する
     * @private
     * @param {Array} attachments - 添付ファイルの配列
     * @returns {Promise<string>} 処理された添付ファイルの内容
     */
    async #processAttachments(attachments) {
        if (!attachments || !Array.isArray(attachments)) {
            return '';
        }

        let content = '';
        for (const attachment of attachments) {
            if (!attachment || !attachment.type) continue;

            if ((attachment.type === 'pdf' || 
                 attachment.type === 'office' || 
                 attachment.type === 'file') && 
                attachment.content) {
                content += `\n${attachment.content}\n`;
            }
        }
        return content;
    }

    /**
     * メッセージ内のURLから情報を取得する
     * @param {string} message - URLを検索するメッセージ
     * @returns {Promise<{messageWithWebContents: string, hasWebContent: boolean}>} 処理されたメッセージとWeb情報の有無
     */
    async getWebContents(message) {
        if (!message) return { messageWithWebContents: message, hasWebContent: false };

        try {
            const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
            const urls = message.match(urlRegex) || [];

            if (urls.length === 0) {
                return { messageWithWebContents: message, hasWebContent: false };
            }

            // 進捗状況表示用の要素を作成
            const messageDiv = ChatUI.getInstance.createElement('div', {
                classList: ['message', 'user'],
            });
            const contentDiv = ChatUI.getInstance.createElement('div');
            contentDiv.innerHTML = `
                <div class="message-content">
                    <p>WEB情報取得中<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
                </div>
            `;
            messageDiv.appendChild(contentDiv);
            window.Elements.chatMessages.appendChild(messageDiv);

            const urlResults = await Promise.all(urls.map(url => this.#fetchUrlContent(url)));
            
            // 進捗状況表示を削除
            messageDiv.remove();

            const urlContents = urlResults.map(result => result.content);
            const messageWithWebContents = message + '\n\n' + urlContents.join('\n\n');
            const hasWebContent = urlResults.some(result => !result.isError);

            return { messageWithWebContents, hasWebContent };
        } catch (error) {
            console.error('URL情報取得エラー:', error);
            return { messageWithWebContents: message, hasWebContent: false };
        }
    }

    /**
     * URLの内容を取得する
     * @private
     * @param {string} url - スクレイピングするURL
     * @returns {Promise<{content: string, isError: boolean}>} ページの内容とエラー状態
     */
    async #fetchUrlContent(url) {
        try {
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');

            // メタデータを抽出
            const title = doc.querySelector('title')?.textContent || '';
            const description = doc.querySelector('meta[name="description"]')?.content || '';
            const h1 = doc.querySelector('h1')?.textContent || '';

            // 本文のテキストを抽出（スクリプトとスタイルを除外）
            const bodyText = doc.body.textContent
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 1000); // 最初の1000文字に制限

            const content = `
### ${title || 'ウェブページの内容'}
${description ? `\n${description}\n` : ''}
${h1 ? `\n${h1}\n` : ''}
\n${bodyText}...\n
[元のページを表示](${url})
`;

            return { content, isError: false };
        } catch (error) {
            console.error('URLの内容取得に失敗しました:', error);
            return { 
                content: `\n> URLの内容を取得できませんでした: ${url}\n`,
                isError: true 
            };
        }
    }

    /**
     * 会話を切り替えます
     */
    #switchConversation(conversationId) {
        if (!conversationId) return;
        
        window.AppState.currentConversationId = conversationId;
        Storage.getInstance.saveCurrentConversationId(window.AppState.currentConversationId);
        
        // アクティブチャットを更新
        ChatHistory.getInstance.updateActiveChatInHistory(window.AppState.currentConversationId);
        
        if (window.Elements.chatMessages && window.Elements.modelSelect) {
            // 会話を表示
            ChatHistory.getInstance.displayConversation(
                window.AppState.getConversationById(window.AppState.currentConversationId),
                window.Elements.chatMessages,
                window.Elements.modelSelect
            );
            
            // 添付ファイルを表示
            FileAttachment.getInstance.displaySavedAttachments(window.AppState.currentConversationId, window.Elements.chatMessages);
        }
    }

    /**
     * 会話を削除します
     */
    #deleteConversation(conversationId) {
        // 確認ダイアログを表示
        if (!confirm('このチャットを削除してもよろしいですか？')) return;
            
        // 削除するチャットが現在表示中のチャットかどうか確認
        const isCurrentChat = conversationId === window.AppState.currentConversationId;
        
        // チャットを削除
        window.AppState.conversations = window.AppState.conversations.filter(conv => conv.id !== conversationId);
        Storage.getInstance.saveConversations(window.AppState.conversations);
        
        // 添付ファイルも削除
        Storage.getInstance.removeAttachments(conversationId);
        
        // 削除したチャットが現在表示中だった場合、別のチャットに切り替える
        if (isCurrentChat) {
            if (window.AppState.conversations.length > 0) {
                // 最初のチャットに切り替え
                window.AppState.currentConversationId = window.AppState.conversations[0].id;
                Storage.getInstance.saveCurrentConversationId(window.AppState.currentConversationId);
                
                if (window.Elements.chatMessages && window.Elements.modelSelect) {
                    // 会話を表示
                    ChatHistory.getInstance.displayConversation(
                        window.AppState.getConversationById(window.AppState.currentConversationId),
                        window.Elements.chatMessages,
                        window.Elements.modelSelect
                    );
                }
            } else {
                // チャットがなくなった場合は新しいチャットを作成
                this.createNewConversation();
                return; // createNewConversation内でrenderChatHistoryを呼ぶので、ここでは不要
            }
        }
        
        // チャット履歴の表示を更新
        this.renderChatHistory();
    }
}
