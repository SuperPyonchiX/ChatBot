/**
 * nodeRegistry.js
 * ワークフローノードタイプの登録・管理
 */

/**
 * @typedef {Object} NodeTypeDefinition
 * @property {string} type - ノードタイプ識別子
 * @property {string} name - 表示名
 * @property {string} category - カテゴリ（control, ai, process, data）
 * @property {string} icon - アイコン（絵文字またはSVG）
 * @property {string} color - ノードカラー
 * @property {Object} inputs - 入力ポート定義
 * @property {Object} outputs - 出力ポート定義
 * @property {Object} properties - 設定可能なプロパティ
 * @property {Function} execute - 実行関数
 */

class NodeRegistry {
    static #instance = null;

    /** @type {Map<string, NodeTypeDefinition>} */
    #nodeTypes = new Map();

    /** @type {Object} */
    #categories = {
        control: { name: 'コントロール', icon: '🎛️', order: 1 },
        ai: { name: 'AI', icon: '🤖', order: 2 },
        process: { name: '処理', icon: '⚙️', order: 3 },
        data: { name: 'データ', icon: '📊', order: 4 }
    };

    /**
     * @constructor
     */
    constructor() {
        if (NodeRegistry.#instance) {
            return NodeRegistry.#instance;
        }
        NodeRegistry.#instance = this;
        this.#registerBuiltInNodes();
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {NodeRegistry}
     */
    static get getInstance() {
        if (!NodeRegistry.#instance) {
            NodeRegistry.#instance = new NodeRegistry();
        }
        return NodeRegistry.#instance;
    }

    /**
     * ビルトインノードを登録
     */
    #registerBuiltInNodes() {
        // Start Node
        this.register({
            type: 'start',
            name: '開始',
            category: 'control',
            icon: '▶️',
            color: '#4CAF50',
            inputs: {},
            outputs: {
                output: { type: 'any', label: '出力' }
            },
            properties: {
                variables: {
                    type: 'object',
                    label: '入力変数',
                    default: {},
                    description: 'ワークフロー開始時の変数'
                }
            },
            execute: async (inputs, properties, context) => {
                return {
                    output: {
                        ...properties.variables,
                        _startTime: Date.now(),
                        _workflowId: context.workflowId
                    }
                };
            }
        });

        // End Node
        this.register({
            type: 'end',
            name: '終了',
            category: 'control',
            icon: '⏹️',
            color: '#f44336',
            inputs: {
                input: { type: 'any', label: '入力' }
            },
            outputs: {},
            properties: {
                outputFormat: {
                    type: 'select',
                    label: '出力形式',
                    options: ['text', 'json', 'markdown'],
                    default: 'text'
                }
            },
            execute: async (inputs, properties) => {
                const result = inputs.input;
                if (properties.outputFormat === 'json') {
                    return { _final: JSON.stringify(result, null, 2) };
                }
                return { _final: result };
            }
        });

        // LLM Node
        this.register({
            type: 'llm',
            name: 'LLM',
            category: 'ai',
            icon: '🧠',
            color: '#2196F3',
            inputs: {
                input: { type: 'string', label: '入力テキスト' },
                context: { type: 'string', label: 'コンテキスト', optional: true }
            },
            outputs: {
                output: { type: 'string', label: '応答' }
            },
            properties: {
                model: {
                    type: 'select',
                    label: 'モデル',
                    options: [], // 動的に設定
                    default: '' // ユーザー選択モデルを使用
                },
                systemPrompt: {
                    type: 'textarea',
                    label: 'システムプロンプト',
                    default: '',
                    placeholder: 'AIの振る舞いを定義...'
                },
                prompt: {
                    type: 'textarea',
                    label: 'プロンプトテンプレート',
                    default: '{{input}}',
                    description: '{{input}}、{{context}}で変数を参照'
                },
                temperature: {
                    type: 'number',
                    label: '温度',
                    min: 0,
                    max: 2,
                    step: 0.1,
                    default: 0.7
                },
                maxTokens: {
                    type: 'number',
                    label: '最大トークン',
                    min: 1,
                    max: 128000,
                    default: 4096
                }
            },
            execute: async (inputs, properties, context) => {
                // 入力を文字列化する関数
                const stringifyInput = (input) => {
                    if (input === null || input === undefined) return '';
                    if (typeof input === 'string') return input;
                    if (typeof input === 'object') {
                        // questionプロパティがあれば優先
                        if (input.question) return input.question;
                        // 最初の文字列プロパティを探す（_で始まるプライベートプロパティは除外）
                        for (const key of Object.keys(input)) {
                            if (typeof input[key] === 'string' && !key.startsWith('_')) {
                                return input[key];
                            }
                        }
                        // それ以外はJSON化
                        return JSON.stringify(input);
                    }
                    return String(input);
                };

                const inputStr = stringifyInput(inputs.input);
                const contextStr = stringifyInput(inputs.context);

                const prompt = properties.prompt
                    .replace(/\{\{input\}\}/g, inputStr)
                    .replace(/\{\{context\}\}/g, contextStr);

                const messages = [];
                if (properties.systemPrompt) {
                    messages.push({ role: 'system', content: properties.systemPrompt });
                }
                messages.push({ role: 'user', content: prompt });

                // モデルが未指定の場合はユーザー選択モデルを使用
                const modelSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('modelSelect'));
                const model = properties.model || modelSelect?.value || '';
                if (!model) {
                    throw new Error('モデルが選択されていません。プロパティパネルまたはチャット画面でモデルを選択してください。');
                }

                // AIAPI経由で呼び出し
                if (window.AIAPI) {
                    const response = await window.AIAPI.getInstance.callAIAPI(
                        messages,
                        model,
                        [],
                        {
                            temperature: properties.temperature,
                            maxTokens: properties.maxTokens
                        }
                    );
                    return { output: response };
                }

                throw new Error('AIAPI が利用できません');
            }
        });

        // Knowledge (RAG) Node
        this.register({
            type: 'knowledge',
            name: 'ナレッジ検索',
            category: 'ai',
            icon: '📚',
            color: '#9C27B0',
            inputs: {
                query: { type: 'string', label: 'クエリ' }
            },
            outputs: {
                results: { type: 'array', label: '検索結果' },
                context: { type: 'string', label: 'コンテキスト' }
            },
            properties: {
                topK: {
                    type: 'number',
                    label: '取得件数',
                    min: 1,
                    max: 20,
                    default: 5
                },
                threshold: {
                    type: 'number',
                    label: '類似度閾値',
                    min: 0,
                    max: 1,
                    step: 0.1,
                    default: 0.5
                }
            },
            execute: async (inputs, properties) => {
                if (window.RAGManager) {
                    const ragManager = window.RAGManager.getInstance;
                    const results = await ragManager.search(inputs.query, {
                        topK: properties.topK,
                        threshold: properties.threshold
                    });

                    const context = results.map(r => r.content).join('\n\n---\n\n');
                    return {
                        results: results,
                        context: context
                    };
                }

                return { results: [], context: '' };
            }
        });

        // Condition Node
        this.register({
            type: 'condition',
            name: '条件分岐',
            category: 'control',
            icon: '🔀',
            color: '#FF9800',
            inputs: {
                input: { type: 'any', label: '入力' }
            },
            outputs: {
                true: { type: 'any', label: 'True' },
                false: { type: 'any', label: 'False' }
            },
            properties: {
                conditionType: {
                    type: 'select',
                    label: '条件タイプ',
                    options: ['contains', 'equals', 'notEquals', 'greaterThan', 'lessThan', 'regex', 'custom'],
                    default: 'contains'
                },
                compareValue: {
                    type: 'text',
                    label: '比較値',
                    default: ''
                },
                customCondition: {
                    type: 'textarea',
                    label: 'カスタム条件（JavaScript）',
                    default: 'return input.length > 0;',
                    description: 'inputで入力値を参照'
                }
            },
            execute: async (inputs, properties) => {
                const input = inputs.input;
                let result = false;

                switch (properties.conditionType) {
                    case 'contains':
                        result = String(input).includes(properties.compareValue);
                        break;
                    case 'equals':
                        result = input === properties.compareValue;
                        break;
                    case 'notEquals':
                        result = input !== properties.compareValue;
                        break;
                    case 'greaterThan':
                        result = Number(input) > Number(properties.compareValue);
                        break;
                    case 'lessThan':
                        result = Number(input) < Number(properties.compareValue);
                        break;
                    case 'regex':
                        result = new RegExp(properties.compareValue).test(String(input));
                        break;
                    case 'custom':
                        try {
                            const fn = new Function('input', properties.customCondition);
                            result = fn(input);
                        } catch (e) {
                            console.error('[Condition] カスタム条件エラー:', e);
                        }
                        break;
                }

                return result
                    ? { true: input, false: undefined }
                    : { true: undefined, false: input };
            }
        });

        // Template Node
        this.register({
            type: 'template',
            name: 'テンプレート',
            category: 'process',
            icon: '📝',
            color: '#607D8B',
            inputs: {
                variables: { type: 'object', label: '変数' }
            },
            outputs: {
                output: { type: 'string', label: '出力' }
            },
            properties: {
                template: {
                    type: 'textarea',
                    label: 'テンプレート',
                    default: '{{variable}}',
                    description: '{{変数名}}で変数を参照'
                }
            },
            execute: async (inputs, properties) => {
                let output = properties.template;
                const vars = inputs.variables || {};

                for (const [key, value] of Object.entries(vars)) {
                    output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
                }

                return { output };
            }
        });

        // Code Node
        this.register({
            type: 'code',
            name: 'コード実行',
            category: 'process',
            icon: '💻',
            color: '#795548',
            inputs: {
                input: { type: 'any', label: '入力' }
            },
            outputs: {
                output: { type: 'any', label: '出力' }
            },
            properties: {
                language: {
                    type: 'select',
                    label: '言語',
                    options: ['javascript', 'python'],
                    default: 'javascript'
                },
                code: {
                    type: 'code',
                    label: 'コード',
                    default: '// inputで入力値を参照\nreturn input;',
                    language: 'javascript'
                }
            },
            execute: async (inputs, properties) => {
                if (properties.language === 'javascript') {
                    try {
                        const fn = new Function('input', properties.code);
                        const result = fn(inputs.input);
                        return { output: result };
                    } catch (e) {
                        throw new Error(`JavaScript実行エラー: ${e.message}`);
                    }
                } else if (properties.language === 'python') {
                    // Pyodide経由で実行
                    if (window.CodeExecutor) {
                        const executor = window.CodeExecutor.getInstance;
                        const result = await executor.execute(properties.code, 'python', {
                            input: inputs.input
                        });
                        return { output: result };
                    }
                    throw new Error('Python実行環境が利用できません');
                }

                throw new Error(`未サポートの言語: ${properties.language}`);
            }
        });

        // HTTP Request Node
        this.register({
            type: 'http',
            name: 'HTTP リクエスト',
            category: 'data',
            icon: '🌐',
            color: '#00BCD4',
            inputs: {
                body: { type: 'any', label: 'ボディ', optional: true }
            },
            outputs: {
                response: { type: 'any', label: 'レスポンス' },
                status: { type: 'number', label: 'ステータス' }
            },
            properties: {
                method: {
                    type: 'select',
                    label: 'メソッド',
                    options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                    default: 'GET'
                },
                url: {
                    type: 'text',
                    label: 'URL',
                    default: '',
                    placeholder: 'https://api.example.com/endpoint'
                },
                headers: {
                    type: 'object',
                    label: 'ヘッダー',
                    default: {}
                },
                timeout: {
                    type: 'number',
                    label: 'タイムアウト（ms）',
                    default: 30000
                }
            },
            execute: async (inputs, properties) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), properties.timeout);

                try {
                    const options = {
                        method: properties.method,
                        headers: {
                            'Content-Type': 'application/json',
                            ...properties.headers
                        },
                        signal: controller.signal
                    };

                    if (['POST', 'PUT', 'PATCH'].includes(properties.method) && inputs.body) {
                        options.body = JSON.stringify(inputs.body);
                    }

                    // CORS対策でプロキシ経由
                    const proxyUrl = `/api/fetch-url?url=${encodeURIComponent(properties.url)}`;
                    const response = await fetch(proxyUrl, options);

                    clearTimeout(timeoutId);

                    let responseData;
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        responseData = await response.json();
                    } else {
                        responseData = await response.text();
                    }

                    return {
                        response: responseData,
                        status: response.status
                    };
                } catch (error) {
                    clearTimeout(timeoutId);
                    throw new Error(`HTTPリクエストエラー: ${error.message}`);
                }
            }
        });

        console.log(`[NodeRegistry] ${this.#nodeTypes.size}個のノードタイプを登録`);
    }

    /**
     * ノードタイプを登録
     * @param {NodeTypeDefinition} definition
     */
    register(definition) {
        if (!definition.type || !definition.name) {
            throw new Error('ノードタイプには type と name が必要です');
        }

        this.#nodeTypes.set(definition.type, {
            ...definition,
            inputs: definition.inputs || {},
            outputs: definition.outputs || {},
            properties: definition.properties || {}
        });
    }

    /**
     * ノードタイプを取得
     * @param {string} type
     * @returns {NodeTypeDefinition|undefined}
     */
    get(type) {
        return this.#nodeTypes.get(type);
    }

    /**
     * 全ノードタイプを取得
     * @returns {NodeTypeDefinition[]}
     */
    getAll() {
        return Array.from(this.#nodeTypes.values());
    }

    /**
     * カテゴリ別にノードタイプを取得
     * @returns {Object}
     */
    getByCategory() {
        const result = {};

        for (const [catId, catInfo] of Object.entries(this.#categories)) {
            result[catId] = {
                ...catInfo,
                nodes: []
            };
        }

        for (const node of this.#nodeTypes.values()) {
            if (result[node.category]) {
                result[node.category].nodes.push(node);
            }
        }

        return result;
    }

    /**
     * カテゴリ情報を取得
     * @returns {Object}
     */
    getCategories() {
        return { ...this.#categories };
    }

    /**
     * ノードタイプが存在するか確認
     * @param {string} type
     * @returns {boolean}
     */
    has(type) {
        return this.#nodeTypes.has(type);
    }

    /**
     * ノードインスタンスを作成
     * @param {string} type
     * @param {string} [id]
     * @param {Object} [position]
     * @returns {Object}
     */
    createNode(type, id = null, position = { x: 0, y: 0 }) {
        const definition = this.get(type);
        if (!definition) {
            throw new Error(`未知のノードタイプ: ${type}`);
        }

        // デフォルトプロパティ値を設定
        const properties = {};
        for (const [key, prop] of Object.entries(definition.properties)) {
            properties[key] = prop.default;
        }

        return {
            id: id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            position: { ...position },
            properties: properties,
            _definition: definition
        };
    }
}

// グローバルに公開
window.NodeRegistry = NodeRegistry;
