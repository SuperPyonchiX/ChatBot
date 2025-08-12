/**
 * api.js
 * AI API統合インターフェース - 各API専用クラスへのルーティングを提供します
 */
class AIAPI {

    // シングルトンインスタンス
    static #instance = null;
    constructor() {
        if (AIAPI.#instance) {
            return AIAPI.#instance;
        }
        AIAPI.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!AIAPI.#instance) {
            AIAPI.#instance = new AIAPI();
        }
        return AIAPI.#instance;
    }

    /**
     * AI APIを呼び出して応答を得る（統合エントリーポイント）
     * @param {Array} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名
     * @param {Array} attachments - 添付ファイルの配列（任意）
     * @param {Object} options - 追加オプション
     * @param {boolean} options.stream - ストリーミングを使用するかどうか
     * @param {boolean} options.enableWebSearch - Web検索を有効にするかどうか
     * @param {Function} options.onChunk - ストリーミング時のチャンク受信コールバック関数
     * @param {Function} options.onComplete - ストリーミング完了時のコールバック関数
     * @returns {Promise<string>} APIからの応答テキスト（ストリーミングの場合は空文字列）
     * @throws {Error} API設定やリクエストに問題があった場合
     */
    async callAIAPI(messages, model, attachments = [], options = {}) {
        try {
            // サポートされているモデルかチェック
            const allSupportedModels = [...window.CONFIG.MODELS.OPENAI, ...window.CONFIG.MODELS.GEMINI, ...window.CONFIG.MODELS.CLAUDE];
            if (!allSupportedModels.includes(model)) {
                throw new Error(`サポートされていないモデルです: ${model}`);
            }
            
            // Web検索が有効でResponses API対応モデルの場合はResponses APIを使用
            if (options.enableWebSearch && this.#isWebSearchCompatibleModel(model)) {
                console.log('🌐 Web検索が有効なため、Responses APIを使用します');
                return await ResponsesAPI.getInstance.callResponsesAPI(messages, model, attachments, options);
            }
            
            // モデルに応じて適切なAPIクラスにルーティング
            if (window.CONFIG.MODELS.GEMINI.includes(model)) {
                return await GeminiAPI.getInstance.callGeminiAPI(messages, model, attachments, options);
            } else if (window.CONFIG.MODELS.CLAUDE.includes(model)) {
                // Claude Web検索設定を追加
                this.#addClaudeWebSearchOptions(options);
                return await ClaudeAPI.getInstance.callClaudeAPI(messages, model, attachments, options);
            } else {
                return await OpenAIAPI.getInstance.callOpenAIAPI(messages, model, attachments, options);
            }
            
        } catch (error) {
            console.error('AI API統合エラー:', error);
            throw error;
        }
    }

    /**
     * Web検索対応モデルかどうかを判定
     * @private
     * @param {string} model - モデル名
     * @returns {boolean} Web検索対応モデルかどうか
     */
    #isWebSearchCompatibleModel(model) {
        // OpenAIのResponses APIでWeb検索をサポートするモデル
        return window.CONFIG.MODELS.OPENAI_WEB_SEARCH_COMPATIBLE.includes(model);
    }    /**
     * Claude用のWeb検索設定をオプションに追加
     * @private
     * @param {Object} options - APIオプション
     */
    #addClaudeWebSearchOptions(options) {
        const storage = Storage.getInstance;
        if (!storage) return;

        const webSearchSettings = storage.getClaudeWebSearchSettings();
        if (webSearchSettings && webSearchSettings.enabled) {
            console.log('DEBUG: Claude Web検索設定を適用', webSearchSettings);
            
            options.useWebSearch = true;
            options.webSearchConfig = {
                maxUses: webSearchSettings.maxSearches || window.CONFIG.WEB_SEARCH.CLAUDE.DEFAULT_CONFIG.maxUses,
                allowedDomains: webSearchSettings.allowedDomains && webSearchSettings.allowedDomains.length > 0 
                    ? webSearchSettings.allowedDomains 
                    : undefined,
                blockedDomains: webSearchSettings.blockedDomains && webSearchSettings.blockedDomains.length > 0 
                    ? webSearchSettings.blockedDomains 
                    : undefined,
                userLocation: webSearchSettings.searchRegion 
                    ? window.CONFIG.WEB_SEARCH.CLAUDE.LOCATION_TEMPLATES[webSearchSettings.searchRegion] 
                    : undefined
            };

            // 未定義のフィールドを削除
            Object.keys(options.webSearchConfig).forEach(key => {
                if (options.webSearchConfig[key] === undefined) {
                    delete options.webSearchConfig[key];
                }
            });
        }
    }
}


