/**
 * codeExecutor.js
 * コードスニペット実行機能を提供します
 */

window.CodeExecutor = {
    /**
     * コードを実行する
     * @param {string} code - 実行するコード
     * @param {string} language - コードの言語
     * @returns {Promise<Object>} 実行結果
     */
    executeCode: async function(code, language) {
        if (!code || !language) {
            return { error: '実行するコードまたは言語が指定されていません' };
        }
        
        language = language.toLowerCase();
        
        try {
            // 言語に応じて適切な実行メソッドを呼び出す
            switch (language) {
                case 'javascript':
                case 'js':
                    return this._executeJavaScript(code);
                case 'html':
                    return this._executeHtml(code);
                case 'python':
                case 'py':
                    return this._executePython(code);
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
     * @returns {Object} 実行結果
     */
    _executeJavaScript: function(code) {
        try {
            // 安全な実行環境を作成（サンドボックス）
            const sandbox = this._createSandbox();
            
            // コンソール出力をキャプチャ
            const consoleOutput = [];
            sandbox.console = {
                log: (...args) => {
                    consoleOutput.push(this._formatConsoleArgs(args, 'log'));
                },
                error: (...args) => {
                    consoleOutput.push(this._formatConsoleArgs(args, 'error'));
                },
                warn: (...args) => {
                    consoleOutput.push(this._formatConsoleArgs(args, 'warn'));
                },
                info: (...args) => {
                    consoleOutput.push(this._formatConsoleArgs(args, 'info'));
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
            
            return {
                result: this._formatOutput(result.result),
                consoleOutput: result.consoleOutput || [],
                executionTime: `${executionTime}ms`
            };
        } catch (error) {
            console.error('JavaScript実行中にエラーが発生しました:', error);
            return { 
                error: `JavaScriptの実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
            };
        }
    },
    
    /**
     * HTMLコードを実行する
     * @private
     * @param {string} code - 実行するHTMLコード
     * @returns {Object} 実行結果（iframeのHTMLとして表示される）
     */
    _executeHtml: function(code) {
        try {
            // HTMLをサニタイズ（危険なスクリプトを除去）
            const sanitizedHtml = this._sanitizeHtml(code);
            
            // HTML結果を返す（iframeで表示される）
            return {
                html: sanitizedHtml,
                type: 'html'
            };
        } catch (error) {
            console.error('HTML実行中にエラーが発生しました:', error);
            return { 
                error: `HTMLの実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
            };
        }
    },
    
    /**
     * Pythonコードを実行する (PyodideまたはSkulptを使用)
     * @private
     * @param {string} code - 実行するPythonコード
     * @returns {Promise<Object>} 実行結果
     */
    _executePython: async function(code) {
        try {
            // PyodideがCDNから読み込まれているか確認
            if (typeof loadPyodide === 'undefined') {
                // 初回実行時にPyodideを読み込む
                await this._loadPyodideRuntime();
            }
            
            // 出力をキャプチャするための準備
            let output = '';
            const originalConsoleLog = console.log;
            console.log = (msg) => {
                output += msg + '\n';
                originalConsoleLog.apply(console, arguments);
            };
            
            // 実行時間を計測
            const startTime = performance.now();
            
            // Pyodideインスタンスが存在するか確認
            if (!window.pyodideInstance) {
                window.pyodideInstance = await loadPyodide();
            }
            
            // Pythonコードを実行
            await window.pyodideInstance.runPythonAsync(`
import sys
from io import StringIO

# 標準出力をキャプチャ
sys.stdout = StringIO()
sys.stderr = StringIO()

try:
    ${code}
except Exception as e:
    print(f"エラー: {str(e)}")

stdout_content = sys.stdout.getvalue()
stderr_content = sys.stderr.getvalue()

# 標準出力を元に戻す
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__

print(stdout_content)
if stderr_content:
    print("エラー出力:")
    print(stderr_content)
`);

            // コンソール出力を元に戻す
            console.log = originalConsoleLog;
            
            // 実行時間を計算
            const endTime = performance.now();
            const executionTime = (endTime - startTime).toFixed(2);
            
            return {
                result: output,
                executionTime: `${executionTime}ms`
            };
        } catch (error) {
            console.error('Python実行中にエラーが発生しました:', error);
            return { 
                error: `Pythonの実行エラー: ${error.message || '不明なエラー'}`, 
                errorDetail: error.stack 
            };
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