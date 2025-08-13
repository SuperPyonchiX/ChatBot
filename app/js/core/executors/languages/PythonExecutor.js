/**
 * PythonExecutor.js
 * Pythonコードの実行を担当するクラス
 */
class PythonExecutor extends ExecutorBase {
    static #instance = null;
    
    constructor() {
        super();
        if (PythonExecutor.#instance) {
            return PythonExecutor.#instance;
        }
        PythonExecutor.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!PythonExecutor.#instance) {
            PythonExecutor.#instance = new PythonExecutor();
        }
        return PythonExecutor.#instance;
    }

    /**
     * Pythonコードを実行する
     * @param {string} code - 実行するPythonコード
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    async execute(code, outputCallback) {
        try {
            if (typeof loadPyodide === 'undefined') {
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'status',
                        content: 'Pythonランタイムを読み込んでいます...'
                    });
                }
                await this._loadRuntime();
            }
            
            let output = '';
            const originalConsoleLog = console.log;
            console.log = (msg) => {
                output += msg + '\n';
                originalConsoleLog.apply(console, arguments);
                
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'output',
                        content: msg + '\n'
                    });
                }
            };
            
            const startTime = performance.now();
            
            if (!window.pyodideInstance) {
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'status',
                        content: 'Pythonインタプリタを初期化しています...'
                    });
                }
                window.pyodideInstance = await loadPyodide();
            }
            
            const importMatches = code.matchAll(/^\s*import\s+([a-zA-Z0-9_]+)(?:\s*as\s+[a-zA-Z0-9_]+)?\s*$/gm);
            const fromImportMatches = code.matchAll(/^\s*from\s+([a-zA-Z0-9_]+)(?:\.[a-zA-Z0-9_]+)?\s+import/gm);
            
            const installablePackages = [
                'flask', 'django', 'numpy', 'pandas', 'matplotlib', 'scikit-learn', 
                'requests', 'beautifulsoup4', 'sqlalchemy', 'pillow', 'tensorflow'
            ];
            
            const modules = [];
            
            for (const match of importMatches) {
                if (match[1] && !['sys', 'io', 'json', 'os', 'time', 'random', 'math', 're'].includes(match[1])) {
                    modules.push(match[1]);
                }
            }
            
            for (const match of fromImportMatches) {
                if (match[1] && !['sys', 'io', 'json', 'os', 'time', 'random', 'math', 're'].includes(match[1])) {
                    modules.push(match[1]);
                }
            }
            
            if (modules.length > 0) {
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
            
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'status',
                    content: 'Pythonコードを実行しています...'
                });
            }
            
            const realtimeOutput = (text) => {
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'output',
                        content: text
                    });
                }
            };
            
            try {
                window.pyodideInstance.globals.set("realtimeOutput", realtimeOutput);
                
                const pythonCode = `
import sys
from io import StringIO

class RealtimeStringIO(StringIO):
    def write(self, text):
        realtimeOutput(text)
        return super().write(text)

sys.stdout = RealtimeStringIO()
sys.stderr = RealtimeStringIO()

try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"エラー: {str(e)}")
    import traceback
    traceback.print_exc()

stdout_content = sys.stdout.getvalue()
stderr_content = sys.stderr.getvalue()

sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__

if stderr_content:
    print("エラー出力:")
    print(stderr_content)
`;

                await window.pyodideInstance.runPythonAsync(pythonCode);
                
            } catch (pythonError) {
                console.error('Pythonスクリプト実行エラー:', pythonError);
                
                const errorMsg = `Pythonの実行に失敗しました: ${pythonError.message || '不明なエラー'}`;
                output += errorMsg + '\n';
                
                if (typeof outputCallback === 'function') {
                    outputCallback({
                        type: 'error',
                        content: errorMsg + '\n'
                    });
                }
            }

            console.log = originalConsoleLog;
            
            const endTime = performance.now();
            const executionTime = (endTime - startTime).toFixed(2);
            
            const finalResult = {
                result: output,
                executionTime: `${executionTime}ms`
            };
            
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
     * Pyodideランタイムを読み込む
     * @protected
     * @returns {Promise<void>}
     */
    _loadRuntime() {
        return new Promise((resolve, reject) => {
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
    }
}