/**
 * codexTaskTool.js
 * サブエージェント（OpenAI Codex CLI）にコーディングタスクを委譲するエージェントツール
 * サーバー側ワークスペース（app/workspace）でファイル作成・編集・コマンド実行を行う
 */

/**
 * @typedef {Object} CodexTaskResult
 * @property {boolean} success
 * @property {string} [message] - Codex の最終メッセージ
 * @property {Array<{path: string, kind: string}>} [fileChanges] - 変更されたファイル
 * @property {string|null} [threadId]
 * @property {Object|null} [usage]
 * @property {string} [error]
 */

class CodexTaskTool {
    static #instance = null;

    /** @type {string} */
    name = 'codex_task';

    /** @type {string} */
    description = 'サブエージェント（Codex）にコーディングタスクを委譲します。ワークスペース内でファイルの作成・編集、コマンド実行、テストなどを自律的に行い、最終報告と変更ファイル一覧を返します。独立したタスクは複数同時に呼び出せます。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            task: {
                type: 'string',
                description: 'Codex に依頼する作業内容。目的・対象ファイル・完了条件を具体的に書く（例: "ワークスペース直下に fizzbuzz.py を作成し、1〜30 の FizzBuzz を出力するようにして実行結果も確認する"）'
            },
            files: {
                type: 'array',
                items: { type: 'string' },
                description: '関連するワークスペース内ファイルの相対パス（任意）'
            },
            sandbox: {
                type: 'string',
                enum: ['read-only', 'workspace-write', 'danger-full-access'],
                description: 'サンドボックス（任意。既定は設定値）'
            }
        },
        required: ['task']
    };

    /** @type {string[]} */
    keywords = ['コード', '実装', 'ファイル作成', '編集', 'リファクタ', '委譲', 'サブエージェント', 'codex', 'implement', 'write code', 'edit file', 'create file', 'refactor', 'delegate'];

    /** @type {number} */
    #running = 0;

    /** @type {Array<() => void>} */
    #waiters = [];

    constructor() {
        if (CodexTaskTool.#instance) {
            return CodexTaskTool.#instance;
        }
        CodexTaskTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {CodexTaskTool}
     */
    static get getInstance() {
        if (!CodexTaskTool.#instance) {
            CodexTaskTool.#instance = new CodexTaskTool();
        }
        return CodexTaskTool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params
     * @param {string} params.task
     * @param {string[]} [params.files]
     * @param {string} [params.sandbox]
     * @returns {Promise<CodexTaskResult>}
     */
    async execute(params) {
        const { task, files, sandbox } = params || {};

        if (!task || typeof task !== 'string') {
            return { success: false, error: 'task が指定されていません' };
        }
        if (typeof CodexClient === 'undefined' || !CodexClient.getInstance.isEnabled()) {
            return { success: false, error: 'Codex 連携が無効です（CONFIG.CODEX.ENABLED）' };
        }

        let prompt = task;
        if (Array.isArray(files) && files.length > 0) {
            prompt += `\n\n関連ファイル（ワークスペース相対パス）:\n${files.map(f => `- ${f}`).join('\n')}`;
        }

        await this.#acquire();
        const card = this.#createCard(task);
        let jobId = null;

        try {
            console.log(`[CodexTaskTool] サブエージェント起動: "${task.substring(0, 60)}..."`);
            const result = await CodexClient.getInstance.run({
                prompt,
                threadId: null,
                sandbox: sandbox || undefined,
                signal: window.AppState?.abortController?.signal,
                onJob: (id) => { jobId = id; },
                onEvent: (event) => card && CodexRunCard.getInstance.appendEvent(card.el, event),
                onStderr: (line) => card && CodexRunCard.getInstance.appendStderr(card.el, line),
                onError: (err) => card && CodexRunCard.getInstance.showError(card.el, err.message)
            });
            if (card) CodexRunCard.getInstance.finalize(card.el, result);

            if (!result.success) {
                return {
                    success: false,
                    error: result.aborted ? '中断されました' : (result.error || 'Codex の実行に失敗しました'),
                    message: result.finalMessage || undefined,
                    fileChanges: result.fileChanges,
                    threadId: result.threadId
                };
            }
            return {
                success: true,
                message: result.finalMessage || '(メッセージなし)',
                fileChanges: result.fileChanges,
                threadId: result.threadId,
                usage: result.usage
            };
        } catch (error) {
            console.error('[CodexTaskTool] 実行エラー:', error);
            if (card) CodexRunCard.getInstance.finalize(card.el, { success: false, error: error.message });
            if (jobId) CodexClient.getInstance.cancel(jobId).catch(() => {});
            return { success: false, error: `Codex 実行エラー: ${error.message}` };
        } finally {
            this.#release();
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

    // ========================================
    // 内部処理
    // ========================================

    /**
     * 進捗カードをエージェント UI の中に作る（無ければ null）
     * @param {string} task
     * @returns {{el: HTMLElement}|null}
     */
    #createCard(task) {
        if (typeof CodexRunCard === 'undefined' || typeof AgentUI === 'undefined') return null;
        const container = AgentUI.getInstance.getCurrentContainer?.();
        const host = container?.querySelector('.agent-iterations') || container;
        if (!host) return null;
        const el = CodexRunCard.getInstance.create(host, {
            title: `Codex: ${task.substring(0, 40)}${task.length > 40 ? '…' : ''}`
        });
        return { el };
    }

    /**
     * 並列上限に達していたら空くまで待つ
     * @returns {Promise<void>}
     */
    #acquire() {
        const max = window.CONFIG?.CODEX?.MAX_PARALLEL || 3;
        if (this.#running < max) {
            this.#running++;
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.#waiters.push(() => {
                this.#running++;
                resolve();
            });
        });
    }

    #release() {
        this.#running = Math.max(0, this.#running - 1);
        const next = this.#waiters.shift();
        if (next) next();
    }
}

window.CodexTaskTool = CodexTaskTool;
