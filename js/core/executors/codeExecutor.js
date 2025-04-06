/**
 * codeExecutor.js
 * コードスニペット実行機能を提供します
 */
class CodeExecutor {
    static #instance = null;
    
    constructor() {
        if (CodeExecutor.#instance) {
            return CodeExecutor.#instance;
        }
        CodeExecutor.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!CodeExecutor.#instance) {
            CodeExecutor.#instance = new CodeExecutor();
        }
        return CodeExecutor.#instance;
    }

    /**
     * コードを実行する
     * @param {string} code - 実行するコード
     * @param {string} language - コードの言語
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} 実行結果
     */
    async executeCode(code, language, outputCallback) {
        if (!code || !language) {
            return { error: '実行するコードまたは言語が指定されていません' };
        }
        
        language = language.toLowerCase();
        
        try {
            // 言語に応じて適切な実行メソッドを呼び出す
            switch (language) {
                case 'javascript':
                case 'js':
                    return await JavaScriptExecutor.getInstance.execute(code, outputCallback);
                case 'html':
                    return await HTMLExecutor.getInstance.execute(code, outputCallback);
                case 'python':
                case 'py':
                    return await PythonExecutor.getInstance.execute(code, outputCallback);
                case 'cpp':
                case 'c++':
                    return await CPPExecutor.getInstance.execute(code, outputCallback);
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
    }

    /**
     * 実行結果の表示用HTML要素を生成する
     * @param {Object} executionResult - 実行結果オブジェクト
     * @returns {HTMLElement} 結果表示用のHTML要素
     */
    createResultElement(executionResult) {
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
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads';
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
}