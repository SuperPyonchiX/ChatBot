/**
 * webContentExtractor.js
 * URLからコンテンツを抽出し、整形するユーティリティクラス
 * TavilyのAPIを使用してLLM向け検索機能も提供
 */
class WebContentExtractor {
    // シングルトンインスタンス
    static #instance = null;
    
    // TavilyのAPIキー
    #tavilyApiKey = null;
    
    // TavilyのAPIエンドポイント
    #tavilySearchEndpoint = 'https://api.tavily.com/search';
    #tavilyExtractEndpoint = 'https://api.tavily.com/extract';

    /**
     * シングルトンインスタンスを取得します
     * @returns {WebContentExtractor} WebContentExtractorのシングルトンインスタンス
     */
    static get getInstance() {
        if (!WebContentExtractor.#instance) {
            WebContentExtractor.#instance = new WebContentExtractor();
        }
        return WebContentExtractor.#instance;
    }

    /**
     * プライベートコンストラクタ
     * @private
     */
    constructor() {
        if (WebContentExtractor.#instance) {
            throw new Error('WebContentExtractorクラスは直接インスタンス化できません。WebContentExtractor.instanceを使用してください。');
        }
        
        // ローカルストレージからAPIキーを取得
        this.#tavilyApiKey = AppState.apiSettings.tavilyApiKey || null;
        if (this.#tavilyApiKey) {
            console.log('Tavily APIキー取得:', this.#tavilyApiKey);
        } else {
            console.warn('Tavily APIキーが設定されていません。');
        }
    }
    
    /**
     * TavilyのAPIキーを設定します
     * @param {string} apiKey - TavilyのAPIキー
     */
    setTavilyApiKey(apiKey) {
        this.#tavilyApiKey = apiKey;
        localStorage.setItem('tavilyApiKey', apiKey);
    }
    
    /**
     * TavilyのAPIキーが設定されているかチェックします
     * @returns {boolean} APIキーが設定されているか
     */
    hasTavilyApiKey() {
        return !!this.#tavilyApiKey;
    }

    // extractWebContents メソッドは削除されました

    /**
     * Tavily検索APIを使用して検索を実行する
     * @private
     * @param {string} query - 検索クエリ
     * @returns {Promise<Object>} 検索結果
     */
    async #performTavilySearch(query) {
        try {
            const response = await fetch(this.#tavilySearchEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.#tavilyApiKey}`
                },
                body: JSON.stringify({
                    query: query,
                    search_depth: 'advanced',
                    include_domains: [], // 任意で検索ドメイン制限を追加可能
                    exclude_domains: [], // 任意で除外ドメインを追加可能
                    include_answer: true, // 検索結果の要約を含める
                    max_results: 5, // 検索結果の数を5件に制限
                    include_raw_content: false, // 生の内容は含めない
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { error: `${response.status}: ${errorData.message || response.statusText}` };
            }
            
            return await response.json();
        } catch (error) {
            console.error('Tavily検索エラー:', error);
            return { error: error.message || '検索中にエラーが発生しました' };
        }
    }

    /**
     * TavilyのExtract APIを使用してURLの内容を抽出する
     * @private
     * @param {string} url - 抽出対象のURL
     * @returns {Promise<Object>} 抽出結果
     */
    async #performTavilyExtract(url) {
        try {
            const response = await fetch(this.#tavilyExtractEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.#tavilyApiKey}`
                },
                body: JSON.stringify({
                    url: url,
                    extract_techniques: ['fulltext', 'table', 'images'],
                    include_raw_html: false, // 生のHTMLは含めない
                    include_images: false // 画像は含めない
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { error: `${response.status}: ${errorData.message || response.statusText}` };
            }
            
            return await response.json();
        } catch (error) {
            console.error('Tavily抽出エラー:', error);
            return { error: error.message || 'コンテンツ抽出中にエラーが発生しました' };
        }
    }

    /**
     * Tavilyを使用してWeb検索を実行する
     * @param {string} query - 検索クエリ
     * @param {HTMLElement} chatMessages - チャットメッセージ表示要素
     * @returns {Promise<{messageWithSearchResults: string, hasResults: boolean}>} 検索結果を含むメッセージと結果の有無
     */
    async searchWeb(query, chatMessages) {
        if (!query) return { messageWithSearchResults: query, hasResults: false };
        if (!this.#tavilyApiKey) return { 
            messageWithSearchResults: query + '\n\n> Tavily APIキーが設定されていないため、WEB検索できません。システム設定から設定してください。', 
            hasResults: false 
        };

        try {
            // 進捗状況を表示
            const progressElement = this.#showProgressIndicator(chatMessages, 'WEB検索中');

            const searchResults = await this.#performTavilySearch(query);
            
            // 進捗状況表示を削除
            progressElement?.remove();

            if (searchResults.error) {
                return { 
                    messageWithSearchResults: query + `\n\n> WEB検索に失敗しました: ${searchResults.error}`, 
                    hasResults: false 
                };
            }

            // 検索結果をマークダウン形式で整形
            let formattedResults = '\n\n### 検索結果\n\n';
            
            searchResults.results.forEach((result, index) => {
                formattedResults += `#### ${index + 1}. [${result.title}](${result.url})\n`;
                formattedResults += `${result.content}\n\n`;
            });
            
            formattedResults += `\n*検索時刻: ${new Date().toLocaleString()}*\n`;
            
            return {
                messageWithSearchResults: query + formattedResults,
                hasResults: searchResults.results.length > 0
            };
        } catch (error) {
            console.error('WEB検索エラー:', error);
            return { 
                messageWithSearchResults: query + '\n\n> WEB検索中にエラーが発生しました。', 
                hasResults: false 
            };
        }
    }
    
    /**
     * Tavilyを使用して特定のURLの内容を詳細に抽出する
     * @param {string} url - 抽出対象のURL
     * @param {HTMLElement} chatMessages - チャットメッセージ表示要素
     * @returns {Promise<{extractedContent: string, success: boolean}>} 抽出された内容と成功状態
     */
    async extractDetailedContent(url, chatMessages) {
        if (!url) return { extractedContent: '', success: false };
        if (!this.#tavilyApiKey) return { 
            extractedContent: '> Tavily APIキーが設定されていないため、コンテンツを抽出できません。システム設定から設定してください。', 
            success: false 
        };

        try {
            // 進捗状況を表示
            const progressElement = this.#showProgressIndicator(chatMessages, 'コンテンツ抽出中');

            const extractResult = await this.#performTavilyExtract(url);
            
            // 進捗状況表示を削除
            progressElement?.remove();

            if (extractResult.error) {
                return { 
                    extractedContent: `> コンテンツ抽出に失敗しました: ${extractResult.error}`, 
                    success: false 
                };
            }

            // 抽出結果をマークダウン形式で整形
            let formattedContent = `### ${extractResult.title || 'ウェブページの内容'}\n\n`;
            
            if (extractResult.description) {
                formattedContent += `> ${extractResult.description}\n\n`;
            }
            
            formattedContent += extractResult.content;
            formattedContent += `\n\n[元のページを表示](${url})\n`;
            
            return {
                extractedContent: formattedContent,
                success: true
            };
        } catch (error) {
            console.error('コンテンツ抽出エラー:', error);
            return { 
                extractedContent: '> コンテンツ抽出中にエラーが発生しました。', 
                success: false 
            };
        }
    }

    /**
     * 進捗状況インジケータを表示
     * @private
     * @param {HTMLElement} chatMessages - チャットメッセージ表示要素
     * @param {string} message - 表示するメッセージ
     * @returns {HTMLElement} 作成された進捗表示要素
     */
    #showProgressIndicator(chatMessages, message = 'WEB情報取得中') {
        if (!chatMessages) return null;

        const messageDiv = ChatUI.getInstance.createElement('div', {
            classList: ['message', 'user'],
        });
        const contentDiv = ChatUI.getInstance.createElement('div');
        contentDiv.innerHTML = `
            <div class="message-content">
                <p>${message}<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
            </div>
        `;
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        return messageDiv;
    }

    // #fetchUrlContent メソッドは削除されました

    /**
     * GPTにWeb検索が必要かどうか判断してもらう
     * @param {string} query - ユーザーの質問内容
     * @param {string} model - 使用するモデル名
     * @returns {Promise<{needsSearch: boolean, searchQuery: string}>} 検索が必要かどうかの判断と検索クエリ
     */
    async checkIfSearchNeeded(query, model) {
        if (!query) return { needsSearch: false, searchQuery: '' };
        if (!this.#tavilyApiKey) return { needsSearch: false, searchQuery: '' };

        try {
            // GPTに検索が必要かどうか判断してもらうシステムプロンプト
            const systemPrompt = `あなたはユーザーの質問に回答するAIアシスタントです。
現在の日付: ${new Date().toLocaleDateString('ja-JP')}
あなたの役割は、ユーザーの質問に対して検索が必要かどうかを判断することです。
検索が必要な場合は、最適な検索クエリも提案してください。
以下のような場合は検索が必要です：
1. 最新の情報やニュースについての質問（例：「今日の天気」「最新のAI技術」など）
2. 事実確認が必要な具体的な情報（例：「東京タワーの高さ」「Python 3.11の新機能」など）
3. あなたの知識が及ばない可能性がある専門的な質問
4. あなたのトレーニングデータ以降の出来事に関する質問（2023年以降の事象）

回答は必ず以下のJSON形式で出力してください：
{
  "needsSearch": true または false,
  "searchQuery": "検索が必要な場合の最適な検索クエリ（日本語で）",
  "reasoning": "判断理由の簡潔な説明"
}`;

            // AIAPIクラスを使用してOpenAI APIを呼び出す
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
            ];
            
            // ストリーミングなしでAPIを呼び出す
            const content = await AIAPI.getInstance.callOpenAIAPI(
                messages, 
                model || 'gpt-4o-mini'
            );
            
            console.log('検索判断結果:', content);

            if (!content) {
                return { needsSearch: false, searchQuery: '' };
            }

            try {
                // JSON文字列を抽出して解析
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    return { needsSearch: false, searchQuery: '' };
                }

                const jsonResult = JSON.parse(jsonMatch[0]);
                return {
                    needsSearch: jsonResult.needsSearch === true,
                    searchQuery: jsonResult.searchQuery || query,
                    reasoning: jsonResult.reasoning || ''
                };
            } catch (parseError) {
                console.error('検索判断結果の解析エラー:', parseError);
                return { needsSearch: false, searchQuery: '' };
            }
        } catch (error) {
            console.error('検索判断APIへの問い合わせエラー:', error);
            return { needsSearch: false, searchQuery: '' };
        }
    }

    /**
     * 自動Web検索を実行（検索が必要かどうかの判断も含む）
     * @param {string} query - ユーザーの質問内容
     * @param {string} model - 使用するモデル名
     * @param {HTMLElement} chatMessages - チャットメッセージ表示要素
     * @returns {Promise<{messageWithSearchResults: string, hasResults: boolean, searchPerformed: boolean}>} 検索結果
     */
    async autoSearchWeb(query, model, chatMessages) {
        if (!query) return { 
            messageWithSearchResults: query, 
            hasResults: false, 
            searchPerformed: false 
        };
        
        if (!this.#tavilyApiKey) return { 
            messageWithSearchResults: query, 
            hasResults: false, 
            searchPerformed: false,
            reason: 'Tavily APIキーが設定されていません' 
        };

        try {
            // 検索の必要性を判断
            const { needsSearch, searchQuery, reasoning } = await this.checkIfSearchNeeded(query, model);
            
            if (!needsSearch) {
                return { 
                    messageWithSearchResults: query, 
                    hasResults: false, 
                    searchPerformed: false,
                    reason: reasoning || '検索は必要ありません'
                };
            }
            
            // 進捗状況を表示
            const progressElement = this.#showProgressIndicator(chatMessages, '関連情報を検索中');
            
            // 実際の検索を実行
            const searchResults = await this.#performTavilySearch(searchQuery);
            
            // 進捗状況表示を削除
            progressElement?.remove();
            
            if (searchResults.error) {
                return { 
                    messageWithSearchResults: query, 
                    hasResults: false, 
                    searchPerformed: true,
                    reason: `検索中にエラーが発生しました: ${searchResults.error}`
                };
            }
            
            // 検索結果をマークダウン形式で整形
            let formattedResults = `\n\n### 以下のWEB検索結果を参考に回答してください。引用元のリンクも回答に含めてください。\n\n検索クエリ: "${searchQuery}"\n\n`;
            
            searchResults.results.forEach((result, index) => {
                formattedResults += `#### ${index + 1}. [${result.title}](${result.url})\n`;
                formattedResults += `${result.content}\n\n`;
            });
            
            formattedResults += `\n*検索時刻: ${new Date().toLocaleString()}*\n`;
            
            return {
                messageWithSearchResults: query + formattedResults,
                hasResults: searchResults.results.length > 0,
                searchPerformed: true,
                reason: reasoning || '検索が必要と判断しました'
            };
            
        } catch (error) {
            console.error('自動Web検索エラー:', error);
            return { 
                messageWithSearchResults: query, 
                hasResults: false, 
                searchPerformed: false,
                reason: 'エラーが発生しました'
            };
        }
    }
}

