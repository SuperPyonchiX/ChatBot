/**
 * customToolStorage.js
 * カスタムツールの永続化管理
 * IndexedDBをメイン、LocalStorageをフォールバックとして使用
 */

/**
 * @typedef {Object} CustomToolDefinition
 * @property {string} id - ツールID
 * @property {string} name - ツール名
 * @property {string} description - ツールの説明
 * @property {Object} parameters - パラメータスキーマ（JSON Schema形式）
 * @property {string[]} keywords - 関連キーワード
 * @property {string} executeCode - 実行コード
 * @property {boolean} enabled - 有効/無効
 * @property {number} createdAt - 作成日時
 * @property {number} updatedAt - 更新日時
 */

class CustomToolStorage {
    static #instance = null;

    /** @type {IDBDatabase|null} */
    #db = null;

    /** @type {boolean} */
    #useIndexedDB = true;

    /** @type {string} */
    #dbName;

    /** @type {string} */
    #storeName;

    /** @type {string} */
    #localStorageKey;

    /**
     * @constructor
     */
    constructor() {
        if (CustomToolStorage.#instance) {
            return CustomToolStorage.#instance;
        }
        CustomToolStorage.#instance = this;

        const config = window.CONFIG?.TOOLS?.CUSTOM || {};
        this.#dbName = config.DB_NAME || 'AgentCustomToolsDB';
        this.#storeName = config.DB_STORE || 'tools';
        this.#localStorageKey = config.STORAGE_KEY || 'agent_custom_tools';
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {CustomToolStorage}
     */
    static get getInstance() {
        if (!CustomToolStorage.#instance) {
            CustomToolStorage.#instance = new CustomToolStorage();
        }
        return CustomToolStorage.#instance;
    }

    /**
     * 初期化
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            await this.#openDatabase();
            console.log('[CustomToolStorage] IndexedDBで初期化完了');
        } catch (error) {
            console.warn('[CustomToolStorage] IndexedDB利用不可、LocalStorageにフォールバック:', error);
            this.#useIndexedDB = false;
        }
    }

    /**
     * IndexedDBを開く
     * @returns {Promise<IDBDatabase>}
     */
    #openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.#dbName, 1);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                this.#db = request.result;
                resolve(this.#db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.#storeName)) {
                    const store = db.createObjectStore(this.#storeName, { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: true });
                    store.createIndex('enabled', 'enabled', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    // ========================================
    // CRUD操作
    // ========================================

    /**
     * ツールを保存
     * @param {CustomToolDefinition} tool - ツール定義
     * @returns {Promise<CustomToolDefinition>}
     */
    async save(tool) {
        // IDを生成（新規の場合）
        if (!tool.id) {
            tool.id = `custom_tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        // タイムスタンプを更新
        const now = Date.now();
        if (!tool.createdAt) {
            tool.createdAt = now;
        }
        tool.updatedAt = now;

        // デフォルト値を設定
        if (tool.enabled === undefined) {
            tool.enabled = true;
        }
        if (!tool.keywords) {
            tool.keywords = [];
        }

        if (this.#useIndexedDB) {
            return await this.#saveToIndexedDB(tool);
        } else {
            return await this.#saveToLocalStorage(tool);
        }
    }

    /**
     * IndexedDBに保存
     * @param {CustomToolDefinition} tool
     * @returns {Promise<CustomToolDefinition>}
     */
    #saveToIndexedDB(tool) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readwrite');
            const store = transaction.objectStore(this.#storeName);
            const request = store.put(tool);

            request.onsuccess = () => {
                console.log(`[CustomToolStorage] ツール保存: ${tool.name}`);
                resolve(tool);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * LocalStorageに保存
     * @param {CustomToolDefinition} tool
     * @returns {Promise<CustomToolDefinition>}
     */
    async #saveToLocalStorage(tool) {
        const tools = await this.getAll();
        const index = tools.findIndex(t => t.id === tool.id);

        if (index >= 0) {
            tools[index] = tool;
        } else {
            tools.push(tool);
        }

        localStorage.setItem(this.#localStorageKey, JSON.stringify(tools));
        console.log(`[CustomToolStorage] ツール保存（LocalStorage）: ${tool.name}`);
        return tool;
    }

    /**
     * ツールを取得
     * @param {string} id - ツールID
     * @returns {Promise<CustomToolDefinition|null>}
     */
    async get(id) {
        if (this.#useIndexedDB) {
            return await this.#getFromIndexedDB(id);
        } else {
            return await this.#getFromLocalStorage(id);
        }
    }

    /**
     * IndexedDBから取得
     * @param {string} id
     * @returns {Promise<CustomToolDefinition|null>}
     */
    #getFromIndexedDB(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readonly');
            const store = transaction.objectStore(this.#storeName);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * LocalStorageから取得
     * @param {string} id
     * @returns {Promise<CustomToolDefinition|null>}
     */
    async #getFromLocalStorage(id) {
        const tools = await this.getAll();
        return tools.find(t => t.id === id) || null;
    }

    /**
     * ツール名で取得
     * @param {string} name - ツール名
     * @returns {Promise<CustomToolDefinition|null>}
     */
    async getByName(name) {
        if (this.#useIndexedDB) {
            return await this.#getByNameFromIndexedDB(name);
        } else {
            const tools = await this.getAll();
            return tools.find(t => t.name === name) || null;
        }
    }

    /**
     * IndexedDBから名前で取得
     * @param {string} name
     * @returns {Promise<CustomToolDefinition|null>}
     */
    #getByNameFromIndexedDB(name) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readonly');
            const store = transaction.objectStore(this.#storeName);
            const index = store.index('name');
            const request = index.get(name);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 全ツールを取得
     * @param {Object} [options] - オプション
     * @param {boolean} [options.enabledOnly] - 有効なもののみ
     * @returns {Promise<CustomToolDefinition[]>}
     */
    async getAll(options = {}) {
        let tools;

        if (this.#useIndexedDB) {
            tools = await this.#getAllFromIndexedDB();
        } else {
            tools = this.#getAllFromLocalStorage();
        }

        if (options.enabledOnly) {
            tools = tools.filter(t => t.enabled);
        }

        // 作成日時でソート（新しい順）
        tools.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        return tools;
    }

    /**
     * IndexedDBから全件取得
     * @returns {Promise<CustomToolDefinition[]>}
     */
    #getAllFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readonly');
            const store = transaction.objectStore(this.#storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * LocalStorageから全件取得
     * @returns {CustomToolDefinition[]}
     */
    #getAllFromLocalStorage() {
        try {
            const data = localStorage.getItem(this.#localStorageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('[CustomToolStorage] LocalStorage読み込みエラー:', error);
            return [];
        }
    }

    /**
     * ツールを削除
     * @param {string} id - ツールID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        if (this.#useIndexedDB) {
            return await this.#deleteFromIndexedDB(id);
        } else {
            return await this.#deleteFromLocalStorage(id);
        }
    }

    /**
     * IndexedDBから削除
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    #deleteFromIndexedDB(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readwrite');
            const store = transaction.objectStore(this.#storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log(`[CustomToolStorage] ツール削除: ${id}`);
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * LocalStorageから削除
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async #deleteFromLocalStorage(id) {
        const tools = await this.getAll();
        const filtered = tools.filter(t => t.id !== id);

        if (filtered.length === tools.length) {
            return false;
        }

        localStorage.setItem(this.#localStorageKey, JSON.stringify(filtered));
        console.log(`[CustomToolStorage] ツール削除（LocalStorage）: ${id}`);
        return true;
    }

    // ========================================
    // インポート/エクスポート
    // ========================================

    /**
     * ツールをエクスポート
     * @param {string} [id] - 特定のツールID（省略時は全件）
     * @returns {Promise<string>} JSON文字列
     */
    async export(id) {
        if (id) {
            const tool = await this.get(id);
            return JSON.stringify(tool, null, 2);
        } else {
            const tools = await this.getAll();
            return JSON.stringify(tools, null, 2);
        }
    }

    /**
     * ツールをインポート
     * @param {string} jsonString - JSON文字列
     * @param {Object} [options] - オプション
     * @param {boolean} [options.overwrite] - 既存のツールを上書き
     * @returns {Promise<CustomToolDefinition[]>} インポートされたツール
     */
    async import(jsonString, options = {}) {
        const data = JSON.parse(jsonString);
        const tools = Array.isArray(data) ? data : [data];
        const imported = [];

        for (const tool of tools) {
            // バリデーション
            if (!this.#validateTool(tool)) {
                console.warn('[CustomToolStorage] 無効なツール定義をスキップ:', tool);
                continue;
            }

            // 既存チェック
            const existing = await this.getByName(tool.name);
            if (existing && !options.overwrite) {
                console.log(`[CustomToolStorage] ツール "${tool.name}" は既に存在するためスキップ`);
                continue;
            }

            // IDを再生成（上書き時）
            if (existing && options.overwrite) {
                tool.id = existing.id;
            } else {
                tool.id = null; // 新規IDを生成
            }

            const saved = await this.save(tool);
            imported.push(saved);
        }

        console.log(`[CustomToolStorage] ${imported.length}件のツールをインポート`);
        return imported;
    }

    /**
     * ツール定義をバリデーション
     * @param {Object} tool
     * @returns {boolean}
     */
    #validateTool(tool) {
        if (!tool || typeof tool !== 'object') return false;
        if (!tool.name || typeof tool.name !== 'string') return false;
        if (!tool.description || typeof tool.description !== 'string') return false;
        if (!tool.executeCode || typeof tool.executeCode !== 'string') return false;
        if (tool.parameters && typeof tool.parameters !== 'object') return false;
        return true;
    }

    /**
     * ファイルにエクスポート
     * @param {string} [id] - 特定のツールID
     */
    async downloadAsFile(id) {
        const json = await this.export(id);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = id ? `custom_tool_${id}.json` : 'custom_tools.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * ファイルからインポート
     * @param {File} file
     * @param {Object} [options]
     * @returns {Promise<CustomToolDefinition[]>}
     */
    async importFromFile(file, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const imported = await this.import(e.target.result, options);
                    resolve(imported);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('ファイル読み込みエラー'));
            };

            reader.readAsText(file);
        });
    }

    // ========================================
    // ユーティリティ
    // ========================================

    /**
     * 全件削除
     * @returns {Promise<void>}
     */
    async clear() {
        if (this.#useIndexedDB) {
            return new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([this.#storeName], 'readwrite');
                const store = transaction.objectStore(this.#storeName);
                const request = store.clear();

                request.onsuccess = () => {
                    console.log('[CustomToolStorage] 全ツール削除');
                    resolve();
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } else {
            localStorage.removeItem(this.#localStorageKey);
            console.log('[CustomToolStorage] 全ツール削除（LocalStorage）');
        }
    }

    /**
     * ツール数を取得
     * @returns {Promise<number>}
     */
    async count() {
        const tools = await this.getAll();
        return tools.length;
    }

    /**
     * ツールの有効/無効を切り替え
     * @param {string} id - ツールID
     * @param {boolean} enabled - 有効/無効
     * @returns {Promise<CustomToolDefinition|null>}
     */
    async setEnabled(id, enabled) {
        const tool = await this.get(id);
        if (!tool) return null;

        tool.enabled = enabled;
        return await this.save(tool);
    }
}

// グローバルに公開
window.CustomToolStorage = CustomToolStorage;
