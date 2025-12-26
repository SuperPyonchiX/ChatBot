/**
 * CPPExecutor.js
 * C++コードの実行を担当するクラス
 */
class CPPExecutor extends ExecutorBase {
    static #instance = null;

    constructor() {
        super();
        if (CPPExecutor.#instance) {
            return CPPExecutor.#instance;
        }
        CPPExecutor.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!CPPExecutor.#instance) {
            CPPExecutor.#instance = new CPPExecutor();
        }
        return CPPExecutor.#instance;
    }

    /**
     * C++コードを実行する
     * @param {string} code - 実行するC++コード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    async execute(code, outputCallback) {
        try {
            // @ts-ignore - JSCPPは外部ライブラリのグローバル変数
            if (typeof JSCPP === 'undefined') {
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'status',
                        content: 'C++ランタイム(JSCPP)を読み込んでいます...'
                    });
                }
                
                try {
                    await this._loadRuntime();
                } catch (loadError) {
                    const errorMsg = `C++ランタイムの読み込みに失敗しました: ${loadError.message}`;
                    console.error(errorMsg);
                    
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'error',
                            content: errorMsg
                        });
                    }
                    
                    return { error: errorMsg };
                }
            }
            
            let outputText = '';
            const startTime = performance.now();
            let preprocessedCode = this._preprocessCPPCode(code);
            
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'C++コードを実行しています...'
                });
            }
            
            const config = {
                stdio: {
                    write: function(s) {
                        outputText += s;
                        
                        if (typeof outputCallback === 'function') {
                            outputCallback({
                                type: 'output',
                                content: s
                            });
                        }
                    }
                },
                unsigned_overflow: "warn"
            };
            
            try {
                // @ts-ignore - JSCPPは外部ライブラリのグローバル変数
                const exitCode = JSCPP.run(preprocessedCode, "", config);
                const endTime = performance.now();
                const executionTime = (endTime - startTime).toFixed(2);
                
                const finalResult = {
                    result: outputText || '(出力なし)',
                    exitCode: exitCode,
                    executionTime: `${executionTime}ms`
                };
                
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'result',
                        content: finalResult
                    });
                }
                
                return finalResult;
            } catch (runtimeError) {
                console.error('C++実行中にエラーが発生しました:', runtimeError);
                
                const errorResult = {
                    error: `C++の実行エラー: ${runtimeError.message || '不明なエラー'}`,
                    errorDetail: runtimeError.stack,
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
            
        } catch (error) {
            console.error('C++実行中にエラーが発生しました:', error);
            const errorResult = { 
                error: `C++の実行エラー: ${error.message || '不明なエラー'}`, 
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
     * JSCPPランタイムを読み込む
     * @protected
     * @returns {Promise<void>}
     */
    _loadRuntime() {
        return new Promise((resolve, reject) => {
            // @ts-ignore - JSCPPは外部ライブラリのグローバル変数
            if (typeof JSCPP !== 'undefined') {
                console.log('JSCPPはすでに読み込まれています');
                resolve();
                return;
            }

            try {
                const script = document.createElement('script');
                script.src = 'js/lib/JSCPP.es5.min.js';
                script.onload = () => {
                    console.log('JSCPPの読み込みが完了しました');
                    resolve();
                };
                script.onerror = (e) => {
                    console.error('JSCPPの読み込みに失敗しました:', e);
                    reject(new Error('C++ランタイム(JSCPP)の読み込みに失敗しました'));
                };
                document.head.appendChild(script);
            } catch (error) {
                console.error('JSCPPローディングエラー:', error);
                reject(error);
            }
        });
    }

    /**
     * C++コードをJSCPPで実行できるように前処理する
     * @param {string} code - 元のC++コード
     * @returns {string} 前処理後のコード
     */
    _preprocessCPPCode(code) {
        let processedCode = code
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/[^\x00-\x7F]/g, '')
            .trim();
        
        if (!processedCode.includes('using namespace std;')) {
            processedCode = processedCode.replace(
                /(#include\s*<[^>]+>)/,
                '$1\nusing namespace std;'
            );
        }
        
        processedCode = processedCode.replace(/std::/g, '');
        
        return processedCode;
    }
}