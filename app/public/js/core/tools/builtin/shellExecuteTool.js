/**
 * shellExecuteTool.js
 * サーバー側ワークスペース（app/workspace）でシェルコマンドを実行するツール
 * サーバーの WORKSPACE_EXEC_ENABLED=0 で無効化できる
 */

/**
 * @typedef {Object} ShellExecuteResult
 * @property {boolean} success
 * @property {number|null} [exitCode]
 * @property {string} [stdout]
 * @property {string} [stderr]
 * @property {boolean} [timedOut]
 * @property {string} [error]
 */

class ShellExecuteTool {
    static #instance = null;

    /** @type {string} */
    name = 'shell_execute';

    /** @type {string} */
    description = 'ワークスペースをカレントディレクトリとしてシェルコマンドを実行し、標準出力・標準エラー・終了コードを返します。npm / git / テスト実行 / ファイル一覧などに使います。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: '実行するコマンド（例: "dir", "ls -la", "npm test", "python main.py"）。Windows では cmd.exe の構文'
            },
            timeoutMs: {
                type: 'number',
                description: 'タイムアウト（ミリ秒、任意。既定は設定値）'
            }
        },
        required: ['command']
    };

    /** @type {string[]} */
    keywords = ['コマンド', 'シェル', '実行して', 'npm', 'git', 'ビルド', 'テスト実行', 'shell', 'command', 'run', 'build', 'ls', 'dir'];

    constructor() {
        if (ShellExecuteTool.#instance) {
            return ShellExecuteTool.#instance;
        }
        ShellExecuteTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {ShellExecuteTool}
     */
    static get getInstance() {
        if (!ShellExecuteTool.#instance) {
            ShellExecuteTool.#instance = new ShellExecuteTool();
        }
        return ShellExecuteTool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params
     * @param {string} params.command
     * @param {number} [params.timeoutMs]
     * @returns {Promise<ShellExecuteResult>}
     */
    async execute(params) {
        const { command, timeoutMs } = params || {};

        if (!command || typeof command !== 'string') {
            return { success: false, error: 'command が指定されていません' };
        }

        const timeout = Number(timeoutMs) || window.CONFIG?.CODEX?.WORKSPACE?.EXEC_TIMEOUT_MS || 60000;

        try {
            console.log(`[ShellExecuteTool] 実行: ${command.substring(0, 120)}`);
            const response = await fetch(window.CONFIG?.CODEX?.ENDPOINTS?.WORKSPACE_EXEC || '/api/workspace/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, timeoutMs: timeout })
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 403) {
                return { success: false, error: 'shell_execute はサーバー設定で無効化されています（WORKSPACE_EXEC_ENABLED=0）' };
            }
            if (!response.ok) {
                return { success: false, error: data?.error?.message || data?.error || `HTTP ${response.status}` };
            }
            return {
                success: data.success === true,
                exitCode: data.exitCode ?? null,
                stdout: data.stdout || '',
                stderr: data.stderr || '',
                timedOut: data.timedOut === true,
                error: data.success ? undefined : (data.timedOut ? 'タイムアウトしました' : `終了コード ${data.exitCode}`)
            };
        } catch (error) {
            console.error('[ShellExecuteTool] 実行エラー:', error);
            return { success: false, error: `実行エラー: ${error.message}` };
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

window.ShellExecuteTool = ShellExecuteTool;
