/**
 * ChatFlowEngine - チャットフローの実行エンジン
 * @description マルチターン会話フローを実行するエンジン
 */
class ChatFlowEngine {
    static #instance = null;

    /** @type {Map<string, Object>} チャットフロー定義 */
    #chatFlows = new Map();

    /** @type {Map<string, Function[]>} イベントリスナー */
    #eventListeners = new Map();

    constructor() {
        if (ChatFlowEngine.#instance) {
            return ChatFlowEngine.#instance;
        }
        ChatFlowEngine.#instance = this;
    }

    static get getInstance() {
        if (!ChatFlowEngine.#instance) {
            ChatFlowEngine.#instance = new ChatFlowEngine();
        }
        return ChatFlowEngine.#instance;
    }

    /**
     * 初期化
     */
    async initialize() {
        await ChatFlowSession.getInstance.initialize();
        await this.#loadChatFlows();
        console.log('[ChatFlowEngine] 初期化完了');
    }

    /**
     * 保存されたチャットフローを読み込む
     */
    async #loadChatFlows() {
        try {
            const stored = Storage.getInstance.get('CHAT_FLOWS');
            if (stored) {
                const flows = JSON.parse(stored);
                flows.forEach(flow => {
                    this.#chatFlows.set(flow.id, flow);
                });
            }
        } catch (error) {
            console.error('[ChatFlowEngine] チャットフロー読み込みエラー:', error);
        }
    }

    /**
     * チャットフローを保存
     */
    async #saveChatFlows() {
        const flows = Array.from(this.#chatFlows.values());
        Storage.getInstance.set('CHAT_FLOWS', JSON.stringify(flows));
    }

    /**
     * チャットフローを登録
     * @param {Object} chatFlow
     */
    async registerChatFlow(chatFlow) {
        if (!chatFlow.id) {
            chatFlow.id = `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        chatFlow.createdAt = chatFlow.createdAt || Date.now();
        chatFlow.updatedAt = Date.now();

        this.#chatFlows.set(chatFlow.id, chatFlow);
        await this.#saveChatFlows();

        console.log(`[ChatFlowEngine] チャットフロー登録: ${chatFlow.name}`);
        return chatFlow;
    }

    /**
     * チャットフローを取得
     * @param {string} flowId
     * @returns {Object|null}
     */
    getChatFlow(flowId) {
        return this.#chatFlows.get(flowId) || null;
    }

    /**
     * 全チャットフローを取得
     * @returns {Object[]}
     */
    getAllChatFlows() {
        return Array.from(this.#chatFlows.values());
    }

    /**
     * チャットフローを削除
     * @param {string} flowId
     */
    async deleteChatFlow(flowId) {
        this.#chatFlows.delete(flowId);
        await this.#saveChatFlows();
    }

    /**
     * チャットフローを開始
     * @param {string} flowId - チャットフローID
     * @param {string} conversationId - 会話ID
     * @param {Object} [options={}] - オプション
     * @returns {Promise<Object>} セッション
     */
    async startFlow(flowId, conversationId, options = {}) {
        const chatFlow = this.#chatFlows.get(flowId);
        if (!chatFlow) {
            throw new Error(`チャットフローが見つかりません: ${flowId}`);
        }

        // セッションを作成
        const session = await ChatFlowSession.getInstance.createSession(
            flowId,
            conversationId,
            options.initialVariables || {}
        );

        // 開始ノードを見つける
        const startNode = chatFlow.nodes.find(n => n.type === 'start');
        if (!startNode) {
            throw new Error('開始ノードが見つかりません');
        }

        // フローを実行開始
        await this.#executeFromNode(chatFlow, startNode, session, null);

        return session;
    }

    /**
     * ユーザー入力を処理（継続実行）
     * @param {string} sessionId - セッションID
     * @param {string} userInput - ユーザー入力
     * @returns {Promise<Object>}
     */
    async processUserInput(sessionId, userInput) {
        const session = ChatFlowSession.getInstance.getSession(sessionId);
        if (!session) {
            throw new Error(`セッションが見つかりません: ${sessionId}`);
        }

        if (session.status !== 'waiting_for_input') {
            throw new Error('セッションは入力待ち状態ではありません');
        }

        const chatFlow = this.#chatFlows.get(session.chatFlowId);
        if (!chatFlow) {
            throw new Error('チャットフローが見つかりません');
        }

        // 現在のノードを取得
        const currentNode = chatFlow.nodes.find(n => n.id === session.currentNodeId);
        if (!currentNode) {
            throw new Error('現在のノードが見つかりません');
        }

        // ユーザー入力をメッセージ履歴に追加
        await ChatFlowSession.getInstance.addMessage(sessionId, {
            role: 'user',
            content: userInput
        });

        // Questionノードの場合、変数に保存
        if (currentNode.type === 'question') {
            const varName = currentNode.properties?.variableName || 'userResponse';
            await ChatFlowSession.getInstance.setVariable(sessionId, varName, userInput);
        }

        // セッション状態を更新
        await ChatFlowSession.getInstance.setStatus(sessionId, 'active');

        // 次のノードへ進む
        const connection = chatFlow.connections.find(c =>
            c.sourceNodeId === currentNode.id &&
            (c.sourcePortId === 'response' || c.sourcePortId === 'next' || c.sourcePortId === 'output')
        );

        if (connection) {
            const nextNode = chatFlow.nodes.find(n => n.id === connection.targetNodeId);
            if (nextNode) {
                // セッションを再取得（更新後）
                const updatedSession = ChatFlowSession.getInstance.getSession(sessionId);
                await this.#executeFromNode(chatFlow, nextNode, updatedSession, userInput);
            }
        }

        return ChatFlowSession.getInstance.getSession(sessionId);
    }

    /**
     * 指定ノードからフローを実行
     * @param {Object} chatFlow
     * @param {Object} startNode
     * @param {Object} session
     * @param {*} input
     */
    async #executeFromNode(chatFlow, startNode, session, input) {
        let currentNode = startNode;
        let currentInput = input;

        while (currentNode) {
            this.emit('nodeStart', { node: currentNode, session });

            try {
                // ノードを実行
                const result = await ChatFlowNodes.getInstance.executeNode(currentNode, {
                    input: currentInput,
                    session: ChatFlowSession.getInstance.getSession(session.sessionId),
                    engine: this
                });

                this.emit('nodeComplete', { node: currentNode, result, session });

                // 入力待ち状態になった場合は中断
                if (result.waitForInput) {
                    return;
                }

                // 完了した場合は終了
                if (result.completed) {
                    this.emit('flowComplete', { session });
                    return;
                }

                // 次のノードを取得
                const outputPort = result.output;
                const connection = chatFlow.connections.find(c =>
                    c.sourceNodeId === currentNode.id &&
                    (c.sourcePortId === outputPort || (!c.sourcePortId && outputPort === 'output'))
                );

                if (connection) {
                    currentNode = chatFlow.nodes.find(n => n.id === connection.targetNodeId);
                    currentInput = result.result !== undefined ? result.result : currentInput;
                } else {
                    // 接続がない場合は終了
                    currentNode = null;
                }

            } catch (error) {
                console.error('[ChatFlowEngine] ノード実行エラー:', error);
                await ChatFlowSession.getInstance.setStatus(session.sessionId, 'error');
                this.emit('error', { node: currentNode, error, session });
                throw error;
            }
        }
    }

    /**
     * 変数を展開
     * @param {string} template
     * @param {Object} session
     * @param {*} input
     * @returns {string}
     */
    interpolateVariables(template, session, input) {
        if (!template) return '';

        let result = template;

        // {{input}} を置換
        result = result.replace(/\{\{input\}\}/g, String(input || ''));

        // {{変数名}} を置換
        const variables = session.variables || {};
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, String(value || ''));
        }

        // {{history}} を置換（会話履歴）
        if (result.includes('{{history}}')) {
            const historyText = (session.messageHistory || [])
                .map(m => `${m.role}: ${m.content}`)
                .join('\n');
            result = result.replace(/\{\{history\}\}/g, historyText);
        }

        return result;
    }

    /**
     * 条件を評価
     * @param {string} condition
     * @param {Object} session
     * @param {*} input
     * @returns {boolean}
     */
    evaluateCondition(condition, session, input) {
        // 変数を展開
        let expr = this.interpolateVariables(condition, session, input);

        // 安全な評価のための正規化
        expr = expr.trim();

        // 基本的な比較演算
        const comparisons = [
            { op: '===', fn: (a, b) => a === b },
            { op: '!==', fn: (a, b) => a !== b },
            { op: '==', fn: (a, b) => a == b },
            { op: '!=', fn: (a, b) => a != b },
            { op: '>=', fn: (a, b) => parseFloat(a) >= parseFloat(b) },
            { op: '<=', fn: (a, b) => parseFloat(a) <= parseFloat(b) },
            { op: '>', fn: (a, b) => parseFloat(a) > parseFloat(b) },
            { op: '<', fn: (a, b) => parseFloat(a) < parseFloat(b) }
        ];

        for (const { op, fn } of comparisons) {
            const parts = expr.split(op);
            if (parts.length === 2) {
                const left = parts[0].trim().replace(/^["']|["']$/g, '');
                const right = parts[1].trim().replace(/^["']|["']$/g, '');
                return fn(left, right);
            }
        }

        // includes チェック
        if (expr.includes('.includes(')) {
            const match = expr.match(/(.+)\.includes\(["'](.+)["']\)/);
            if (match) {
                return String(match[1]).includes(match[2]);
            }
        }

        // true/false リテラル
        if (expr === 'true') return true;
        if (expr === 'false') return false;

        // 数値として評価
        const num = parseFloat(expr);
        if (!isNaN(num)) return num !== 0;

        // 文字列として評価（空でなければtrue）
        return expr.length > 0;
    }

    /**
     * イベントリスナーを登録
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this.#eventListeners.has(event)) {
            this.#eventListeners.set(event, []);
        }
        this.#eventListeners.get(event).push(callback);
    }

    /**
     * イベントリスナーを解除
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        const listeners = this.#eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * イベントを発火
     * @param {string} event
     * @param {Object} data
     */
    emit(event, data) {
        const listeners = this.#eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[ChatFlowEngine] イベントリスナーエラー (${event}):`, error);
                }
            });
        }
    }

    /**
     * 会話IDでアクティブなセッションがあるか確認
     * @param {string} conversationId
     * @returns {boolean}
     */
    hasActiveSession(conversationId) {
        const session = ChatFlowSession.getInstance.getSessionByConversationId(conversationId);
        return session !== null;
    }

    /**
     * 会話IDでセッションを取得
     * @param {string} conversationId
     * @returns {Object|null}
     */
    getSessionByConversationId(conversationId) {
        return ChatFlowSession.getInstance.getSessionByConversationId(conversationId);
    }
}

// グローバルに公開
window.ChatFlowEngine = ChatFlowEngine;
