/**
 * embeddingApi.js
 * マルチプロバイダ対応の埋め込み生成クラス
 * OpenAI, Azure OpenAI, ローカル（Transformers.js）をサポート
 */

class EmbeddingAPI {
    static #instance = null;

    /** @type {'openai'|'azure'|'local'} 現在の埋め込みモード */
    #mode = 'local';

    /** @type {any} Transformers.js pipeline（ローカルモード用） */
    #extractor = null;

    /** @type {boolean} 初期化中フラグ */
    #isInitializing = false;

    /** @type {Promise<void>|null} 初期化Promise */
    #initPromise = null;

    /** @type {boolean} 初期化完了フラグ */
    #initialized = false;

    /** @type {number} 現在の埋め込み次元数 */
    #dimensions = 384;

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
        this.#determineMode();
    }

    /**
     * APIキー設定に基づいてモードを自動決定
     */
    #determineMode() {
        // 保存されたモード設定があれば使用
        const savedMode = Storage.getInstance.getItem(window.CONFIG.STORAGE.KEYS.EMBEDDING_MODE, '');
        if (savedMode && ['openai', 'azure', 'local'].includes(savedMode)) {
            this.#mode = savedMode;
            this.#dimensions = savedMode === 'local'
                ? window.CONFIG.RAG.EMBEDDING.LOCAL_DIMENSIONS
                : window.CONFIG.RAG.EMBEDDING.OPENAI_DIMENSIONS;
            console.log(`📊 埋め込みモード: ${savedMode}（保存設定から復元）`);
            return;
        }

        // 自動検出
        if (window.apiSettings?.openaiApiKey) {
            this.#mode = 'openai';
            this.#dimensions = window.CONFIG.RAG.EMBEDDING.OPENAI_DIMENSIONS;
            console.log('📊 埋め込みモード: openai（自動検出）');
        } else if (window.apiSettings?.azureApiKey &&
                   Storage.getInstance.getItem(window.CONFIG.STORAGE.KEYS.AZURE_EMBEDDING_ENDPOINT, '')) {
            this.#mode = 'azure';
            this.#dimensions = window.CONFIG.RAG.EMBEDDING.OPENAI_DIMENSIONS;
            console.log('📊 埋め込みモード: azure（自動検出）');
        } else {
            this.#mode = 'local';
            this.#dimensions = window.CONFIG.RAG.EMBEDDING.LOCAL_DIMENSIONS;
            console.log('📊 埋め込みモード: local（フォールバック）');
        }
    }

    /**
     * 現在の埋め込みモードを取得
     * @returns {'openai'|'azure'|'local'}
     */
    getMode() {
        return this.#mode;
    }

    /**
     * 埋め込みモードを設定
     * 次元数が変わる場合はナレッジベースをクリア
     * @param {'openai'|'azure'|'local'} mode
     * @returns {Promise<void>}
     */
    async setMode(mode) {
        if (!['openai', 'azure', 'local'].includes(mode)) {
            throw new Error(`無効なモード: ${mode}`);
        }

        if (this.#mode === mode) {
            return;
        }

        const oldDimensions = this.#dimensions;
        this.#mode = mode;
        this.#dimensions = mode === 'local'
            ? window.CONFIG.RAG.EMBEDDING.LOCAL_DIMENSIONS
            : window.CONFIG.RAG.EMBEDDING.OPENAI_DIMENSIONS;
        this.#initialized = false;
        this.#extractor = null;

        // 設定を保存
        Storage.getInstance.setItem(window.CONFIG.STORAGE.KEYS.EMBEDDING_MODE, mode);
        Storage.getInstance.setItem(window.CONFIG.STORAGE.KEYS.EMBEDDING_DIMENSIONS, this.#dimensions.toString());

        // 次元数が変わった場合はナレッジベースをクリア
        if (oldDimensions !== this.#dimensions) {
            console.log(`⚠️ 次元数が ${oldDimensions} から ${this.#dimensions} に変更されました。ナレッジベースをクリアします。`);
            if (typeof VectorStore !== 'undefined') {
                await VectorStore.getInstance.clearAll();
            }
        }

        console.log(`📊 埋め込みモードを ${mode} に変更しました`);
    }

    /**
     * モードを再検出（API設定変更後に呼び出す）
     * APIキー変更時に自動でモードを切り替える
     */
    refreshMode() {
        const oldMode = this.#mode;
        const oldDimensions = this.#dimensions;

        // 保存されたモード設定をクリア（APIキー変更に追従）
        Storage.getInstance.removeItem(window.CONFIG.STORAGE.KEYS.EMBEDDING_MODE);

        this.#determineMode();

        if (oldMode !== this.#mode) {
            this.#initialized = false;
            this.#extractor = null;

            // 次元数が変わった場合はナレッジベースをクリア
            if (oldDimensions !== this.#dimensions && typeof VectorStore !== 'undefined') {
                console.log(`⚠️ 埋め込み次元数が変更されました（${oldDimensions} → ${this.#dimensions}）。ナレッジベースをクリアします。`);
                VectorStore.getInstance.clearAll();
                Storage.getInstance.setItem(
                    window.CONFIG.STORAGE.KEYS.EMBEDDING_DIMENSIONS,
                    this.#dimensions.toString()
                );
            }

            console.log(`📊 埋め込みモードを切り替えました: ${oldMode} → ${this.#mode}`);
        }
    }

    /**
     * 埋め込みモデルを初期化
     * @param {function} [onProgress] - 進捗コールバック
     * @returns {Promise<void>}
     */
    async initialize(onProgress) {
        if (this.#initialized) {
            return;
        }

        if (this.#isInitializing && this.#initPromise) {
            return this.#initPromise;
        }

        this.#isInitializing = true;

        this.#initPromise = (async () => {
            try {
                if (this.#mode === 'local') {
                    await this.#initializeLocal(onProgress);
                } else {
                    // OpenAI/Azureモードはローカル初期化不要
                    console.log(`✅ 埋め込みAPI初期化完了（${this.#mode}モード）`);
                }
                this.#initialized = true;
            } catch (error) {
                console.error('❌ 埋め込みAPI初期化エラー:', error);
                throw error;
            } finally {
                this.#isInitializing = false;
            }
        })();

        return this.#initPromise;
    }

    /**
     * ローカルモデル（Transformers.js）を初期化
     * @param {function} [onProgress]
     */
    async #initializeLocal(onProgress) {
        await this.#waitForTransformersJS();

        const { pipeline } = window.TransformersJS;
        const modelId = window.CONFIG.RAG.EMBEDDING.LOCAL_MODEL_ID;

        console.log(`🔄 ローカル埋め込みモデル初期化中: ${modelId}`);

        this.#extractor = await pipeline(
            'feature-extraction',
            modelId,
            {
                progress_callback: (progress) => {
                    if (onProgress) {
                        onProgress(progress);
                    }
                    if (progress.status === 'progress' && progress.progress) {
                        console.log(`📥 ${progress.file}: ${Math.round(progress.progress)}%`);
                    }
                }
            }
        );

        console.log('✅ ローカル埋め込みモデル初期化完了');
    }

    /**
     * Transformers.jsがロードされるまで待機
     */
    async #waitForTransformersJS() {
        const maxWait = 30000;
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
     * @returns {Promise<number[]>} 埋め込みベクトル
     */
    async getEmbedding(text) {
        if (!this.#initialized) {
            await this.initialize();
        }

        if (!text || text.trim().length === 0) {
            throw new Error('埋め込み対象のテキストが空です');
        }

        switch (this.#mode) {
            case 'openai':
                return this.#getOpenAIEmbedding(text);
            case 'azure':
                return this.#getAzureEmbedding(text);
            default:
                return this.#getLocalEmbedding(text);
        }
    }

    /**
     * 複数テキストの埋め込みをバッチ取得
     * @param {string[]} texts - テキスト配列
     * @param {function} [onProgress] - 進捗コールバック (current, total)
     * @returns {Promise<number[][]>} 埋め込みベクトル配列
     */
    async getEmbeddings(texts, onProgress) {
        if (!this.#initialized) {
            await this.initialize();
        }

        switch (this.#mode) {
            case 'openai':
                return this.#getOpenAIEmbeddings(texts, onProgress);
            case 'azure':
                return this.#getAzureEmbeddings(texts, onProgress);
            default:
                return this.#getLocalEmbeddings(texts, onProgress);
        }
    }

    // ========================================
    // ローカル埋め込み（Transformers.js）
    // ========================================

    async #getLocalEmbedding(text) {
        if (!this.#extractor) {
            await this.#initializeLocal();
        }

        const output = await this.#extractor(text, {
            pooling: 'mean',
            normalize: true
        });

        return Array.from(output.data);
    }

    async #getLocalEmbeddings(texts, onProgress) {
        const embeddings = [];

        for (let i = 0; i < texts.length; i++) {
            const embedding = await this.#getLocalEmbedding(texts[i]);
            embeddings.push(embedding);

            if (onProgress) {
                onProgress(i + 1, texts.length);
            }
        }

        return embeddings;
    }

    // ========================================
    // OpenAI Embeddings API
    // ========================================

    async #getOpenAIEmbedding(text) {
        const embeddings = await this.#getOpenAIEmbeddings([text]);
        return embeddings[0];
    }

    async #getOpenAIEmbeddings(texts, onProgress) {
        const batchSize = 100; // OpenAIは最大2048入力をサポート
        const allEmbeddings = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            const response = await fetch('/openai-embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiSettings.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: window.CONFIG.RAG.EMBEDDING.OPENAI_MODEL,
                    input: batch,
                    dimensions: window.CONFIG.RAG.EMBEDDING.OPENAI_DIMENSIONS
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `OpenAI Embedding APIエラー: ${response.status}`);
            }

            const data = await response.json();

            // indexでソートして埋め込みを取得
            const batchEmbeddings = data.data
                .sort((a, b) => a.index - b.index)
                .map(item => item.embedding);

            allEmbeddings.push(...batchEmbeddings);

            if (onProgress) {
                onProgress(Math.min(i + batchSize, texts.length), texts.length);
            }
        }

        return allEmbeddings;
    }

    // ========================================
    // Azure OpenAI Embeddings API
    // ========================================

    async #getAzureEmbedding(text) {
        const embeddings = await this.#getAzureEmbeddings([text]);
        return embeddings[0];
    }

    async #getAzureEmbeddings(texts, onProgress) {
        const endpoint = Storage.getInstance.getItem(window.CONFIG.STORAGE.KEYS.AZURE_EMBEDDING_ENDPOINT, '');

        if (!endpoint) {
            throw new Error('Azure埋め込みエンドポイントが設定されていません');
        }

        const batchSize = 100;
        const allEmbeddings = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            const response = await fetch('/azure-openai-embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targetUrl: endpoint,
                    apiKey: window.apiSettings.azureApiKey,
                    input: batch,
                    dimensions: window.CONFIG.RAG.EMBEDDING.OPENAI_DIMENSIONS
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `Azure Embedding APIエラー: ${response.status}`);
            }

            const data = await response.json();

            // indexでソートして埋め込みを取得
            const batchEmbeddings = data.data
                .sort((a, b) => a.index - b.index)
                .map(item => item.embedding);

            allEmbeddings.push(...batchEmbeddings);

            if (onProgress) {
                onProgress(Math.min(i + batchSize, texts.length), texts.length);
            }
        }

        return allEmbeddings;
    }

    // ========================================
    // ユーティリティメソッド
    // ========================================

    /**
     * 埋め込みAPIが利用可能かチェック
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        this.#determineMode();

        if (this.#mode === 'openai') {
            return !!window.apiSettings?.openaiApiKey;
        } else if (this.#mode === 'azure') {
            return !!window.apiSettings?.azureApiKey &&
                   !!Storage.getInstance.getItem(window.CONFIG.STORAGE.KEYS.AZURE_EMBEDDING_ENDPOINT, '');
        } else {
            return !!window.TransformersJS;
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
        if (this.#mode === 'local') {
            return window.CONFIG.RAG.EMBEDDING.LOCAL_MODEL_ID;
        }
        return window.CONFIG.RAG.EMBEDDING.OPENAI_MODEL;
    }

    /**
     * 埋め込みの次元数を取得
     * @returns {number}
     */
    getDimensions() {
        return this.#dimensions;
    }

    /**
     * モード表示名を取得
     * @returns {string}
     */
    getModeDisplayName() {
        const modeNames = {
            'openai': 'OpenAI (text-embedding-3-large)',
            'azure': 'Azure OpenAI (text-embedding-3-large)',
            'local': 'ローカル (all-MiniLM-L6-v2)'
        };
        return modeNames[this.#mode] || this.#mode;
    }
}

// グローバルに公開
window.EmbeddingAPI = EmbeddingAPI;
