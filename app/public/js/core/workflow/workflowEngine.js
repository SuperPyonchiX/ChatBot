/**
 * workflowEngine.js
 * ワークフロー実行エンジン
 * ノード間のデータフローを管理し、順次/並列実行を制御
 */

/**
 * @typedef {Object} WorkflowDefinition
 * @property {string} id - ワークフローID
 * @property {string} name - ワークフロー名
 * @property {string} [description] - 説明
 * @property {Array} nodes - ノード配列
 * @property {Array} connections - 接続配列
 * @property {Object} [metadata] - メタデータ
 */

/**
 * @typedef {Object} ExecutionContext
 * @property {string} workflowId - ワークフローID
 * @property {string} executionId - 実行ID
 * @property {Map} nodeOutputs - ノード出力マップ
 * @property {Map} nodeStates - ノード状態マップ
 * @property {Object} variables - グローバル変数
 * @property {AbortController} abortController - 中断コントローラー
 */

class WorkflowEngine {
    static #instance = null;

    /** @type {NodeRegistry} */
    #nodeRegistry = null;

    /** @type {Map<string, ExecutionContext>} */
    #activeExecutions = new Map();

    /** @type {Object} */
    #eventListeners = {};

    /** @type {number} */
    #nodeTimeout;

    /** @type {number} */
    #maxExecutionTime;

    /**
     * @constructor
     */
    constructor() {
        if (WorkflowEngine.#instance) {
            return WorkflowEngine.#instance;
        }
        WorkflowEngine.#instance = this;

        const config = window.CONFIG?.WORKFLOW?.EXECUTION || {};
        this.#nodeTimeout = config.NODE_TIMEOUT || 60000;
        this.#maxExecutionTime = config.MAX_TIME || 300000;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {WorkflowEngine}
     */
    static get getInstance() {
        if (!WorkflowEngine.#instance) {
            WorkflowEngine.#instance = new WorkflowEngine();
        }
        return WorkflowEngine.#instance;
    }

    /**
     * 初期化
     */
    initialize() {
        this.#nodeRegistry = window.NodeRegistry?.getInstance || new NodeRegistry();
        console.log('[WorkflowEngine] 初期化完了');
    }

    /**
     * ワークフローを実行
     * @param {WorkflowDefinition} workflow - ワークフロー定義
     * @param {Object} [inputVariables={}] - 入力変数
     * @returns {Promise<Object>} 実行結果
     */
    async execute(workflow, inputVariables = {}) {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[WorkflowEngine] ワークフロー実行開始: ${workflow.name} (${executionId})`);

        // 実行コンテキストを作成
        const context = {
            workflowId: workflow.id,
            executionId: executionId,
            nodeOutputs: new Map(),
            nodeStates: new Map(),
            variables: { ...inputVariables },
            abortController: new AbortController(),
            startTime: Date.now()
        };

        this.#activeExecutions.set(executionId, context);

        // 最大実行時間のタイマー
        const timeoutId = setTimeout(() => {
            context.abortController.abort();
            this.#emit('error', {
                executionId,
                error: new Error('ワークフロー実行がタイムアウトしました')
            });
        }, this.#maxExecutionTime);

        try {
            this.#emit('start', { executionId, workflow });

            // ノードマップと接続マップを構築
            const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));
            const connectionMap = this.#buildConnectionMap(workflow.connections);

            // Startノードを見つける
            const startNode = workflow.nodes.find(n => n.type === 'start');
            if (!startNode) {
                throw new Error('Startノードが見つかりません');
            }

            // 実行キューを初期化
            const executionQueue = [startNode.id];
            const executedNodes = new Set();

            // ノード実行ループ
            while (executionQueue.length > 0 && !context.abortController.signal.aborted) {
                const nodeId = executionQueue.shift();

                if (executedNodes.has(nodeId)) {
                    continue;
                }

                const node = nodeMap.get(nodeId);
                if (!node) {
                    console.warn(`[WorkflowEngine] ノードが見つかりません: ${nodeId}`);
                    continue;
                }

                // 依存ノードがすべて実行完了しているか確認
                const inputConnections = connectionMap.incoming.get(nodeId) || [];
                const allInputsReady = inputConnections.every(conn =>
                    context.nodeStates.get(conn.sourceNodeId) === 'completed'
                );

                if (!allInputsReady && inputConnections.length > 0) {
                    // まだ準備ができていない場合はキューの最後に追加
                    executionQueue.push(nodeId);
                    continue;
                }

                // ノードを実行
                try {
                    await this.#executeNode(node, context, connectionMap);
                    executedNodes.add(nodeId);

                    // 次のノードをキューに追加
                    const outgoingConnections = connectionMap.outgoing.get(nodeId) || [];
                    for (const conn of outgoingConnections) {
                        // 条件分岐の場合、アクティブな出力のみ追加
                        if (node.type === 'condition') {
                            const output = context.nodeOutputs.get(nodeId);
                            const portName = conn.sourcePort;
                            if (output && output[portName] !== undefined) {
                                executionQueue.push(conn.targetNodeId);
                            }
                        } else {
                            executionQueue.push(conn.targetNodeId);
                        }
                    }
                } catch (error) {
                    context.nodeStates.set(nodeId, 'error');
                    this.#emit('nodeError', { executionId, nodeId, error });
                    throw error;
                }
            }

            clearTimeout(timeoutId);

            // Endノードの結果を取得
            const endNode = workflow.nodes.find(n => n.type === 'end');
            const finalResult = endNode
                ? context.nodeOutputs.get(endNode.id)?._final
                : null;

            const result = {
                executionId,
                success: true,
                result: finalResult,
                nodeOutputs: Object.fromEntries(context.nodeOutputs),
                duration: Date.now() - context.startTime
            };

            this.#emit('complete', { executionId, result });
            console.log(`[WorkflowEngine] ワークフロー実行完了: ${result.duration}ms`);

            return result;

        } catch (error) {
            clearTimeout(timeoutId);

            const result = {
                executionId,
                success: false,
                error: error.message,
                nodeOutputs: Object.fromEntries(context.nodeOutputs),
                duration: Date.now() - context.startTime
            };

            this.#emit('error', { executionId, error, result });
            console.error('[WorkflowEngine] ワークフロー実行エラー:', error);

            return result;

        } finally {
            this.#activeExecutions.delete(executionId);
        }
    }

    /**
     * ステップ実行（デバッグ用）
     * @param {WorkflowDefinition} workflow
     * @param {Object} [inputVariables={}]
     * @returns {AsyncGenerator}
     */
    async *executeStep(workflow, inputVariables = {}) {
        const executionId = `exec_step_${Date.now()}`;

        const context = {
            workflowId: workflow.id,
            executionId: executionId,
            nodeOutputs: new Map(),
            nodeStates: new Map(),
            variables: { ...inputVariables },
            abortController: new AbortController(),
            startTime: Date.now()
        };

        this.#activeExecutions.set(executionId, context);

        try {
            const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));
            const connectionMap = this.#buildConnectionMap(workflow.connections);

            const startNode = workflow.nodes.find(n => n.type === 'start');
            if (!startNode) {
                throw new Error('Startノードが見つかりません');
            }

            const executionQueue = [startNode.id];
            const executedNodes = new Set();

            while (executionQueue.length > 0 && !context.abortController.signal.aborted) {
                const nodeId = executionQueue.shift();

                if (executedNodes.has(nodeId)) continue;

                const node = nodeMap.get(nodeId);
                if (!node) continue;

                // 依存チェック
                const inputConnections = connectionMap.incoming.get(nodeId) || [];
                const allInputsReady = inputConnections.every(conn =>
                    context.nodeStates.get(conn.sourceNodeId) === 'completed'
                );

                if (!allInputsReady && inputConnections.length > 0) {
                    executionQueue.push(nodeId);
                    continue;
                }

                // ステップ実行前に一時停止
                yield {
                    type: 'beforeExecute',
                    nodeId,
                    node,
                    context: {
                        nodeOutputs: Object.fromEntries(context.nodeOutputs),
                        nodeStates: Object.fromEntries(context.nodeStates)
                    }
                };

                await this.#executeNode(node, context, connectionMap);
                executedNodes.add(nodeId);

                // ステップ実行後
                yield {
                    type: 'afterExecute',
                    nodeId,
                    node,
                    output: context.nodeOutputs.get(nodeId),
                    context: {
                        nodeOutputs: Object.fromEntries(context.nodeOutputs),
                        nodeStates: Object.fromEntries(context.nodeStates)
                    }
                };

                // 次のノードをキューに追加
                const outgoingConnections = connectionMap.outgoing.get(nodeId) || [];
                for (const conn of outgoingConnections) {
                    if (node.type === 'condition') {
                        const output = context.nodeOutputs.get(nodeId);
                        if (output && output[conn.sourcePort] !== undefined) {
                            executionQueue.push(conn.targetNodeId);
                        }
                    } else {
                        executionQueue.push(conn.targetNodeId);
                    }
                }
            }

            yield {
                type: 'complete',
                result: {
                    success: true,
                    nodeOutputs: Object.fromEntries(context.nodeOutputs),
                    duration: Date.now() - context.startTime
                }
            };

        } finally {
            this.#activeExecutions.delete(executionId);
        }
    }

    /**
     * 単一ノードを実行
     * @param {Object} node
     * @param {ExecutionContext} context
     * @param {Object} connectionMap
     */
    async #executeNode(node, context, connectionMap) {
        const nodeType = this.#nodeRegistry.get(node.type);
        if (!nodeType) {
            throw new Error(`未知のノードタイプ: ${node.type}`);
        }

        context.nodeStates.set(node.id, 'running');
        this.#emit('nodeStart', {
            executionId: context.executionId,
            nodeId: node.id,
            nodeType: node.type
        });

        // 入力を収集
        const inputs = {};
        const inputConnections = connectionMap.incoming.get(node.id) || [];

        for (const conn of inputConnections) {
            const sourceOutput = context.nodeOutputs.get(conn.sourceNodeId);
            if (sourceOutput) {
                const value = sourceOutput[conn.sourcePort];
                inputs[conn.targetPort] = value;
            }
        }

        // プロパティをマージ（ノード定義のデフォルト + インスタンスの値）
        const properties = { ...node.properties };

        // タイムアウト付きで実行
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('ノード実行タイムアウト')), this.#nodeTimeout);
        });

        const executePromise = nodeType.execute(inputs, properties, {
            workflowId: context.workflowId,
            executionId: context.executionId,
            nodeId: node.id,
            variables: context.variables,
            signal: context.abortController.signal
        });

        const result = await Promise.race([executePromise, timeoutPromise]);

        context.nodeOutputs.set(node.id, result);
        context.nodeStates.set(node.id, 'completed');

        this.#emit('nodeComplete', {
            executionId: context.executionId,
            nodeId: node.id,
            output: result
        });
    }

    /**
     * 接続マップを構築
     * @param {Array} connections
     * @returns {Object}
     */
    #buildConnectionMap(connections) {
        const incoming = new Map();
        const outgoing = new Map();

        for (const conn of connections) {
            // Incoming
            if (!incoming.has(conn.targetNodeId)) {
                incoming.set(conn.targetNodeId, []);
            }
            incoming.get(conn.targetNodeId).push(conn);

            // Outgoing
            if (!outgoing.has(conn.sourceNodeId)) {
                outgoing.set(conn.sourceNodeId, []);
            }
            outgoing.get(conn.sourceNodeId).push(conn);
        }

        return { incoming, outgoing };
    }

    /**
     * 実行を中断
     * @param {string} executionId
     */
    abort(executionId) {
        const context = this.#activeExecutions.get(executionId);
        if (context) {
            context.abortController.abort();
            this.#emit('abort', { executionId });
            console.log(`[WorkflowEngine] 実行を中断: ${executionId}`);
        }
    }

    /**
     * 全実行を中断
     */
    abortAll() {
        for (const [executionId, context] of this.#activeExecutions) {
            context.abortController.abort();
            this.#emit('abort', { executionId });
        }
        console.log(`[WorkflowEngine] 全実行を中断: ${this.#activeExecutions.size}件`);
    }

    /**
     * アクティブな実行を取得
     * @returns {string[]}
     */
    getActiveExecutions() {
        return Array.from(this.#activeExecutions.keys());
    }

    /**
     * ワークフローを検証
     * @param {WorkflowDefinition} workflow
     * @returns {Object} 検証結果
     */
    validate(workflow) {
        const errors = [];
        const warnings = [];

        // Startノードの確認
        const startNodes = workflow.nodes.filter(n => n.type === 'start');
        if (startNodes.length === 0) {
            errors.push('Startノードがありません');
        } else if (startNodes.length > 1) {
            warnings.push('複数のStartノードがあります');
        }

        // Endノードの確認
        const endNodes = workflow.nodes.filter(n => n.type === 'end');
        if (endNodes.length === 0) {
            warnings.push('Endノードがありません');
        }

        // 接続されていないノードの確認
        const connectedNodeIds = new Set();
        for (const conn of workflow.connections) {
            connectedNodeIds.add(conn.sourceNodeId);
            connectedNodeIds.add(conn.targetNodeId);
        }

        for (const node of workflow.nodes) {
            if (!connectedNodeIds.has(node.id) && node.type !== 'start' && node.type !== 'end') {
                warnings.push(`ノード "${node.id}" は接続されていません`);
            }
        }

        // 循環参照の確認
        if (this.#hasCycle(workflow)) {
            errors.push('循環参照が検出されました');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 循環参照をチェック
     * @param {WorkflowDefinition} workflow
     * @returns {boolean}
     */
    #hasCycle(workflow) {
        const visited = new Set();
        const recursionStack = new Set();
        const adjacencyList = new Map();

        // 隣接リストを構築
        for (const node of workflow.nodes) {
            adjacencyList.set(node.id, []);
        }
        for (const conn of workflow.connections) {
            adjacencyList.get(conn.sourceNodeId)?.push(conn.targetNodeId);
        }

        const dfs = (nodeId) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);

            for (const neighbor of (adjacencyList.get(nodeId) || [])) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) return true;
                } else if (recursionStack.has(neighbor)) {
                    return true;
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const node of workflow.nodes) {
            if (!visited.has(node.id)) {
                if (dfs(node.id)) return true;
            }
        }

        return false;
    }

    // ========================================
    // イベント管理
    // ========================================

    /**
     * イベントリスナーを登録
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this.#eventListeners[event]) {
            this.#eventListeners[event] = [];
        }
        this.#eventListeners[event].push(callback);
    }

    /**
     * イベントリスナーを解除
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        if (this.#eventListeners[event]) {
            this.#eventListeners[event] = this.#eventListeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * イベントを発火
     * @param {string} event
     * @param {Object} data
     */
    #emit(event, data) {
        if (this.#eventListeners[event]) {
            for (const callback of this.#eventListeners[event]) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[WorkflowEngine] イベントハンドラエラー (${event}):`, error);
                }
            }
        }
    }
}

// グローバルに公開
window.WorkflowEngine = WorkflowEngine;
