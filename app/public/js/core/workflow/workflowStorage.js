/**
 * workflowStorage.js
 * ワークフローの永続化管理
 * IndexedDB/LocalStorageへの保存・読み込み
 */

/**
 * @typedef {Object} StoredWorkflow
 * @property {string} id - ワークフローID
 * @property {string} name - ワークフロー名
 * @property {string} [description] - 説明
 * @property {Array} nodes - ノード配列
 * @property {Array} connections - 接続配列
 * @property {number} createdAt - 作成日時
 * @property {number} updatedAt - 更新日時
 * @property {Object} [metadata] - メタデータ
 */

class WorkflowStorage {
    static #instance = null;

    /** @type {string} */
    #dbName;

    /** @type {string} */
    #storeName;

    /** @type {IDBDatabase|null} */
    #db = null;

    /** @type {boolean} */
    #useIndexedDB;

    /** @type {string} */
    #localStorageKey;

    /** @type {boolean} */
    #initialized = false;

    /**
     * @constructor
     */
    constructor() {
        if (WorkflowStorage.#instance) {
            return WorkflowStorage.#instance;
        }
        WorkflowStorage.#instance = this;

        const config = window.CONFIG?.WORKFLOW?.STORAGE || {};
        this.#dbName = config.INDEXEDDB_NAME || 'WorkflowDB';
        this.#storeName = config.INDEXEDDB_STORE || 'workflows';
        this.#localStorageKey = config.LOCALSTORAGE_KEY || 'chatbot_workflows';
        this.#useIndexedDB = config.USE_INDEXEDDB !== false;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {WorkflowStorage}
     */
    static get getInstance() {
        if (!WorkflowStorage.#instance) {
            WorkflowStorage.#instance = new WorkflowStorage();
        }
        return WorkflowStorage.#instance;
    }

    /**
     * 初期化
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) return;

        if (this.#useIndexedDB) {
            await this.#initIndexedDB();
        }

        this.#initialized = true;
        console.log('[WorkflowStorage] 初期化完了');
    }

    /**
     * IndexedDBを初期化
     * @returns {Promise<void>}
     */
    async #initIndexedDB() {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(this.#dbName, 1);

                request.onerror = () => {
                    console.warn('[WorkflowStorage] IndexedDB初期化エラー、LocalStorageにフォールバック');
                    this.#useIndexedDB = false;
                    resolve();
                };

                request.onsuccess = (event) => {
                    this.#db = event.target.result;
                    console.log('[WorkflowStorage] IndexedDB接続成功');
                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    if (!db.objectStoreNames.contains(this.#storeName)) {
                        const store = db.createObjectStore(this.#storeName, { keyPath: 'id' });
                        store.createIndex('name', 'name', { unique: false });
                        store.createIndex('updatedAt', 'updatedAt', { unique: false });
                        store.createIndex('createdAt', 'createdAt', { unique: false });
                    }

                    console.log('[WorkflowStorage] IndexedDBスキーマ作成完了');
                };
            } catch (error) {
                console.warn('[WorkflowStorage] IndexedDB初期化エラー:', error);
                this.#useIndexedDB = false;
                resolve();
            }
        });
    }

    /**
     * ワークフローを保存
     * @param {Object} workflow - ワークフロー定義
     * @returns {Promise<StoredWorkflow>}
     */
    async save(workflow) {
        await this.initialize();

        const now = Date.now();
        const storedWorkflow = {
            ...workflow,
            id: workflow.id || `wf_${now}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: workflow.createdAt || now,
            updatedAt: now
        };

        if (this.#useIndexedDB && this.#db) {
            await this.#saveToIndexedDB(storedWorkflow);
        } else {
            this.#saveToLocalStorage(storedWorkflow);
        }

        console.log(`[WorkflowStorage] ワークフロー保存: ${storedWorkflow.id}`);
        return storedWorkflow;
    }

    /**
     * IndexedDBに保存
     * @param {StoredWorkflow} workflow
     * @returns {Promise<void>}
     */
    async #saveToIndexedDB(workflow) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readwrite');
            const store = transaction.objectStore(this.#storeName);
            const request = store.put(workflow);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * LocalStorageに保存
     * @param {StoredWorkflow} workflow
     */
    #saveToLocalStorage(workflow) {
        const workflows = this.#getLocalStorageData();
        const index = workflows.findIndex(w => w.id === workflow.id);

        if (index >= 0) {
            workflows[index] = workflow;
        } else {
            workflows.push(workflow);
        }

        localStorage.setItem(this.#localStorageKey, JSON.stringify(workflows));
    }

    /**
     * ワークフローを取得
     * @param {string} id - ワークフローID
     * @returns {Promise<StoredWorkflow|null>}
     */
    async get(id) {
        await this.initialize();

        if (this.#useIndexedDB && this.#db) {
            return this.#getFromIndexedDB(id);
        } else {
            return this.#getFromLocalStorage(id);
        }
    }

    /**
     * IndexedDBから取得
     * @param {string} id
     * @returns {Promise<StoredWorkflow|null>}
     */
    async #getFromIndexedDB(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readonly');
            const store = transaction.objectStore(this.#storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * LocalStorageから取得
     * @param {string} id
     * @returns {StoredWorkflow|null}
     */
    #getFromLocalStorage(id) {
        const workflows = this.#getLocalStorageData();
        return workflows.find(w => w.id === id) || null;
    }

    /**
     * 全ワークフローを取得
     * @param {Object} [options] - オプション
     * @param {string} [options.sortBy='updatedAt'] - ソート基準
     * @param {boolean} [options.descending=true] - 降順
     * @returns {Promise<StoredWorkflow[]>}
     */
    async getAll(options = {}) {
        await this.initialize();

        const { sortBy = 'updatedAt', descending = true } = options;

        let workflows;
        if (this.#useIndexedDB && this.#db) {
            workflows = await this.#getAllFromIndexedDB();
        } else {
            workflows = this.#getLocalStorageData();
        }

        // ソート
        workflows.sort((a, b) => {
            const aVal = a[sortBy] || 0;
            const bVal = b[sortBy] || 0;
            return descending ? bVal - aVal : aVal - bVal;
        });

        return workflows;
    }

    /**
     * IndexedDBから全件取得
     * @returns {Promise<StoredWorkflow[]>}
     */
    async #getAllFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readonly');
            const store = transaction.objectStore(this.#storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * ワークフローを削除
     * @param {string} id - ワークフローID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        await this.initialize();

        if (this.#useIndexedDB && this.#db) {
            await this.#deleteFromIndexedDB(id);
        } else {
            this.#deleteFromLocalStorage(id);
        }

        console.log(`[WorkflowStorage] ワークフロー削除: ${id}`);
        return true;
    }

    /**
     * IndexedDBから削除
     * @param {string} id
     * @returns {Promise<void>}
     */
    async #deleteFromIndexedDB(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readwrite');
            const store = transaction.objectStore(this.#storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * LocalStorageから削除
     * @param {string} id
     */
    #deleteFromLocalStorage(id) {
        const workflows = this.#getLocalStorageData();
        const filtered = workflows.filter(w => w.id !== id);
        localStorage.setItem(this.#localStorageKey, JSON.stringify(filtered));
    }

    /**
     * ワークフローを複製
     * @param {string} id - 複製元のID
     * @param {string} [newName] - 新しい名前
     * @returns {Promise<StoredWorkflow>}
     */
    async duplicate(id, newName = null) {
        const original = await this.get(id);
        if (!original) {
            throw new Error(`ワークフローが見つかりません: ${id}`);
        }

        const duplicate = {
            ...original,
            id: null, // 新しいIDを生成させる
            name: newName || `${original.name} (コピー)`,
            createdAt: null, // 新しい作成日時
            updatedAt: null
        };

        return this.save(duplicate);
    }

    /**
     * ワークフローをエクスポート
     * @param {string} id - ワークフローID
     * @returns {Promise<string>} JSON文字列
     */
    async export(id) {
        const workflow = await this.get(id);
        if (!workflow) {
            throw new Error(`ワークフローが見つかりません: ${id}`);
        }

        return JSON.stringify(workflow, null, 2);
    }

    /**
     * ワークフローをファイルとしてダウンロード
     * @param {string} id - ワークフローID
     */
    async downloadAsFile(id) {
        const workflow = await this.get(id);
        if (!workflow) {
            throw new Error(`ワークフローが見つかりません: ${id}`);
        }

        const json = JSON.stringify(workflow, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`[WorkflowStorage] ワークフローをエクスポート: ${id}`);
    }

    /**
     * ワークフローをインポート
     * @param {string} jsonString - JSON文字列
     * @returns {Promise<StoredWorkflow>}
     */
    async import(jsonString) {
        try {
            const workflow = JSON.parse(jsonString);

            // 必須フィールドの検証
            if (!workflow.name || !workflow.nodes || !workflow.connections) {
                throw new Error('無効なワークフロー形式です');
            }

            // 新しいIDを生成
            workflow.id = null;
            workflow.createdAt = null;
            workflow.updatedAt = null;

            return this.save(workflow);
        } catch (error) {
            throw new Error(`インポートエラー: ${error.message}`);
        }
    }

    /**
     * ファイルからインポート
     * @param {File} file - JSONファイル
     * @returns {Promise<StoredWorkflow>}
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const workflow = await this.import(e.target.result);
                    resolve(workflow);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
            reader.readAsText(file);
        });
    }

    /**
     * 全ワークフローをエクスポート
     * @returns {Promise<string>}
     */
    async exportAll() {
        const workflows = await this.getAll();
        return JSON.stringify({
            version: '1.0',
            exportedAt: Date.now(),
            workflows: workflows
        }, null, 2);
    }

    /**
     * 全ワークフローをインポート
     * @param {string} jsonString
     * @param {Object} [options]
     * @param {boolean} [options.overwrite=false] - 既存を上書き
     * @returns {Promise<number>} インポート件数
     */
    async importAll(jsonString, options = {}) {
        const { overwrite = false } = options;

        try {
            const data = JSON.parse(jsonString);
            const workflows = data.workflows || [];
            let importCount = 0;

            for (const workflow of workflows) {
                if (!overwrite) {
                    workflow.id = null;
                    workflow.createdAt = null;
                }
                workflow.updatedAt = null;
                await this.save(workflow);
                importCount++;
            }

            console.log(`[WorkflowStorage] ${importCount}件のワークフローをインポート`);
            return importCount;
        } catch (error) {
            throw new Error(`インポートエラー: ${error.message}`);
        }
    }

    /**
     * ワークフローを検索
     * @param {string} query - 検索クエリ
     * @returns {Promise<StoredWorkflow[]>}
     */
    async search(query) {
        const workflows = await this.getAll();
        const lowerQuery = query.toLowerCase();

        return workflows.filter(w =>
            w.name.toLowerCase().includes(lowerQuery) ||
            (w.description && w.description.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * ストレージ統計を取得
     * @returns {Promise<Object>}
     */
    async getStats() {
        const workflows = await this.getAll();

        return {
            count: workflows.length,
            useIndexedDB: this.#useIndexedDB,
            oldestWorkflow: workflows.length > 0
                ? new Date(Math.min(...workflows.map(w => w.createdAt)))
                : null,
            newestWorkflow: workflows.length > 0
                ? new Date(Math.max(...workflows.map(w => w.updatedAt)))
                : null,
            totalNodes: workflows.reduce((sum, w) => sum + (w.nodes?.length || 0), 0),
            totalConnections: workflows.reduce((sum, w) => sum + (w.connections?.length || 0), 0)
        };
    }

    /**
     * ストレージをクリア
     * @returns {Promise<void>}
     */
    async clear() {
        await this.initialize();

        if (this.#useIndexedDB && this.#db) {
            await new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([this.#storeName], 'readwrite');
                const store = transaction.objectStore(this.#storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } else {
            localStorage.removeItem(this.#localStorageKey);
        }

        console.log('[WorkflowStorage] ストレージをクリア');
    }

    /**
     * LocalStorageからデータを取得
     * @returns {StoredWorkflow[]}
     */
    #getLocalStorageData() {
        try {
            const data = localStorage.getItem(this.#localStorageKey);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }
}

// グローバルに公開
window.WorkflowStorage = WorkflowStorage;
