/**
 * customToolExecutor.js
 * カスタムツールの安全な実行環境
 * サンドボックス内でユーザー定義コードを実行
 */

class CustomToolExecutor {
    static #instance = null;

    /** @type {string[]} */
    #allowedGlobals;

    /** @type {number} */
    #timeout;

    /** @type {Set<string>} */
    #dangerousPatterns;

    /**
     * @constructor
     */
    constructor() {
        if (CustomToolExecutor.#instance) {
            return CustomToolExecutor.#instance;
        }
        CustomToolExecutor.#instance = this;

        const config = window.CONFIG?.TOOLS?.CUSTOM || {};
        this.#allowedGlobals = config.ALLOWED_APIS || [
            'fetch', 'JSON', 'Math', 'Date', 'Array', 'Object',
            'String', 'Number', 'Boolean', 'console', 'Promise',
            'setTimeout', 'clearTimeout', 'encodeURIComponent',
            'decodeURIComponent', 'encodeURI', 'decodeURI',
            'parseInt', 'parseFloat', 'isNaN', 'isFinite'
        ];
        this.#timeout = config.SANDBOX_TIMEOUT || 5000;

        // 危険なパターン
        this.#dangerousPatterns = new Set([
            'eval',
            'Function',
            'document.cookie',
            'localStorage',
            'sessionStorage',
            'indexedDB',
            'XMLHttpRequest',
            'WebSocket',
            'Worker',
            'importScripts',
            'window.location',
            'document.location',
            'window.open',
            'document.write',
            '__proto__',
            'constructor.constructor'
        ]);
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {CustomToolExecutor}
     */
    static get getInstance() {
        if (!CustomToolExecutor.#instance) {
            CustomToolExecutor.#instance = new CustomToolExecutor();
        }
        return CustomToolExecutor.#instance;
    }

    /**
     * カスタムツールを実行
     * @param {Object} toolDefinition - ツール定義
     * @param {Object} params - 実行パラメータ
     * @returns {Promise<Object>} 実行結果
     */
    async execute(toolDefinition, params) {
        const { name, executeCode } = toolDefinition;

        try {
            // コードのセキュリティチェック
            const securityCheck = this.#checkSecurity(executeCode);
            if (!securityCheck.safe) {
                return {
                    success: false,
                    error: `セキュリティエラー: ${securityCheck.reason}`,
                    toolName: name
                };
            }

            // サンドボックスで実行
            const result = await this.#executeInSandbox(executeCode, params);

            return {
                success: true,
                result,
                toolName: name
            };
        } catch (error) {
            console.error(`[CustomToolExecutor] ツール実行エラー (${name}):`, error);
            return {
                success: false,
                error: error.message,
                toolName: name
            };
        }
    }

    /**
     * セキュリティチェック
     * @param {string} code
     * @returns {{ safe: boolean, reason?: string }}
     */
    #checkSecurity(code) {
        // 危険なパターンをチェック
        for (const pattern of this.#dangerousPatterns) {
            if (code.includes(pattern)) {
                return {
                    safe: false,
                    reason: `禁止されたパターン: ${pattern}`
                };
            }
        }

        // eval系のチェック
        if (/\beval\s*\(/.test(code)) {
            return { safe: false, reason: 'eval()は使用できません' };
        }

        // new Function のチェック
        if (/new\s+Function\s*\(/.test(code)) {
            return { safe: false, reason: 'new Function()は使用できません' };
        }

        // プロトタイプ汚染のチェック
        if (/__proto__|prototype\s*=/.test(code)) {
            return { safe: false, reason: 'プロトタイプの変更は禁止されています' };
        }

        return { safe: true };
    }

    /**
     * サンドボックス内でコードを実行
     * @param {string} code - 実行コード
     * @param {Object} params - パラメータ
     * @returns {Promise<any>}
     */
    async #executeInSandbox(code, params) {
        return new Promise((resolve, reject) => {
            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                reject(new Error(`タイムアウト: ${this.#timeout}ms を超過しました`));
            }, this.#timeout);

            try {
                // サンドボックス用のコンテキストを作成
                const sandbox = this.#createSandbox(params);

                // 非同期関数としてラップ
                const wrappedCode = `
                    (async function(params, sandbox) {
                        with (sandbox) {
                            ${code}
                        }
                    })
                `;

                // 実行
                const fn = new Function('params', 'sandbox', `
                    return (async function() {
                        const { ${Object.keys(sandbox).join(', ')} } = sandbox;
                        ${code}
                    })();
                `);

                fn(params, sandbox)
                    .then(result => {
                        clearTimeout(timeoutId);
                        resolve(result);
                    })
                    .catch(error => {
                        clearTimeout(timeoutId);
                        reject(error);
                    });
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * サンドボックスコンテキストを作成
     * @param {Object} params
     * @returns {Object}
     */
    #createSandbox(params) {
        const sandbox = {
            // パラメータ
            params,

            // 安全なユーティリティ
            JSON: {
                parse: JSON.parse,
                stringify: JSON.stringify
            },
            Math,
            Date,
            Array,
            Object: {
                keys: Object.keys,
                values: Object.values,
                entries: Object.entries,
                assign: Object.assign,
                fromEntries: Object.fromEntries
            },
            String,
            Number,
            Boolean,
            Promise,

            // 文字列操作
            encodeURIComponent,
            decodeURIComponent,
            encodeURI,
            decodeURI,
            parseInt,
            parseFloat,
            isNaN,
            isFinite,

            // コンソール（ログのみ）
            console: {
                log: (...args) => console.log('[CustomTool]', ...args),
                warn: (...args) => console.warn('[CustomTool]', ...args),
                error: (...args) => console.error('[CustomTool]', ...args),
                info: (...args) => console.info('[CustomTool]', ...args)
            },

            // 安全なfetch（プロキシ経由）
            fetch: this.#createSafeFetch(),

            // タイマー（制限付き）
            setTimeout: (fn, delay) => {
                const maxDelay = Math.min(delay, this.#timeout);
                return setTimeout(fn, maxDelay);
            },
            clearTimeout
        };

        return sandbox;
    }

    /**
     * 安全なfetchを作成
     * @returns {Function}
     */
    #createSafeFetch() {
        return async (url, options = {}) => {
            // URLの検証
            try {
                const parsed = new URL(url);

                // 禁止スキームのチェック
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    throw new Error(`禁止されたプロトコル: ${parsed.protocol}`);
                }

                // ローカルホストへのアクセス制限
                if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
                    throw new Error('ローカルホストへのアクセスは禁止されています');
                }
            } catch (error) {
                if (error.message.includes('Invalid URL')) {
                    throw new Error(`無効なURL: ${url}`);
                }
                throw error;
            }

            // プロキシ経由でリクエスト
            const proxyUrl = `/proxy/fetch?url=${encodeURIComponent(url)}`;

            // オプションの制限
            const safeOptions = {
                method: options.method || 'GET',
                headers: options.headers || {}
            };

            // POSTの場合のみbodyを許可
            if (safeOptions.method === 'POST' && options.body) {
                safeOptions.body = typeof options.body === 'string'
                    ? options.body
                    : JSON.stringify(options.body);
            }

            try {
                const response = await fetch(proxyUrl, safeOptions);
                const text = await response.text();

                // JSONの場合はパース
                try {
                    return JSON.parse(text);
                } catch {
                    return text;
                }
            } catch (error) {
                throw new Error(`フェッチエラー: ${error.message}`);
            }
        };
    }

    /**
     * コードをテスト実行（結果のプレビュー）
     * @param {string} code - 実行コード
     * @param {Object} testParams - テストパラメータ
     * @returns {Promise<Object>}
     */
    async testExecute(code, testParams = {}) {
        const startTime = Date.now();

        try {
            const securityCheck = this.#checkSecurity(code);
            if (!securityCheck.safe) {
                return {
                    success: false,
                    error: securityCheck.reason,
                    duration: Date.now() - startTime
                };
            }

            const result = await this.#executeInSandbox(code, testParams);

            return {
                success: true,
                result,
                duration: Date.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * コードを検証のみ（実行なし）
     * @param {string} code
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(code) {
        const errors = [];

        // セキュリティチェック
        const securityCheck = this.#checkSecurity(code);
        if (!securityCheck.safe) {
            errors.push(securityCheck.reason);
        }

        // 構文チェック
        try {
            new Function(code);
        } catch (error) {
            errors.push(`構文エラー: ${error.message}`);
        }

        // returnの存在チェック
        if (!code.includes('return')) {
            errors.push('警告: return文がありません。値を返すにはreturnを使用してください。');
        }

        return {
            valid: errors.filter(e => !e.startsWith('警告')).length === 0,
            errors
        };
    }

    /**
     * タイムアウトを設定
     * @param {number} ms
     */
    setTimeout(ms) {
        this.#timeout = Math.max(1000, Math.min(ms, 30000)); // 1秒〜30秒
    }

    /**
     * 現在のタイムアウト値を取得
     * @returns {number}
     */
    getTimeout() {
        return this.#timeout;
    }
}

// グローバルに公開
window.CustomToolExecutor = CustomToolExecutor;
