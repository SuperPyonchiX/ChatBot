/**
 * CPPExecutor.js
 * C++コードの実行を担当するクラス
 * サーバーサイドでg++を使用してコンパイル・実行
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
        const startTime = performance.now();

        try {
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'C++コードをコンパイル・実行しています...'
                });
            }

            // サーバーAPIを呼び出し
            const response = await fetch('/api/compile/cpp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });

            const result = await response.json();
            const executionTime = (performance.now() - startTime).toFixed(2);

            if (!response.ok) {
                const errorResult = {
                    error: result.error || 'サーバーエラーが発生しました',
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

            if (!result.success) {
                // コンパイルエラー
                const errorResult = {
                    error: result.phase === 'compile'
                        ? `コンパイルエラー:\n${result.error}`
                        : `実行エラー:\n${result.error}`,
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

            // 成功
            const outputText = result.output || '';
            const stderrText = result.stderr || '';

            if (typeof outputCallback === 'function') {
                if (outputText) {
                    outputCallback({
                        type: 'output',
                        content: outputText
                    });
                }
                if (stderrText) {
                    outputCallback({
                        type: 'output',
                        content: stderrText
                    });
                }
            }

            const finalResult = {
                result: outputText || '(出力なし)',
                exitCode: result.exitCode || 0,
                executionTime: `${executionTime}ms`
            };

            if (stderrText) {
                finalResult.stderr = stderrText;
            }

            if (result.killed) {
                finalResult.note = '実行がタイムアウトしました（10秒制限）';
            }

            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'result',
                    content: finalResult
                });
            }

            return finalResult;

        } catch (error) {
            console.error('C++実行中にエラーが発生しました:', error);

            // ネットワークエラーなどの場合、JSCPPにフォールバック
            console.warn('サーバー接続エラー。JSCPPにフォールバックします:', error);

            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'サーバー接続エラー。軽量版(JSCPP)で実行します...'
                });
            }

            return await this._executeWithJSCPP(code, outputCallback, startTime);
        }
    }

    /**
     * JSCPP (フォールバック) でC++コードを実行
     * @private
     */
    async _executeWithJSCPP(code, outputCallback, startTime) {
        // JSCPPが読み込まれていなければ読み込む
        if (typeof JSCPP === 'undefined') {
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: '軽量版C++ランタイム(JSCPP)を読み込んでいます...'
                });
            }
            await this._loadJSCPPRuntime();
        }

        let outputText = '';
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
                executionTime: `${executionTime}ms`,
                note: '軽量版(JSCPP)で実行されました。一部のC++機能はサポートされていません。'
            };

            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'result',
                    content: finalResult
                });
            }

            return finalResult;
        } catch (runtimeError) {
            console.error('JSCPP実行中にエラーが発生しました:', runtimeError);

            const errorResult = {
                error: `C++の実行エラー: ${runtimeError.message || '不明なエラー'}`,
                errorDetail: runtimeError.stack,
                executionTime: `${(performance.now() - startTime).toFixed(2)}ms`,
                note: '軽量版(JSCPP)で実行されました。一部のC++機能はサポートされていません。'
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
     * JSCPPランタイムを読み込む（フォールバック用）
     * @private
     */
    _loadJSCPPRuntime() {
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
     * C++コードをJSCPPで実行できるように前処理する（JSCPP用）
     * @private
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
