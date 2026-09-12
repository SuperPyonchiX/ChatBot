/**
 * toolManager.js
 * ツール機能の統合マネージャー
 * ツールの登録（生成系 / 情報取得・実行系 / カスタム）、有効・無効の管理、
 * プロバイダ対応、実行制御を一元管理する。モデルはここに登録されたツールを自分で選んで呼ぶ
 */
class ToolManager {
    static #instance = null;

    // 初期化済みフラグ
    #initialized = false;

    /** @type {Promise<void>|null} */
    #initPromise = null;

    /** @type {Set<string>} 有効なツール名 */
    #enabledTools = new Set();

    /** @type {Set<string>} カスタムツール名 */
    #customToolNames = new Set();

    /** @type {number} 1 回の送信でツール呼び出しを回す最大往復数 */
    #maxRounds = 8;

    constructor() {
        if (ToolManager.#instance) {
            return ToolManager.#instance;
        }
        ToolManager.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ToolManager.#instance) {
            ToolManager.#instance = new ToolManager();
        }
        return ToolManager.#instance;
    }

    /**
     * ツールマネージャーを初期化
     * 組み込みツールを登録
     */
    async initialize() {
        if (this.#initialized) {
            return;
        }
        if (this.#initPromise) {
            return this.#initPromise;
        }
        this.#initPromise = (async () => {
            await this.#registerBuiltInTools();
            this.#registerAgentTools();
            await this.#registerCustomTools();
            this.#loadSettings();
            this.#initialized = true;
            console.log(`[ToolManager] 初期化完了: ${ToolRegistry.getInstance.getNames().length} 個登録 / ${this.#enabledTools.size} 個有効`);
        })();
        window.addEventListener('customToolSaved', () => this.reloadCustomTools());
        window.addEventListener('customToolDeleted', () => this.reloadCustomTools());
        return this.#initPromise;
    }

    /**
     * 初期化が終わるまで待つ
     * @returns {Promise<void>}
     */
    async waitForInitialization() {
        if (this.#initialized) return;
        await this.initialize();
    }

    /**
     * 情報取得・実行系のビルトインツール（js/core/tools/builtin/）を登録
     * 各ツールは { name, description, parameters, execute(params, context) } を持つシングルトン
     */
    #registerAgentTools() {
        const registry = ToolRegistry.getInstance;
        const classes = [
            'WebSearchTool', 'UrlFetchTool', 'CalculatorTool',
            'JiraSearchTool', 'JiraGetIssueTool', 'ConfluenceSearchTool', 'ConfluenceGetPageTool',
            'CodeExecuteTool', 'CodexTaskTool', 'FileWriteTool', 'ShellExecuteTool'
        ];
        for (const className of classes) {
            const cls = window[className];
            if (!cls?.getInstance) continue;
            const tool = cls.getInstance;
            registry.register({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
                executor: { execute: (params, context) => tool.execute(params, context) }
            });
        }
    }

    /**
     * カスタムツール（CustomToolStorage）を登録
     */
    async #registerCustomTools() {
        if (typeof CustomToolStorage === 'undefined' || typeof CustomToolExecutor === 'undefined') return;
        if (window.CONFIG?.TOOLS?.CUSTOM?.ENABLED === false) return;
        const registry = ToolRegistry.getInstance;
        for (const name of this.#customToolNames) {
            registry.unregister(name);
        }
        this.#customToolNames.clear();
        try {
            await CustomToolStorage.getInstance.initialize();
            const tools = await CustomToolStorage.getInstance.getAll({ enabledOnly: true });
            for (const def of tools) {
                if (!def?.name || registry.has(def.name)) continue;
                registry.register({
                    name: def.name,
                    description: def.description,
                    parameters: def.parameters,
                    executor: { execute: (params) => CustomToolExecutor.getInstance.execute(def, params) }
                });
                this.#customToolNames.add(def.name);
            }
        } catch (error) {
            console.warn('[ToolManager] カスタムツール読み込みエラー:', error);
        }
    }

    /**
     * カスタムツールを読み直す（保存・削除後）
     * @returns {Promise<void>}
     */
    async reloadCustomTools() {
        await this.#registerCustomTools();
        for (const name of this.#customToolNames) {
            if (!this.#enabledTools.has(name) && !this.#isDisabledByUser(name)) {
                this.#enabledTools.add(name);
            }
        }
    }

    /**
     * localStorage の設定を読み込み、有効ツール集合を組み立てる
     */
    #loadSettings() {
        const config = window.CONFIG?.TOOLS || {};
        const defaultDisabled = new Set(config.DEFAULT_DISABLED || []);
        const all = ToolRegistry.getInstance.getNames();
        const stored = this.#readStoredSettings();

        if (Array.isArray(stored.disabledTools)) {
            const disabled = new Set(stored.disabledTools);
            this.#enabledTools = new Set(all.filter(n => !disabled.has(n)));
        } else {
            this.#enabledTools = new Set(all.filter(n => !defaultDisabled.has(n)));
        }
        this.#maxRounds = Number(stored.maxRounds) || config.MAX_ROUNDS || 8;
    }

    /**
     * @param {string} name
     * @returns {boolean}
     */
    #isDisabledByUser(name) {
        const stored = this.#readStoredSettings();
        return Array.isArray(stored.disabledTools) && stored.disabledTools.includes(name);
    }

    /**
     * @returns {{disabledTools?: string[], maxRounds?: number}}
     */
    #readStoredSettings() {
        try {
            const key = window.CONFIG?.STORAGE?.KEYS?.TOOL_SETTINGS || 'tool_settings';
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    /**
     * 設定を保存する
     * @param {Object} settings
     * @param {string[]} [settings.enabledTools] - 有効にするツール名
     * @param {number} [settings.maxRounds]
     */
    saveSettings(settings = {}) {
        if (Array.isArray(settings.enabledTools)) {
            this.#enabledTools = new Set(settings.enabledTools);
        }
        if (settings.maxRounds) {
            this.#maxRounds = Math.max(1, Math.min(Number(settings.maxRounds), 30));
        }
        const all = ToolRegistry.getInstance.getNames();
        const disabledTools = all.filter(n => !this.#enabledTools.has(n));
        const key = window.CONFIG?.STORAGE?.KEYS?.TOOL_SETTINGS || 'tool_settings';
        localStorage.setItem(key, JSON.stringify({ disabledTools, maxRounds: this.#maxRounds }));
        console.log(`[ToolManager] 設定を保存: 有効 ${this.#enabledTools.size} / ${all.length}`);
    }

    /**
     * 登録済みツールの一覧（設定 UI 用）
     * @returns {Array<{name: string, description: string, enabled: boolean, isCustom: boolean, category: string}>}
     */
    getAllTools() {
        const categories = window.CONFIG?.TOOLS?.CATEGORIES || {};
        return ToolRegistry.getInstance.getAll().map(t => ({
            name: t.name,
            description: t.description,
            enabled: this.#enabledTools.has(t.name),
            isCustom: this.#customToolNames.has(t.name),
            category: this.#customToolNames.has(t.name) ? 'custom' : (categories[t.name] || 'other')
        }));
    }

    /**
     * @param {string} name
     * @returns {boolean}
     */
    isToolEnabled(name) {
        return this.#enabledTools.has(name);
    }

    /**
     * ツール呼び出しループの最大往復数
     * @returns {number}
     */
    getMaxRounds() {
        return this.#maxRounds;
    }

    /**
     * 生成系の組み込みツール（PowerPoint / Excel / Canvas）を登録
     */
    async #registerBuiltInTools() {
        const registry = ToolRegistry.getInstance;

        // PowerPointGenerator
        if (typeof PowerPointGenerator !== 'undefined') {
            registry.register({
                name: 'generate_powerpoint',
                description: 'PowerPointプレゼンテーションを生成します。スライドのタイトル、内容、レイアウトを指定してPPTXファイルを作成します。',
                parameters: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'プレゼンテーションのタイトル'
                        },
                        slides: {
                            type: 'array',
                            description: 'スライドの配列',
                            items: {
                                type: 'object',
                                properties: {
                                    title: {
                                        type: 'string',
                                        description: 'スライドのタイトル'
                                    },
                                    content: {
                                        type: 'string',
                                        description: 'スライドの本文内容。改行で区切ると箇条書きになります'
                                    },
                                    bullets: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description: '箇条書きの配列（contentの代わりに使用可能）'
                                    },
                                    layout: {
                                        type: 'string',
                                        enum: ['title', 'content', 'two_column', 'blank'],
                                        description: 'スライドのレイアウト種類'
                                    }
                                },
                                required: ['title']
                            }
                        },
                        theme: {
                            type: 'string',
                            enum: ['default', 'dark', 'corporate', 'minimal'],
                            description: 'プレゼンテーションのテーマ'
                        }
                    },
                    required: ['title', 'slides']
                },
                executor: PowerPointGenerator.getInstance
            });
        }

        // ExcelProcessor
        if (typeof ExcelProcessor !== 'undefined') {
            registry.register({
                name: 'process_excel',
                description: 'Excelファイルを作成または分析します。データからワークブックを生成したり、既存データの統計分析を行います。',
                parameters: {
                    type: 'object',
                    properties: {
                        operation: {
                            type: 'string',
                            enum: ['create', 'analyze'],
                            description: '操作種類: create（ファイル作成）, analyze（データ分析）'
                        },
                        data: {
                            type: 'object',
                            description: '処理するデータ',
                            properties: {
                                sheets: {
                                    type: 'array',
                                    description: 'シートの配列（複数シート対応）',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', description: 'シート名' },
                                            data: {
                                                type: 'array',
                                                description: '2次元配列のデータ（行ごとの配列）',
                                                items: {
                                                    type: 'array',
                                                    items: { type: 'string' },
                                                    description: '行データ（セル値の配列）'
                                                }
                                            },
                                            headerStyle: { type: 'boolean', description: '1行目をヘッダーとしてスタイル適用' }
                                        }
                                    }
                                },
                                rows: {
                                    type: 'array',
                                    description: '単一シート用の2次元配列データ',
                                    items: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description: '行データ（セル値の配列）'
                                    }
                                }
                            }
                        },
                        filename: {
                            type: 'string',
                            description: '出力ファイル名（.xlsx拡張子は自動付与）'
                        }
                    },
                    required: ['operation', 'data']
                },
                executor: ExcelProcessor.getInstance
            });
        }

        // CanvasRenderer
        if (typeof CanvasRenderer !== 'undefined') {
            registry.register({
                name: 'render_canvas',
                description: 'Canvas APIを使用して図形やアートを描画し、PNG画像を生成します。グラデーション、図形、テキストなどを組み合わせた画像を作成できます。',
                parameters: {
                    type: 'object',
                    properties: {
                        width: {
                            type: 'number',
                            description: 'キャンバスの幅（ピクセル）。デフォルト: 800'
                        },
                        height: {
                            type: 'number',
                            description: 'キャンバスの高さ（ピクセル）。デフォルト: 600'
                        },
                        elements: {
                            type: 'array',
                            description: '描画する要素の配列',
                            items: {
                                type: 'object',
                                properties: {
                                    type: {
                                        type: 'string',
                                        enum: ['rectangle', 'circle', 'line', 'text', 'path', 'gradient', 'arc'],
                                        description: '要素の種類'
                                    },
                                    x: { type: 'number', description: 'X座標' },
                                    y: { type: 'number', description: 'Y座標' },
                                    width: { type: 'number', description: '幅（rectangle用）' },
                                    height: { type: 'number', description: '高さ（rectangle用）' },
                                    radius: { type: 'number', description: '半径（circle用）' },
                                    fill: { type: 'string', description: '塗りつぶし色（#RRGGBB形式）' },
                                    stroke: { type: 'string', description: '線の色' },
                                    strokeWidth: { type: 'number', description: '線の太さ' },
                                    text: { type: 'string', description: 'テキスト内容（text用）' },
                                    font: { type: 'string', description: 'フォント指定（例: "24px Arial"）' }
                                },
                                required: ['type']
                            }
                        },
                        style: {
                            type: 'object',
                            description: 'キャンバス全体のスタイル',
                            properties: {
                                backgroundColor: { type: 'string', description: '背景色' }
                            }
                        }
                    },
                    required: ['elements']
                },
                executor: CanvasRenderer.getInstance
            });
        }

        console.log(`ToolManager: ${registry.getNames().length} 個のツールを登録`);
    }

    /**
     * モデルがツール機能に対応しているか確認
     * @param {string} model - モデル名
     * @returns {boolean} 対応しているかどうか
     */
    isModelCompatible(model) {
        if (!model) return false;

        const config = window.CONFIG?.TOOLS?.COMPATIBLE_MODELS;
        if (!config) {
            // 設定がない場合はデフォルトのモデルリストで判定
            return this.#isDefaultCompatible(model);
        }

        const allCompatibleModels = [
            ...(config.CLAUDE || []),
            ...(config.OPENAI || []),
            ...(config.GEMINI || [])
        ];

        return allCompatibleModels.some(m =>
            model.toLowerCase().includes(m.toLowerCase()) ||
            m.toLowerCase().includes(model.toLowerCase())
        );
    }

    /**
     * デフォルトの対応モデル判定
     * @param {string} model - モデル名
     * @returns {boolean}
     */
    #isDefaultCompatible(model) {
        const modelLower = model.toLowerCase();

        // Claude
        if (modelLower.includes('claude')) {
            // Claude 3.5以降、Claude 4以降
            if (modelLower.includes('claude-3-5') ||
                modelLower.includes('claude-3.5') ||
                modelLower.includes('claude-sonnet-4') ||
                modelLower.includes('claude-opus-4') ||
                modelLower.includes('claude-4')) {
                return true;
            }
        }

        // OpenAI
        if (modelLower.includes('gpt-4') ||
            modelLower.includes('gpt-5') ||
            modelLower.includes('o1') ||
            modelLower.includes('o3')) {
            return true;
        }

        // Gemini
        if (modelLower.includes('gemini-2') ||
            modelLower.includes('gemini-1.5') ||
            modelLower.includes('gemini-pro')) {
            return true;
        }

        return false;
    }

    /**
     * プロバイダを判定
     * @param {string} model - モデル名
     * @returns {string} プロバイダ名
     */
    getProviderForModel(model) {
        if (!model) return 'openai';

        const modelLower = model.toLowerCase();

        if (modelLower.includes('claude')) {
            return 'claude';
        }

        if (modelLower.includes('gemini')) {
            return 'gemini';
        }

        // OpenAI（デフォルト）
        // gpt-5等の最新モデルはResponses APIを使用する可能性があるが、
        // 現時点ではChat Completions形式で統一
        return 'openai';
    }

    /**
     * プロバイダ形式のツール定義を取得
     * @param {string} provider - プロバイダ名
     * @returns {Array} ツール定義の配列
     */
    getToolsForProvider(provider) {
        const schemas = ToolRegistry.getInstance.getSchemas()
            .filter(schema => this.#enabledTools.has(schema.name));
        if (schemas.length === 0) return [];
        return ToolSchemaConverter.getInstance.convert(schemas, provider);
    }

    /**
     * モデルに対応したツール定義を取得
     * @param {string} model - モデル名
     * @returns {Array} ツール定義の配列
     */
    getToolsForModel(model) {
        if (!this.isModelCompatible(model)) {
            return [];
        }
        const provider = this.getProviderForModel(model);
        return this.getToolsForProvider(provider);
    }

    /**
     * ツール呼び出しを処理
     * @param {Object} toolCall - ツール呼び出し情報
     * @param {string} provider - プロバイダ名
     * @param {Object} [context] - 実行コンテキスト（表示先コンテナなど）
     * @returns {Promise<Object>} 実行結果
     */
    async handleToolCall(toolCall, provider, context = {}) {
        return await ToolExecutor.getInstance.execute(toolCall, context);
    }

    /**
     * ツール結果をプロバイダ形式に変換
     * @param {Object} toolCall - ツール呼び出し情報
     * @param {Object} result - 実行結果
     * @param {string} provider - プロバイダ名
     * @returns {Object} プロバイダ形式の結果
     */
    formatToolResult(toolCall, result, provider) {
        return ToolSchemaConverter.getInstance.formatToolResult(toolCall, result, provider);
    }

    /**
     * ツールエラーをプロバイダ形式に変換
     * @param {Object} toolCall - ツール呼び出し情報
     * @param {Error} error - エラー
     * @param {string} provider - プロバイダ名
     * @returns {Object} プロバイダ形式のエラー
     */
    formatToolError(toolCall, error, provider) {
        return ToolSchemaConverter.getInstance.formatToolError(toolCall, error, provider);
    }

    /**
     * ストリーミングイベントからツール呼び出しを検出
     * @param {Object} event - ストリーミングイベント
     * @param {string} provider - プロバイダ名
     * @returns {Object|null} ツール呼び出し情報
     */
    detectToolCall(event, provider) {
        return ToolExecutor.getInstance.detectToolCall(event, provider);
    }

    /**
     * 登録されているツール名一覧を取得
     * @returns {Array<string>} ツール名の配列
     */
    getToolNames() {
        return ToolRegistry.getInstance.getNames();
    }

    /**
     * ツールが登録されているか確認
     * @param {string} name - ツール名
     * @returns {boolean}
     */
    hasTool(name) {
        return ToolRegistry.getInstance.has(name);
    }

    /**
     * イベントリスナーを登録（ToolExecutorに委譲）
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    on(event, callback) {
        ToolExecutor.getInstance.on(event, callback);
    }

    /**
     * イベントリスナーを解除
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    off(event, callback) {
        ToolExecutor.getInstance.off(event, callback);
    }
}
