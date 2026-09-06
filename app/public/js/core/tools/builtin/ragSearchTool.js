/**
 * ragSearchTool.js
 * RAG検索ツール
 * 既存のRAGManagerと連携してナレッジベースを検索
 */

/**
 * @typedef {Object} RagSearchResult
 * @property {boolean} success - 成功したかどうか
 * @property {string} query - 検索クエリ
 * @property {Array} results - 検索結果
 * @property {number} totalResults - 結果件数
 * @property {string} [error] - エラーメッセージ
 */

class RagSearchTool {
    static #instance = null;

    /** @type {string} */
    name = 'rag_search';

    /** @type {string} */
    description = 'ナレッジベースから関連ドキュメントを検索します。登録済みの文書から情報を取得できます。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: '検索クエリ'
            },
            topK: {
                type: 'number',
                description: '取得する結果の最大数（デフォルト: 5）'
            },
            threshold: {
                type: 'number',
                description: '類似度の閾値（0-1、デフォルト: 0.5）'
            }
        },
        required: ['query']
    };

    /** @type {string[]} */
    keywords = ['検索', '調べ', '探す', 'ナレッジ', '知識', 'ドキュメント', '文書', 'search', 'find', 'knowledge', 'document', 'RAG'];

    /**
     * @constructor
     */
    constructor() {
        if (RagSearchTool.#instance) {
            return RagSearchTool.#instance;
        }
        RagSearchTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {RagSearchTool}
     */
    static get getInstance() {
        if (!RagSearchTool.#instance) {
            RagSearchTool.#instance = new RagSearchTool();
        }
        return RagSearchTool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params - パラメータ
     * @param {string} params.query - 検索クエリ
     * @param {number} [params.topK=5] - 最大結果数
     * @param {number} [params.threshold=0.5] - 類似度閾値
     * @returns {Promise<RagSearchResult>}
     */
    async execute(params) {
        const { query, topK = 5, threshold = 0.5 } = params;

        if (!query || typeof query !== 'string') {
            return {
                success: false,
                query: query || '',
                results: [],
                totalResults: 0,
                error: '検索クエリが指定されていません'
            };
        }

        try {
            // RAGManagerを取得
            const ragManager = window.RAGManager?.getInstance;

            if (!ragManager) {
                return {
                    success: false,
                    query: query,
                    results: [],
                    totalResults: 0,
                    error: 'RAGManagerが利用できません。ナレッジベースが初期化されていない可能性があります。'
                };
            }

            // ナレッジベースが有効かチェック
            const isEnabled = await ragManager.isEnabled();
            if (!isEnabled) {
                return {
                    success: false,
                    query: query,
                    results: [],
                    totalResults: 0,
                    error: 'ナレッジベースが有効になっていません。設定から有効にしてください。'
                };
            }

            // 検索実行
            const searchResults = await ragManager.search(query, {
                topK: topK,
                threshold: threshold
            });

            // 結果を整形
            const formattedResults = searchResults.map((result, index) => ({
                rank: index + 1,
                content: result.content,
                similarity: (result.similarity * 100).toFixed(1) + '%',
                source: result.metadata?.source || '不明',
                documentId: result.documentId
            }));

            return {
                success: true,
                query: query,
                results: formattedResults,
                totalResults: formattedResults.length
            };
        } catch (error) {
            console.error('[RagSearchTool] 検索エラー:', error);
            return {
                success: false,
                query: query,
                results: [],
                totalResults: 0,
                error: `検索エラー: ${error.message}`
            };
        }
    }

    /**
     * ナレッジベースの状態を取得
     * @returns {Promise<Object>}
     */
    async getStatus() {
        try {
            const ragManager = window.RAGManager?.getInstance;

            if (!ragManager) {
                return {
                    available: false,
                    enabled: false,
                    documentCount: 0,
                    error: 'RAGManagerが利用できません'
                };
            }

            const isEnabled = await ragManager.isEnabled();
            const stats = await ragManager.getStats();

            return {
                available: true,
                enabled: isEnabled,
                documentCount: stats?.documentCount || 0,
                chunkCount: stats?.chunkCount || 0,
                embeddingMode: stats?.embeddingMode || 'unknown'
            };
        } catch (error) {
            return {
                available: false,
                enabled: false,
                documentCount: 0,
                error: error.message
            };
        }
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
window.RagSearchTool = RagSearchTool;
