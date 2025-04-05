/**
 * JavaScriptExecutor.js
 * JavaScriptコードの実行を担当するクラス
 */
class JavaScriptExecutor {
    /**
     * JavaScriptコードを実行する
     * @param {string} code - 実行するJavaScriptコード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Object} 実行結果
     */
    static async execute(code, outputCallback) {
        try {
            const sandbox = ExecutorUtils.createSandbox();
            const consoleOutput = [];
            sandbox.console = {
                log: (...args) => {
                    const formattedOutput = ExecutorUtils.formatConsoleArgs(args, 'log');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                error: (...args) => {
                    const formattedOutput = ExecutorUtils.formatConsoleArgs(args, 'error');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                warn: (...args) => {
                    const formattedOutput = ExecutorUtils.formatConsoleArgs(args, 'warn');
                    consoleOutput.push(formattedOutput);
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                info: (...args) => {
                    const formattedOutput = ExecutorUtils.formatConsoleArgs(args, 'info');
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
}