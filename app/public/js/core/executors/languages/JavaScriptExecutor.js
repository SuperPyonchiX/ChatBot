/**
 * JavaScriptExecutor.js
 * JavaScriptコードの実行を担当するクラス
 */
class JavaScriptExecutor extends ExecutorBase {
    static #instance = null;
    
    constructor() {
        super();
        if (JavaScriptExecutor.#instance) {
            return JavaScriptExecutor.#instance;
        }
        JavaScriptExecutor.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!JavaScriptExecutor.#instance) {
            JavaScriptExecutor.#instance = new JavaScriptExecutor();
        }
        return JavaScriptExecutor.#instance;
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
            Promise,
            print: (...args) => {
                console.log(...args);
                return args.join(' ');
            }
        };
    }

    /**
     * JavaScriptコードを実行する
     * @param {string} code - 実行するJavaScriptコード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    async execute(code, outputCallback) {
        try {
            const sandbox = JavaScriptExecutor.#createSandbox();
            const consoleOutput = [];
            sandbox.console = {
                log: (...args) => {
                    const formattedOutput = JavaScriptExecutor.#formatConsoleArgs(args, 'log');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                error: (...args) => {
                    const formattedOutput = JavaScriptExecutor.#formatConsoleArgs(args, 'error');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                warn: (...args) => {
                    const formattedOutput = JavaScriptExecutor.#formatConsoleArgs(args, 'warn');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                info: (...args) => {
                    const formattedOutput = JavaScriptExecutor.#formatConsoleArgs(args, 'info');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                }
            };
            
            const startTime = performance.now();
            
            try {
                const execFunc = new Function(`
                    with (this) {
                        try {
                            ${code}
                        } catch (e) {
                            console.error("実行エラー: " + e.message);
                            throw e;
                        }
                    }
                `);
                
                execFunc.call(sandbox);
                
                const endTime = performance.now();
                const executionTime = (endTime - startTime).toFixed(2);
                
                const finalResult = {
                    consoleOutput: consoleOutput,
                    executionTime: `${executionTime}ms`
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
                
                const endTime = performance.now();
                const executionTime = (endTime - startTime).toFixed(2);
                
                const errorResult = {
                    error: `JavaScriptの実行エラー: ${evalError.message}`,
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
            console.error('JavaScript実行中にエラーが発生しました:', error);
            const errorResult = { 
                error: `JavaScriptの実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
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

    /**
     * JavaScriptはブラウザにビルトインされているため、
     * ランタイムのロードは不要です
     * @protected
     * @returns {Promise<void>}
     */
    _loadRuntime() {
        return Promise.resolve();
    }
}