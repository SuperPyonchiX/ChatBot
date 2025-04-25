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
            if (query) {
                document.body.removeChild(overlay);
                document.body.removeChild(miniModal);
                this.#performConfluenceSearch(query);
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
        
        // ボタンコンテナ
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-button-container';
        
        // 検索ボタン
        const searchButton = document.createElement('button');
        searchButton.textContent = '検索';
        searchButton.type = 'submit';
        searchButton.className = 'button primary';
        buttonContainer.appendChild(searchButton);
        
        form.appendChild(buttonContainer);
        miniModal.appendChild(form);
        
        // DOMに追加
        document.body.appendChild(overlay);
        document.body.appendChild(miniModal);
        
        // 入力欄にフォーカス
        searchInput.focus();
    }
    
    /**
     * Confluence検索を実行し、結果をチャットに表示
     * 
     * @param {string} query - 検索クエリ
     * @private
     */
    async #performConfluenceSearch(query) {
        // 検索中メッセージをチャットに表示
        const searchingMessage = this.#addSystemMessageToChat(`Confluenceで「${query}」を検索中...`);
        
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
                return;
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
                </div>`;
                
                // 検索結果をチャットに表示
                searchingMessage.innerHTML = resultsHTML;
                
                // 「内容を表示」ボタンにイベントを設定
                setTimeout(() => {
                    const viewButtons = searchingMessage.querySelectorAll('.view-content-btn');
                    viewButtons.forEach(button => {
                        button.addEventListener('click', () => {
                            const pageId = button.getAttribute('data-page-id');
                            this.#showConfluencePageContent(pageId);
                        });
                    });
                }, 100);
            } else {
                // 検索結果がない場合
                searchingMessage.textContent = `「${query}」に関する情報はConfluenceで見つかりませんでした。`;
            }
        } catch (error) {
            console.error('Confluence検索エラー:', error);
            searchingMessage.textContent = `検索エラー: ${error.message || '不明なエラーが発生しました'}`;
            searchingMessage.classList.add('error-message');
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
