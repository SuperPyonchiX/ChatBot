/**
 * agentMemory.js
 * エージェントの短期・長期メモリ管理
 * 会話コンテキストとツール実行履歴を保持
 * IndexedDB対応の永続化機能を提供
 */

/**
 * メモリアイテムの型定義
 * @typedef {Object} MemoryItem
 * @property {string} id - 一意識別子
 * @property {'observation'|'thought'|'action'|'result'|'context'} type - アイテムタイプ
 * @property {*} content - 内容
 * @property {number} timestamp - 作成日時
 * @property {Object} [metadata] - 追加メタデータ
 */

/**
 * 作業メモリの型定義
 * @typedef {Object} WorkingMemory
 * @property {string} taskId - 現在のタスクID
 * @property {string} goal - 現在の目標
 * @property {number} iteration - 現在のイテレーション
 * @property {Object} variables - 変数マップ
 * @property {Array} pendingActions - 保留中のアクション
 */

/**
 * タスク履歴の型定義
 * @typedef {Object} TaskHistory
 * @property {string} taskId - タスクID
 * @property {string} goal - 目標
 * @property {number} startTime - 開始時刻
 * @property {number} endTime - 終了時刻
 * @property {boolean} success - 成功したかどうか
 * @property {number} iterations - イテレーション数
 * @property {string} summary - サマリー
 */

class AgentMemory {
    static #instance = null;

    /** @type {MemoryItem[]} */
    #shortTermMemory = [];

    /** @type {MemoryItem[]} */
    #longTermMemory = [];

    /** @type {TaskHistory[]} */
    #taskHistory = [];

    /** @type {WorkingMemory} */
    #workingMemory = {
        taskId: null,
        goal: null,
        iteration: 0,
        variables: {},
        pendingActions: []
    };

    /** @type {number} */
    #maxShortTermItems;

    /** @type {number} */
    #maxLongTermItems;

    /** @type {number} */
    #maxTaskHistory;

    /** @type {string} */
    #persistenceKey;

    /** @type {string} */
    #dbName;

    /** @type {string} */
    #storeName;

    /** @type {IDBDatabase|null} */
    #db = null;

    /** @type {boolean} */
    #useIndexedDB;

    /** @type {boolean} */
    #initialized = false;

    /**
     * @constructor
     */
    constructor() {
        if (AgentMemory.#instance) {
            return AgentMemory.#instance;
        }
        AgentMemory.#instance = this;

        const config = window.CONFIG?.AGENT?.MEMORY || {};
        this.#maxShortTermItems = config.SHORT_TERM_LIMIT || 50;
        this.#maxLongTermItems = config.LONG_TERM_LIMIT || 200;
        this.#maxTaskHistory = config.TASK_HISTORY_LIMIT || 100;
        this.#persistenceKey = config.PERSISTENCE_KEY || 'agent_memory';
        this.#dbName = config.INDEXEDDB_NAME || 'AgentMemoryDB';
        this.#storeName = config.INDEXEDDB_STORE || 'memories';
        this.#useIndexedDB = config.USE_INDEXEDDB !== false;

        this.#initialize();
    }

    /**
     * 初期化処理
     */
    async #initialize() {
        if (this.#useIndexedDB) {
            await this.#initIndexedDB();
        }
        await this.#loadFromStorage();
        this.#initialized = true;
        console.log('[AgentMemory] 初期化完了');
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
                    console.warn('[AgentMemory] IndexedDB初期化エラー、LocalStorageにフォールバック');
                    this.#useIndexedDB = false;
                    resolve();
                };

                request.onsuccess = (event) => {
                    this.#db = event.target.result;
                    console.log('[AgentMemory] IndexedDB接続成功');
                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    // メモリストア
                    if (!db.objectStoreNames.contains(this.#storeName)) {
                        const store = db.createObjectStore(this.#storeName, { keyPath: 'id' });
                        store.createIndex('type', 'type', { unique: false });
                        store.createIndex('timestamp', 'timestamp', { unique: false });
                    }

                    // タスク履歴ストア
                    if (!db.objectStoreNames.contains('taskHistory')) {
                        const historyStore = db.createObjectStore('taskHistory', { keyPath: 'taskId' });
                        historyStore.createIndex('startTime', 'startTime', { unique: false });
                    }

                    console.log('[AgentMemory] IndexedDBスキーマ作成完了');
                };
            } catch (error) {
                console.warn('[AgentMemory] IndexedDB初期化エラー:', error);
                this.#useIndexedDB = false;
                resolve();
            }
        });
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {AgentMemory}
     */
    static get getInstance() {
        if (!AgentMemory.#instance) {
            AgentMemory.#instance = new AgentMemory();
        }
        return AgentMemory.#instance;
    }

    // ========================================
    // 短期メモリ操作
    // ========================================

    /**
     * 短期メモリにアイテムを追加
     * @param {Object} item - 追加するアイテム
     * @param {string} item.type - アイテムタイプ
     * @param {*} item.content - 内容
     * @param {Object} [item.metadata] - メタデータ
     * @returns {MemoryItem} 追加されたアイテム
     */
    addToShortTerm(item) {
        const memoryItem = {
            id: this.#generateId(),
            type: item.type,
            content: item.content,
            timestamp: Date.now(),
            metadata: item.metadata || {}
        };

        this.#shortTermMemory.push(memoryItem);

        // 最大数を超えたら古いものを削除
        while (this.#shortTermMemory.length > this.#maxShortTermItems) {
            const removed = this.#shortTermMemory.shift();
            // 重要なアイテムは長期メモリに移動
            if (this.#isImportant(removed)) {
                this.addToLongTerm(removed);
            }
        }

        console.log(`[AgentMemory] 短期メモリに追加: ${item.type}`);
        return memoryItem;
    }

    /**
     * 短期メモリからコンテキストを取得
     * @param {number} [limit=10] - 取得する最大数
     * @param {string} [filterType] - フィルタするタイプ
     * @returns {MemoryItem[]} メモリアイテムの配列
     */
    getShortTermContext(limit = 10, filterType = null) {
        let items = [...this.#shortTermMemory];

        if (filterType) {
            items = items.filter(item => item.type === filterType);
        }

        return items.slice(-limit);
    }

    /**
     * 短期メモリをクリア
     */
    clearShortTerm() {
        console.log('[AgentMemory] 短期メモリをクリア');
        this.#shortTermMemory = [];
    }

    /**
     * 短期メモリの現在のサイズを取得
     * @returns {number}
     */
    getShortTermSize() {
        return this.#shortTermMemory.length;
    }

    // ========================================
    // 長期メモリ操作
    // ========================================

    /**
     * 長期メモリにアイテムを追加
     * @param {MemoryItem|Object} item - 追加するアイテム
     * @returns {MemoryItem} 追加されたアイテム
     */
    addToLongTerm(item) {
        const memoryItem = item.id ? item : {
            id: this.#generateId(),
            type: item.type,
            content: item.content,
            timestamp: Date.now(),
            metadata: item.metadata || {}
        };

        this.#longTermMemory.push(memoryItem);

        // 最大数を超えたら古いものを削除
        while (this.#longTermMemory.length > this.#maxLongTermItems) {
            this.#longTermMemory.shift();
        }

        // 永続化
        this.#saveToStorage();

        console.log(`[AgentMemory] 長期メモリに追加: ${memoryItem.type}`);
        return memoryItem;
    }

    /**
     * 長期メモリを検索
     * @param {string} query - 検索クエリ
     * @param {Object} [options] - オプション
     * @param {string} [options.type] - タイプでフィルタ
     * @param {number} [options.limit=5] - 結果の最大数
     * @returns {MemoryItem[]} マッチしたアイテム
     */
    searchLongTerm(query, options = {}) {
        const { type, limit = 5 } = options;
        const queryLower = query.toLowerCase();

        let results = this.#longTermMemory.filter(item => {
            // タイプフィルタ
            if (type && item.type !== type) {
                return false;
            }

            // コンテンツ検索
            const contentStr = typeof item.content === 'string'
                ? item.content
                : JSON.stringify(item.content);

            return contentStr.toLowerCase().includes(queryLower);
        });

        // 新しいものを優先
        results.sort((a, b) => b.timestamp - a.timestamp);

        return results.slice(0, limit);
    }

    /**
     * 長期メモリをクリア
     */
    clearLongTerm() {
        console.log('[AgentMemory] 長期メモリをクリア');
        this.#longTermMemory = [];
        this.#saveToStorage();
    }

    /**
     * 長期メモリの現在のサイズを取得
     * @returns {number}
     */
    getLongTermSize() {
        return this.#longTermMemory.length;
    }

    // ========================================
    // 作業メモリ操作
    // ========================================

    /**
     * 作業メモリにコンテキストを設定
     * @param {string} key - キー
     * @param {*} value - 値
     */
    setWorkingContext(key, value) {
        this.#workingMemory.variables[key] = value;
    }

    /**
     * 作業メモリからコンテキストを取得
     * @param {string} key - キー
     * @returns {*} 値
     */
    getWorkingContext(key) {
        return this.#workingMemory.variables[key];
    }

    /**
     * 作業メモリ全体を取得
     * @returns {WorkingMemory}
     */
    getWorkingMemory() {
        return { ...this.#workingMemory };
    }

    /**
     * 作業メモリを初期化（新しいタスク開始時）
     * @param {Object} options - 初期化オプション
     * @param {string} options.taskId - タスクID
     * @param {string} options.goal - 目標
     */
    initializeWorkingMemory(options) {
        this.#workingMemory = {
            taskId: options.taskId || this.#generateId(),
            goal: options.goal || '',
            iteration: 0,
            variables: {},
            pendingActions: []
        };
        console.log(`[AgentMemory] 作業メモリを初期化: ${this.#workingMemory.taskId}`);
    }

    /**
     * イテレーションをインクリメント
     * @returns {number} 新しいイテレーション番号
     */
    incrementIteration() {
        return ++this.#workingMemory.iteration;
    }

    /**
     * 現在のイテレーション番号を取得
     * @returns {number}
     */
    getCurrentIteration() {
        return this.#workingMemory.iteration;
    }

    /**
     * 保留中のアクションを追加
     * @param {Object} action - アクション
     */
    addPendingAction(action) {
        this.#workingMemory.pendingActions.push(action);
    }

    /**
     * 次の保留中アクションを取得して削除
     * @returns {Object|null} アクション
     */
    popPendingAction() {
        return this.#workingMemory.pendingActions.shift() || null;
    }

    /**
     * 作業メモリをクリア
     */
    clearWorkingMemory() {
        console.log('[AgentMemory] 作業メモリをクリア');
        this.#workingMemory = {
            taskId: null,
            goal: null,
            iteration: 0,
            variables: {},
            pendingActions: []
        };
    }

    // ========================================
    // 統合操作
    // ========================================

    /**
     * エージェント実行のサマリーを取得
     * @returns {Object} サマリー
     */
    getExecutionSummary() {
        const observations = this.getShortTermContext(100, 'observation');
        const thoughts = this.getShortTermContext(100, 'thought');
        const actions = this.getShortTermContext(100, 'action');
        const results = this.getShortTermContext(100, 'result');

        return {
            taskId: this.#workingMemory.taskId,
            goal: this.#workingMemory.goal,
            totalIterations: this.#workingMemory.iteration,
            observations: observations.map(o => o.content),
            thoughts: thoughts.map(t => t.content),
            actions: actions.map(a => a.content),
            results: results.map(r => r.content)
        };
    }

    /**
     * 会話履歴形式でメモリを取得（LLMへの入力用）
     * @param {number} [maxItems=20] - 最大アイテム数
     * @returns {Array<{role: string, content: string}>} 会話履歴
     */
    toConversationHistory(maxItems = 20) {
        const items = this.getShortTermContext(maxItems);
        const history = [];

        for (const item of items) {
            switch (item.type) {
                case 'observation':
                    history.push({
                        role: 'system',
                        content: `[Observation] ${this.#contentToString(item.content)}`
                    });
                    break;
                case 'thought':
                    history.push({
                        role: 'assistant',
                        content: `[Thought] ${this.#contentToString(item.content)}`
                    });
                    break;
                case 'action':
                    history.push({
                        role: 'assistant',
                        content: `[Action] ${this.#contentToString(item.content)}`
                    });
                    break;
                case 'result':
                    history.push({
                        role: 'system',
                        content: `[Result] ${this.#contentToString(item.content)}`
                    });
                    break;
            }
        }

        return history;
    }

    /**
     * 全メモリをクリア
     */
    clearAll() {
        this.clearShortTerm();
        this.clearLongTerm();
        this.clearWorkingMemory();
        console.log('[AgentMemory] 全メモリをクリア');
    }

    // ========================================
    // シリアライゼーション
    // ========================================

    /**
     * メモリをシリアライズ
     * @returns {Object} シリアライズされたデータ
     */
    serialize() {
        return {
            longTermMemory: this.#longTermMemory,
            timestamp: Date.now()
        };
    }

    /**
     * シリアライズされたデータからメモリを復元
     * @param {Object} data - シリアライズされたデータ
     */
    deserialize(data) {
        if (data && Array.isArray(data.longTermMemory)) {
            this.#longTermMemory = data.longTermMemory;
            console.log(`[AgentMemory] 長期メモリを復元: ${this.#longTermMemory.length}件`);
        }
    }

    // ========================================
    // プライベートメソッド
    // ========================================

    /**
     * 一意のIDを生成
     * @returns {string}
     */
    #generateId() {
        return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * アイテムが重要かどうかを判定
     * @param {MemoryItem} item
     * @returns {boolean}
     */
    #isImportant(item) {
        // result タイプは重要とみなす
        if (item.type === 'result') {
            return true;
        }

        // メタデータに重要フラグがある場合
        if (item.metadata?.important) {
            return true;
        }

        return false;
    }

    /**
     * コンテンツを文字列に変換
     * @param {*} content
     * @returns {string}
     */
    #contentToString(content) {
        if (typeof content === 'string') {
            return content;
        }
        try {
            return JSON.stringify(content, null, 2);
        } catch {
            return String(content);
        }
    }

    /**
     * ストレージに保存
     */
    async #saveToStorage() {
        try {
            if (this.#useIndexedDB && this.#db) {
                await this.#saveToIndexedDB();
            } else {
                const data = this.serialize();
                localStorage.setItem(this.#persistenceKey, JSON.stringify(data));
            }
        } catch (error) {
            console.error('[AgentMemory] ストレージ保存エラー:', error);
        }
    }

    /**
     * IndexedDBに保存
     * @returns {Promise<void>}
     */
    async #saveToIndexedDB() {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.#db.transaction([this.#storeName, 'taskHistory'], 'readwrite');
                const memoryStore = transaction.objectStore(this.#storeName);
                const historyStore = transaction.objectStore('taskHistory');

                // 長期メモリを保存
                for (const item of this.#longTermMemory) {
                    memoryStore.put(item);
                }

                // タスク履歴を保存
                for (const task of this.#taskHistory) {
                    historyStore.put(task);
                }

                transaction.oncomplete = () => {
                    console.log('[AgentMemory] IndexedDBに保存完了');
                    resolve();
                };

                transaction.onerror = () => {
                    console.error('[AgentMemory] IndexedDB保存エラー');
                    reject(transaction.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * ストレージから読み込み
     * @returns {Promise<void>}
     */
    async #loadFromStorage() {
        try {
            if (this.#useIndexedDB && this.#db) {
                await this.#loadFromIndexedDB();
            } else {
                const stored = localStorage.getItem(this.#persistenceKey);
                if (stored) {
                    const data = JSON.parse(stored);
                    this.deserialize(data);
                }
            }
        } catch (error) {
            console.error('[AgentMemory] ストレージ読み込みエラー:', error);
        }
    }

    /**
     * IndexedDBから読み込み
     * @returns {Promise<void>}
     */
    async #loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.#db.transaction([this.#storeName, 'taskHistory'], 'readonly');
                const memoryStore = transaction.objectStore(this.#storeName);
                const historyStore = transaction.objectStore('taskHistory');

                // 長期メモリを読み込み
                const memoryRequest = memoryStore.getAll();
                memoryRequest.onsuccess = () => {
                    this.#longTermMemory = memoryRequest.result || [];
                    console.log(`[AgentMemory] 長期メモリを読み込み: ${this.#longTermMemory.length}件`);
                };

                // タスク履歴を読み込み
                const historyRequest = historyStore.getAll();
                historyRequest.onsuccess = () => {
                    this.#taskHistory = historyRequest.result || [];
                    console.log(`[AgentMemory] タスク履歴を読み込み: ${this.#taskHistory.length}件`);
                };

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    // ========================================
    // タスク履歴管理
    // ========================================

    /**
     * タスク履歴を追加
     * @param {Object} task - タスク情報
     * @returns {TaskHistory}
     */
    addTaskHistory(task) {
        const history = {
            taskId: task.taskId || this.#generateId(),
            goal: task.goal || '',
            startTime: task.startTime || Date.now(),
            endTime: task.endTime || Date.now(),
            success: task.success ?? false,
            iterations: task.iterations || 0,
            summary: task.summary || ''
        };

        this.#taskHistory.push(history);

        // 最大数を超えたら古いものを削除
        while (this.#taskHistory.length > this.#maxTaskHistory) {
            this.#taskHistory.shift();
        }

        this.#saveToStorage();
        console.log(`[AgentMemory] タスク履歴を追加: ${history.taskId}`);
        return history;
    }

    /**
     * タスク履歴を取得
     * @param {Object} [options] - オプション
     * @param {number} [options.limit=10] - 取得数
     * @param {boolean} [options.successOnly=false] - 成功タスクのみ
     * @returns {TaskHistory[]}
     */
    getTaskHistory(options = {}) {
        const { limit = 10, successOnly = false } = options;
        let history = [...this.#taskHistory];

        if (successOnly) {
            history = history.filter(t => t.success);
        }

        // 新しいものから
        history.sort((a, b) => b.startTime - a.startTime);
        return history.slice(0, limit);
    }

    /**
     * 特定のタスク履歴を取得
     * @param {string} taskId - タスクID
     * @returns {TaskHistory|null}
     */
    getTaskHistoryById(taskId) {
        return this.#taskHistory.find(t => t.taskId === taskId) || null;
    }

    /**
     * 類似タスクの履歴を検索
     * @param {string} goal - 目標
     * @param {number} [limit=3] - 取得数
     * @returns {TaskHistory[]}
     */
    searchSimilarTasks(goal, limit = 3) {
        const goalLower = goal.toLowerCase();
        const results = this.#taskHistory
            .filter(t => t.goal.toLowerCase().includes(goalLower) ||
                        goalLower.includes(t.goal.toLowerCase().substring(0, 20)))
            .sort((a, b) => b.startTime - a.startTime);

        return results.slice(0, limit);
    }

    /**
     * タスク履歴をクリア
     */
    clearTaskHistory() {
        this.#taskHistory = [];
        this.#saveToStorage();
        console.log('[AgentMemory] タスク履歴をクリア');
    }

    // ========================================
    // エクスポート/インポート機能
    // ========================================

    /**
     * 全メモリをエクスポート
     * @returns {Object} エクスポートデータ
     */
    exportMemory() {
        return {
            version: '1.0',
            exportedAt: Date.now(),
            longTermMemory: this.#longTermMemory,
            taskHistory: this.#taskHistory,
            stats: {
                longTermCount: this.#longTermMemory.length,
                taskHistoryCount: this.#taskHistory.length
            }
        };
    }

    /**
     * メモリをJSONファイルとしてダウンロード
     */
    downloadMemory() {
        const data = this.exportMemory();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `agent_memory_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[AgentMemory] メモリをエクスポート');
    }

    /**
     * メモリをインポート
     * @param {Object} data - インポートデータ
     * @param {Object} [options] - オプション
     * @param {boolean} [options.merge=false] - 既存データとマージするか
     * @returns {boolean} 成功したかどうか
     */
    importMemory(data, options = {}) {
        const { merge = false } = options;

        try {
            if (!data || typeof data !== 'object') {
                throw new Error('無効なデータ形式');
            }

            if (data.longTermMemory && Array.isArray(data.longTermMemory)) {
                if (merge) {
                    // マージ: 重複を避けて追加
                    const existingIds = new Set(this.#longTermMemory.map(m => m.id));
                    const newItems = data.longTermMemory.filter(m => !existingIds.has(m.id));
                    this.#longTermMemory.push(...newItems);
                    console.log(`[AgentMemory] ${newItems.length}件の長期メモリをマージ`);
                } else {
                    this.#longTermMemory = data.longTermMemory;
                }
            }

            if (data.taskHistory && Array.isArray(data.taskHistory)) {
                if (merge) {
                    const existingIds = new Set(this.#taskHistory.map(t => t.taskId));
                    const newTasks = data.taskHistory.filter(t => !existingIds.has(t.taskId));
                    this.#taskHistory.push(...newTasks);
                    console.log(`[AgentMemory] ${newTasks.length}件のタスク履歴をマージ`);
                } else {
                    this.#taskHistory = data.taskHistory;
                }
            }

            // 制限を適用
            while (this.#longTermMemory.length > this.#maxLongTermItems) {
                this.#longTermMemory.shift();
            }
            while (this.#taskHistory.length > this.#maxTaskHistory) {
                this.#taskHistory.shift();
            }

            this.#saveToStorage();
            console.log('[AgentMemory] メモリをインポート完了');
            return true;
        } catch (error) {
            console.error('[AgentMemory] インポートエラー:', error);
            return false;
        }
    }

    /**
     * ファイルからメモリをインポート
     * @param {File} file - JSONファイル
     * @param {Object} [options] - オプション
     * @returns {Promise<boolean>}
     */
    async importFromFile(file, options = {}) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(this.importMemory(data, options));
                } catch (error) {
                    console.error('[AgentMemory] ファイル読み込みエラー:', error);
                    resolve(false);
                }
            };
            reader.onerror = () => {
                console.error('[AgentMemory] ファイル読み込みエラー');
                resolve(false);
            };
            reader.readAsText(file);
        });
    }

    // ========================================
    // メモリ圧縮・最適化
    // ========================================

    /**
     * 古いメモリを圧縮（要約）
     * @param {number} [olderThanDays=30] - 圧縮対象の日数
     * @returns {number} 圧縮されたアイテム数
     */
    compressOldMemories(olderThanDays = 30) {
        const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        let compressedCount = 0;

        // 古いアイテムをグループ化して圧縮
        const oldItems = this.#longTermMemory.filter(m => m.timestamp < cutoffTime);
        const newItems = this.#longTermMemory.filter(m => m.timestamp >= cutoffTime);

        if (oldItems.length > 10) {
            // タイプごとにグループ化
            const grouped = {};
            for (const item of oldItems) {
                if (!grouped[item.type]) {
                    grouped[item.type] = [];
                }
                grouped[item.type].push(item);
            }

            // 各グループを圧縮
            const compressedItems = [];
            for (const [type, items] of Object.entries(grouped)) {
                if (items.length > 5) {
                    // 要約アイテムを作成
                    const summary = {
                        id: this.#generateId(),
                        type: 'context',
                        content: {
                            summary: `${items.length}件の${type}を圧縮`,
                            originalType: type,
                            count: items.length,
                            dateRange: {
                                start: Math.min(...items.map(i => i.timestamp)),
                                end: Math.max(...items.map(i => i.timestamp))
                            }
                        },
                        timestamp: Date.now(),
                        metadata: { compressed: true, originalCount: items.length }
                    };
                    compressedItems.push(summary);
                    compressedCount += items.length;
                } else {
                    compressedItems.push(...items);
                }
            }

            this.#longTermMemory = [...compressedItems, ...newItems];
            this.#saveToStorage();
        }

        if (compressedCount > 0) {
            console.log(`[AgentMemory] ${compressedCount}件のメモリを圧縮`);
        }

        return compressedCount;
    }

    /**
     * メモリ統計を取得
     * @returns {Object}
     */
    getStats() {
        return {
            shortTermCount: this.#shortTermMemory.length,
            longTermCount: this.#longTermMemory.length,
            taskHistoryCount: this.#taskHistory.length,
            shortTermLimit: this.#maxShortTermItems,
            longTermLimit: this.#maxLongTermItems,
            taskHistoryLimit: this.#maxTaskHistory,
            useIndexedDB: this.#useIndexedDB,
            initialized: this.#initialized,
            oldestMemory: this.#longTermMemory.length > 0
                ? new Date(Math.min(...this.#longTermMemory.map(m => m.timestamp)))
                : null,
            newestMemory: this.#longTermMemory.length > 0
                ? new Date(Math.max(...this.#longTermMemory.map(m => m.timestamp)))
                : null
        };
    }

    /**
     * 初期化が完了するまで待機
     * @returns {Promise<void>}
     */
    async waitForInitialization() {
        while (!this.#initialized) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}

// グローバルに公開
window.AgentMemory = AgentMemory;
