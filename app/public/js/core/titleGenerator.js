/**
 * titleGenerator.js
 * 会話タイトル自動生成機能を提供するモジュール
 */
class TitleGenerator {
    static #instance = null;

    constructor() {
        if (TitleGenerator.#instance) {
            return TitleGenerator.#instance;
        }
        TitleGenerator.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {TitleGenerator} TitleGeneratorのシングルトンインスタンス
     */
    static get getInstance() {
        if (!TitleGenerator.#instance) {
            TitleGenerator.#instance = new TitleGenerator();
        }
        return TitleGenerator.#instance;
    }

    /**
     * 最初のユーザーメッセージからタイトルを生成
     * @param {string} firstMessage - 最初のユーザーメッセージ
     * @param {string} model - 使用するモデル名
     * @returns {Promise<string>} 生成されたタイトル
     */
    async generateTitle(firstMessage, model) {
        // メッセージが短い場合はそのまま使用（先頭を切り取り）
        if (firstMessage.length <= 25) {
            return this.#sanitizeTitle(firstMessage);
        }

        // AIでタイトル生成を試みる
        try {
            const title = await this.#generateTitleWithAI(firstMessage, model);
            return title;
        } catch (error) {
            console.warn('[TitleGenerator] AI生成エラー、フォールバックを使用:', error.message);
            return this.#truncate(firstMessage, 30);
        }
    }

    /**
     * AIを使用してタイトルを生成
     * @param {string} message - ユーザーメッセージ
     * @param {string} model - 使用するモデル名
     * @returns {Promise<string>} 生成されたタイトル
     */
    async #generateTitleWithAI(message, model) {
        const prompt = `以下のメッセージに対する短いタイトル（15文字以内の日本語または英語）を生成してください。タイトルのみを返してください。余計な説明や記号は不要です。

メッセージ: ${message.substring(0, 500)}`;

        const response = await AIAPI.getInstance.callAIAPI(
            [{ role: 'user', content: prompt }],
            model,
            [],
            {
                stream: false,
                skipRetry: true  // タイトル生成はリトライ不要
            }
        );

        // レスポンスをクリーンアップ
        const title = this.#cleanupAIResponse(response);
        return this.#truncate(title, 30);
    }

    /**
     * AI応答からタイトルをクリーンアップ
     * @param {string} response - AIからの応答
     * @returns {string} クリーンアップされたタイトル
     */
    #cleanupAIResponse(response) {
        if (!response) return '';

        let title = response.trim();

        // 引用符を削除
        title = title.replace(/^["'「『]|["'」』]$/g, '');

        // 「タイトル:」などのプレフィックスを削除
        title = title.replace(/^(タイトル|title|Title)[:：]\s*/i, '');

        // 改行以降を削除
        title = title.split('\n')[0];

        return title.trim();
    }

    /**
     * タイトルをサニタイズ（不正な文字を除去）
     * @param {string} text - 入力テキスト
     * @returns {string} サニタイズされたテキスト
     */
    #sanitizeTitle(text) {
        if (!text) return '';

        // 改行をスペースに置換
        let sanitized = text.replace(/[\r\n]+/g, ' ');

        // 連続するスペースを1つに
        sanitized = sanitized.replace(/\s+/g, ' ');

        return sanitized.trim();
    }

    /**
     * テキストを指定長で切り詰め
     * @param {string} text - 入力テキスト
     * @param {number} maxLength - 最大長
     * @returns {string} 切り詰められたテキスト
     */
    #truncate(text, maxLength) {
        const sanitized = this.#sanitizeTitle(text);

        if (sanitized.length <= maxLength) {
            return sanitized;
        }

        return sanitized.substring(0, maxLength - 3) + '...';
    }
}
