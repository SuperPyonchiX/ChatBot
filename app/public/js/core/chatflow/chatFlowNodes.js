/**
 * ChatFlowNodes - チャットフローのノードタイプ定義
 * @description 会話フロー用のノードタイプを定義・管理するクラス
 */
class ChatFlowNodes {
    static #instance = null;

    /** @type {Map<string, Object>} ノードタイプ定義 */
    #nodeTypes = new Map();

    constructor() {
        if (ChatFlowNodes.#instance) {
            return ChatFlowNodes.#instance;
        }
        ChatFlowNodes.#instance = this;
        this.#registerBuiltInNodes();
    }

    static get getInstance() {
        if (!ChatFlowNodes.#instance) {
            ChatFlowNodes.#instance = new ChatFlowNodes();
        }
        return ChatFlowNodes.#instance;
    }

    /**
     * ビルトインノードを登録
     */
    #registerBuiltInNodes() {
        // 開始ノード
        this.registerNode('start', {
            name: '開始',
            category: 'control',
            icon: '▶️',
            color: '#4caf50',
            inputs: [],
            outputs: [{ id: 'next', name: '次へ' }],
            properties: [
                { name: 'welcomeMessage', label: 'ウェルカムメッセージ', type: 'textarea', default: '' },
                { name: 'variables', label: '初期変数 (JSON)', type: 'textarea', default: '{}' }
            ],
            execute: async (node, context) => {
                const { session, engine } = context;

                // 初期変数を設定
                if (node.properties.variables) {
                    try {
                        const vars = JSON.parse(node.properties.variables);
                        for (const [key, value] of Object.entries(vars)) {
                            await session.setVariable(session.sessionId, key, value);
                        }
                    } catch (e) {
                        console.warn('[ChatFlowNodes] 初期変数のパースエラー:', e);
                    }
                }

                // ウェルカムメッセージを送信
                if (node.properties.welcomeMessage) {
                    engine.emit('output', {
                        type: 'message',
                        content: node.properties.welcomeMessage
                    });
                }

                return { output: 'next' };
            }
        });

        // 終了ノード
        this.registerNode('end', {
            name: '終了',
            category: 'control',
            icon: '⏹️',
            color: '#f44336',
            inputs: [{ id: 'input', name: '入力' }],
            outputs: [],
            properties: [
                { name: 'message', label: '終了メッセージ', type: 'textarea', default: '' }
            ],
            execute: async (node, context) => {
                const { session, engine } = context;

                if (node.properties.message) {
                    engine.emit('output', {
                        type: 'message',
                        content: node.properties.message
                    });
                }

                await ChatFlowSession.getInstance.setStatus(session.sessionId, 'completed');
                return { completed: true };
            }
        });

        // LLMノード
        this.registerNode('llm', {
            name: 'LLM',
            category: 'ai',
            icon: '🤖',
            color: '#2196f3',
            inputs: [{ id: 'input', name: '入力' }],
            outputs: [{ id: 'output', name: '出力' }],
            properties: [
                { name: 'model', label: 'モデル', type: 'model-select', default: '' },
                { name: 'systemPrompt', label: 'システムプロンプト', type: 'textarea', default: '' },
                { name: 'prompt', label: 'プロンプト', type: 'textarea', default: '{{input}}' },
                { name: 'temperature', label: '温度', type: 'number', default: 0.7, min: 0, max: 2 },
                { name: 'includeHistory', label: '会話履歴を含める', type: 'checkbox', default: true }
            ],
            execute: async (node, context) => {
                const { input, session, engine } = context;

                // 変数を展開
                let prompt = node.properties.prompt || '{{input}}';
                prompt = engine.interpolateVariables(prompt, session, input);

                // メッセージを構築
                const messages = [];

                // システムプロンプト
                if (node.properties.systemPrompt) {
                    messages.push({
                        role: 'system',
                        content: engine.interpolateVariables(node.properties.systemPrompt, session, input)
                    });
                }

                // 会話履歴
                if (node.properties.includeHistory) {
                    const history = session.messageHistory || [];
                    messages.push(...history);
                }

                // ユーザープロンプト
                messages.push({ role: 'user', content: prompt });

                // モデル選択
                const model = node.properties.model || document.getElementById('modelSelect')?.value || window.CONFIG.MODELS.DEFAULT;

                // API呼び出し
                if (typeof AIAPI !== 'undefined') {
                    const response = await AIAPI.getInstance.callAIAPI(messages, model, [], {
                        temperature: node.properties.temperature || 0.7
                    });

                    // 出力
                    engine.emit('output', {
                        type: 'message',
                        content: response
                    });

                    return { output: 'output', result: response };
                }

                throw new Error('AIAPI が利用できません');
            }
        });

        // 回答ノード（ユーザーへの出力）
        this.registerNode('answer', {
            name: '回答',
            category: 'output',
            icon: '💬',
            color: '#9c27b0',
            inputs: [{ id: 'input', name: '入力' }],
            outputs: [{ id: 'next', name: '次へ' }],
            properties: [
                { name: 'message', label: 'メッセージ', type: 'textarea', default: '{{input}}' }
            ],
            execute: async (node, context) => {
                const { input, session, engine } = context;

                let message = node.properties.message || '{{input}}';
                message = engine.interpolateVariables(message, session, input);

                engine.emit('output', {
                    type: 'message',
                    content: message
                });

                return { output: 'next', result: message };
            }
        });

        // 質問ノード（ユーザー入力待ち）
        this.registerNode('question', {
            name: '質問',
            category: 'input',
            icon: '❓',
            color: '#ff9800',
            inputs: [{ id: 'input', name: '入力' }],
            outputs: [{ id: 'response', name: '回答' }],
            properties: [
                { name: 'question', label: '質問文', type: 'textarea', default: '' },
                { name: 'variableName', label: '保存先変数名', type: 'text', default: 'userResponse' },
                { name: 'options', label: '選択肢 (改行区切り)', type: 'textarea', default: '' }
            ],
            execute: async (node, context) => {
                const { session, engine } = context;

                // 質問を出力
                if (node.properties.question) {
                    engine.emit('output', {
                        type: 'question',
                        content: node.properties.question,
                        options: node.properties.options ? node.properties.options.split('\n').filter(o => o.trim()) : []
                    });
                }

                // 入力待ち状態に遷移
                await ChatFlowSession.getInstance.setStatus(session.sessionId, 'waiting_for_input');
                await ChatFlowSession.getInstance.setCurrentNode(session.sessionId, node.id);

                return { waitForInput: true, variableName: node.properties.variableName };
            }
        });

        // 条件分岐ノード
        this.registerNode('condition', {
            name: '条件',
            category: 'control',
            icon: '🔀',
            color: '#795548',
            inputs: [{ id: 'input', name: '入力' }],
            outputs: [
                { id: 'true', name: 'True' },
                { id: 'false', name: 'False' }
            ],
            properties: [
                { name: 'condition', label: '条件式', type: 'text', default: '{{input}} === "yes"' }
            ],
            execute: async (node, context) => {
                const { input, session, engine } = context;

                let condition = node.properties.condition || 'true';
                condition = engine.interpolateVariables(condition, session, input);

                try {
                    // 安全な評価（基本的な比較のみ）
                    const result = engine.evaluateCondition(condition, session, input);
                    return { output: result ? 'true' : 'false' };
                } catch (error) {
                    console.error('[ChatFlowNodes] 条件評価エラー:', error);
                    return { output: 'false' };
                }
            }
        });

        // コードノード
        this.registerNode('code', {
            name: 'コード',
            category: 'process',
            icon: '📝',
            color: '#607d8b',
            inputs: [{ id: 'input', name: '入力' }],
            outputs: [{ id: 'output', name: '出力' }],
            properties: [
                { name: 'code', label: 'JavaScriptコード', type: 'code', default: 'return input;' }
            ],
            execute: async (node, context) => {
                const { input, session, engine } = context;

                try {
                    const code = node.properties.code || 'return input;';
                    const fn = new Function('input', 'variables', 'history', code);
                    const result = fn(input, session.variables, session.messageHistory);

                    return { output: 'output', result };
                } catch (error) {
                    console.error('[ChatFlowNodes] コード実行エラー:', error);
                    throw error;
                }
            }
        });

        // テンプレートノード
        this.registerNode('template', {
            name: 'テンプレート',
            category: 'process',
            icon: '📄',
            color: '#00bcd4',
            inputs: [{ id: 'input', name: '入力' }],
            outputs: [{ id: 'output', name: '出力' }],
            properties: [
                { name: 'template', label: 'テンプレート', type: 'textarea', default: '' }
            ],
            execute: async (node, context) => {
                const { input, session, engine } = context;

                let template = node.properties.template || '';
                const result = engine.interpolateVariables(template, session, input);

                return { output: 'output', result };
            }
        });
    }

    /**
     * ノードタイプを登録
     * @param {string} type
     * @param {Object} definition
     */
    registerNode(type, definition) {
        this.#nodeTypes.set(type, {
            type,
            ...definition
        });
    }

    /**
     * ノードタイプを取得
     * @param {string} type
     * @returns {Object|null}
     */
    getNodeType(type) {
        return this.#nodeTypes.get(type) || null;
    }

    /**
     * 全ノードタイプを取得
     * @returns {Object[]}
     */
    getAllNodeTypes() {
        return Array.from(this.#nodeTypes.values());
    }

    /**
     * カテゴリ別にノードタイプを取得
     * @returns {Object}
     */
    getNodeTypesByCategory() {
        const categories = {};

        for (const nodeType of this.#nodeTypes.values()) {
            const category = nodeType.category || 'other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(nodeType);
        }

        return categories;
    }

    /**
     * ノードを実行
     * @param {Object} node
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async executeNode(node, context) {
        const nodeType = this.#nodeTypes.get(node.type);
        if (!nodeType) {
            throw new Error(`Unknown node type: ${node.type}`);
        }

        if (!nodeType.execute) {
            throw new Error(`Node type ${node.type} has no execute function`);
        }

        return await nodeType.execute(node, context);
    }
}

// グローバルに公開
window.ChatFlowNodes = ChatFlowNodes;
