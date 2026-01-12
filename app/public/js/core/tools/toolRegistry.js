/**
 * toolRegistry.js
 * ツール定義の登録・管理を担当するモジュール
 * 統一フォーマットでツールを定義し、各プロバイダ形式への変換をサポート
 */
class ToolRegistry {
    static #instance = null;

    // 登録されたツール定義
    #tools = new Map();

    constructor() {
        if (ToolRegistry.#instance) {
            return ToolRegistry.#instance;
        }
        ToolRegistry.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ToolRegistry.#instance) {
            ToolRegistry.#instance = new ToolRegistry();
        }
        return ToolRegistry.#instance;
    }

    /**
     * ツールを登録
     * @param {Object} toolDefinition - ツール定義
     * @param {string} toolDefinition.name - ツール名（一意）
     * @param {string} toolDefinition.description - ツールの説明
     * @param {Object} toolDefinition.parameters - JSONスキーマ形式のパラメータ定義
     * @param {Object} toolDefinition.executor - ツール実行クラスのインスタンス
     */
    register(toolDefinition) {
        if (!toolDefinition.name) {
            throw new Error('ツール名は必須です');
        }
        if (!toolDefinition.executor) {
            throw new Error('ツール実行クラスは必須です');
        }

        this.#tools.set(toolDefinition.name, {
            name: toolDefinition.name,
            description: toolDefinition.description || '',
            parameters: toolDefinition.parameters || { type: 'object', properties: {} },
            executor: toolDefinition.executor
        });

        console.log(`ツール登録: ${toolDefinition.name}`);
    }

    /**
     * ツールを取得
     * @param {string} name - ツール名
     * @returns {Object|null} ツール定義
     */
    get(name) {
        return this.#tools.get(name) || null;
    }

    /**
     * 全ツールを取得
     * @returns {Array} ツール定義の配列
     */
    getAll() {
        return Array.from(this.#tools.values());
    }

    /**
     * ツール名の一覧を取得
     * @returns {Array<string>} ツール名の配列
     */
    getNames() {
        return Array.from(this.#tools.keys());
    }

    /**
     * ツールが存在するか確認
     * @param {string} name - ツール名
     * @returns {boolean}
     */
    has(name) {
        return this.#tools.has(name);
    }

    /**
     * ツールを削除
     * @param {string} name - ツール名
     * @returns {boolean} 削除成功したかどうか
     */
    unregister(name) {
        return this.#tools.delete(name);
    }

    /**
     * 全ツールをクリア
     */
    clear() {
        this.#tools.clear();
    }

    /**
     * ツール定義のスキーマ部分のみを取得（実行クラスを除く）
     * @returns {Array} スキーマ定義の配列
     */
    getSchemas() {
        return this.getAll().map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
    }
}
