/**
 * vectorStore.js
 * IndexedDBを使用したベクトルストレージ管理クラス
 * ドキュメントとそのチャンク（埋め込みベクトル付き）を保存・検索します
 */

class VectorStore {
    static #instance = null;

    /** @type {IDBDatabase|null} */
    #db = null;

    /** @type {boolean} */
    #initialized = false;

    /**
     * シングルトンインスタンスを取得
     * @returns {VectorStore}
     */
    static get getInstance() {
        if (!VectorStore.#instance) {
            VectorStore.#instance = new VectorStore();
        }
        return VectorStore.#instance;
    }

    /**
     * コンストラクタ（プライベート）
     */
    constructor() {
        if (VectorStore.#instance) {
            throw new Error('VectorStore is a singleton. Use VectorStore.getInstance instead.');
        }
    }

    /**
     * IndexedDBを初期化
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) {
            return;
        }

        const config = window.CONFIG.RAG.STORAGE;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(config.DB_NAME, config.DB_VERSION);

            request.onerror = (event) => {
                console.error('❌ IndexedDB open error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.#db = event.target.result;
                this.#initialized = true;
                console.log('✅ VectorStore initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // documentsストア作成
                if (!db.objectStoreNames.contains(config.DOCUMENTS_STORE)) {
                    const documentsStore = db.createObjectStore(config.DOCUMENTS_STORE, { keyPath: 'id' });
                    documentsStore.createIndex('name', 'name', { unique: false });
                    documentsStore.createIndex('createdAt', 'createdAt', { unique: false });
                    console.log('📁 Created documents store');
                }

                // chunksストア作成
                if (!db.objectStoreNames.contains(config.CHUNKS_STORE)) {
                    const chunksStore = db.createObjectStore(config.CHUNKS_STORE, { keyPath: 'id' });
                    chunksStore.createIndex('docId', 'docId', { unique: false });
                    chunksStore.createIndex('position', 'position', { unique: false });
                    console.log('📄 Created chunks store');
                }
            };
        });
    }

    /**
     * 初期化状態を確認
     * @returns {boolean}
     */
    get isInitialized() {
        return this.#initialized;
    }

    /**
     * ドキュメントを追加
     * @param {Object} document - ドキュメント情報
     * @param {string} document.id - ドキュメントID
     * @param {string} document.name - ファイル名
     * @param {string} document.type - ファイルタイプ
     * @param {number} document.size - ファイルサイズ
     * @param {number} document.chunkCount - チャンク数
     * @returns {Promise<void>}
     */
    async addDocument(document) {
        await this.#ensureInitialized();

        const doc = {
            ...document,
            createdAt: Date.now()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [window.CONFIG.RAG.STORAGE.DOCUMENTS_STORE],
                'readwrite'
            );
            const store = transaction.objectStore(window.CONFIG.RAG.STORAGE.DOCUMENTS_STORE);
            const request = store.put(doc);

            request.onsuccess = () => {
                console.log(`📝 Document added: ${document.name}`);
                resolve();
            };

            request.onerror = (event) => {
                console.error('❌ Failed to add document:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * チャンクを追加（バッチ処理）
     * @param {Array<Object>} chunks - チャンク配列
     * @param {string} chunks[].id - チャンクID
     * @param {string} chunks[].docId - 親ドキュメントID
     * @param {string} chunks[].text - テキスト内容
     * @param {number[]} chunks[].embedding - 埋め込みベクトル
     * @param {number} chunks[].position - ドキュメント内の位置
     * @returns {Promise<void>}
     */
    async addChunks(chunks) {
        await this.#ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [window.CONFIG.RAG.STORAGE.CHUNKS_STORE],
                'readwrite'
            );
            const store = transaction.objectStore(window.CONFIG.RAG.STORAGE.CHUNKS_STORE);

            let completed = 0;
            let hasError = false;

            chunks.forEach((chunk) => {
                const request = store.put(chunk);

                request.onsuccess = () => {
                    completed++;
                    if (completed === chunks.length && !hasError) {
                        console.log(`📦 Added ${chunks.length} chunks`);
                        resolve();
                    }
                };

                request.onerror = (event) => {
                    if (!hasError) {
                        hasError = true;
                        console.error('❌ Failed to add chunk:', event.target.error);
                        reject(event.target.error);
                    }
                };
            });

            // 空配列の場合
            if (chunks.length === 0) {
                resolve();
            }
        });
    }

    /**
     * ドキュメントを削除（関連チャンクも削除）
     * @param {string} docId - ドキュメントID
     * @returns {Promise<void>}
     */
    async deleteDocument(docId) {
        await this.#ensureInitialized();

        // まずチャンクを削除
        await this.#deleteChunksByDocId(docId);

        // 次にドキュメントを削除
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [window.CONFIG.RAG.STORAGE.DOCUMENTS_STORE],
                'readwrite'
            );
            const store = transaction.objectStore(window.CONFIG.RAG.STORAGE.DOCUMENTS_STORE);
            const request = store.delete(docId);

            request.onsuccess = () => {
                console.log(`🗑️ Document deleted: ${docId}`);
                resolve();
            };

            request.onerror = (event) => {
                console.error('❌ Failed to delete document:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * ドキュメントIDに基づいてチャンクを削除
     * @param {string} docId - ドキュメントID
     * @returns {Promise<void>}
     */
    async #deleteChunksByDocId(docId) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [window.CONFIG.RAG.STORAGE.CHUNKS_STORE],
                'readwrite'
            );
            const store = transaction.objectStore(window.CONFIG.RAG.STORAGE.CHUNKS_STORE);
            const index = store.index('docId');
            const request = index.openCursor(IDBKeyRange.only(docId));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 全ドキュメントを取得（メタデータのみ）
     * @returns {Promise<Array<Object>>}
     */
    async getAllDocuments() {
        await this.#ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [window.CONFIG.RAG.STORAGE.DOCUMENTS_STORE],
                'readonly'
            );
            const store = transaction.objectStore(window.CONFIG.RAG.STORAGE.DOCUMENTS_STORE);
            const request = store.getAll();

            request.onsuccess = () => {
                // 作成日時の降順でソート
                const documents = request.result.sort((a, b) => b.createdAt - a.createdAt);
                resolve(documents);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 特定ドキュメントのチャンクを取得
     * @param {string} docId - ドキュメントID
     * @returns {Promise<Array<Object>>}
     */
    async getChunksByDocId(docId) {
        await this.#ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [window.CONFIG.RAG.STORAGE.CHUNKS_STORE],
                'readonly'
            );
            const store = transaction.objectStore(window.CONFIG.RAG.STORAGE.CHUNKS_STORE);
            const index = store.index('docId');
            const request = index.getAll(IDBKeyRange.only(docId));

            request.onsuccess = () => {
                // 位置順でソート
                const chunks = request.result.sort((a, b) => a.position - b.position);
                resolve(chunks);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 全チャンクを取得（ベクトル検索用）
     * @returns {Promise<Array<Object>>}
     */
    async getAllChunks() {
        await this.#ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [window.CONFIG.RAG.STORAGE.CHUNKS_STORE],
                'readonly'
            );
            const store = transaction.objectStore(window.CONFIG.RAG.STORAGE.CHUNKS_STORE);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * ドキュメント数を取得
     * @returns {Promise<number>}
     */
    async getDocumentCount() {
        await this.#ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [window.CONFIG.RAG.STORAGE.DOCUMENTS_STORE],
                'readonly'
            );
            const store = transaction.objectStore(window.CONFIG.RAG.STORAGE.DOCUMENTS_STORE);
            const request = store.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * チャンク数を取得
     * @returns {Promise<number>}
     */
    async getChunkCount() {
        await this.#ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [window.CONFIG.RAG.STORAGE.CHUNKS_STORE],
                'readonly'
            );
            const store = transaction.objectStore(window.CONFIG.RAG.STORAGE.CHUNKS_STORE);
            const request = store.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 全データをクリア
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.#ensureInitialized();

        const config = window.CONFIG.RAG.STORAGE;

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(
                [config.DOCUMENTS_STORE, config.CHUNKS_STORE],
                'readwrite'
            );

            const documentsStore = transaction.objectStore(config.DOCUMENTS_STORE);
            const chunksStore = transaction.objectStore(config.CHUNKS_STORE);

            let cleared = 0;

            const onClear = () => {
                cleared++;
                if (cleared === 2) {
                    console.log('🧹 All data cleared');
                    resolve();
                }
            };

            documentsStore.clear().onsuccess = onClear;
            chunksStore.clear().onsuccess = onClear;

            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
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
     * データベース接続を閉じる
     */
    close() {
        if (this.#db) {
            this.#db.close();
            this.#db = null;
            this.#initialized = false;
            console.log('🔌 VectorStore connection closed');
        }
    }
}

// グローバルに公開
window.VectorStore = VectorStore;
