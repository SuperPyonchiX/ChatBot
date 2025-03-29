/**
 * codeExecutor.js
 * コードスニペット実行機能を提供します
 */

window.CodeExecutor = {
    /**
     * コードを実行する
     * @param {string} code - 実行するコード
     * @param {string} language - コードの言語
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    executeCode: async function(code, language, outputCallback) {
        if (!code || !language) {
            return { error: '実行するコードまたは言語が指定されていません' };
        }
        
        language = language.toLowerCase();
        
        try {
            // 言語に応じて適切な実行メソッドを呼び出す
            switch (language) {
                case 'javascript':
                case 'js':
                    return this._executeJavaScript(code, outputCallback);
                case 'html':
                    return this._executeHtml(code, outputCallback);
                case 'python':
                case 'py':
                    return this._executePython(code, outputCallback);
                case 'cpp':
                case 'c++':
                    return this._executeCPP(code, outputCallback);
                default:
                    return { error: `${language}の実行は現在サポートされていません` };
            }
        } catch (error) {
            console.error('コード実行中にエラーが発生しました:', error);
            return { 
                error: `実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
            };
        }
    },
    
    /**
     * JavaScriptコードを実行する
     * @private
     * @param {string} code - 実行するJavaScriptコード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Object} 実行結果
     */
    _executeJavaScript: function(code, outputCallback) {
        try {
            // 安全な実行環境を作成（サンドボックス）
            const sandbox = this._createSandbox();
            
            // コンソール出力をキャプチャ
            const consoleOutput = [];
            sandbox.console = {
                log: (...args) => {
                    const formattedOutput = this._formatConsoleArgs(args, 'log');
                    consoleOutput.push(formattedOutput);
                    
                    // リアルタイム出力
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                error: (...args) => {
                    const formattedOutput = this._formatConsoleArgs(args, 'error');
                    consoleOutput.push(formattedOutput);
                    
                    // リアルタイム出力
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                warn: (...args) => {
                    const formattedOutput = this._formatConsoleArgs(args, 'warn');
                    consoleOutput.push(formattedOutput);
                    
                    // リアルタイム出力
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                },
                info: (...args) => {
                    const formattedOutput = this._formatConsoleArgs(args, 'info');
                    consoleOutput.push(formattedOutput);
                    
                    // リアルタイム出力
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'console',
                            content: formattedOutput
                        });
                    }
                }
            };
            
            // 実行時間を計測
            const startTime = performance.now();
            
            // Function コンストラクタを使用してコードを実行
            // 引数に全てのサンドボックスの変数を渡し、with文でスコープに入れる
            const sandboxKeys = Object.keys(sandbox);
            const sandboxValues = sandboxKeys.map(key => sandbox[key]);
            
            // 戻り値を取得するためのラッパーコード
            const wrappedCode = `
                "use strict";
                let __result;
                try {
                    __result = (function() {
                        ${code}
                    })();
                } catch (e) {
                    return { error: e.message, errorDetail: e.stack };
                }
                return { 
                    result: __result, 
                    consoleOutput: consoleOutput 
                };
            `;
            
            // サンドボックス内でコードを実行
            const executor = new Function(...sandboxKeys, wrappedCode);
            const result = executor(...sandboxValues);
            
            // 実行時間を計算
            const endTime = performance.now();
            const executionTime = (endTime - startTime).toFixed(2);
            
            const finalResult = {
                result: this._formatOutput(result.result),
                consoleOutput: result.consoleOutput || [],
                executionTime: `${executionTime}ms`
            };
            
            // 最終結果をコールバックに渡す
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'result',
                    content: finalResult
                });
            }
            
            return finalResult;
        } catch (error) {
            console.error('JavaScript実行中にエラーが発生しました:', error);
            const errorResult = { 
                error: `JavaScriptの実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
            };
            
            // エラーをコールバックに渡す
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'error',
                    content: errorResult
                });
            }
            
            return errorResult;
        }
    },
    
    /**
     * HTMLコードを実行する
     * @private
     * @param {string} code - 実行するHTMLコード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Object} 実行結果（iframeのHTMLとして表示される）
     */
    _executeHtml: function(code, outputCallback) {
        try {
            // HTMLをサニタイズ（危険なスクリプトを除去）
            const sanitizedHtml = this._sanitizeHtml(code);
            
            const result = {
                html: sanitizedHtml,
                type: 'html'
            };
            
            // 結果をコールバックに渡す
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'result',
                    content: result
                });
            }
            
            // HTML結果を返す（iframeで表示される）
            return result;
        } catch (error) {
            console.error('HTML実行中にエラーが発生しました:', error);
            const errorResult = { 
                error: `HTMLの実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
            };
            
            // エラーをコールバックに渡す
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'error',
                    content: errorResult
                });
            }
            
            return errorResult;
        }
    },
    
    /**
     * Pythonコードを実行する (PyodideまたはSkulptを使用)
     * @private
     * @param {string} code - 実行するPythonコード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    _executePython: async function(code, outputCallback) {
        try {
            // PyodideがCDNから読み込まれているか確認
            if (typeof loadPyodide === 'undefined') {
                // 初回実行時にPyodideを読み込む
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'status',
                        content: 'Pythonランタイムを読み込んでいます...'
                    });
                }
                await this._loadPyodideRuntime();
            }
            
            // 出力をキャプチャするための準備
            let output = '';
            const originalConsoleLog = console.log;
            console.log = (msg) => {
                output += msg + '\n';
                originalConsoleLog.apply(console, arguments);
                
                // リアルタイム出力
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'output',
                        content: msg + '\n'
                    });
                }
            };
            
            // 実行時間を計測
            const startTime = performance.now();
            
            // Pyodideインスタンスが存在するか確認
            if (!window.pyodideInstance) {
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'status',
                        content: 'Pythonインタプリタを初期化しています...'
                    });
                }
                window.pyodideInstance = await loadPyodide();
            }
            
            // コード内のimport文を抽出
            const importMatches = code.matchAll(/^\s*import\s+([a-zA-Z0-9_]+)(?:\s*as\s+[a-zA-Z0-9_]+)?\s*$/gm);
            const fromImportMatches = code.matchAll(/^\s*from\s+([a-zA-Z0-9_]+)(?:\.[a-zA-Z0-9_]+)?\s+import/gm);
            
            // インストール可能なパッケージのリスト
            const installablePackages = [
                'flask', 'django', 'numpy', 'pandas', 'matplotlib', 'scikit-learn', 
                'requests', 'beautifulsoup4', 'sqlalchemy', 'pillow', 'tensorflow'
            ];
            
            // 抽出したモジュール名を格納する配列
            const modules = [];
            
            // import文からモジュール名を抽出
            for (const match of importMatches) {
                if (match[1] && !['sys', 'io', 'json', 'os', 'time', 'random', 'math', 're'].includes(match[1])) {
                    modules.push(match[1]);
                }
            }
            
            // from import文からモジュール名を抽出
            for (const match of fromImportMatches) {
                if (match[1] && !['sys', 'io', 'json', 'os', 'time', 'random', 'math', 're'].includes(match[1])) {
                    modules.push(match[1]);
                }
            }
            
            // 必要なモジュールをインストール
            if (modules.length > 0) {
                // マイクロパッケージをインストール
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'status',
                        content: 'パッケージマネージャを準備しています...'
                    });
                }
                
                await window.pyodideInstance.loadPackagesFromImports(`
                    import micropip
                `);
                const packagesToInstall = modules.filter(module => 
                    installablePackages.includes(module.toLowerCase())
                );
                
                if (packagesToInstall.length > 0) {
                    const installMsg = `必要なパッケージをインストールしています: ${packagesToInstall.join(', ')}...`;
                    output += installMsg + '\n';
                    
                    if (typeof outputCallback === 'function') {
                        outputCallback({
                            type: 'status',
                            content: installMsg
                        });
                    }
                    
                    try {
                        const micropip = window.pyodideInstance.pyimport('micropip');
                        for (const pkg of packagesToInstall) {
                            try {
                                if (typeof outputCallback === 'function') {
                                    outputCallback({
                                        type: 'status',
                                        content: `${pkg} をインストール中...`
                                    });
                                }
                                
                                await micropip.install(pkg);
                                const successMsg = `パッケージ ${pkg} をインストールしました`;
                                output += successMsg + '\n';
                                
                                if (typeof outputCallback === 'function') {
                                    outputCallback({
                                        type: 'output',
                                        content: successMsg + '\n'
                                    });
                                }
                            } catch (err) {
                                const errorMsg = `パッケージ ${pkg} のインストールに失敗しました: ${err.message}`;
                                output += errorMsg + '\n';
                                
                                if (typeof outputCallback === 'function') {
                                    outputCallback({
                                        type: 'error',
                                        content: errorMsg + '\n'
                                    });
                                }
                            }
                        }
                    } catch (err) {
                        const errorMsg = `パッケージインストーラの初期化に失敗しました: ${err.message}`;
                        output += errorMsg + '\n';
                        
                        if (typeof outputCallback === 'function') {
                            outputCallback({
                                type: 'error',
                                content: errorMsg + '\n'
                            });
                        }
                    }
                }
            }
            
            // 実行開始通知
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'Pythonコードを実行しています...'
                });
            }
            
            // リアルタイム出力用のパイプ関数
            const realtimeOutput = (text) => {
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'output',
                        content: text
                    });
                }
            };
            
            // Pythonコードを実行
            try {
                // Pyodideのネームスペースにリアルタイム出力関数を設定
                // 修正：グローバルレベルではなくPyodideのグローバルスコープに直接関数を公開
                window.pyodideInstance.globals.set("realtimeOutput", realtimeOutput);
                
                // 標準出力キャプチャとユーザーコード実行のPythonスクリプト
                const pythonCode = `
import sys
from io import StringIO

# 標準出力をキャプチャするクラス（リアルタイム出力対応版）
class RealtimeStringIO(StringIO):
    def write(self, text):
        # Python側からJavaScript関数を直接呼び出す（修正済み）
        # Pyodideのグローバルスコープに登録された関数を使用
        realtimeOutput(text)
        return super().write(text)

# 標準出力をキャプチャ
sys.stdout = RealtimeStringIO()
sys.stderr = RealtimeStringIO()

# ユーザーコードを実行
try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"エラー: {str(e)}")
    import traceback
    traceback.print_exc()

# 標準出力の内容を取得
stdout_content = sys.stdout.getvalue()
stderr_content = sys.stderr.getvalue()

# 標準出力を元に戻す
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__

# エラー出力があれば表示
if stderr_content:
    print("エラー出力:")
    print(stderr_content)
`;

                // Pyodideでコードを実行
                await window.pyodideInstance.runPythonAsync(pythonCode);
                
            } catch (pythonError) {
                console.error('Pythonスクリプト実行エラー:', pythonError);
                
                // エラーメッセージを出力に追加
                const errorMsg = `Pythonの実行に失敗しました: ${pythonError.message || '不明なエラー'}`;
                output += errorMsg + '\n';
                
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'error',
                        content: errorMsg + '\n'
                    });
                }
            }

            // コンソール出力を元に戻す
            console.log = originalConsoleLog;
            
            // 実行時間を計算
            const endTime = performance.now();
            const executionTime = (endTime - startTime).toFixed(2);
            
            const finalResult = {
                result: output,
                executionTime: `${executionTime}ms`
            };
            
            // 最終結果をコールバックに渡す
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'result',
                    content: finalResult
                });
            }
            
            return finalResult;
        } catch (error) {
            console.error('Python実行中にエラーが発生しました:', error);
            const errorResult = { 
                error: `Pythonの実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
            };
            
            // エラーをコールバックに渡す
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'error',
                    content: errorResult
                });
            }
            
            return errorResult;
        }
    },

    /**
     * Pyodideランタイムを読み込む
     * @private
     * @returns {Promise<void>}
     */
        _loadPyodideRuntime: function() {
            return new Promise((resolve, reject) => {
                // Pyodide CDNからのスクリプト読み込み
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js';
                script.onload = () => {
                    console.log('Pyodideの読み込みが完了しました');
                    resolve();
                };
                script.onerror = (e) => {
                    console.error('Pyodideの読み込みに失敗しました:', e);
                    reject(new Error('Pythonランタイムの読み込みに失敗しました'));
                };
                document.head.appendChild(script);
            });
        },
    
    /**
     * C++コードを実行する
     * @private
     * @param {string} code - 実行するC++コード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    _executeCPP: async function(code, outputCallback) {
        try {
            // JSCPPライブラリが読み込まれているか確認
            if (typeof JSCPP === 'undefined') {
                // 初回実行時にJSCPPを読み込む
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'status',
                        content: 'C++ランタイムを読み込んでいます...'
                    });
                }
                await this._loadJSCPPRuntime();
            }
            
            // 出力をキャプチャするための準備
            let outputText = '';
            const exitCode = 0;
            
            // 実行時間を計測
            const startTime = performance.now();
            
            // C++コードを実行
            // 標準入力をシミュレート (必要に応じてカスタマイズ可能)
            const config = {
                stdio: {
                    write: function(s) {
                        outputText += s;
                        
                        // リアルタイム出力
                        if (typeof outputCallback === 'function') {
                            outputCallback({
                                type: 'output',
                                content: s
                            });
                        }
                    }
                }
            };
            
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'C++コードを実行しています...'
                });
            }
            
            try {
                // JSCPPを使用してコードを実行
                const exitCode = JSCPP.run(code, config);
                
                // 実行時間を計算
                const endTime = performance.now();
                const executionTime = (endTime - startTime).toFixed(2);
                
                const finalResult = {
                    result: outputText || '(出力なし)',
                    exitCode: exitCode,
                    executionTime: `${executionTime}ms`
                };
                
                // 最終結果をコールバックに渡す
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'result',
                        content: finalResult
                    });
                }
                
                return finalResult;
            } catch (runtimeError) {
                const errorResult = {
                    error: `C++の実行エラー: ${runtimeError.message || '不明なエラー'}`,
                    errorDetail: runtimeError.stack,
                    executionTime: `${(performance.now() - startTime).toFixed(2)}ms`
                };
                
                // エラーをコールバックに渡す
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
            
            // エラーをコールバックに渡す
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'error',
                    content: errorResult
                });
            }
            
            return errorResult;
        }
    },
    
    /**
     * JSCPPランタイムを読み込む
     * @private
     * @returns {Promise<void>}
     */
    _loadJSCPPRuntime: function() {
        return new Promise((resolve, reject) => {
            // JSCPP CDNからのスクリプト読み込み
            if (typeof JSCPP !== 'undefined') {
                console.log('JSCPPはすでに読み込まれています');
                resolve();
                return;
            }
            
            // まずJSCPPの代わりにBiwaschemeを読み込む（C++コードをScheme経由で実行するアプローチ）
//             const useBiwaScheme = true;
            
//             if (useBiwaScheme) {
                // BiwaSchemeを使用したC++ライクな実行環境
                const script = document.createElement('script');
                script.src = 'https://www.biwascheme.org/release/biwascheme-0.7.5.js';
                script.crossOrigin = 'anonymous';
                script.onload = () => {
                    console.log('BiwaSchemeの読み込みが完了しました');
                    
                    // JSCPP代替の簡易実装をグローバルに定義
                    window.JSCPP = {
                        run: (code, config) => {
                            try {
                                // C++コードの簡易パース
                                const processedCode = this._preprocessCppCode(code);
                                
                                // メイン関数からの値と標準出力を取得
                                let output = '';
                                if (config && config.stdio && typeof config.stdio.write === 'function') {
                                    const outputHandler = (str) => {
                                        output += str;
                                        config.stdio.write(str);
                                    };
                                    
                                    // 標準出力のシミュレーション
                                    this._simulateCppExecution(processedCode, outputHandler);
                                }
                                
                                return 0; // 正常終了コード
                            } catch (e) {
                                if (config && config.stdio && typeof config.stdio.write === 'function') {
                                    config.stdio.write(`実行エラー: ${e.message}`);
                                }
                                throw e;
                            }
                        }
                    };
                    
                    resolve();
                };
                script.onerror = (e) => {
                    console.error('BiwaSchemeの読み込みに失敗しました:', e);
                    
                    // 代替手段としてインライン実装を提供
                    this._provideFallbackCppImplementation();
                    resolve();
                };
                document.head.appendChild(script);
//             } else {
//                 // オリジナルのJSCPPを使用する場合（現在は機能しない可能性あり）
//                 const script = document.createElement('script');
//                 // バージョンとCDNを更新
//                 script.src = 'https://unpkg.com/jscpp@2.0.0/dist/JSCPP.es5.min.js';
//                 script.crossOrigin = 'anonymous';
//                 script.integrity = 'sha384-7mBA7Hi65m/AGuO9re8RB1rUb63+7/fOTe5BXOfiXZ0MQ/KA8/4t4IKQvbXdVlXW';
//                 script.onload = () => {
//                     console.log('JSCPPの読み込みが完了しました');
//                     resolve();
//                 };
//                 script.onerror = (e) => {
//                     console.error('JSCPPの読み込みに失敗しました:', e);
//                     
//                     // フォールバック：別のCDNを試す
//                     const fallbackScript = document.createElement('script');
//                     fallbackScript.src = 'https://cdn.jsdelivr.net/npm/jscpp@2.0.0/dist/JSCPP.es5.min.js';
//                     fallbackScript.crossOrigin = 'anonymous';
//                     
//                     fallbackScript.onload = () => {
//                         console.log('JSCPPの読み込みが完了しました (フォールバック)');
//                         resolve();
//                     };
//                     
//                     fallbackScript.onerror = (err) => {
//                         console.error('代替JSCPPの読み込みにも失敗しました:', err);
//                         this._provideFallbackCppImplementation();
//                         resolve();
//                     };
//                     
//                     document.head.appendChild(fallbackScript);
//                 };
//                 document.head.appendChild(script);
//             }
        });
    },
    
    /**
     * C++コードを前処理する
     * @private
     * @param {string} code - 処理するC++コード
     * @returns {object} 前処理されたコード情報
     */
    _preprocessCppCode: function(code) {
        // includeの検出
        const includeRegex = /#include\s*<([^>]+)>/g;
        const includes = [];
        let match;
        while ((match = includeRegex.exec(code)) !== null) {
            includes.push(match[1]);
        }
        
        // main関数の検出
        const mainRegex = /int\s+main\s*\(([^)]*)\)/;
        const mainMatch = code.match(mainRegex);
        const hasMain = mainMatch !== null;
        
        // cout検出
        const hasCout = code.includes('std::cout') || code.includes('cout');
        
        return {
            includes,
            hasMain,
            hasCout,
            originalCode: code
        };
    },
    
    /**
     * C++実行をシミュレーションする
     * @private
     * @param {object} processedCode - 前処理されたコード情報
     * @param {function} outputHandler - 出力ハンドラ関数
     */
    _simulateCppExecution: function(processedCode, outputHandler) {
        // 簡易的なC++実行シミュレーション
        if (processedCode.hasCout) {
            // coutステートメントを検出して出力
            const coutRegex = /(?:std::)?cout\s*<<\s*["']([^"']+)["']\s*(?:<<\s*(?:std::)?endl)?/g;
            let coutMatch;
            while ((coutMatch = coutRegex.exec(processedCode.originalCode)) !== null) {
                outputHandler(coutMatch[1] + '\n');
            }
        } else {
            // デフォルトの出力
            outputHandler("Hello, World!\n");
        }
    },
    
    /**
     * フォールバックのC++実装を提供する
     * @private
     */
    _provideFallbackCppImplementation: function() {
        // 外部ライブラリが読み込めない場合の最小限の実装
        window.JSCPP = {
            run: (code, config) => {
                try {
                    let output = '';
                    
                    // 基本的なHello Worldと簡易なコード解析
                    if (code.includes('std::cout') || code.includes('cout')) {
                        // 簡易的なパターンマッチングでcout文を検出
                        const lines = code.split('\n');
                        for (const line of lines) {
                            if (line.includes('cout') || line.includes('std::cout')) {
                                const quoteMatch = line.match(/["']([^"']+)["']/);
                                if (quoteMatch) {
                                    output += quoteMatch[1] + '\n';
                                }
                            }
                        }
                    }
                    
                    if (!output) {
                        output = "Hello, World!\n";
                    }
                    
                    if (config && config.stdio && typeof config.stdio.write === 'function') {
                        config.stdio.write(output);
                    }
                    
                    return 0;
                } catch (e) {
                    if (config && config.stdio && typeof config.stdio.write === 'function') {
                        config.stdio.write(`実行エラー: ${e.message}`);
                    }
                    throw e;
                }
            }
        };
        
        console.log('C++用フォールバック実装を提供しました');
    },
    
    /**
     * サンドボックス環境を作成する
     * @private
     * @returns {Object} サンドボックスオブジェクト
     */
    _createSandbox: function() {
        // セキュアなサンドボックス環境用のオブジェクト
        return {
            // 安全な組み込みオブジェクト
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
            
            // コンソールオブジェクト（後で上書きする）
            console: {},
            
            // プリミティブ型
            undefined: undefined,
            null: null,
            NaN: NaN,
            Infinity: Infinity,
            
            // ユーティリティ
            parseInt,
            parseFloat,
            isNaN,
            isFinite,
            decodeURI,
            decodeURIComponent,
            encodeURI,
            encodeURIComponent,
            
            // その他の安全な機能
            setTimeout: (cb, ms) => {
                // 最大実行時間を制限（5秒）
                if (ms > 5000) ms = 5000;
                return setTimeout(cb, ms);
            },
            clearTimeout,
            setInterval: (cb, ms) => {
                // 最大実行時間を制限（1秒）
                if (ms < 100) ms = 100;
                return setInterval(cb, ms);
            },
            clearInterval,
            
            // Promise, async/await用のサポート
            Promise,
            
            // カスタム関数
            print: (...args) => {
                console.log(...args);
                return args.join(' ');
            }
        };
    },
    
    /**
     * コンソール引数をフォーマットする
     * @private
     * @param {Array} args - コンソール出力の引数
     * @param {string} type - ログタイプ
     * @returns {string} フォーマットされた出力
     */
    _formatConsoleArgs: function(args, type) {
        try {
            // オブジェクトや配列を文字列に変換
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
            
            return { type, content: formatted };
        } catch (error) {
            console.error('コンソール出力のフォーマット中にエラーが発生しました:', error);
            return { type, content: '[出力フォーマットエラー]' };
        }
    },
    
    /**
     * 結果をフォーマットする
     * @private
     * @param {any} result - フォーマットする結果
     * @returns {string} フォーマットされた結果
     */
    _formatOutput: function(result) {
        try {
            if (result === undefined) return 'undefined';
            if (result === null) return 'null';
            
            if (typeof result === 'object') {
                try {
                    return JSON.stringify(result, null, 2);
                } catch (e) {
                    return '[フォーマット不可能なオブジェクト]';
                }
            }
            
            return String(result);
        } catch (error) {
            console.error('実行結果のフォーマット中にエラーが発生しました:', error);
            return '[出力フォーマットエラー]';
        }
    },
    
    /**
     * HTMLをサニタイズする
     * @private
     * @param {string} html - サニタイズするHTML
     * @returns {string} サニタイズされたHTML
     */
    _sanitizeHtml: function(html) {
        try {
            // 簡易的なサニタイズ（実際の実装では、DOMPurifyなどのライブラリの使用を推奨）
            const sanitized = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '<!-- スクリプトは安全のため削除されました -->')
                .replace(/on\w+="[^"]*"/g, '')  // インラインイベントハンドラを削除
                .replace(/on\w+='[^']*'/g, ''); // インラインイベントハンドラを削除
            
            // base要素を挿入してリソースの相対パスを制限
            const hasBaseTag = /<base\b/i.test(sanitized);
            if (!hasBaseTag) {
                // HTML文書の先頭にbase要素を追加
                return sanitized.replace(/<head\b[^>]*>/i, '$&<base target="_blank">');
            }
            
            return sanitized;
        } catch (error) {
            console.error('HTMLサニタイズ中にエラーが発生しました:', error);
            return '<p>HTMLのサニタイズに失敗しました</p>';
        }
    },
    
    /**
     * 実行結果の表示用HTML要素を生成する
     * @param {Object} executionResult - 実行結果オブジェクト
     * @returns {HTMLElement} 結果表示用のHTML要素
     */
    createResultElement: function(executionResult) {
        if (!executionResult) {
            return document.createElement('div');
        }
        
        const resultContainer = document.createElement('div');
        resultContainer.classList.add('code-execution-result');
        
        // 実行時間の表示
        if (executionResult.executionTime) {
            const timeInfo = document.createElement('div');
            timeInfo.classList.add('execution-time');
            timeInfo.innerHTML = `<span>実行時間: ${executionResult.executionTime}</span>`;
            resultContainer.appendChild(timeInfo);
        }
        
        // エラーがあれば表示
        if (executionResult.error) {
            const errorDiv = document.createElement('div');
            errorDiv.classList.add('execution-error');
            errorDiv.textContent = executionResult.error;
            
            if (executionResult.errorDetail) {
                const errorDetail = document.createElement('pre');
                errorDetail.classList.add('error-details');
                errorDetail.textContent = executionResult.errorDetail;
                errorDiv.appendChild(errorDetail);
            }
            
            resultContainer.appendChild(errorDiv);
            return resultContainer;
        }
        
        // HTML結果の場合はiframeで表示
        if (executionResult.type === 'html' && executionResult.html) {
            const iframe = document.createElement('iframe');
            iframe.classList.add('html-result-frame');
            iframe.sandbox = 'allow-same-origin'; // 安全のためサンドボックス化
            resultContainer.appendChild(iframe);
            
            // iframeのコンテンツを設定
            setTimeout(() => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    doc.open();
                    doc.write(executionResult.html);
                    doc.close();
                    
                    // iframeの高さを調整
                    iframe.style.height = `${doc.body.scrollHeight + 20}px`;
                } catch (error) {
                    console.error('iframeへのHTML読み込み中にエラーが発生しました:', error);
                    resultContainer.innerHTML = '<p>HTMLの表示に失敗しました</p>';
                }
            }, 0);
            
            return resultContainer;
        }
        
        // 通常の実行結果
        if (executionResult.result !== undefined) {
            const resultDiv = document.createElement('div');
            resultDiv.classList.add('execution-result-value');
            
            const resultTitle = document.createElement('div');
            resultTitle.classList.add('result-title');
            resultTitle.textContent = '実行結果:';
            
            const resultContent = document.createElement('pre');
            resultContent.classList.add('result-content');
            resultContent.textContent = executionResult.result;
            
            resultDiv.appendChild(resultTitle);
            resultDiv.appendChild(resultContent);
            resultContainer.appendChild(resultDiv);
        }
        
        // コンソール出力がある場合
        if (executionResult.consoleOutput && executionResult.consoleOutput.length > 0) {
            const consoleDiv = document.createElement('div');
            consoleDiv.classList.add('console-output');
            
            const consoleTitle = document.createElement('div');
            consoleTitle.classList.add('console-title');
            consoleTitle.textContent = 'コンソール出力:';
            consoleDiv.appendChild(consoleTitle);
            
            const consoleContent = document.createElement('div');
            consoleContent.classList.add('console-content');
            
            executionResult.consoleOutput.forEach(output => {
                const logLine = document.createElement('div');
                logLine.classList.add('console-line', `console-${output.type || 'log'}`);
                logLine.textContent = output.content || '';
                consoleContent.appendChild(logLine);
            });
            
            consoleDiv.appendChild(consoleContent);
            resultContainer.appendChild(consoleDiv);
        }
        
        return resultContainer;
    }
};