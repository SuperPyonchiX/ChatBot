/**
 * fileWriteTool.js
 * サーバー側ワークスペース（app/workspace）にファイルを書き込むツール
 */

/**
 * @typedef {Object} FileWriteResult
 * @property {boolean} success
 * @property {string} [path]
 * @property {number} [size]
 * @property {string} [error]
 */

class FileWriteTool {
    static #instance = null;

    /** @type {string} */
    name = 'file_write';

    /** @type {string} */
    description = 'ワークスペースにテキストファイルを作成・上書きします。path はワークスペースからの相対パス、content はファイルの全文です。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'ワークスペース相対パス（例: "src/app.js", "notes/todo.md"）。親フォルダは自動作成される'
            },
            content: {
                type: 'string',
                description: 'ファイルの内容（全文）'
            }
        },
        required: ['path', 'content']
    };

    /** @type {string[]} */
    keywords = ['保存', '書き込み', '書き出し', 'ファイル作成', 'ファイルに', 'write', 'save', 'create file', 'write file'];

    constructor() {
        if (FileWriteTool.#instance) {
            return FileWriteTool.#instance;
        }
        FileWriteTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {FileWriteTool}
     */
    static get getInstance() {
        if (!FileWriteTool.#instance) {
            FileWriteTool.#instance = new FileWriteTool();
        }
        return FileWriteTool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params
     * @param {string} params.path
     * @param {string} params.content
     * @returns {Promise<FileWriteResult>}
     */
    async execute(params) {
        const { path, content } = params || {};

        if (!path || typeof path !== 'string') {
            return { success: false, error: 'path が指定されていません' };
        }
        if (typeof content !== 'string') {
            return { success: false, error: 'content は文字列で指定してください' };
        }

        try {
            const response = await fetch(window.CONFIG?.CODEX?.ENDPOINTS?.WORKSPACE_FILE || '/api/workspace/file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, content })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                return { success: false, error: data?.error?.message || `HTTP ${response.status}` };
            }
            console.log(`[FileWriteTool] 書き込み完了: ${path} (${data.size} bytes)`);
            document.dispatchEvent(new CustomEvent('codex:completed', { detail: { fileChanges: [{ path, kind: 'update' }] } }));
            return { success: true, path: data.path, size: data.size };
        } catch (error) {
            console.error('[FileWriteTool] 書き込みエラー:', error);
            return { success: false, error: `書き込みエラー: ${error.message}` };
        }
    }

    /**
     * ツール定義を取得（Function Calling用）
     * @returns {Object}
     */
    getToolDefinition() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
}

window.FileWriteTool = FileWriteTool;
