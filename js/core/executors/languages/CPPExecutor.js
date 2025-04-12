/**
 * CPPExecutor.js
 * C++コードの実行を担当するクラス
 * GodboltコンパイラエクスプローラーのAPIを使用してC++コードをコンパイル・実行
 */
class CPPExecutor extends ExecutorBase {
    static #instance = null;
    #compilerOptions = {
        compiler: 'g122', // GCC 12.2をデフォルトで使用
        options: {
            compilerOptions: {
                executorRequest: true,
                skipAsm: true
            }
        },
        allowStoreCodeDebug: true
    };

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
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'Godbolt APIでC++コードを送信しています...'
                });
            }
            
            const startTime = performance.now();
            const processedCode = this._preprocessCPPCode(code);
            
            try {
                const result = await this._executeViaGodbolt(processedCode);
                const endTime = performance.now();
                const executionTime = (endTime - startTime).toFixed(2);
                
                // 実行結果の処理
                if (result.code === 0) {
                    // 正常終了
                    // stdoutの各要素からtextプロパティを抽出して結合
                    const outputText = result.stdout.map(item => typeof item === 'object' && item.text ? item.text : String(item)).join('\n') || '(出力なし)';
                    const finalResult = {
                        result: outputText,
                        exitCode: result.code,
                        executionTime: `${executionTime}ms`,
                        compilerOutput: result.buildResult ? result.buildResult.stderr.join('\n') : ''
                    };
                    
                    // UI更新用のコールバックを実行
                    if (typeof outputCallback === 'function') {
                        // 一度ステータス更新
                        outputCallback({
                            type: 'output',
                            content: outputText
                        });
                        
                        // 最終結果を送信
                        outputCallback({
                            type: 'result',
                            content: finalResult
                        });
                    }
                    
                    return finalResult;
                } else {
                    // エラー発生
                    const errorOutput = result.stderr.join('\n') || result.buildResult?.stderr.join('\n') || '不明なエラー';
                    
                    const errorResult = {
                        error: `C++の実行エラー: 終了コード ${result.code}`,
                        errorDetail: errorOutput,
                        executionTime: `${executionTime}ms`,
                        compilerOutput: result.buildResult ? result.buildResult.stderr.join('\n') : ''
                    };
                    
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'error',
                            content: errorResult
                        });
                    }
                    
                    return errorResult;
                }
            } catch (execError) {
                console.error('Godbolt APIでのC++実行中にエラーが発生しました:', execError);
                
                const errorResult = {
                    error: `C++の実行エラー: ${execError.message || '不明なエラー'}`,
                    errorDetail: execError.stack,
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
     * Godbolt APIを使用してC++コードを実行する
     * @private
     * @param {string} code - 実行するC++コード
     * @returns {Promise<Object>} APIレスポンス
     */
    async _executeViaGodbolt(code) {
        const url = 'https://godbolt.org/api/compiler/' + this.#compilerOptions.compiler + '/compile';
        
        const requestBody = {
            source: code,
            options: this.#compilerOptions.options,
            allowStoreCodeDebug: this.#compilerOptions.allowStoreCodeDebug
        };
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    /**
     * C++コードを前処理する
     * @private
     * @param {string} code - 元のC++コード
     * @returns {string} 前処理後のコード
     */
    _preprocessCPPCode(code) {
        // 不可視文字の除去と改行の統一
        let processedCode = code
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字の除去
            .replace(/\r\n/g, '\n')                // 改行コードの統一
            .trim();
        
        // コードにmain関数がない場合はmain関数を追加
        if (!processedCode.includes('int main(') && !processedCode.includes('int main (')) {
            // #includeがあれば、その後にmain関数を追加
            if (processedCode.includes('#include')) {
                const includeEndIndex = processedCode.lastIndexOf('#include');
                const lineEndIndex = processedCode.indexOf('\n', includeEndIndex);
                const insertIndex = lineEndIndex > 0 ? lineEndIndex + 1 : processedCode.length;
                
                const beforeMain = processedCode.substring(0, insertIndex);
                const afterMain = processedCode.substring(insertIndex);
                
                processedCode = beforeMain + '\n\nint main() {\n' + afterMain + '\n  return 0;\n}\n';
            } else {
                // #includeがなければ、標準ライブラリを追加してからmain関数を追加
                processedCode = '#include <iostream>\n\nint main() {\n' + processedCode + '\n  return 0;\n}\n';
            }
        }
        
        return processedCode;
    }
}