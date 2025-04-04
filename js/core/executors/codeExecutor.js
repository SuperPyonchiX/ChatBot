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
            
            try {
                // evalを直接使わずに実行する安全な方法
                // JavaScriptコードを評価するために最も単純な方法を使用
                
                // 単純な即時実行関数パターンを使用
                let result;
                
                // sandboxをthisに設定して実行する関数を作成
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
                
                // サンドボックスのコンテキストで関数を実行
                execFunc.call(sandbox);
                
                // 実行時間を計算
                const endTime = performance.now();
                const executionTime = (endTime - startTime).toFixed(2);
                
                // 最終結果を整形
                const finalResult = {
                    consoleOutput: consoleOutput,
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
            } catch (evalError) {
                // エラーをコンソール出力に追加
                if (consoleOutput.length === 0 || !consoleOutput.some(output => output.type === 'error')) {
                    consoleOutput.push({
                        type: 'error',
                        content: `実行エラー: ${evalError.message}`
                    });
                }
                
                // 実行時間を計算
                const endTime = performance.now();
                const executionTime = (endTime - startTime).toFixed(2);
                
                // エラー結果を返す
                const errorResult = {
                    error: `JavaScriptの実行エラー: ${evalError.message}`,
                    errorDetail: evalError.stack,
                    consoleOutput: consoleOutput,
                    executionTime: `${executionTime}ms`
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
            // ステータス通知を出す
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'HTMLを処理しています...'
                });
            }

            // HTMLが不完全な場合は補完する（<html>, <head>, <body>タグがない場合）
            let sanitizedHtml = code.trim();
            
            // HTMLテンプレートを用意
            if (!sanitizedHtml.match(/<html[\s>]/i)) {
                // HTML文書構造を持たない場合、適切なHTML構造を持つように補完
                const hasDoctype = sanitizedHtml.match(/<!DOCTYPE\s+html>/i);
                const hasHead = sanitizedHtml.match(/<head[\s>]/i);
                const hasBody = sanitizedHtml.match(/<body[\s>]/i);
                
                let resultHtml = '';
                
                if (!hasDoctype) {
                    resultHtml += '<!DOCTYPE html>\n';
                }
                
                if (!sanitizedHtml.match(/<html[\s>]/i)) {
                    resultHtml += '<html>\n';
                    
                    if (!hasHead) {
                        resultHtml += '<head>\n';
                        resultHtml += '  <meta charset="UTF-8">\n';
                        resultHtml += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
                        resultHtml += '  <title>HTML実行結果</title>\n';
                        resultHtml += '</head>\n';
                    }
                    
                    if (!hasBody) {
                        resultHtml += '<body>\n';
                        resultHtml += sanitizedHtml;
                        resultHtml += '\n</body>\n';
                    } else {
                        resultHtml += sanitizedHtml;
                    }
                    
                    resultHtml += '</html>';
                } else {
                    resultHtml = sanitizedHtml;
                }
                
                sanitizedHtml = resultHtml;
            }
            
            // HTMLをサニタイズ（危険なスクリプトを除去）
            sanitizedHtml = this._sanitizeHtml(sanitizedHtml);
            
            // 結果オブジェクトを作成
            const result = {
                html: sanitizedHtml,
                type: 'html',
                executionTime: '0ms' // HTML実行の場合は実行時間は常に0
            };
            
            // 結果をコールバックに渡す
            if (typeof outputCallback === 'function') {
                // 実行結果をコールバックで送信
                outputCallback({
                    type: 'result',
                    content: result
                });
            }
            
            // HTML結果を返す
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
                // JSCPPが読み込まれていない場合は読み込む
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'status',
                        content: 'C++ランタイム(JSCPP)を読み込んでいます...'
                    });
                }
                
                // _loadJSCPPRuntimeを呼び出してJSCPPを読み込む
                try {
                    await this._loadJSCPPRuntime();
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
            
            // 出力をキャプチャするための準備
            let outputText = '';
            
            // 実行時間を計測
            const startTime = performance.now();
            
            // 入力コードを前処理して、JSCPPが処理しやすい形式に変換
            let preprocessedCode = this._preprocessCPPCode(code);
            
            // // 処理前後のコードをデバッグ表示（開発中のみ）
            // console.log("元のコード:", code);
            // console.log("前処理後のコード:", preprocessedCode);
            
            // ステータス通知
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'C++コードを実行しています...'
                });
            }
            
            // 標準入出力設定 - JSCPPの公式サンプルに基づく正しい実装
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
                },
                // オプション設定
                unsigned_overflow: "warn" // "error"(デフォルト), "warn", "ignore"のいずれか
            };
            
            try {
                // JSCPPを使用してコードを実行 (C++の標準入力は空文字列で初期化)
                const exitCode = JSCPP.run(preprocessedCode, "", config);
                
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
                console.error('C++実行中にエラーが発生しました:', runtimeError);
                
                // エラー結果を返す
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
            // すでに読み込まれているかチェック
            if (typeof JSCPP !== 'undefined') {
                console.log('JSCPPはすでに読み込まれています');
                resolve();
                return;
            }

            try {
                // ローカルのJSCPPスクリプトを読み込む
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
    },
    
    /**
     * C++コードをJSCPPで実行できるように前処理する
     * @private
     * @param {string} code - 元のC++コード
     * @returns {string} 前処理後のコード
     */
    _preprocessCPPCode: function(code) {
        // 基本的なコード正規化
        let processedCode = code
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅スペースなどの非表示文字を削除
            .replace(/\r\n/g, '\n')  // CRLF → LF
            .replace(/[^\x00-\x7F]/g, '') // ASCII以外の文字を削除
            .trim(); // 前後の空白を削除
        
        // using namespace std; がない場合は追加
        if (!processedCode.includes('using namespace std;')) {
            // #includeの後に追加
            processedCode = processedCode.replace(
                /(#include\s*<[^>]+>)/,
                '$1\nusing namespace std;'
            );
        }
        
        // std::を削除
        processedCode = processedCode.replace(/std::/g, '');
        
        return processedCode;
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
            
            // 出力の最後に改行を追加
            return { type, content: formatted + '\n' };
        } catch (error) {
            console.error('コンソール出力のフォーマット中にエラーが発生しました:', error);
            return { type, content: '[出力フォーマットエラー]\n' };
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
            // セキュリティ上の一般的な対策を維持しつつ、インタラクティブなコードを許可
            const sanitized = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (match) => {
                    // スクリプトタグは維持するが、src属性が外部を参照している場合は削除
                    if (match.match(/src\s*=\s*["']https?:\/\//i)) {
                        return '<!-- 外部スクリプトは安全のため削除されました -->';
                    }
                    return match; // ローカルスクリプトは許可
                });
            
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
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads'; // スクリプト実行と他の必要な機能を許可
            iframe.style.width = '100%';
            iframe.style.minHeight = '300px';
            iframe.style.border = '1px solid #ddd';
            iframe.style.borderRadius = '4px';
            resultContainer.appendChild(iframe);
            
            // iframeのコンテンツを設定
            setTimeout(() => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    doc.open();
                    doc.write(executionResult.html);
                    doc.close();
                    
                    // iframeの高さを調整
                    iframe.onload = function() {
                        try {
                            const height = Math.max(300, doc.body.scrollHeight + 30);
                            iframe.style.height = `${height}px`;
                            
                            // コンテンツの変更を監視して高さを再調整
                            const resizeObserver = new ResizeObserver(() => {
                                const newHeight = Math.max(300, doc.body.scrollHeight + 30);
                                iframe.style.height = `${newHeight}px`;
                            });
                            
                            if (doc.body) {
                                resizeObserver.observe(doc.body);
                            }
                        } catch (e) {
                            console.error('iframe高さ調整エラー:', e);
                        }
                    };
                    
                    // すぐに高さを調整してみる
                    const height = Math.max(300, doc.body.scrollHeight + 30);
                    iframe.style.height = `${height}px`;
                    
                } catch (error) {
                    console.error('iframeへのHTML読み込み中にエラーが発生しました:', error);
                    const errorElement = document.createElement('p');
                    errorElement.textContent = 'HTMLの表示に失敗しました: ' + error.message;
                    errorElement.style.color = 'red';
                    resultContainer.appendChild(errorElement);
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