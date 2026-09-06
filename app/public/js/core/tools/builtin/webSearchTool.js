/**
 * webSearchTool.js
 * Web検索ツール
 * プロバイダ組み込みのWeb検索（OpenAI Responses API の web_search、Claude の web_search ツール）を
 * モデルがツールとして呼べるようにラップする
 */

/**
 * @typedef {Object} WebSearchResult
 * @property {boolean} success - 成功したかどうか
 * @property {string} query - 検索クエリ
 * @property {string} [model] - 検索に使ったモデル
 * @property {string} [results] - 検索結果を含む応答テキスト
 * @property {string} [error] - エラーメッセージ
 */

class WebSearchTool {
    static #instance = null;

    /** @type {string} */
    name = 'web_search';

    /** @type {string} */
    description = 'Webを検索して最新の情報を取得します。ニュース、現在の出来事、最新の仕様など、学習データに無い情報が必要なときに使います。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: '検索クエリ（例: "2026年 Node.js LTS バージョン"）'
            }
        },
        required: ['query']
    };

    /** @type {string[]} */
    keywords = ['検索', '調べ', 'ウェブ', 'インターネット', '最新', 'ニュース', 'search', 'web', 'internet', 'latest', 'news', 'current'];

    constructor() {
        if (WebSearchTool.#instance) {
            return WebSearchTool.#instance;
        }
        WebSearchTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {WebSearchTool}
     */
    static get getInstance() {
        if (!WebSearchTool.#instance) {
            WebSearchTool.#instance = new WebSearchTool();
        }
        return WebSearchTool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params - パラメータ
     * @param {string} params.query - 検索クエリ
     * @returns {Promise<WebSearchResult>}
     */
    async execute(params) {
        const { query } = params;

        if (!query || typeof query !== 'string') {
            return { success: false, query: query || '', error: '検索クエリが指定されていません' };
        }

        const api = window.AIAPI?.getInstance;
        if (!api) {
            return { success: false, query, error: 'AIAPI が利用できません' };
        }

        const model = this.#selectModel();
        if (!model) {
            return { success: false, query, error: 'Web検索に対応したモデルが設定されていません' };
        }

        try {
            console.log(`[WebSearchTool] 検索: "${query}" (model: ${model})`);

            const messages = [
                {
                    role: 'user',
                    content: `次のクエリでWeb検索を行い、見つかった事実を出典URL付きで簡潔にまとめてください。\n検索クエリ: ${query}`
                }
            ];

            const response = await api.callAIAPI(messages, model, [], {
                stream: false,
                enableWebSearch: true
            });

            return {
                success: true,
                query,
                model,
                results: typeof response === 'string' ? response : String(response ?? '')
            };
        } catch (error) {
            console.error('[WebSearchTool] 検索エラー:', error);
            return { success: false, query, error: `Web検索エラー: ${error.message}` };
        }
    }

    /**
     * Web検索に使うモデルを選ぶ
     * 現在選択中のモデルがWeb検索対応ならそれを使い、そうでなければ CONFIG.WEB_SEARCH.AUTO_SEARCH_MODEL を使う
     * @returns {string|null}
     */
    #selectModel() {
        const config = window.CONFIG || {};
        const openaiCompatible = config.MODELS?.OPENAI_WEB_SEARCH_COMPATIBLE || [];
        const claudeModels = config.MODELS?.CLAUDE || [];
        const current = window.AppState?.getCurrentModel?.();

        if (current && (openaiCompatible.includes(current) || claudeModels.includes(current))) {
            return current;
        }
        return config.WEB_SEARCH?.AUTO_SEARCH_MODEL || openaiCompatible[0] || null;
    }

    /**
     * ツール定義を取得（Function Calling用）
     * @returns {Object}
     */
    getToolDefinition() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
}

// グローバルに公開
window.WebSearchTool = WebSearchTool;
