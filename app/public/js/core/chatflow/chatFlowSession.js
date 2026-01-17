/**
 * ChatFlowSession - チャットフローのセッション管理
 * @description マルチターン会話のセッション状態を管理するクラス
 */
class ChatFlowSession {
    static #instance = null;

    /** @type {Map<string, Object>} セッションマップ */
    #sessions = new Map();

    /** @type {string} IndexedDB名 */
    #dbName = 'ChatFlowSessions';

    /** @type {number} DBバージョン */
    #dbVersion = 1;

    /** @type {IDBDatabase|null} */
    #db = null;

    constructor() {
        if (ChatFlowSession.#instance) {
            return ChatFlowSession.#instance;
        }
        ChatFlowSession.#instance = this;
    }

    static get getInstance() {
        if (!ChatFlowSession.#instance) {
            ChatFlowSession.#instance = new ChatFlowSession();
        }
        return ChatFlowSession.#instance;
    }

    /**
     * 初期化
     */
    async initialize() {
        try {
            await this.#openDatabase();
            await this.#loadSessions();
            console.log('[ChatFlowSession] 初期化完了');
        } catch (error) {
            console.error('[ChatFlowSession] 初期化エラー:', error);
        }
    }

    /**
     * IndexedDBを開く
     */
    async #openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.#dbName, this.#dbVersion);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.#db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('sessions')) {
                    const store = db.createObjectStore('sessions', { keyPath: 'sessionId' });
                    store.createIndex('chatFlowId', 'chatFlowId', { unique: false });
                    store.createIndex('conversationId', 'conversationId', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }
            };
        });
    }

    /**
     * 保存されたセッションを読み込む
     */
    async #loadSessions() {
        if (!this.#db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.getAll();

            request.onsuccess = () => {
                const sessions = request.result || [];
                sessions.forEach(session => {
                    this.#sessions.set(session.sessionId, session);
                });
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 新しいセッションを作成
     * @param {string} chatFlowId - チャットフローID
     * @param {string} conversationId - 会話ID
     * @param {Object} [initialVariables={}] - 初期変数
     * @returns {Object} セッションオブジェクト
     */
    async createSession(chatFlowId, conversationId, initialVariables = {}) {
        const sessionId = `cf_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const session = {
            sessionId,
            chatFlowId,
            conversationId,
            variables: { ...initialVariables },
            messageHistory: [],
            currentNodeId: null,
            status: 'active', // active, waiting_for_input, completed, error
            createdAt: Date.now(),
            lastUpdated: Date.now()
        };

        this.#sessions.set(sessionId, session);
        await this.#saveSession(session);

        console.log(`[ChatFlowSession] セッション作成: ${sessionId}`);
        return session;
    }

    /**
     * セッションを取得
     * @param {string} sessionId
     * @returns {Object|null}
     */
    getSession(sessionId) {
        return this.#sessions.get(sessionId) || null;
    }

    /**
     * 会話IDでセッションを取得
     * @param {string} conversationId
     * @returns {Object|null}
     */
    getSessionByConversationId(conversationId) {
        for (const session of this.#sessions.values()) {
            if (session.conversationId === conversationId && session.status !== 'completed') {
                return session;
            }
        }
        return null;
    }

    /**
     * セッション変数を更新
     * @param {string} sessionId
     * @param {string} key
     * @param {*} value
     */
    async setVariable(sessionId, key, value) {
        const session = this.#sessions.get(sessionId);
        if (!session) {
            console.warn(`[ChatFlowSession] セッション未存在: ${sessionId}`);
            return;
        }

        session.variables[key] = value;
        session.lastUpdated = Date.now();
        await this.#saveSession(session);
    }

    /**
     * セッション変数を取得
     * @param {string} sessionId
     * @param {string} key
     * @returns {*}
     */
    getVariable(sessionId, key) {
        const session = this.#sessions.get(sessionId);
        return session?.variables[key];
    }

    /**
     * メッセージ履歴に追加
     * @param {string} sessionId
     * @param {Object} message - { role: 'user'|'assistant', content: string }
     */
    async addMessage(sessionId, message) {
        const session = this.#sessions.get(sessionId);
        if (!session) return;

        session.messageHistory.push({
            ...message,
            timestamp: Date.now()
        });
        session.lastUpdated = Date.now();
        await this.#saveSession(session);
    }

    /**
     * 現在のノードIDを更新
     * @param {string} sessionId
     * @param {string} nodeId
     */
    async setCurrentNode(sessionId, nodeId) {
        const session = this.#sessions.get(sessionId);
        if (!session) return;

        session.currentNodeId = nodeId;
        session.lastUpdated = Date.now();
        await this.#saveSession(session);
    }

    /**
     * セッション状態を更新
     * @param {string} sessionId
     * @param {'active'|'waiting_for_input'|'completed'|'error'} status
     */
    async setStatus(sessionId, status) {
        const session = this.#sessions.get(sessionId);
        if (!session) return;

        session.status = status;
        session.lastUpdated = Date.now();
        await this.#saveSession(session);
    }

    /**
     * セッションを保存
     * @param {Object} session
     */
    async #saveSession(session) {
        if (!this.#db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.put(session);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * セッションを削除
     * @param {string} sessionId
     */
    async deleteSession(sessionId) {
        this.#sessions.delete(sessionId);

        if (!this.#db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.delete(sessionId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 全セッションを取得
     * @returns {Object[]}
     */
    getAllSessions() {
        return Array.from(this.#sessions.values());
    }

    /**
     * アクティブなセッション数を取得
     * @returns {number}
     */
    getActiveSessionCount() {
        let count = 0;
        for (const session of this.#sessions.values()) {
            if (session.status === 'active' || session.status === 'waiting_for_input') {
                count++;
            }
        }
        return count;
    }
}

// グローバルに公開
window.ChatFlowSession = ChatFlowSession;
