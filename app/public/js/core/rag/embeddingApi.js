/**
 * embeddingApi.js
 * Transformers.jsを使用したローカル埋め込み生成クラス
 * ブラウザ内で完全にローカルで動作し、外部APIへのデータ送信なし
 */

class EmbeddingAPI {
    static #instance = null;

    /** @type {any} Transformers.js pipeline */
    #extractor = null;

    /** @type {boolean} 初期化中フラグ */
    #isInitializing = false;

    /** @type {Promise<void>|null} 初期化Promise */
    #initPromise = null;

    /** @type {boolean} 初期化完了フラグ */
    #initialized = false;

    /**
     * シングルトンインスタンスを取得
     * @returns {EmbeddingAPI}
     */
    static get getInstance() {
        if (!EmbeddingAPI.#instance) {
            EmbeddingAPI.#instance = new EmbeddingAPI();
        }
        return EmbeddingAPI.#instance;
    }

    /**
     * コンストラクタ（プライベート）
     */
    constructor() {
        if (EmbeddingAPI.#instance) {
            throw new Error('EmbeddingAPI is a singleton. Use EmbeddingAPI.getInstance instead.');
        }
    }

    /**
     * 埋め込みモデルを初期化
     * @param {function} [onProgress] - 進捗コールバック (progress: {status, file, progress, loaded, total})
     * @returns {Promise<void>}
     */
    async initialize(onProgress) {
        // 既に初期化済み
        if (this.#initialized && this.#extractor) {
            return;
        }

        // 初期化中なら既存のPromiseを返す
        if (this.#isInitializing && this.#initPromise) {
            return this.#initPromise;
        }

        this.#isInitializing = true;

        this.#initPromise = (async () => {
            try {
                // Transformers.jsがロードされるまで待機
                await this.#waitForTransformersJS();

                const { pipeline } = window.TransformersJS;
                const modelId = window.CONFIG.RAG.EMBEDDING.MODEL_ID;

                console.log(`🔄 埋め込みモデル初期化中: ${modelId}`);

                // pipeline作成（モデルダウンロード含む）
                this.#extractor = await pipeline(
                    'feature-extraction',
                    modelId,
                    {
                        progress_callback: (progress) => {
                            if (onProgress) {
                                onProgress(progress);
                            }
                            // ダウンロード進捗をログ
                            if (progress.status === 'progress' && progress.progress) {
                                console.log(`📥 ${progress.file}: ${Math.round(progress.progress)}%`);
                            }
                        }
                    }
                );

                this.#initialized = true;
                console.log('✅ 埋め込みモデル初期化完了');

            } catch (error) {
                console.error('❌ 埋め込みモデル初期化エラー:', error);
                this.#isInitializing = false;
                this.#initPromise = null;
                throw error;
            } finally {
                this.#isInitializing = false;
            }
        })();

        return this.#initPromise;
    }

    /**
     * Transformers.jsがロードされるまで待機
     * @returns {Promise<void>}
     */
    async #waitForTransformersJS() {
        const maxWait = 30000; // 30秒
        const interval = 100;
        let waited = 0;

        while (!window.TransformersJS && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, interval));
            waited += interval;
        }

        if (!window.TransformersJS) {
            throw new Error('Transformers.jsがロードされていません。ページをリロードしてください。');
        }
    }

    /**
     * テキストの埋め込みベクトルを取得
     * @param {string} text - 埋め込みを取得するテキスト
     * @returns {Promise<number[]>} 埋め込みベクトル（384次元）
     */
    async getEmbedding(text) {
        // 未初期化なら初期化
        if (!this.#initialized || !this.#extractor) {
            await this.initialize();
        }

        try {
            // 空文字列チェック
            if (!text || text.trim().length === 0) {
                throw new Error('埋め込み対象のテキストが空です');
            }

            // 埋め込み生成
            const output = await this.#extractor(text, {
                pooling: 'mean',
                normalize: true
            });

            // Tensor から配列に変換
            return Array.from(output.data);

        } catch (error) {
            console.error('❌ 埋め込み取得エラー:', error);
            throw error;
        }
    }

    /**
     * 複数テキストの埋め込みをバッチ取得
     * @param {string[]} texts - テキスト配列
     * @param {function} [onProgress] - 進捗コールバック (current, total)
     * @returns {Promise<number[][]>} 埋め込みベクトル配列
     */
    async getEmbeddings(texts, onProgress) {
        // 未初期化なら初期化
        if (!this.#initialized || !this.#extractor) {
            await this.initialize();
        }

        const embeddings = [];

        for (let i = 0; i < texts.length; i++) {
            const embedding = await this.getEmbedding(texts[i]);
            embeddings.push(embedding);

            if (onProgress) {
                onProgress(i + 1, texts.length);
            }
        }

        return embeddings;
    }

    /**
     * 埋め込みAPIが利用可能かチェック
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            // Transformers.jsがロードされているか確認
            if (!window.TransformersJS) {
                return false;
            }

            // 既に初期化済みなら利用可能
            if (this.#initialized && this.#extractor) {
                return true;
            }

            // 初期化していなくても、Transformers.jsがあれば利用可能（初期化は遅延）
            return true;

        } catch {
            return false;
        }
    }

    /**
     * 初期化済みかどうかを返す
     * @returns {boolean}
     */
    get isInitialized() {
        return this.#initialized;
    }

    /**
     * 初期化中かどうかを返す
     * @returns {boolean}
     */
    get isInitializing() {
        return this.#isInitializing;
    }

    /**
     * 現在使用されている埋め込みモデル名を取得
     * @returns {string}
     */
    getCurrentModelName() {
        return window.CONFIG.RAG.EMBEDDING.MODEL_ID;
    }

    /**
     * 埋め込みの次元数を取得
     * @returns {number}
     */
    getDimensions() {
        return window.CONFIG.RAG.EMBEDDING.DIMENSIONS;
    }
}

// グローバルに公開
window.EmbeddingAPI = EmbeddingAPI;
