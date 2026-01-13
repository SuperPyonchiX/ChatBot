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
     * @async
     * @param {Message[]} messages - 会話メッセージの配列
     * @param {string} model - 使用するモデル名 (例: 'gpt-4o', 'claude-sonnet-4-5', 'gemini-2.5-pro')
     * @param {Attachment[]} [attachments=[]] - 添付ファイルの配列（任意）
     * @param {ApiCallOptions} [options={}] - 追加オプション
     * @returns {Promise<string>} APIからの応答テキスト（ストリーミングの場合は空文字列）
     * @throws {Error} API設定やリクエストに問題があった場合（APIキー未設定、サポート外モデル等）
     */
    async callAIAPI(messages, model, attachments = [], options = {}) {
        try {
            // サポートされているモデルかチェック
            const allSupportedModels = [...window.CONFIG.MODELS.OPENAI, ...window.CONFIG.MODELS.GEMINI, ...window.CONFIG.MODELS.CLAUDE];
            if (!allSupportedModels.includes(model)) {
                throw new Error(`サポートされていないモデルです: ${model}`);
            }

            // ツール機能が利用可能な場合、ツール定義を追加
            if (this.#isToolsCompatibleModel(model)) {
                const provider = this.#getProviderForModel(model);
                options.enableTools = true;
                options.tools = this.#getToolsForProvider(provider);
            }

            // Web検索が有効でResponses API対応モデルの場合はResponses APIを使用
            if (options.enableWebSearch && this.#isWebSearchCompatibleModel(model)) {
                return await ResponsesAPI.getInstance.callResponsesAPI(messages, model, attachments, options);
            }

            // モデルに応じて適切なAPIクラスにルーティング
            if (window.CONFIG.MODELS.GEMINI.includes(model)) {
                return await GeminiAPI.getInstance.callGeminiAPI(messages, model, attachments, options);
            } else if (window.CONFIG.MODELS.CLAUDE.includes(model)) {
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
     * @param {string} model - モデル名 (例: 'gpt-5', 'gpt-5-mini')
     * @returns {boolean} Web検索対応モデルかどうか
     */
    #isWebSearchCompatibleModel(model) {
        // OpenAIのResponses APIでWeb検索をサポートするモデル
        return window.CONFIG.MODELS.OPENAI_WEB_SEARCH_COMPATIBLE.includes(model);
    }

    /**
     * ツール機能対応モデルかどうかを判定
     * @param {string} model - モデル名
     * @returns {boolean} ツール機能対応モデルかどうか
     */
    #isToolsCompatibleModel(model) {
        if (typeof ToolManager === 'undefined') {
            return false;
        }
        return ToolManager.getInstance.isModelCompatible(model);
    }

    /**
     * モデルからプロバイダを判定
     * @param {string} model - モデル名
     * @returns {string} プロバイダ名 ('claude', 'openai', 'gemini')
     */
    #getProviderForModel(model) {
        if (typeof ToolManager === 'undefined') {
            return 'openai';
        }
        return ToolManager.getInstance.getProviderForModel(model);
    }

    /**
     * プロバイダ形式のツール定義を取得
     * @param {string} provider - プロバイダ名
     * @returns {Array} ツール定義の配列
     */
    #getToolsForProvider(provider) {
        if (typeof ToolManager === 'undefined') {
            return [];
        }
        return ToolManager.getInstance.getToolsForProvider(provider);
    }
}


