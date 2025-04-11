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
    
    // WEB検索の有効/無効状態
    #isWebSearchEnabled = true;
    
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
        
        // ローカルストレージからWEB検索の有効/無効状態を取得
        this.#isWebSearchEnabled = Storage.getInstance.loadWebSearchEnabled();
        
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

    /**
     * WEB検索が有効かどうかを取得します
     * @returns {boolean} WEB検索が有効かどうか
     */
    isWebSearchEnabled() {
        return this.#isWebSearchEnabled;
    }

    /**
     * WEB検索の有効/無効を切り替えます
     * @param {boolean} enabled WEB検索を有効にするかどうか
     * @returns {boolean} 設定後のWEB検索の状態
     */
    toggleWebSearch(enabled) {
        this.#isWebSearchEnabled = enabled;
        Storage.getInstance.saveWebSearchEnabled(enabled);
        return this.#isWebSearchEnabled;
    }

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
     * GPTにWeb検索が必要かどうか判断してもらう
     * @param {string} query - ユーザーの質問内容
     * @param {string} model - 使用するモデル名
     * @param {string} systemPrompt - 現在のシステムプロンプト（オプション）
     * @returns {Promise<{needsSearch: boolean, searchQuery: string}>} 検索が必要かどうかの判断と検索クエリ
     */
    async checkIfSearchNeeded(query, model, systemPrompt = '') {
        if (!query) return { needsSearch: false, searchQuery: '' };
        if (!this.#tavilyApiKey) return { needsSearch: false, searchQuery: '' };

        try {
            // 検索要否判断用のシステムプロンプト
            const searchJudgmentPrompt = `あなたはユーザーの質問に回答するAIアシスタントです。
現在の日付: ${new Date().toLocaleDateString('ja-JP')}
あなたの役割は、ユーザーの質問に対して検索が必要かどうかを判断することです。

以下の2つの要素を考慮して判断してください：

1. システムプロンプトの性質
- タスク特化型のシステムプロンプトかどうかを判断してください
- タスク特化型とは、特定の作業や処理に特化した明確な指示が含まれているプロンプトです
- 例：コード解析、図の作成、UML作成、コードレビュー、リファクタリングなど

2. ユーザーの質問内容
以下のような場合は検索が必要です：
- 最新の情報やニュースについての質問
- 事実確認が必要な具体的な情報
- AIの知識が及ばない可能性がある専門的な質問
- トレーニングデータ以降の出来事に関する質問

以下のような場合は検索不要です：
- システムプロンプトがタスク特化型で、ユーザーの質問がそのタスクに関連している
- 提供されたコンテンツのみで完結するタスク
- 一般的なプログラミングの概念やパターンについての質問
- 特定のコードやシステムについての説明や改善提案

回答は必ず以下のJSON形式で出力してください：
{
  "needsSearch": true または false,
  "searchQuery": "検索が必要な場合の最適な検索クエリ（日本語で）",
  "reasoning": "判断理由の簡潔な説明"
}

現在のシステムの状況：
${systemPrompt ? `システムプロンプト: ${systemPrompt}\n` : '一般的な質問応答モード\n'}
ユーザーの質問: ${query}`;

            // AIAPIクラスを使用してOpenAI APIを呼び出す
            const messages = [
                { role: 'system', content: searchJudgmentPrompt },
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
            // Thinkingメッセージを表示
            const statusMessage = ChatRenderer.getInstance.addSystemMessage(chatMessages, 'Thinking');

            // 検索の必要性を判断（現在のシステムプロンプトを渡す）
            const { needsSearch, searchQuery, reasoning } = await this.checkIfSearchNeeded(
                query, 
                model,
                window.AppState.systemPrompt
            );
            
            if (!needsSearch) {
                // システムメッセージを削除
                ChatRenderer.getInstance.removeSystemMessage(statusMessage.messageDiv);
                return { 
                    messageWithSearchResults: query, 
                    hasResults: false, 
                    searchPerformed: false,
                    reason: reasoning || '検索は必要ありません'
                };
            }
            
            // Web検索中メッセージに更新
            ChatRenderer.getInstance.updateSystemMessage(statusMessage.messageDiv, 'Searching the web');
            
            // 実際の検索を実行
            const searchResults = await this.#performTavilySearch(searchQuery);
            
            // システムメッセージを削除
            ChatRenderer.getInstance.removeSystemMessage(statusMessage.messageDiv);
            
            if (searchResults.error) {
                return { 
                    messageWithSearchResults: query, 
                    hasResults: false, 
                    searchPerformed: true,
                    reason: `検索中にエラーが発生しました: ${searchResults.error}`
                };
            }
            
            // 検索結果をマークダウン形式で整形
            let formattedResults = `\n\n=== 以下のWEB検索結果を参考に回答してください ===\n引用元のリンクも回答に含めてください。\n\n検索クエリ: "${searchQuery}"\n\n`;
            
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
            // エラー時もシステムメッセージを削除
            if (statusMessage?.messageDiv) {
                ChatRenderer.getInstance.removeSystemMessage(statusMessage.messageDiv);
            }
            
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

