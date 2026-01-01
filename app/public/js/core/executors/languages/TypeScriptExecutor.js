/**
 * TypeScriptExecutor.js
 * TypeScriptコードの実行を担当するクラス
 * TypeScriptをJavaScriptにトランスパイルしてから実行
 */
class TypeScriptExecutor extends ExecutorBase {
    static #instance = null;
    static #typescriptLoaded = false;

    constructor() {
        super();
        if (TypeScriptExecutor.#instance) {
            return TypeScriptExecutor.#instance;
        }
        TypeScriptExecutor.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!TypeScriptExecutor.#instance) {
            TypeScriptExecutor.#instance = new TypeScriptExecutor();
        }
        return TypeScriptExecutor.#instance;
    }

    /**
     * TypeScriptコンパイラをロードする
     * @private
     * @returns {Promise<void>}
     */
    async _loadRuntime() {
        if (TypeScriptExecutor.#typescriptLoaded && typeof ts !== 'undefined') {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            if (typeof ts !== 'undefined') {
                TypeScriptExecutor.#typescriptLoaded = true;
                console.log('TypeScriptコンパイラは既に読み込まれています');
                resolve();
                return;
            }

            try {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/typescript@latest/lib/typescript.js';
                script.onload = () => {
                    TypeScriptExecutor.#typescriptLoaded = true;
                    console.log('TypeScriptコンパイラの読み込みが完了しました');
                    resolve();
                };
                script.onerror = (e) => {
                    console.error('TypeScriptコンパイラの読み込みに失敗しました:', e);
                    reject(new Error('TypeScriptコンパイラの読み込みに失敗しました'));
                };
                document.head.appendChild(script);
            } catch (error) {
                console.error('TypeScriptローディングエラー:', error);
                reject(error);
            }
        });
    }

    /**
     * コンソール引数をフォーマットする
     * @param {Array} args - コンソール出力の引数
     * @param {string} type - ログタイプ
     * @returns {Object} フォーマットされた出力
     */
    static #formatConsoleArgs(args, type) {
        try {
            const formatted = args.map(arg => {
                if (arg === undefined) return 'undefined';
                if (arg === null) return 'null';

                try {
                    if (typeof arg === 'object') {
                        return JSON.stringify(arg);
                    }
                    return String(arg);
                } catch (e) {
                    return '[フォーマット不可能なオブジェクト]';
                }
            }).join(' ');

            return { type, content: formatted + '\n' };
        } catch (error) {
            console.error('コンソール出力のフォーマット中にエラーが発生しました:', error);
            return { type, content: '[出力フォーマットエラー]\n' };
        }
    }

    /**
     * サンドボックス環境を作成する
     * @returns {Object} サンドボックスオブジェクト
     */
    static #createSandbox() {
        return {
            Array,
            Object,
            String,
            Number,
            Boolean,
            Date,
            Math,
            JSON,
            RegExp,
            Error,
            Map,
            Set,
            WeakMap,
            WeakSet,
            Symbol,
            Promise,
            console: {},
            undefined: undefined,
            null: null,
            NaN: NaN,
            Infinity: Infinity,
            parseInt,
            parseFloat,
            isNaN,
            isFinite,
            decodeURI,
            decodeURIComponent,
            encodeURI,
            encodeURIComponent,
            setTimeout: (cb, ms) => {
                if (ms > 5000) ms = 5000;
                return setTimeout(cb, ms);
            },
            clearTimeout,
            setInterval: (cb, ms) => {
                if (ms < 100) ms = 100;
                return setInterval(cb, ms);
            },
            clearInterval,
            print: (...args) => {
                console.log(...args);
                return args.join(' ');
            }
        };
    }

    /**
     * TypeScriptコードをJavaScriptにトランスパイルする
     * @param {string} code - TypeScriptコード
     * @returns {Object} トランスパイル結果
     */
    #transpileTypeScript(code) {
        try {
            const result = ts.transpileModule(code, {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2020,
                    module: ts.ModuleKind.None,
                    strict: false,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    forceConsistentCasingInFileNames: true,
                    noEmit: false,
                    removeComments: false
                },
                reportDiagnostics: true
            });

            // 診断情報（エラー/警告）をチェック
            const errors = [];
            const warnings = [];

            if (result.diagnostics && result.diagnostics.length > 0) {
                result.diagnostics.forEach(diagnostic => {
                    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    const lineInfo = diagnostic.file && diagnostic.start !== undefined
                        ? (() => {
                            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                            return `(${line + 1}:${character + 1})`;
                        })()
                        : '';

                    if (diagnostic.category === ts.DiagnosticCategory.Error) {
                        errors.push(`${lineInfo} ${message}`);
                    } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
                        warnings.push(`${lineInfo} ${message}`);
                    }
                });
            }

            return {
                success: errors.length === 0,
                code: result.outputText,
                errors,
                warnings
            };
        } catch (error) {
            return {
                success: false,
                code: '',
                errors: [`トランスパイルエラー: ${error.message}`],
                warnings: []
            };
        }
    }

    /**
     * TypeScriptコードを実行する
     * @param {string} code - 実行するTypeScriptコード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    async execute(code, outputCallback) {
        const startTime = performance.now();

        try {
            // TypeScriptコンパイラをロード
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'TypeScriptコンパイラを読み込んでいます...'
                });
            }

            await this._loadRuntime();

            // TypeScriptをJavaScriptにトランスパイル
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'TypeScriptをトランスパイルしています...'
                });
            }

            const transpileResult = this.#transpileTypeScript(code);

            // 警告があれば出力
            if (transpileResult.warnings.length > 0) {
                transpileResult.warnings.forEach(warning => {
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: { type: 'warn', content: `[TypeScript警告] ${warning}\n` }
                        });
                    }
                });
            }

            // エラーがあればトランスパイル失敗
            if (!transpileResult.success) {
                const errorMessage = transpileResult.errors.join('\n');
                const errorResult = {
                    error: `TypeScriptトランスパイルエラー:\n${errorMessage}`,
                    executionTime: `${(performance.now() - startTime).toFixed(2)}ms`
                };

                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'error',
                        content: errorResult
                    });
                }

                return errorResult;
            }

            // トランスパイル成功、JavaScriptを実行
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'コードを実行しています...'
                });
            }

            const jsCode = transpileResult.code;
            const sandbox = TypeScriptExecutor.#createSandbox();
            const consoleOutput = [];

            sandbox.console = {
                log: (...args) => {
                    const formattedOutput = TypeScriptExecutor.#formatConsoleArgs(args, 'log');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                error: (...args) => {
                    const formattedOutput = TypeScriptExecutor.#formatConsoleArgs(args, 'error');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                warn: (...args) => {
                    const formattedOutput = TypeScriptExecutor.#formatConsoleArgs(args, 'warn');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                info: (...args) => {
                    const formattedOutput = TypeScriptExecutor.#formatConsoleArgs(args, 'info');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                }
            };

            try {
                const execFunc = new Function(`
                    with (this) {
                        try {
                            ${jsCode}
                        } catch (e) {
                            console.error("実行エラー: " + e.message);
                            throw e;
                        }
                    }
                `);

                execFunc.call(sandbox);

                const executionTime = (performance.now() - startTime).toFixed(2);

                const finalResult = {
                    consoleOutput: consoleOutput,
                    executionTime: `${executionTime}ms`,
                    note: 'TypeScriptからトランスパイルして実行しました'
                };

                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'result',
                        content: finalResult
                    });
                }

                return finalResult;
            } catch (evalError) {
                if (consoleOutput.length === 0 || !consoleOutput.some(output => output.type === 'error')) {
                    consoleOutput.push({
                        type: 'error',
                        content: `実行エラー: ${evalError.message}`
                    });
                }

                const executionTime = (performance.now() - startTime).toFixed(2);

                const errorResult = {
                    error: `TypeScriptの実行エラー: ${evalError.message}`,
                    errorDetail: evalError.stack,
                    consoleOutput: consoleOutput,
                    executionTime: `${executionTime}ms`
                };

                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'error',
                        content: errorResult
                    });
                }

                return errorResult;
            }
        } catch (error) {
            console.error('TypeScript実行中にエラーが発生しました:', error);
            const errorResult = {
                error: `TypeScriptの実行エラー: ${error.message || '不明なエラー'}`,
                errorDetail: error.stack,
                executionTime: `${(performance.now() - startTime).toFixed(2)}ms`
            };

            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'error',
                    content: errorResult
                });
            }

            return errorResult;
        }
    }
}
