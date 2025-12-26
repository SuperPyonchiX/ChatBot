/**
 * codeExecutor.js
 * コードスニペット実行機能を提供します
 */
class CodeExecutor {
    static #instance = null;
    
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
     * コンストラクタ - privateなので直接newはできません
     * @throws {Error} 直接インスタンス化できないエラー
     */
    constructor() {
        if (CodeExecutor.#instance) {
            return CodeExecutor.#instance;
        }
        CodeExecutor.#instance = this;
    }

    /**
     * コードを実行する
     * @param {string} code - 実行するコード
     * @param {string} language - コードの言語
     * @param {HTMLElement} resultElement - 実行結果を表示する要素
     * @returns {Promise<Object>} 実行結果
     */
    async executeCode(code, language, resultElement) {
        if (!code || !language || !resultElement) {
            return { error: '実行するコードまたは言語、または表示要素が指定されていません' };
        }
        
        language = language.toLowerCase();
        
        try {
            // デフォルトのコールバック関数を定義
            const outputCallback = (data) => this.#handleOutput(data, language, resultElement);
            
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
     * 実行結果の出力を処理する
     * @param {Object} data - 出力データ
     * @param {HTMLElement} resultElement - 表示要素
     */
    #handleOutput(data, language, resultElement) {
        if (!data || !resultElement) return;

        const statusElement = resultElement.querySelector('.execution-status');
        const outputElement = resultElement.querySelector('.realtime-output');
        const htmlContainer = resultElement.querySelector('.html-result-container');

        if (!statusElement) return;

        switch (data.type) {
            case 'status':
                statusElement.textContent = data.content;
                break;

            case 'output':
            case 'console':
                if (outputElement) {
                    const contentSpan = document.createElement('span');
                    if (data.content && data.content.type) {
                        contentSpan.classList.add(`console-${data.content.type}`);
                        contentSpan.textContent = data.content.content;
                    } else {
                        contentSpan.textContent = data.content;
                    }
                    outputElement.appendChild(contentSpan);
                    outputElement.scrollTop = outputElement.scrollHeight;
                }
                break;

            case 'error':
                const errorContent = data.content;
                const targetElement = htmlContainer && language === 'html' ? htmlContainer : outputElement;

                if (targetElement) {
                    if (typeof errorContent === 'string') {
                        const errorSpan = document.createElement('span');
                        errorSpan.classList.add('console-error');
                        errorSpan.textContent = errorContent;
                        targetElement.appendChild(errorSpan);
                    } else if (errorContent.error) {
                        const errorMessage = document.createElement('div');
                        errorMessage.classList.add('console-error');
                        errorMessage.textContent = errorContent.error || 'エラーが発生しました';
                        targetElement.appendChild(errorMessage);

                        if (errorContent.errorDetail) {
                            const errorDetail = document.createElement('pre');
                            errorDetail.classList.add('error-details');
                            errorDetail.textContent = errorContent.errorDetail;
                            targetElement.appendChild(errorDetail);
                        }
                    } else {
                        const errorSpan = document.createElement('span');
                        errorSpan.classList.add('console-error');
                        errorSpan.textContent = 'エラーが発生しました';
                        targetElement.appendChild(errorSpan);
                    }
                }

                statusElement.textContent = 'エラーが発生しました';
                statusElement.classList.add('execution-error');
                break;

            case 'result':
                if (data.content.executionTime) {
                    // 既存の実行時間表示要素を更新
                    const timeDisplay = resultElement.querySelector('#executionTimeDisplay');
                    if (timeDisplay) {
                        timeDisplay.innerHTML = `<span>実行時間: ${data.content.executionTime}</span>`;
                        timeDisplay.style.display = 'block'; // 表示を確実にする
                    }
                }

                if (language === 'html' && data.content.type === 'html' && data.content.html) {
                    if (htmlContainer) {
                        htmlContainer.innerHTML = '';
                        
                        const iframe = document.createElement('iframe');
                        iframe.classList.add('html-result-frame');
                        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads'; 
                        iframe.style.width = '100%';
                        iframe.style.minHeight = '300px';
                        iframe.style.border = '1px solid #ddd';
                        iframe.style.borderRadius = '4px';
                        htmlContainer.appendChild(iframe);

                        setTimeout(() => {
                            try {
                                const doc = iframe.contentDocument || iframe.contentWindow.document;
                                doc.open();
                                doc.write(data.content.html);
                                doc.close();

                                iframe.onload = function() {
                                    try {
                                        const height = Math.max(300, doc.body.scrollHeight + 30);
                                        iframe.style.height = `${height}px`;

                                        if (window.ResizeObserver) {
                                            const resizeObserver = new ResizeObserver(() => {
                                                const newHeight = Math.max(300, doc.body.scrollHeight + 30);
                                                iframe.style.height = `${newHeight}px`;
                                            });
                                            
                                            if (doc.body) {
                                                resizeObserver.observe(doc.body);
                                            }
                                        }
                                    } catch (e) {
                                        console.error('iframe高さ調整エラー:', e);
                                    }
                                };

                                iframe.style.height = `${Math.max(300, doc.body.scrollHeight + 30)}px`;
                            } catch (error) {
                                console.error('iframeへのHTML読み込み中にエラーが発生しました:', error);
                                htmlContainer.innerHTML = '<p style="color: red;">HTMLの表示に失敗しました: ' + error.message + '</p>';
                            }
                        }, 0);
                    }
                }

                if (statusElement) {
                    statusElement.textContent = '実行完了';
                    statusElement.classList.add('execution-complete');
                }
                break;
        }
    }
}