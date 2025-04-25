/**
 * confluenceChatActions.js
 * チャットインターフェースからConfluenceを検索するためのアクション
 */

class ConfluenceChatActions {
    static #instance = null;
    #confluenceService;
      constructor() {
        if (ConfluenceChatActions.#instance) {
            return ConfluenceChatActions.#instance;
        }
          this.#confluenceService = ConfluenceService.getInstance;
        
        ConfluenceChatActions.#instance = this;
    }
    
    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ConfluenceChatActions.#instance) {
            ConfluenceChatActions.#instance = new ConfluenceChatActions();
        }
        return ConfluenceChatActions.#instance;
    }
    
    /**
     * UIにConfluence検索ボタンを追加
     * 
     * @param {HTMLElement} chatInputContainer - チャット入力コンテナ要素
     */
    addConfluenceSearchButton(chatInputContainer) {
        // 既存のボタンコンテナを探す
        let actionsContainer = chatInputContainer.querySelector('.chat-input-actions');
        
        // なければ作成
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.className = 'chat-input-actions';
            chatInputContainer.appendChild(actionsContainer);
        }          // Confluence検索ボタン作成
        const searchButton = document.createElement('button');
        searchButton.className = 'primary-button action-button confluence-search-btn';
        searchButton.title = 'Confluenceで検索';
        searchButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>';
        
        // クリックイベント設定
        searchButton.addEventListener('click', () => this.#handleConfluenceSearchClick());
        
        actionsContainer.appendChild(searchButton);
    }
    
    /**
     * Confluence検索ボタン押下時の処理
     * @private
     */
    #handleConfluenceSearchClick() {
        if (!this.#confluenceService.isConfigured()) {
            UI.getInstance.Core.Notification.show('Confluenceの設定が必要です', 'warning');
            ConfluenceSettingsModal.getInstance.show();
            return;
        }
        
        // 検索クエリ入力用のモーダル表示
        this.#showSearchQueryInput();
    }
      /**
     * 検索クエリ入力用のミニモーダルを表示
     * @private 
     */
    #showSearchQueryInput() {
        // 既存のモーダルがあれば削除
        const existingModal = document.querySelector('.confluence-search-modal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }
        
        // オーバーレイ作成
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(miniModal);
        });
        
        // ミニモーダル作成
        const miniModal = document.createElement('div');
        miniModal.className = 'modal mini-modal confluence-search-modal';
        
        const modalTitle = document.createElement('h4');
        modalTitle.textContent = 'Confluenceで検索';
        miniModal.appendChild(modalTitle);
        
        // フォーム作成
        const form = document.createElement('form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            const askGpt = askGptCheckbox.checked;
            
            if (query) {
                document.body.removeChild(overlay);
                document.body.removeChild(miniModal);
                this.#performConfluenceSearch(query, askGpt);
            }
        });
        
        // 検索入力欄
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '検索キーワードを入力...';
        searchInput.required = true;
        searchInput.className = 'confluence-search-input';
        
        formGroup.appendChild(searchInput);
        form.appendChild(formGroup);
        
        // GPTオプション
        const optionGroup = document.createElement('div');
        optionGroup.className = 'form-group checkbox-group';
        
        const askGptCheckbox = document.createElement('input');
        askGptCheckbox.type = 'checkbox';
        askGptCheckbox.id = 'ask-gpt-checkbox';
        
        const askGptLabel = document.createElement('label');
        askGptLabel.setAttribute('for', 'ask-gpt-checkbox');
        askGptLabel.textContent = '検索結果をもとにGPTに回答を生成させる';
        
        optionGroup.appendChild(askGptCheckbox);
        optionGroup.appendChild(askGptLabel);
        form.appendChild(optionGroup);
        
        // 説明テキスト
        const helpText = document.createElement('p');
        helpText.className = 'help-text';
        helpText.textContent = 'オンにすると、Confluenceの検索結果をGPTに送り、その情報を元に回答を生成します。';
        form.appendChild(helpText);
        
        // ボタンコンテナ
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-button-container';
        
        // 検索ボタン
        const searchButton = document.createElement('button');
        searchButton.textContent = '検索';
        searchButton.type = 'submit';
        searchButton.className = 'button primary';
        buttonContainer.appendChild(searchButton);
        
        // キャンセルボタン
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'キャンセル';
        cancelButton.type = 'button';
        cancelButton.className = 'button secondary';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(miniModal);
        });
        buttonContainer.appendChild(cancelButton);
        
        form.appendChild(buttonContainer);
        miniModal.appendChild(form);
        
        // DOMに追加
        document.body.appendChild(overlay);
        document.body.appendChild(miniModal);
        
        // 入力欄にフォーカス
        searchInput.focus();
    }    /**
     * Confluence検索を実行し、結果をチャットに表示
     * 
     * @param {string} query - 検索クエリ
     * @param {boolean} [askGpt=false] - 検索結果をGPTに質問するかどうか
     * @param {HTMLElement} [existingMessage=null] - 既存の検索メッセージ要素（メインチャットからの呼び出し時に使用）
     * @returns {Promise<Object>} - 検索結果
     * @private
     */
    async #performConfluenceSearch(query, askGpt = false, existingMessage = null) {
        // 検索中メッセージをチャットに表示（既存のメッセージがあれば使用）
        const searchingMessage = existingMessage || this.#addSystemMessageToChat(`Confluenceで「${query}」を検索中...`);
        
        try {
            // 検索実行
            const result = await this.#confluenceService.searchInConfluence(query, (output) => {
                // 必要に応じてリアルタイム出力を処理
                if (output.type === 'error') {
                    searchingMessage.textContent = `検索エラー: ${output.content}`;
                    searchingMessage.classList.add('error-message');
                }
            });
            
            // 検索結果を処理
            if (result.error) {
                searchingMessage.textContent = `検索エラー: ${result.error}`;
                searchingMessage.classList.add('error-message');
                return null;
            }
            
            // 検索結果をパース（文字列の場合）
            let parsedResults;
            if (typeof result.result === 'string') {
                // JSON文字列をパースしようとする
                try {
                    const resultText = result.result;
                    const jsonMatch = resultText.match(/{[\s\S]*}/);
                    if (jsonMatch) {
                        parsedResults = JSON.parse(jsonMatch[0]);
                    }
                } catch (parseError) {
                    console.error('結果のパースエラー:', parseError);
                }
            }
            
            // 結果表示のHTMLを生成
            let resultsHTML;
            if (parsedResults && parsedResults.results && parsedResults.results.length > 0) {
                // GPTに質問する場合は追加ボタンを表示
                const askGptButton = askGpt ? '' : `<button class="button primary-button ask-gpt-btn">この検索結果についてGPTに質問</button>`;
                
                resultsHTML = `<div class="confluence-search-results">
                    <h4>Confluence検索結果: ${parsedResults.results.length}件</h4>
                    <ul class="result-list">
                        ${parsedResults.results.map((item, index) => `
                            <li class="result-item">
                                <h5>
                                    <a href="${item.url}" target="_blank" rel="noopener noreferrer">
                                        ${item.title}
                                    </a>
                                </h5>
                                <div class="result-summary">${item.summary}</div>
                                <div class="result-actions">
                                    <button class="button mini-button view-content-btn" data-page-id="${item.id}">内容を表示</button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                    ${askGptButton}
                </div>`;
                
                // 検索結果をチャットに表示
                searchingMessage.innerHTML = resultsHTML;
                
                // 「内容を表示」ボタンと「GPTに質問」ボタンにイベントを設定
                setTimeout(() => {
                    const viewButtons = searchingMessage.querySelectorAll('.view-content-btn');
                    viewButtons.forEach(button => {
                        button.addEventListener('click', () => {
                            const pageId = button.getAttribute('data-page-id');
                            this.#showConfluencePageContent(pageId);
                        });
                    });
                    
                    // GPTに質問ボタンのイベント設定
                    const askGptBtn = searchingMessage.querySelector('.ask-gpt-btn');
                    if (askGptBtn) {
                        askGptBtn.addEventListener('click', () => {
                            this.#askGptWithConfluenceResults(query, parsedResults);
                        });
                    }
                }, 100);
                
                // GPTに質問する場合はここで実行
                if (askGpt && parsedResults) {
                    return this.#askGptWithConfluenceResults(query, parsedResults, searchingMessage);
                }
                
                return parsedResults;
            } else {
                // 検索結果がない場合
                searchingMessage.textContent = `「${query}」に関する情報はConfluenceで見つかりませんでした。`;
                return null;
            }
        } catch (error) {
            console.error('Confluence検索エラー:', error);
            searchingMessage.textContent = `検索エラー: ${error.message || '不明なエラーが発生しました'}`;
            searchingMessage.classList.add('error-message');
            return null;
        }
    }
    
    /**
     * Confluenceページの内容を表示
     * 
     * @param {string} pageId - ページID
     * @private 
     */
    async #showConfluencePageContent(pageId) {
        // 読み込み中メッセージをチャットに表示
        const loadingMessage = this.#addSystemMessageToChat('Confluenceページの内容を読み込み中...');
        
        try {
            // ページ内容を取得
            const result = await this.#confluenceService.getPageContent(pageId);
            
            // 結果をパース
            let pageContent;
            if (typeof result.result === 'string') {
                try {
                    const resultText = result.result;
                    const jsonMatch = resultText.match(/{[\s\S]*}/);
                    if (jsonMatch) {
                        pageContent = JSON.parse(jsonMatch[0]);
                    }
                } catch (parseError) {
                    console.error('結果のパースエラー:', parseError);
                }
            }
            
            if (pageContent) {
                // ページ内容をHTMLで表示
                const contentHTML = `<div class="confluence-page-content">
                    <h4>${pageContent.title}</h4>
                    <div class="page-meta">
                        スペース: ${pageContent.space} | バージョン: ${pageContent.version}
                    </div>
                    <div class="content-display">
                        ${pageContent.htmlContent || pageContent.textContent || '内容を取得できませんでした'}
                    </div>
                </div>`;
                
                loadingMessage.innerHTML = contentHTML;
            } else {
                loadingMessage.textContent = 'ページ内容を取得できませんでした。';
                loadingMessage.classList.add('error-message');
            }
        } catch (error) {
            console.error('ページ内容取得エラー:', error);
            loadingMessage.textContent = `エラー: ${error.message || '不明なエラーが発生しました'}`;
            loadingMessage.classList.add('error-message');
        }
    }    /**
     * Confluenceで検索してGPTに回答させる（パブリックメソッド - メインチャットからも使用可能）
     * 
     * @param {string} query - 検索クエリ
     * @param {HTMLElement} [searchingMessage] - すでに表示されている検索中メッセージ要素
     * @returns {Promise<Object>} - 検索と回答の結果
     * @public
     */
    async searchAndAnswerWithGPT(query, searchingMessage = null) {
        try {
            // 検索中メッセージをまだ表示していない場合は表示
            const searchMessage = searchingMessage || this.#addSystemMessageToChat(`Confluenceで「${query}」を検索中...`);
            
            // Confluence検索を実行
            const results = await this.#performConfluenceSearch(query, true, searchMessage);
            return results;
        } catch (error) {
            console.error('Confluence検索と回答生成エラー:', error);
            return { error: error.message || '検索処理中にエラーが発生しました' };
        }
    }

    /**
     * Confluenceの検索結果をもとにGPTに質問する
     * 
     * @param {string} query - ユーザーの質問
     * @param {Object} confluenceResults - Confluenceの検索結果
     * @param {HTMLElement} [searchingMessage] - 既存の検索結果メッセージ要素
     * @returns {Promise<Object>} - GPTの応答結果
     * @private
     */
    async #askGptWithConfluenceResults(query, confluenceResults, searchingMessage = null) {
        const results = confluenceResults.results || [];
        if (results.length === 0) {
            return null;
        }
        
        // GPTに送信するプロンプトを作成
        let contextText = '以下のConfluence検索結果を参考にして質問に回答してください。\n\n';
        
        // 検索結果の内容を追加
        results.forEach((item, index) => {
            contextText += `----文書${index + 1}----\n`;
            contextText += `タイトル: ${item.title}\n`;
            contextText += `要約: ${item.summary}\n\n`;
        });
        
        // ユーザー質問を追加
        contextText += `----質問----\n${query}\n\n`;
        
        try {
            // 処理中メッセージを表示
            const processingMessage = searchingMessage || this.#addSystemMessageToChat(`Confluenceの情報をもとにGPTが回答を作成中...`);
            if (!searchingMessage) {
                processingMessage.classList.add('gpt-processing');
            }
            
            // 現在のチャット会話を取得
            const currentConversation = window.AppState.getConversationById(window.AppState.currentConversationId);
            if (!currentConversation) {
                throw new Error('現在の会話が見つかりません');
            }
            
            // システムプロンプトを取得
            const systemPrompt = window.AppState.systemPrompt || window.CONFIG.SYSTEM_PROMPTS.DEFAULT_SYSTEM_PROMPT;
            
            // GPTにコンテキストと質問を送信するためのメッセージ配列
            const messagesWithSystem = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: contextText }
            ];
            
            // チャット履歴を作成
            if (!currentConversation.messages) {
                currentConversation.messages = [];
            }
            
            // ユーザーのメッセージとして会話履歴に追加
            currentConversation.messages.push({
                role: 'user',
                content: `Confluence検索「${query}」結果に基づく質問`,
                timestamp: Date.now()
            });
            
            let fullResponseText = '';
            let isFirstChunk = true;
            
            // メッセージのHTML要素を作成
            const chatMessages = document.getElementById('chatMessages');
            if (!chatMessages) {
                throw new Error('チャットメッセージ要素が見つかりません');
            }
            
            // 応答表示用のメッセージ要素
            const { messageDiv, contentContainer } = ChatRenderer.getInstance.addStreamingBotMessage(chatMessages, Date.now());
            
            // GPTにAPI呼び出し
            await AIAPI.getInstance.callOpenAIAPI(
                messagesWithSystem,
                currentConversation.model,
                [],  // 添付ファイルなし
                {
                    stream: true,
                    onChunk: (chunk) => {
                        fullResponseText += chunk;
                        // ストリーミング中のメッセージ更新
                        ChatRenderer.getInstance.updateStreamingBotMessage(contentContainer, chunk, fullResponseText, isFirstChunk);
                        isFirstChunk = false;
                    },
                    onComplete: (fullText) => {
                        // ストリーミング完了時の処理
                        ChatRenderer.getInstance.finalizeStreamingBotMessage(messageDiv, contentContainer, fullText);
                        fullResponseText = fullText;
                        
                        // 元々の検索結果メッセージを更新（渡された場合のみ）
                        if (searchingMessage) {
                            searchingMessage.innerHTML = `<div class="confluence-search-results">
                                <h4>Confluence検索結果がGPTに送信されました</h4>
                                <p>「${query}」に関する情報をGPTに提供しました。</p>
                            </div>`;
                        }
                    }
                }
            );
            
            // 応答をメッセージ履歴に追加
            currentConversation.messages.push({
                role: 'assistant',
                content: fullResponseText,
                timestamp: Date.now()
            });
            
            // 会話更新を保存
            ChatHistory.getInstance.saveConversation(currentConversation);
            
            return { success: true, response: fullResponseText };
        } catch (error) {
            console.error('GPT応答生成エラー:', error);
            const errorMessage = this.#addSystemMessageToChat(`エラー: Confluenceの情報をもとにした回答の生成に失敗しました - ${error.message}`);
            errorMessage.classList.add('error-message');
            return { error: error.message };
        }
    }
    
    /**
     * システムメッセージをチャットに追加
     * 
     * @param {string} message - メッセージ内容
     * @returns {HTMLElement} - 追加されたメッセージ要素
     * @private
     */
    #addSystemMessageToChat(message) {
        const chatContainer = document.querySelector('.chat-messages-container');
        if (!chatContainer) {
            console.error('チャットコンテナが見つかりません');
            return null;
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message system-message confluence-message';
        messageElement.textContent = message;
        
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return messageElement;
    }
}
