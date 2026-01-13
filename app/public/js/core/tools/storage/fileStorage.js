/**
 * ファイルストレージ管理クラス
 * ツールで生成したファイル（PPTX, XLSX等）をIndexedDBに永続化
 */
class FileStorage {
    static #instance = null;

    /** @type {IDBDatabase|null} */
    #db = null;

    /** @type {boolean} */
    #initialized = false;

    constructor() {
        if (FileStorage.#instance) {
            return FileStorage.#instance;
        }
        FileStorage.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {FileStorage}
     */
    static get getInstance() {
        if (!FileStorage.#instance) {
            FileStorage.#instance = new FileStorage();
        }
        return FileStorage.#instance;
    }

    /**
     * ストレージを初期化
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) return;

        try {
            const config = window.CONFIG?.FILE_STORAGE || {
                DB_NAME: 'ChatBotFileStorage',
                STORE_NAME: 'generatedFiles',
                DB_VERSION: 1
            };

            this.#db = await this.#openDatabase(config);
            this.#initialized = true;

            // 古いファイルのクリーンアップを実行
            await this.#cleanupOldFiles();

            console.log('[FileStorage] 初期化完了');
        } catch (error) {
            console.error('[FileStorage] 初期化エラー:', error);
            throw error;
        }
    }

    /**
     * IndexedDBを開く
     * @param {Object} config - 設定オブジェクト
     * @returns {Promise<IDBDatabase>}
     */
    #openDatabase(config) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(config.DB_NAME, config.DB_VERSION);

            request.onerror = () => {
                reject(new Error(`IndexedDB open failed: ${request.error}`));
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // ファイルストアを作成
                if (!db.objectStoreNames.contains(config.STORE_NAME)) {
                    const store = db.createObjectStore(config.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('conversationId', 'conversationId', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('messageTimestamp', 'messageTimestamp', { unique: false });
                }
            };
        });
    }

    /**
     * ファイルを保存
     * @param {Object} fileResult - ツール実行結果（blob, filename, mimeType等）
     * @param {string} conversationId - 会話ID
     * @param {number} messageTimestamp - メッセージのタイムスタンプ
     * @returns {Promise<string>} 保存したファイルのID
     */
    async save(fileResult, conversationId, messageTimestamp) {
        if (!this.#initialized) {
            await this.initialize();
        }

        const config = window.CONFIG?.FILE_STORAGE || { STORE_NAME: 'generatedFiles' };
        const fileId = this.#generateFileId();

        const fileRecord = {
            id: fileId,
            conversationId: conversationId,
            messageTimestamp: messageTimestamp,
            filename: fileResult.filename,
            mimeType: fileResult.mimeType,
            size: fileResult.size || fileResult.blob?.size || 0,
            blob: fileResult.blob,
            createdAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([config.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(config.STORE_NAME);
            const request = store.put(fileRecord);

            request.onsuccess = () => {
                console.log(`[FileStorage] ファイル保存: ${fileResult.filename} (ID: ${fileId})`);
                resolve(fileId);
            };

            request.onerror = () => {
                console.error('[FileStorage] ファイル保存エラー:', request.error);
                reject(new Error(`ファイル保存に失敗: ${request.error}`));
            };
        });
    }

    /**
     * ファイルを取得
     * @param {string} fileId - ファイルID
     * @returns {Promise<Object|null>} ファイルレコード
     */
    async get(fileId) {
        if (!this.#initialized) {
            await this.initialize();
        }

        const config = window.CONFIG?.FILE_STORAGE || { STORE_NAME: 'generatedFiles' };

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([config.STORE_NAME], 'readonly');
            const store = transaction.objectStore(config.STORE_NAME);
            const request = store.get(fileId);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                console.error('[FileStorage] ファイル取得エラー:', request.error);
                reject(new Error(`ファイル取得に失敗: ${request.error}`));
            };
        });
    }

    /**
     * 会話に関連するすべてのファイルを取得
     * @param {string} conversationId - 会話ID
     * @returns {Promise<Object[]>} ファイルレコードの配列
     */
    async getByConversation(conversationId) {
        if (!this.#initialized) {
            await this.initialize();
        }

        const config = window.CONFIG?.FILE_STORAGE || { STORE_NAME: 'generatedFiles' };

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([config.STORE_NAME], 'readonly');
            const store = transaction.objectStore(config.STORE_NAME);
            const index = store.index('conversationId');
            const request = index.getAll(conversationId);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('[FileStorage] 会話ファイル取得エラー:', request.error);
                reject(new Error(`会話ファイル取得に失敗: ${request.error}`));
            };
        });
    }

    /**
     * 特定のメッセージに関連するファイルを取得
     * @param {number} messageTimestamp - メッセージのタイムスタンプ
     * @returns {Promise<Object[]>} ファイルレコードの配列
     */
    async getByMessageTimestamp(messageTimestamp) {
        if (!this.#initialized) {
            await this.initialize();
        }

        const config = window.CONFIG?.FILE_STORAGE || { STORE_NAME: 'generatedFiles' };

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([config.STORE_NAME], 'readonly');
            const store = transaction.objectStore(config.STORE_NAME);
            const index = store.index('messageTimestamp');
            const request = index.getAll(messageTimestamp);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('[FileStorage] メッセージファイル取得エラー:', request.error);
                reject(new Error(`メッセージファイル取得に失敗: ${request.error}`));
            };
        });
    }

    /**
     * ファイルを削除
     * @param {string} fileId - ファイルID
     * @returns {Promise<void>}
     */
    async delete(fileId) {
        if (!this.#initialized) {
            await this.initialize();
        }

        const config = window.CONFIG?.FILE_STORAGE || { STORE_NAME: 'generatedFiles' };

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([config.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(config.STORE_NAME);
            const request = store.delete(fileId);

            request.onsuccess = () => {
                console.log(`[FileStorage] ファイル削除: ${fileId}`);
                resolve();
            };

            request.onerror = () => {
                console.error('[FileStorage] ファイル削除エラー:', request.error);
                reject(new Error(`ファイル削除に失敗: ${request.error}`));
            };
        });
    }

    /**
     * 会話に関連するすべてのファイルを削除
     * @param {string} conversationId - 会話ID
     * @returns {Promise<number>} 削除したファイル数
     */
    async deleteByConversation(conversationId) {
        const files = await this.getByConversation(conversationId);

        for (const file of files) {
            await this.delete(file.id);
        }

        console.log(`[FileStorage] 会話 ${conversationId} のファイル ${files.length} 件を削除`);
        return files.length;
    }

    /**
     * 古いファイルをクリーンアップ
     * @returns {Promise<number>} 削除したファイル数
     */
    async #cleanupOldFiles() {
        const config = window.CONFIG?.FILE_STORAGE || {
            STORE_NAME: 'generatedFiles',
            RETENTION_DAYS: 7
        };

        const retentionDays = config.RETENTION_DAYS || 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cutoffISO = cutoffDate.toISOString();

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([config.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(config.STORE_NAME);
            const index = store.index('createdAt');
            const range = IDBKeyRange.upperBound(cutoffISO);
            const request = index.openCursor(range);

            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    deletedCount++;
                    cursor.continue();
                } else {
                    if (deletedCount > 0) {
                        console.log(`[FileStorage] 古いファイル ${deletedCount} 件をクリーンアップ`);
                    }
                    resolve(deletedCount);
                }
            };

            request.onerror = () => {
                console.error('[FileStorage] クリーンアップエラー:', request.error);
                reject(new Error(`クリーンアップに失敗: ${request.error}`));
            };
        });
    }

    /**
     * ユニークなファイルIDを生成
     * @returns {string}
     */
    #generateFileId() {
        return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * ストレージの使用状況を取得
     * @returns {Promise<Object>} { totalFiles, totalSize }
     */
    async getStorageStats() {
        if (!this.#initialized) {
            await this.initialize();
        }

        const config = window.CONFIG?.FILE_STORAGE || { STORE_NAME: 'generatedFiles' };

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([config.STORE_NAME], 'readonly');
            const store = transaction.objectStore(config.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const files = request.result || [];
                const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
                resolve({
                    totalFiles: files.length,
                    totalSize: totalSize,
                    formattedSize: this.#formatFileSize(totalSize)
                });
            };

            request.onerror = () => {
                reject(new Error(`ストレージ統計取得に失敗: ${request.error}`));
            };
        });
    }

    /**
     * ファイルサイズをフォーマット
     * @param {number} bytes - バイト数
     * @returns {string}
     */
    #formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
