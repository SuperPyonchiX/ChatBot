/**
 * codeExecuteTool.js
 * コード実行ツール
 * 既存のCodeExecutorと連携してコードを実行
 */

/**
 * @typedef {Object} CodeExecuteResult
 * @property {boolean} success - 成功したかどうか
 * @property {string} language - 実行言語
 * @property {string} code - 実行したコード
 * @property {string} [output] - 実行結果
 * @property {string} [error] - エラーメッセージ
 * @property {number} [executionTime] - 実行時間（ms）
 */

class CodeExecuteTool {
    static #instance = null;

    /** @type {string} */
    name = 'code_execute';

    /** @type {string} */
    description = 'コードを実行します。JavaScript, Python, TypeScriptに対応。計算や変換など、プログラムで解決できるタスクに使用します。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            code: {
                type: 'string',
                description: '実行するコード'
            },
            language: {
                type: 'string',
                enum: ['javascript', 'python', 'typescript'],
                description: 'プログラミング言語（デフォルト: javascript）'
            },
            timeout: {
                type: 'number',
                description: 'タイムアウト時間（ミリ秒、デフォルト: 30000）'
            }
        },
        required: ['code']
    };

    /** @type {string[]} */
    keywords = ['実行', 'コード', 'プログラム', 'スクリプト', 'execute', 'run', 'code', 'program', 'script', 'python', 'javascript'];

    /** @type {number} */
    #defaultTimeout = 30000;

    /**
     * @constructor
     */
    constructor() {
        if (CodeExecuteTool.#instance) {
            return CodeExecuteTool.#instance;
        }
        CodeExecuteTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {CodeExecuteTool}
     */
    static get getInstance() {
        if (!CodeExecuteTool.#instance) {
            CodeExecuteTool.#instance = new CodeExecuteTool();
        }
        return CodeExecuteTool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params - パラメータ
     * @param {string} params.code - 実行するコード
     * @param {string} [params.language='javascript'] - 言語
     * @param {number} [params.timeout] - タイムアウト
     * @returns {Promise<CodeExecuteResult>}
     */
    async execute(params) {
        const { code, language = 'javascript', timeout = this.#defaultTimeout } = params;

        if (!code || typeof code !== 'string') {
            return {
                success: false,
                language: language,
                code: code || '',
                error: 'コードが指定されていません'
            };
        }

        // セキュリティチェック
        const securityCheck = this.#checkSecurity(code, language);
        if (!securityCheck.safe) {
            return {
                success: false,
                language: language,
                code: code,
                error: `セキュリティ上の理由により実行を拒否: ${securityCheck.reason}`
            };
        }

        try {
            const startTime = Date.now();
            let result;

            switch (language.toLowerCase()) {
                case 'javascript':
                    result = await this.#executeJavaScript(code, timeout);
                    break;
                case 'python':
                    result = await this.#executePython(code, timeout);
                    break;
                case 'typescript':
                    result = await this.#executeTypeScript(code, timeout);
                    break;
                default:
                    return {
                        success: false,
                        language: language,
                        code: code,
                        error: `未対応の言語: ${language}`
                    };
            }

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                language: language,
                code: code,
                output: result,
                executionTime: executionTime
            };
        } catch (error) {
            console.error('[CodeExecuteTool] 実行エラー:', error);
            return {
                success: false,
                language: language,
                code: code,
                error: `実行エラー: ${error.message}`
            };
        }
    }

    /**
     * セキュリティチェック
     * @param {string} code
     * @param {string} language
     * @returns {{safe: boolean, reason?: string}}
     */
    #checkSecurity(code, language) {
        const dangerousPatterns = [
            // ファイルシステムアクセス
            /require\s*\(\s*['"]fs['"]\s*\)/i,
            /import\s+.*from\s+['"]fs['"]/i,
            /open\s*\(/i,
            /readFile|writeFile|unlink|rmdir/i,
            // ネットワークアクセス（評価実行のため制限）
            /child_process/i,
            /exec\s*\(/i,
            /spawn\s*\(/i,
            // プロセス操作
            /process\.exit/i,
            // evalの連鎖
            /eval\s*\(\s*eval/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(code)) {
                return {
                    safe: false,
                    reason: `危険なパターンが検出されました: ${pattern.toString()}`
                };
            }
        }

        // コードの長さチェック
        if (code.length > 50000) {
            return {
                safe: false,
                reason: 'コードが長すぎます（最大50000文字）'
            };
        }

        return { safe: true };
    }

    /**
     * JavaScriptを実行
     * @param {string} code
     * @param {number} timeout
     * @returns {Promise<string>}
     */
    async #executeJavaScript(code, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('タイムアウト'));
            }, timeout);

            try {
                // 出力をキャプチャするためのラッパー
                const outputs = [];
                const mockConsole = {
                    log: (...args) => outputs.push(args.map(a => this.#stringify(a)).join(' ')),
                    error: (...args) => outputs.push('[ERROR] ' + args.map(a => this.#stringify(a)).join(' ')),
                    warn: (...args) => outputs.push('[WARN] ' + args.map(a => this.#stringify(a)).join(' ')),
                    info: (...args) => outputs.push(args.map(a => this.#stringify(a)).join(' '))
                };

                // サンドボックス環境で実行
                const wrappedCode = `
                    (function(console) {
                        'use strict';
                        ${code}
                    })(mockConsole);
                `;

                const result = new Function('mockConsole', wrappedCode)(mockConsole);

                clearTimeout(timeoutId);

                // 結果を構築
                if (outputs.length > 0) {
                    resolve(outputs.join('\n'));
                } else if (result !== undefined) {
                    resolve(this.#stringify(result));
                } else {
                    resolve('(出力なし)');
                }
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Pythonを実行（Pyodide経由）
     * @param {string} code
     * @param {number} timeout
     * @returns {Promise<string>}
     */
    async #executePython(code, timeout) {
        // 既存のCodeExecutorを使用
        const codeExecutor = window.CodeExecutor?.getInstance;

        if (!codeExecutor) {
            // CodeExecutorがない場合はPyodideを直接使用
            if (!window.pyodide) {
                throw new Error('Pyodideが読み込まれていません。Pythonの実行にはPyodideが必要です。');
            }

            return new Promise(async (resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('タイムアウト'));
                }, timeout);

                try {
                    // 出力をキャプチャ
                    const outputs = [];
                    window.pyodide.setStdout({
                        batched: (text) => outputs.push(text)
                    });

                    await window.pyodide.runPythonAsync(code);

                    clearTimeout(timeoutId);
                    resolve(outputs.join('') || '(出力なし)');
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
        }

        // CodeExecutorを使用
        const result = await codeExecutor.execute(code, 'python', { timeout });

        if (result.error) {
            throw new Error(result.error);
        }

        return result.output || '(出力なし)';
    }

    /**
     * TypeScriptを実行
     * @param {string} code
     * @param {number} timeout
     * @returns {Promise<string>}
     */
    async #executeTypeScript(code, timeout) {
        // 既存のCodeExecutorを使用
        const codeExecutor = window.CodeExecutor?.getInstance;

        if (codeExecutor) {
            const result = await codeExecutor.execute(code, 'typescript', { timeout });

            if (result.error) {
                throw new Error(result.error);
            }

            return result.output || '(出力なし)';
        }

        // TypeScriptコンパイラがない場合は型注釈を除去してJSとして実行
        const jsCode = code
            .replace(/:\s*\w+(\[\])?(\s*=|\s*[,\)]|\s*{)/g, '$2')  // 型注釈を除去
            .replace(/interface\s+\w+\s*{[^}]*}/g, '')  // interfaceを除去
            .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');  // type定義を除去

        return this.#executeJavaScript(jsCode, timeout);
    }

    /**
     * 値を文字列化
     * @param {*} value
     * @returns {string}
     */
    #stringify(value) {
        if (value === undefined) return 'undefined';
        if (value === null) return 'null';
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return String(value);
            }
        }
        return String(value);
    }

    /**
     * 利用可能な言語を取得
     * @returns {string[]}
     */
    getAvailableLanguages() {
        const languages = ['javascript'];

        if (window.pyodide || window.CodeExecutor?.getInstance) {
            languages.push('python');
        }

        if (window.CodeExecutor?.getInstance) {
            languages.push('typescript');
        }

        return languages;
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

// グローバルに公開
window.CodeExecuteTool = CodeExecuteTool;
