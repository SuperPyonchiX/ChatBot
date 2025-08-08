/**
 * webContentExtractor.js
 * URLからコンテンツを抽出し、整形するユーティリティクラス
 * GPT-4o/GPT-5シリーズのResponses API内蔵Web検索機能に対応
 */
class WebContentExtractor {
    // シングルトンインスタンス
    static #instance = null;
    
    // WEB検索の有効/無効状態
    #isWebSearchEnabled = true;

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
        
        // ローカルストレージからWEB検索の有効/無効状態を取得
        this.#isWebSearchEnabled = Storage.getInstance.loadWebSearchEnabled();
        
        console.log('WebContentExtractor初期化完了');
    }

    /**
     * Web検索機能の有効/無効状態を取得します
     * @returns {boolean} Web検索機能が有効な場合はtrue
     */
    isWebSearchEnabled() {
        return this.#isWebSearchEnabled;
    }

    /**
     * Web検索機能の有効/無効を切り替えます
     * @param {boolean} enabled - 有効にする場合はtrue、無効にする場合はfalse
     */
    setWebSearchEnabled(enabled) {
        this.#isWebSearchEnabled = enabled;
        Storage.getInstance.saveWebSearchEnabled(enabled);
    }

    /**
     * URLからコンテンツを抽出します（直接フェッチ）
     * @param {string} url - 抽出対象のURL
     * @returns {Promise<{success: boolean, content: string, title?: string, error?: string}>}
     */
    async extractContent(url) {
        try {
            // プロキシサーバーを使用してCORSを回避
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const htmlContent = data.contents;

            // HTMLから本文を抽出
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            // タイトルを抽出
            const title = doc.querySelector('title')?.textContent?.trim() || 'タイトルなし';
            
            // 本文を抽出（基本的なクリーニング）
            const bodyText = this.#extractTextFromHTML(doc);

            return {
                success: true,
                content: bodyText,
                title: title
            };

        } catch (error) {
            console.error('URL抽出エラー:', error);
            return {
                success: false,
                content: '',
                error: error.message
            };
        }
    }

    /**
     * HTMLドキュメントからテキストを抽出します
     * @private
     * @param {Document} doc - パース済みのHTMLドキュメント
     * @returns {string} 抽出されたテキスト
     */
    #extractTextFromHTML(doc) {
        // 不要な要素を削除
        const unwantedSelectors = ['script', 'style', 'nav', 'header', 'footer', 'aside', '.advertisement', '.ad', '.sidebar'];
        unwantedSelectors.forEach(selector => {
            const elements = doc.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });

        // メインコンテンツの候補を取得
        const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.main-content', '#content', '#main'];
        let mainContent = null;

        for (const selector of mainSelectors) {
            mainContent = doc.querySelector(selector);
            if (mainContent) break;
        }

        // メインコンテンツが見つからない場合はbodyを使用
        const targetElement = mainContent || doc.body;
        
        if (!targetElement) {
            return '';
        }

        // テキストを抽出してクリーンアップ
        const text = targetElement.textContent || '';
        
        return text
            .replace(/\s+/g, ' ') // 複数の空白を単一スペースに
            .replace(/\n\s*\n/g, '\n') // 複数の改行を単一改行に
            .trim()
            .substring(0, 8000); // 8000文字に制限
    }
}

// グローバルスコープに登録
window.WebContentExtractor = WebContentExtractor;
