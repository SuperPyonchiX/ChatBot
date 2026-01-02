/**
 * ragManager.js
 * RAG（Retrieval-Augmented Generation）機能の統合マネージャー
 * ドキュメント追加、検索、プロンプト拡張を統括
 */

class RAGManager {
    static #instance = null;

    /** @type {boolean} */
    #enabled = false;

    /** @type {boolean} */
    #initialized = false;

    /**
     * シングルトンインスタンスを取得
     * @returns {RAGManager}
     */
    static get getInstance() {
        if (!RAGManager.#instance) {
            RAGManager.#instance = new RAGManager();
        }
        return RAGManager.#instance;
    }

    /**
     * コンストラクタ（プライベート）
     */
    constructor() {
        if (RAGManager.#instance) {
            throw new Error('RAGManager is a singleton. Use RAGManager.getInstance instead.');
        }
    }

    /**
     * RAGシステムを初期化
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) {
            return;
        }

        try {
            // VectorStoreを初期化
            await VectorStore.getInstance.initialize();

            // 保存されたRAG有効状態を復元
            const savedEnabled = Storage.getInstance.getItem(window.CONFIG.STORAGE.KEYS.RAG_ENABLED);
            this.#enabled = savedEnabled === 'true';

            this.#initialized = true;
            console.log(`✅ RAGManager initialized (enabled: ${this.#enabled})`);
        } catch (error) {
            console.error('❌ RAGManager initialization error:', error);
            throw error;
        }
    }

    /**
     * RAGが有効かどうか
     * @returns {boolean}
     */
    get isEnabled() {
        return this.#enabled;
    }

    /**
     * RAGの有効/無効を設定
     * @param {boolean} value
     */
    set isEnabled(value) {
        this.#enabled = value;
        Storage.getInstance.setItem(window.CONFIG.STORAGE.KEYS.RAG_ENABLED, value.toString());
        console.log(`📚 RAG ${value ? 'enabled' : 'disabled'}`);
    }

    /**
     * ドキュメントをナレッジベースに追加
     * @param {File} file - 追加するファイル
     * @param {function} [onProgress] - 進捗コールバック (stage, current, total)
     * @returns {Promise<{docId: string, chunkCount: number}>}
     */
    async addDocument(file, onProgress) {
        await this.#ensureInitialized();

        const docId = this.#generateId();

        try {
            // ステージ1: テキスト抽出とチャンキング
            if (onProgress) onProgress('chunking', 0, 1);
            const { text, chunks } = await DocumentChunker.getInstance.chunkDocument(file);

            if (chunks.length === 0) {
                throw new Error('ファイルからテキストを抽出できませんでした');
            }

            console.log(`📄 Extracted ${chunks.length} chunks from ${file.name}`);

            // チャンクにファイル名メタデータを追加（検索精度向上のため）
            const chunksWithMetadata = chunks.map(text =>
                `[ドキュメント: ${file.name}]\n${text}`
            );

            // ステージ2: 埋め込みベクトルの取得（メタデータ付きテキストから生成）
            const embeddings = await EmbeddingAPI.getInstance.getEmbeddings(
                chunksWithMetadata,
                (current, total) => {
                    if (onProgress) onProgress('embedding', current, total);
                }
            );

            // ステージ3: データベースに保存
            if (onProgress) onProgress('saving', 0, 1);

            // ドキュメントメタデータを保存
            await VectorStore.getInstance.addDocument({
                id: docId,
                name: file.name,
                type: file.type,
                size: file.size,
                chunkCount: chunks.length
            });

            // チャンクを保存
            const chunkRecords = chunksWithMetadata.map((text, index) => ({
                id: `${docId}_${index}`,
                docId: docId,
                text: text,
                embedding: embeddings[index],
                position: index
            }));

            await VectorStore.getInstance.addChunks(chunkRecords);

            if (onProgress) onProgress('complete', 1, 1);

            console.log(`✅ Document added: ${file.name} (${chunks.length} chunks)`);

            return { docId, chunkCount: chunks.length };
        } catch (error) {
            // エラー時はドキュメントを削除（部分的に保存されている可能性）
            try {
                await VectorStore.getInstance.deleteDocument(docId);
            } catch {
                // 削除失敗は無視
            }
            console.error('❌ Failed to add document:', error);
            throw error;
        }
    }

    /**
     * ドキュメントをナレッジベースから削除
     * @param {string} docId - ドキュメントID
     * @returns {Promise<void>}
     */
    async removeDocument(docId) {
        await this.#ensureInitialized();
        await VectorStore.getInstance.deleteDocument(docId);
        console.log(`🗑️ Document removed: ${docId}`);
    }

    /**
     * クエリに関連するコンテキストを検索
     * @param {string} query - 検索クエリ
     * @returns {Promise<string>} 関連コンテキスト
     */
    async search(query) {
        await this.#ensureInitialized();

        if (!query || query.trim().length === 0) {
            return '';
        }

        try {
            // クエリの埋め込みを取得
            const queryEmbedding = await EmbeddingAPI.getInstance.getEmbedding(query);

            // 類似チャンクを検索
            let results = await SimilaritySearch.getInstance.findSimilar(queryEmbedding);

            // 重複を除去
            results = SimilaritySearch.getInstance.deduplicateResults(results);

            // コンテキスト文字列を生成
            const context = SimilaritySearch.getInstance.formatResultsAsContext(results);

            const stats = SimilaritySearch.getInstance.getSearchStats(results);
            console.log(`🔍 RAG search: found ${stats.count} relevant chunks (avg similarity: ${(stats.avgSimilarity * 100).toFixed(1)}%)`);

            return context;
        } catch (error) {
            console.error('❌ RAG search error:', error);
            return '';
        }
    }

    /**
     * クエリに関連するコンテキストと参照資料情報を検索
     * @param {string} query - 検索クエリ
     * @returns {Promise<{context: string, sources: Array<{docName: string, similarity: number}>}>}
     */
    async searchWithDetails(query) {
        await this.#ensureInitialized();

        if (!query || query.trim().length === 0) {
            return { context: '', sources: [] };
        }

        try {
            // クエリの埋め込みを取得
            const queryEmbedding = await EmbeddingAPI.getInstance.getEmbedding(query);

            // 類似チャンクを検索
            let results = await SimilaritySearch.getInstance.findSimilar(queryEmbedding);

            // 重複を除去
            results = SimilaritySearch.getInstance.deduplicateResults(results);

            // コンテキスト文字列を生成
            const context = SimilaritySearch.getInstance.formatResultsAsContext(results);

            // 参照資料情報を抽出（重複するドキュメント名はまとめる）
            const sourceMap = new Map();
            for (const result of results) {
                const docName = this.#extractDocName(result.chunk.text);
                const similarity = Math.round(result.similarity * 100);

                // 同じドキュメントがある場合は最高の類似度を保持
                if (!sourceMap.has(docName) || sourceMap.get(docName) < similarity) {
                    sourceMap.set(docName, similarity);
                }
            }

            const sources = Array.from(sourceMap.entries()).map(([docName, similarity]) => ({
                docName,
                similarity
            })).sort((a, b) => b.similarity - a.similarity);

            const stats = SimilaritySearch.getInstance.getSearchStats(results);
            console.log(`🔍 RAG search with details: found ${stats.count} relevant chunks from ${sources.length} documents`);

            return { context, sources };
        } catch (error) {
            console.error('❌ RAG search error:', error);
            return { context: '', sources: [] };
        }
    }

    /**
     * チャンクテキストからドキュメント名を抽出
     * @param {string} chunkText - チャンクテキスト
     * @returns {string} ドキュメント名
     */
    #extractDocName(chunkText) {
        if (!chunkText) return '不明なドキュメント';

        // [ドキュメント: filename.pdf] の形式から抽出
        const match = chunkText.match(/^\[ドキュメント:\s*(.+?)\]/);
        if (match && match[1]) {
            return match[1].trim();
        }

        return '不明なドキュメント';
    }

    /**
     * メッセージ配列にRAGコンテキストを拡張
     * @param {Array<{role: string, content: string}>} messages - メッセージ配列
     * @param {string} [userQuery] - ユーザークエリ（指定しない場合は最後のユーザーメッセージを使用）
     * @param {Object} [options] - オプション
     * @param {boolean} [options.returnSources=false] - 参照資料情報も返すかどうか
     * @returns {Promise<Array<{role: string, content: string}>|{messages: Array, sources: Array}>}
     */
    async augmentPrompt(messages, userQuery, options = {}) {
        const { returnSources = false } = options;

        // 先に初期化を確認（#enabledの値がストレージから復元される）
        await this.#ensureInitialized();

        console.log('📚 RAG augmentPrompt called, enabled:', this.#enabled);

        const emptyResult = returnSources ? { messages, sources: [] } : messages;

        if (!this.#enabled) {
            console.log('📚 RAG is disabled, skipping augmentation');
            return emptyResult;
        }

        // ナレッジベースが空の場合はそのまま返す
        const docCount = await VectorStore.getInstance.getDocumentCount();
        console.log('📚 RAG document count:', docCount);
        if (docCount === 0) {
            return emptyResult;
        }

        // クエリを決定
        let query = userQuery;
        if (!query) {
            // 最後のユーザーメッセージを使用
            const userMessages = messages.filter(m => m.role === 'user');
            if (userMessages.length > 0) {
                const lastUserMessage = userMessages[userMessages.length - 1];
                query = typeof lastUserMessage.content === 'string'
                    ? lastUserMessage.content
                    : JSON.stringify(lastUserMessage.content);
            }
        }

        if (!query) {
            return emptyResult;
        }

        // 関連コンテキストを検索（returnSourcesの場合は詳細情報付き）
        console.log('📚 RAG searching for query:', query.substring(0, 50) + '...');

        let context, sources = [];
        if (returnSources) {
            const result = await this.searchWithDetails(query);
            context = result.context;
            sources = result.sources;
        } else {
            context = await this.search(query);
        }

        if (!context) {
            console.log('📚 RAG no context found for query');
            return emptyResult;
        }
        console.log('📚 RAG context found, length:', context.length);

        // メッセージを拡張
        const config = window.CONFIG.RAG.AUGMENTATION;
        const augmentedMessages = [...messages];

        // システムメッセージを探す or 新規作成
        const systemIndex = augmentedMessages.findIndex(m => m.role === 'system');

        if (systemIndex >= 0) {
            // 既存のシステムメッセージにコンテキストを追加
            augmentedMessages[systemIndex] = {
                ...augmentedMessages[systemIndex],
                content: augmentedMessages[systemIndex].content +
                         config.CONTEXT_PREFIX +
                         context +
                         config.CONTEXT_SUFFIX
            };
        } else {
            // 新しいシステムメッセージを先頭に追加
            augmentedMessages.unshift({
                role: 'system',
                content: config.CONTEXT_PREFIX + context + config.CONTEXT_SUFFIX
            });
        }

        console.log('📚 Prompt augmented with RAG context');

        if (returnSources) {
            return { messages: augmentedMessages, sources };
        }
        return augmentedMessages;
    }

    /**
     * 全ドキュメントを取得
     * @returns {Promise<Array<Object>>}
     */
    async getDocuments() {
        await this.#ensureInitialized();
        return VectorStore.getInstance.getAllDocuments();
    }

    /**
     * ナレッジベースの統計情報を取得
     * @returns {Promise<Object>}
     */
    async getStats() {
        await this.#ensureInitialized();

        const docCount = await VectorStore.getInstance.getDocumentCount();
        const chunkCount = await VectorStore.getInstance.getChunkCount();
        const documents = await VectorStore.getInstance.getAllDocuments();

        const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);

        return {
            documentCount: docCount,
            chunkCount: chunkCount,
            totalSize: totalSize,
            embeddingModel: EmbeddingAPI.getInstance.getCurrentModelName()
        };
    }

    /**
     * ナレッジベースをクリア
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.#ensureInitialized();
        await VectorStore.getInstance.clearAll();
        console.log('🧹 Knowledge base cleared');
    }

    /**
     * 埋め込みAPIが利用可能かチェック
     * @returns {Promise<boolean>}
     */
    async isEmbeddingAvailable() {
        return EmbeddingAPI.getInstance.isAvailable();
    }

    /**
     * 初期化を確認
     * @returns {Promise<void>}
     */
    async #ensureInitialized() {
        if (!this.#initialized) {
            await this.initialize();
        }
    }

    /**
     * 一意のIDを生成
     * @returns {string}
     */
    #generateId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * ファイルサイズを人間が読める形式に変換
     * @param {number} bytes
     * @returns {string}
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// グローバルに公開
window.RAGManager = RAGManager;
