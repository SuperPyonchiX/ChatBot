/**
 * api.js
 * AI API統合インターフェース - 各API専用クラスへのルーティングを提供します
 */
class AIAPI {
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
            const allSupportedModels = [...window.CONFIG.MODELS.OPENAI, ...window.CONFIG.MODELS.GEMINI];
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
     * @param {string} model - モデル名
     * @returns {boolean} Web検索対応モデルかどうか
     */
    #isWebSearchCompatibleModel(model) {
        // OpenAIのResponses APIでWeb検索をサポートするモデル
        return model.startsWith('gpt-5');
    }
}

// グローバルに登録
window.AIAPI = AIAPI;
