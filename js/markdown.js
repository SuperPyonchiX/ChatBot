/**
 * markdown.js
 * マークダウンのレンダリングとコードハイライト関連の機能を提供します
 */

// グローバルスコープに関数を公開
window.Markdown = {
    /**
     * 設定オプション
     * @private
     * @type {Object}
     */
    _CONFIG: {
        // マークダウンオプション
        MARKED_OPTIONS: {
            breaks: true,        // 改行を認識
            gfm: true,           // GitHub Flavored Markdown
            headerIds: false,    // ヘッダーIDを無効化
            mangle: false,       // リンクを難読化しない
            sanitize: false,     // HTMLタグを許可
        },
        // PrismJSのCDN URL
        PRISM_URL: 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js',
        // プリロードする言語
        PRELOAD_LANGUAGES: ['javascript', 'typescript', 'html', 'css', 'python', 'json', 'markdown', 'cpp'],
        // 実行可能な言語リスト
        EXECUTABLE_LANGUAGES: ['javascript', 'js', 'python', 'py', 'html', 'cpp', 'c++'],
        // Mermaid関連の設定
        MERMAID: {
            ENABLED: true,        // mermaidサポートの有効化
            CDN_URL: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
            DEFAULT_CONFIG: {
                startOnLoad: false,
                securityLevel: 'strict'
            }
        }
    },
    
    /**
     * ライブラリの準備状況
     * @private
     * @type {Object}
     */
    _libraryStatus: {
        marked: false,
        prism: false
    },

    /**
     * Markdownテキストをレンダリングします
     * @param {string} text - レンダリングするマークダウンテキスト
     * @returns {string} レンダリングされたHTML
     */
    renderMarkdown: async function(text) {
        if (!text) return '';
        
        try {
            // markedライブラリが利用可能かチェック
            if (typeof marked !== 'undefined') {
                // マークダウンオプションが設定されていなければ初期化
                if (!this._libraryStatus.marked) {
                    this.initializeMarkdown();
                }
                
                // Mermaidのサポートが有効で、mermaidブロックが検出された場合はmermaidライブラリをロード
                if (this._CONFIG.MERMAID.ENABLED && text.includes('```mermaid')) {
                    await this.loadMermaid();
                }
                
                // マークダウンをレンダリング
                let renderedHtml = marked.parse(text);
                
                // mermaidブロックを探して処理
                if (this._CONFIG.MERMAID.ENABLED && typeof mermaid !== 'undefined') {
                    renderedHtml = await this._processMermaidBlocks(renderedHtml);
                }
                
                return renderedHtml;
            } else {
                console.warn('マークダウンライブラリが読み込まれていません');
                return this.escapeHtml(text).replace(/\n/g, '<br>');
            }
        } catch (error) {
            console.error('マークダウンレンダリングエラー:', error);
            // エラー時はプレーンテキストとして表示
            return this.escapeHtml(text).replace(/\n/g, '<br>');
        }
    },
    
    /**
     * レンダリング済みHTMLからmermaidブロックを探して処理します
     * @private
     * @param {string} html - 処理するHTML
     * @returns {Promise<string>} 処理後のHTML
     */
    _processMermaidBlocks: async function(html) {
        if (!html || typeof mermaid === 'undefined') return html;
        
        try {
            console.log('mermaid processing start');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            const mermaidBlocks = tempDiv.querySelectorAll('pre code.language-mermaid');
            console.log('found mermaid blocks:', mermaidBlocks.length);
            
            if (!mermaidBlocks || mermaidBlocks.length === 0) return html;
            
            // イベントハンドラを保持するための配列
            const handlers = [];
            
            for (let i = 0; i < mermaidBlocks.length; i++) {
                const codeBlock = mermaidBlocks[i];
                const preElement = codeBlock.parentElement;
                if (!preElement) continue;
                
                const parentElement = preElement.parentElement;
                if (!parentElement) continue;

                // 現在の位置を記録
                const nextSibling = preElement.nextSibling;
                
                try {
                    console.log('processing block', i);
                    const mermaidCode = codeBlock.textContent;
                    if (!mermaidCode.trim()) continue;
                    
                    // 要素を作成
                    const wrapperContainer = document.createElement('div');
                    wrapperContainer.classList.add('mermaid-wrapper');
                    wrapperContainer.setAttribute('data-mermaid-index', i);
                    
                    const toolbar = document.createElement('div');
                    toolbar.classList.add('mermaid-toolbar');
                    
                    const previewButton = document.createElement('button');
                    previewButton.classList.add('mermaid-preview-toggle');
                    previewButton.setAttribute('type', 'button');
                    previewButton.setAttribute('data-mermaid-index', i);
                    previewButton.innerHTML = '<i class="fas fa-eye"></i> プレビュー表示';
                    previewButton.title = 'プレビュー表示/コード表示を切り替え';
                    
                    const codeContainer = document.createElement('div');
                    codeContainer.classList.add('mermaid-code-container');
                    codeContainer.setAttribute('data-mermaid-index', i);
                    
                    // ダイアグラム表示用の要素を作成
                    const diagramContainer = document.createElement('div');
                    diagramContainer.classList.add('mermaid-diagram', 'hidden');
                    diagramContainer.setAttribute('data-mermaid-index', i);
                    
                    const renderedDiagramId = `mermaid-diagram-${Date.now()}-${i}`;
                    diagramContainer.setAttribute('data-diagram-id', renderedDiagramId);
                    
                    const loadingElement = document.createElement('div');
                    loadingElement.classList.add('mermaid-loading');
                    loadingElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ダイアグラムを生成中...';
                    loadingElement.style.display = 'none';
                    loadingElement.setAttribute('data-mermaid-index', i);
                    
                    const errorElement = document.createElement('div');
                    errorElement.classList.add('mermaid-error');
                    errorElement.style.display = 'none';
                    errorElement.setAttribute('data-mermaid-index', i);
                    
                    // DOMツリーを構築
                    toolbar.appendChild(previewButton);
                    wrapperContainer.appendChild(toolbar);
                    wrapperContainer.appendChild(codeContainer);
                    wrapperContainer.appendChild(diagramContainer);
                    wrapperContainer.appendChild(loadingElement);
                    wrapperContainer.appendChild(errorElement);
                    
                    // 元のpreElementを移動
                    preElement.remove();
                    codeContainer.appendChild(preElement);
                    
                    // 元の位置に新しい要素を挿入（nextSiblingがnullの場合は最後に追加）
                    parentElement.insertBefore(wrapperContainer, nextSibling);
                    
                    // イベントハンドラを作成
                    const togglePreview = async (e) => {
                        const button = e.target.closest('.mermaid-preview-toggle');
                        if (!button) return;
                        
                        const index = button.getAttribute('data-mermaid-index');
                        const wrapper = document.querySelector(`.mermaid-wrapper[data-mermaid-index="${index}"]`);
                        if (!wrapper) return;
                        
                        const diagramContainer = wrapper.querySelector('.mermaid-diagram');
                        const codeContainer = wrapper.querySelector('.mermaid-code-container');
                        const loadingElement = wrapper.querySelector('.mermaid-loading');
                        const errorElement = wrapper.querySelector('.mermaid-error');
                        
                        if (!diagramContainer || !codeContainer || !loadingElement || !errorElement) return;
                        
                        const isPreviewMode = !diagramContainer.classList.contains('hidden');
                        
                        if (isPreviewMode) {
                            // プレビューモードから通常モードへ
                            diagramContainer.classList.add('hidden');
                            codeContainer.classList.remove('hidden');
                            button.innerHTML = '<i class="fas fa-eye"></i> プレビュー表示';
                        } else {
                            // 通常モードからプレビューモードへ
                            codeContainer.classList.add('hidden');
                            loadingElement.style.display = 'block';
                            diagramContainer.classList.remove('hidden');
                            button.innerHTML = '<i class="fas fa-code"></i> コード表示';
                            
                            try {
                                // まだレンダリングされていないダイアグラムの場合
                                if (!diagramContainer.hasAttribute('data-rendered')) {
                                    const diagramId = diagramContainer.getAttribute('data-diagram-id');
                                    const { svg } = await mermaid.render(diagramId, mermaidCode);
                                    diagramContainer.innerHTML = svg;
                                    
                                    // SVGのスタイルを調整
                                    const svgElement = diagramContainer.querySelector('svg');
                                    if (svgElement) {
                                        svgElement.style.maxWidth = '100%';
                                        svgElement.style.height = 'auto';
                                        
                                        // エラー表示のSVGをチェックして非表示にする
                                        if (svgElement.getAttribute('aria-roledescription') === 'error') {
                                            svgElement.style.display = 'none';
                                        }

                                        // クリック時の全画面表示用のスタイルとイベントを追加
                                        svgElement.style.cursor = 'pointer';
                                        svgElement.title = 'クリックで全画面表示';
                                        
                                        svgElement.addEventListener('click', (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            
                                            // モーダル要素を作成
                                            const modal = document.createElement('div');
                                            modal.classList.add('mermaid-modal');
                                            modal.style.cssText = `
                                                position: fixed;
                                                top: 0;
                                                left: 0;
                                                width: 100vw;
                                                height: 100vh;
                                                background: rgba(0, 0, 0, 0.8);
                                                display: flex;
                                                justify-content: center;
                                                align-items: center;
                                                z-index: 10000;
                                                padding: 20px;
                                                box-sizing: border-box;
                                            `;
                                            
                                            // SVGのクローンを作成
                                            const clonedSvg = svgElement.cloneNode(true);
                                            clonedSvg.style.cssText = `
                                                max-width: 95%;
                                                max-height: 95%;
                                                width: auto;
                                                height: auto;
                                                background: white;
                                                padding: 20px;
                                                border-radius: 8px;
                                                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                                            `;
                                            
                                            modal.appendChild(clonedSvg);
                                            
                                            // モーダルクリックで閉じる
                                            modal.addEventListener('click', () => {
                                                modal.remove();
                                            });
                                            
                                            // ESCキーでも閉じる
                                            document.addEventListener('keydown', function closeOnEsc(e) {
                                                if (e.key === 'Escape') {
                                                    modal.remove();
                                                    document.removeEventListener('keydown', closeOnEsc);
                                                }
                                            });
                                            
                                            document.body.appendChild(modal);
                                        });
                                    }
                                    
                                    diagramContainer.setAttribute('data-rendered', 'true');
                                }
                                errorElement.style.display = 'none';
                            } catch (error) {
                                console.error('Mermaidレンダリングエラー:', error);
                                errorElement.style.display = 'block';
                                errorElement.innerHTML = `
                                    <div class="error-message">
                                        <i class="fas fa-exclamation-circle"></i>
                                        ダイアグラムの生成に失敗しました: ${error.message || 'エラーが発生しました'}
                                    </div>
                                `;
                                diagramContainer.classList.add('hidden');
                                codeContainer.classList.remove('hidden');
                            } finally {
                                loadingElement.style.display = 'none';
                            }
                        }
                    };
                    
                    // イベントハンドラをキャッシュ
                    handlers.push({ button: previewButton, handler: togglePreview });
                    
                } catch (blockError) {
                    console.error('mermaidブロック処理エラー:', blockError);
                    continue;
                }
            }
            
            const resultHtml = tempDiv.innerHTML;
            
            // イベントハンドラを実際のDOM要素に適用
            requestAnimationFrame(() => {
                handlers.forEach(({ handler }) => {
                    const buttons = document.querySelectorAll('.mermaid-preview-toggle');
                    buttons.forEach(button => {
                        button.addEventListener('click', handler);
                    });
                });
            });
            
            return resultHtml;
            
        } catch (error) {
            console.error('mermaidブロック処理中にエラーが発生しました:', error);
            return html;
        }
    },

    /**
     * コードブロックにコピーボタンと実行ボタンを追加します
     * @param {HTMLElement} messageElement - コードブロックを含むメッセージ要素
     */
    addCodeBlockCopyButtons: function(messageElement) {
        if (!messageElement) return;
        
        try {
            const codeBlocks = messageElement.querySelectorAll('pre code');
            if (!codeBlocks || codeBlocks.length === 0) return;
            
            codeBlocks.forEach((codeBlock, index) => {
                const pre = codeBlock.parentElement;
                if (!pre) return;
                
                // すでにラッパーがある場合はスキップ
                if (pre.parentNode && pre.parentNode.classList.contains('code-block')) {
                    return;
                }
                
                // 言語クラスからコード言語を特定
                const langClass = Array.from(codeBlock.classList)
                    .find(cls => cls.startsWith('language-'));
                const language = langClass ? langClass.replace('language-', '') : '';
                
                // ラッパーでコードブロックを囲む
                const wrapper = document.createElement('div');
                wrapper.classList.add('code-block');
                
                // 言語表示を追加
                if (language && language !== 'plaintext' && language !== 'none') {
                    const langLabel = document.createElement('div');
                    langLabel.classList.add('code-language');
                    langLabel.textContent = this._getNiceLanguageName(language);
                    wrapper.appendChild(langLabel);
                }
                
                // ラッパーに元のpreを移動
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);
                
                // ツールバーを作成
                const toolbar = document.createElement('div');
                toolbar.classList.add('code-block-toolbar');
                
                // コピーボタンを追加
                const copyButton = this._createCopyButton(index, codeBlock);
                toolbar.appendChild(copyButton);
                
                // 実行可能言語の場合は実行ボタンを追加
                if (this._isExecutableLanguage(language)) {
                    const executeButton = this._createExecuteButton(index, codeBlock, language);
                    toolbar.appendChild(executeButton);
                }
                
                wrapper.appendChild(toolbar);
            });
        } catch (error) {
            console.error('コードブロックボタン追加エラー:', error);
        }
    },
    
    /**
     * 言語が実行可能かどうかを判定します
     * @private
     * @param {string} language - 判定する言語
     * @returns {boolean} 実行可能な場合はtrue
     */
    _isExecutableLanguage: function(language) {
        if (!language) return false;
        return this._CONFIG.EXECUTABLE_LANGUAGES.includes(language.toLowerCase());
    },
    
    /**
     * コード実行ボタンを作成します
     * @private
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @param {string} language - コードの言語
     * @returns {HTMLElement} 作成された実行ボタン要素
     */
    _createExecuteButton: function(index, codeBlock, language) {
        if (!codeBlock || !language) return document.createElement('button');
        
        const executeButton = document.createElement('button');
        executeButton.classList.add('code-execute-button');
        executeButton.innerHTML = '<i class="fas fa-play"></i>';
        executeButton.title = 'コードを実行';
        executeButton.setAttribute('data-code-index', index);
        executeButton.setAttribute('data-language', language);
        executeButton.setAttribute('aria-label', 'コードを実行');
        
        // 実行ボタンのクリックイベント
        executeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // イベント伝播を停止
            this._handleExecuteButtonClick(executeButton, codeBlock, language);
        });
        
        return executeButton;
    },
    
    /**
     * 実行ボタンのクリックイベントを処理します
     * @private
     * @param {HTMLElement} button - クリックされたボタン
     * @param {HTMLElement} codeBlock - 実行対象のコードブロック
     * @param {string} language - コードの言語
     */
    _handleExecuteButtonClick: async function(button, codeBlock, language) {
        if (!button || !codeBlock || !language || !window.CodeExecutor) {
            console.error('コード実行に必要な要素が見つかりません');
            return;
        }
        
        // ボタンの元の状態を保存（スコープ問題を防ぐために関数の上部に移動）
        const originalButtonHtml = button.innerHTML || '<i class="fas fa-play"></i>';
        
        try {
            // ボタンの状態を実行中に変更
            button.disabled = true;
            button.classList.add('code-executing');
            button.innerHTML = '<span class="executing-spinner"></span>';
            
            // 既存の実行結果を削除
            const parentBlock = codeBlock.closest('.code-block');
            if (parentBlock) {
                const existingResult = parentBlock.querySelector('.code-execution-result');
                if (existingResult) {
                    parentBlock.removeChild(existingResult);
                }
            }
            
            // リアルタイム出力用の要素を作成
            let resultElement = null;
            if (parentBlock) {
                resultElement = document.createElement('div');
                resultElement.classList.add('code-execution-result');
                
                // ステータス表示用の要素
                const statusElement = document.createElement('div');
                statusElement.classList.add('execution-status');
                statusElement.textContent = '実行準備中...';
                resultElement.appendChild(statusElement);
                
                // HTML言語の場合は特別なコンテナを用意
                if (language === 'html') {
                    const htmlContainer = document.createElement('div');
                    htmlContainer.classList.add('html-result-container');
                    resultElement.appendChild(htmlContainer);
                } else {
                    // 通常の言語の場合はリアルタイム出力表示用の要素
                    const outputElement = document.createElement('pre');
                    outputElement.classList.add('realtime-output');
                    resultElement.appendChild(outputElement);
                }
                
                parentBlock.appendChild(resultElement);
            }
            
            // コードを取得して実行
            const code = this._cleanCodeForCopy(codeBlock.textContent);
            
            // リアルタイム出力を処理するコールバック
            const outputCallback = function(data) {
                if (!resultElement) return;
                
                const statusElement = resultElement.querySelector('.execution-status');
                const outputElement = resultElement.querySelector('.realtime-output');
                const htmlContainer = resultElement.querySelector('.html-result-container');
                
                if (!statusElement) return;
                
                switch (data.type) {
                    case 'status':
                        // ステータスメッセージを更新
                        statusElement.textContent = data.content;
                        break;
                        
                    case 'output':
                    case 'console':
                        // 出力内容を追加（HTML以外の言語）
                        if (outputElement) {
                            const contentSpan = document.createElement('span');
                            if (data.content && data.content.type) {
                                contentSpan.classList.add(`console-${data.content.type}`);
                                contentSpan.textContent = data.content.content;
                            } else {
                                contentSpan.textContent = data.content;
                            }
                            outputElement.appendChild(contentSpan);
                            
                            // 自動スクロール（出力エリア内のみ）
                            outputElement.scrollTop = outputElement.scrollHeight;
                        }
                        break;
                        
                    case 'error':
                        // エラーメッセージを表示
                        const errorContent = data.content;
                        
                        // HTMLの場合はHTMLコンテナに、それ以外は通常の出力エリアに表示
                        const targetElement = language === 'html' ? htmlContainer : outputElement;
                        
                        if (targetElement) {
                            if (typeof errorContent === 'string') {
                                // 文字列の場合はそのまま表示
                                const errorSpan = document.createElement('span');
                                errorSpan.classList.add('console-error');
                                errorSpan.textContent = errorContent;
                                targetElement.appendChild(errorSpan);
                            } else if (errorContent.error) {
                                // エラーオブジェクトの場合の処理
                                const errorMessage = document.createElement('div');
                                errorMessage.classList.add('console-error');
                                errorMessage.textContent = errorContent.error || 'エラーが発生しました';
                                targetElement.appendChild(errorMessage);
                                
                                // エラー詳細があれば追加
                                if (errorContent.errorDetail) {
                                    const errorDetail = document.createElement('pre');
                                    errorDetail.classList.add('error-details');
                                    errorDetail.textContent = errorContent.errorDetail;
                                    targetElement.appendChild(errorDetail);
                                }
                            } else {
                                // 未知のエラー形式の場合
                                const errorSpan = document.createElement('span');
                                errorSpan.classList.add('console-error');
                                errorSpan.textContent = 'エラーが発生しました';
                                targetElement.appendChild(errorSpan);
                            }
                        }
                        
                        // エラー時はステータスを更新
                        statusElement.textContent = 'エラーが発生しました';
                        statusElement.classList.add('execution-error');
                        break;
                        
                    case 'result':
                        // 最終結果が返ってきた場合
                        if (data.content.executionTime) {
                            const timeInfo = document.createElement('div');
                            timeInfo.classList.add('execution-time');
                            timeInfo.innerHTML = `<span>実行時間: ${data.content.executionTime}</span>`;
                            resultElement.prepend(timeInfo);
                        }
                        
                        // HTML結果の特別処理
                        if (language === 'html' && data.content.type === 'html' && data.content.html) {
                            // HTMLコンテナを空にする
                            if (htmlContainer) {
                                htmlContainer.innerHTML = '';
                                
                                // iframeを作成
                                const iframe = document.createElement('iframe');
                                iframe.classList.add('html-result-frame');
                                iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads'; 
                                iframe.style.width = '100%';
                                iframe.style.minHeight = '300px';
                                iframe.style.border = '1px solid #ddd';
                                iframe.style.borderRadius = '4px';
                                htmlContainer.appendChild(iframe);
                                
                                // iframeのコンテンツを設定
                                setTimeout(() => {
                                    try {
                                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                                        doc.open();
                                        doc.write(data.content.html);
                                        doc.close();
                                        
                                        // iframeの高さを調整
                                        iframe.onload = function() {
                                            try {
                                                const height = Math.max(300, doc.body.scrollHeight + 30);
                                                iframe.style.height = `${height}px`;
                                                
                                                // コンテンツの変更を監視して高さを再調整
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
                                        
                                        // すぐに高さを調整してみる
                                        iframe.style.height = `${Math.max(300, doc.body.scrollHeight + 30)}px`;
                                        
                                    } catch (error) {
                                        console.error('iframeへのHTML読み込み中にエラーが発生しました:', error);
                                        htmlContainer.innerHTML = '<p style="color: red;">HTMLの表示に失敗しました: ' + error.message + '</p>';
                                    }
                                }, 0);
                            }
                        }
                        
                        // ステータス表示を削除するか成功メッセージに変更
                        if (statusElement) {
                            statusElement.textContent = '実行完了';
                            statusElement.classList.add('execution-complete');
                        }
                        break;
                }
            };
            
            // CodeExecutorを使用してコードを実行
            const result = await window.CodeExecutor.executeCode(code, language, outputCallback);
            
            // スクロール位置は自動調整しない
            
        } catch (error) {
            console.error('コード実行中にエラーが発生しました:', error);
            
            // エラーメッセージを表示
            const errorMsg = {
                error: `実行エラー: ${error.message || '不明なエラー'}`,
                errorDetail: error.stack
            };
            
            const parentBlock = codeBlock.closest('.code-block');
            if (parentBlock) {
                const errorElement = document.createElement('div');
                errorElement.classList.add('code-execution-result');
                
                const errorDiv = document.createElement('div');
                errorDiv.classList.add('execution-error');
                errorDiv.textContent = errorMsg.error;
                
                if (errorMsg.errorDetail) {
                    const errorDetail = document.createElement('pre');
                    errorDetail.classList.add('error-details');
                    errorDetail.textContent = errorMsg.errorDetail;
                    errorDiv.appendChild(errorDetail);
                }
                
                errorElement.appendChild(errorDiv);
                parentBlock.appendChild(errorElement);
            }
        } finally {
            // ボタンを元の状態に戻す
            button.disabled = false;
            button.classList.remove('code-executing');
            button.innerHTML = originalButtonHtml;
        }
    },
    
    /**
     * 言語IDから表示用の言語名を取得
     * @private
     * @param {string} langId - 言語ID
     * @returns {string} 表示用言語名
     */
    _getNiceLanguageName: function(langId) {
        if (!langId) return '';
        
        const languageMap = {
            'js': 'JavaScript',
            'javascript': 'JavaScript',
            'ts': 'TypeScript',
            'typescript': 'TypeScript',
            'python': 'Python',
            'py': 'Python',
            'html': 'HTML',
            'css': 'CSS',
            'json': 'JSON',
            'java': 'Java',
            'csharp': 'C#',
            'cs': 'C#',
            'c': 'C',
            'cpp': 'C++',
            'php': 'PHP',
            'ruby': 'Ruby',
            'rb': 'Ruby',
            'go': 'Go',
            'rust': 'Rust',
            'swift': 'Swift',
            'kotlin': 'Kotlin',
            'sql': 'SQL',
            'bash': 'Bash',
            'shell': 'Shell',
            'sh': 'Shell',
            'markdown': 'Markdown',
            'md': 'Markdown',
            'yaml': 'YAML',
            'yml': 'YAML',
            'xml': 'XML',
            'plaintext': 'Text'
        };
        
        return languageMap[langId.toLowerCase()] || langId;
    },

    /**
     * コードブロック用のコピーボタンを作成します
     * @private
     * @param {number} index - コードブロックのインデックス
     * @param {HTMLElement} codeBlock - 対象のコードブロック要素
     * @returns {HTMLElement} 作成されたコピーボタン要素
     */
    _createCopyButton: function(index, codeBlock) {
        if (!codeBlock) return document.createElement('button');
        
        const copyButton = document.createElement('button');
        copyButton.classList.add('code-copy-button');
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.title = 'コードをコピー';
        copyButton.setAttribute('data-code-index', index);
        copyButton.setAttribute('aria-label', 'コードをクリップボードにコピー');
        
        // コピーボタンのクリックイベント
        copyButton.addEventListener('click', (e) => {
            e.stopPropagation(); // イベント伝播を停止
            this._handleCopyButtonClick(copyButton, codeBlock);
        });
        
        return copyButton;
    },
    
    /**
     * コピーボタンのクリックイベントを処理します
     * @private
     * @param {HTMLElement} button - クリックされたボタン
     * @param {HTMLElement} codeBlock - コピー対象のコードブロック
     */
    _handleCopyButtonClick: function(button, codeBlock) {
        if (!button || !codeBlock) return;
        
        try {
            // トリミングしてコピー（余分な空白行を削除）
            const codeText = this._cleanCodeForCopy(codeBlock.textContent);
            
            navigator.clipboard.writeText(codeText)
                .then(() => {
                    this._showCopySuccess(button);
                })
                .catch(err => {
                    console.error('コードのコピーに失敗しました:', err);
                    this._showCopyError(button);
                });
        } catch (error) {
            console.error('コピー処理エラー:', error);
            this._showCopyError(button);
        }
    },
    
    /**
     * コードをコピー用に整形する
     * @private
     * @param {string} code - 整形するコード
     * @returns {string} 整形されたコード
     */
    _cleanCodeForCopy: function(code) {
        if (!code) return '';
        
        // 前後の空白を削除
        let cleanCode = code.trim();
        
        // 連続する空行を単一の空行に置換
        cleanCode = cleanCode.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        return cleanCode;
    },
    
    /**
     * コピー成功時のボタン表示を更新します
     * @private
     * @param {HTMLElement} button - 更新するボタン
     */
    _showCopySuccess: function(button) {
        if (!button) return;
        
        button.classList.add('copied');
        button.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            if (button) {
                button.classList.remove('copied');
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }
        }, 1500);
    },
    
    /**
     * コピー失敗時のボタン表示を更新します
     * @private
     * @param {HTMLElement} button - 更新するボタン
     */
    _showCopyError: function(button) {
        if (!button) return;
        
        button.classList.add('error');
        button.innerHTML = '<i class="fas fa-times"></i>';
        
        setTimeout(() => {
            if (button) {
                button.classList.remove('error');
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }
        }, 1500);
    },

    /**
     * 特殊文字をHTMLエスケープします
     * @param {string} text - エスケープするテキスト
     * @returns {string} エスケープされたテキスト
     */
    escapeHtml: function(text) {
        if (!text) return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    /**
     * メッセージをフォーマットします（改行やコードブロックを処理）
     * @param {string} message - フォーマットするメッセージ
     * @returns {string} フォーマットされたメッセージHTML
     */
    formatMessage: function(message) {
        if (!message) return '';
        
        try {
            let formattedMessage = this.escapeHtml(message);
            
            // 改行を<br>に変換
            formattedMessage = formattedMessage.replace(/\n/g, '<br>');
            
            // インラインコードを処理
            formattedMessage = formattedMessage.replace(/`([^`]+)`/g, '<code>$1</code>');
            
            // コードブロックを処理
            formattedMessage = formattedMessage.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
                const language = lang ? ` class="language-${lang}"` : '';
                return `<pre><code${language}>${code}</code></pre>`;
            });
            
            return formattedMessage;
        } catch (error) {
            console.error('メッセージフォーマットエラー:', error);
            return this.escapeHtml(message).replace(/\n/g, '<br>');
        }
    },

    /**
     * 外部スクリプトを動的に読み込みます
     * @param {string} src - スクリプトのURL
     * @param {Object} attributes - 追加の属性
     * @returns {Promise} スクリプト読み込み後に解決するPromise
     */
    loadScript: function(src, attributes = {}) {
        return new Promise((resolve, reject) => {
            // 既に読み込まれている場合はそのまま解決
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            
            // 追加の属性を設定
            Object.entries(attributes).forEach(([key, value]) => {
                script.setAttribute(key, value);
            });
            
            // イベントハンドラを設定
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`スクリプトの読み込みに失敗しました: ${src}`));
            
            // 読み込みタイムアウト
            const timeoutId = setTimeout(() => {
                reject(new Error(`スクリプトの読み込みがタイムアウトしました: ${src}`));
            }, 10000); // 10秒
            
            script.onload = () => {
                clearTimeout(timeoutId);
                resolve();
            };
            
            // DOMに追加
            document.head.appendChild(script);
        });
    },
    
    /**
     * 言語ファイルを動的に読み込みます
     * @param {string} language - 読み込む言語
     * @returns {Promise} 読み込み後に解決するPromise
     */
    loadLanguage: function(language) {
        if (!language || language === 'plaintext' || language === 'none') {
            return Promise.resolve();
        }
        
        // すでに読み込まれているか確認
        if (typeof Prism !== 'undefined' && Prism.languages[language]) {
            return Promise.resolve();
        }
        
        return this.loadScript(`https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-${language}.min.js`)
            .catch(error => {
                console.warn(`言語 ${language} の読み込みに失敗しました:`, error);
                return Promise.resolve(); // 失敗しても続行
            });
    },

    /**
     * マークダウンライブラリを初期化します
     * 構文ハイライトなどの設定を行います
     */
    initializeMarkdown: function() {
        // ライブラリのステータスを更新
        this._libraryStatus.marked = true;
        
        // マークダウンが未ロードの場合は何もしない
        if (typeof marked === 'undefined') {
            console.warn('マークダウンライブラリが読み込まれていません。ライブラリ読み込み後にこのメソッドを呼び出してください。');
            return;
        }
        
        // マークダウンのレンダリングオプション設定
        const options = { ...this._CONFIG.MARKED_OPTIONS };
        
        // Prismが利用可能ならハイライト関数を設定
        if (typeof Prism !== 'undefined') {
            options.highlight = this._highlightCode;
            this._libraryStatus.prism = true;
        }
        
        marked.setOptions(options);
    },
    
    /**
     * コードブロックの構文ハイライトを行います
     * @private
     * @param {string} code - ハイライトするコード
     * @param {string} lang - 言語識別子
     * @returns {string} ハイライトされたHTML
     */
    _highlightCode: function(code, lang) {
        if (!code) return '';
        
        // Prismが利用可能で言語が指定されている場合のみハイライト
        if (typeof Prism !== 'undefined' && Prism.languages && lang && Prism.languages[lang]) {
            try {
                return Prism.highlight(code, Prism.languages[lang], lang);
            } catch (error) {
                console.error('構文ハイライトエラー:', error);
            }
        }
        
        // 失敗時やサポートされていない言語の場合はそのまま返す
        return code;
    },
    
    /**
     * マークダウンとシンタックスハイライト用の必要なスクリプトを読み込みます
     * @returns {Promise} すべてのスクリプト読み込み後に解決するPromise
     */
    loadDependencies: async function() {
        try {
            // マークダウンライブラリが既に読み込まれているか確認
            if (typeof marked === 'undefined') {
                await this.loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
            }
            
            // Prismが既に読み込まれているか確認
            if (typeof Prism === 'undefined') {
                await this.loadScript(this._CONFIG.PRISM_URL);
                
                // 主要言語を先読み
                const languagePromises = this._CONFIG.PRELOAD_LANGUAGES.map(lang => 
                    this.loadLanguage(lang)
                );
                
                // 並列で読み込み
                await Promise.all(languagePromises);
            }
            
            // マークダウンを初期化
            this.initializeMarkdown();
            
            return true;
        } catch (error) {
            console.error('依存関係の読み込みに失敗しました:', error);
            return false;
        }
    },

    /**
     * Mermaidライブラリを読み込みます
     * @returns {Promise} ロード完了後に解決するPromise
     */
    loadMermaid: async function() {
        try {
            // mermaidが無効化されている場合は何もしない
            if (!this._CONFIG.MERMAID.ENABLED) {
                return Promise.resolve(false);
            }
            
            // すでにロードされている場合は何もしない
            if (typeof mermaid !== 'undefined') {
                return Promise.resolve(true);
            }
            
            // mermaidライブラリをロード
            await this.loadScript(this._CONFIG.MERMAID.CDN_URL);
            
            // 初期化
            await this.initializeMermaid();
            
            return true;
        } catch (error) {
            console.error('Mermaidライブラリのロードに失敗しました:', error);
            return false;
        }
    },
    
    /**
     * Mermaidライブラリを初期化します
     */
    initializeMermaid: function() {
        if (typeof mermaid === 'undefined') {
            console.warn('Mermaidライブラリが読み込まれていません');
            return Promise.resolve(false);
        }
        
        try {
            // Mermaidの初期設定
            mermaid.initialize({
                ...this._CONFIG.MERMAID.DEFAULT_CONFIG,
                startOnLoad: false,
                securityLevel: 'strict',
                suppressErrors: true, // エラーメッセージを抑制
                logLevel: 'fatal', // 最小限のログ出力
                flowchart: {
                    htmlLabels: true,
                    useMaxWidth: true
                },
                er: {
                    useMaxWidth: true
                },
                sequence: {
                    useMaxWidth: true
                },
                gantt: {
                    useMaxWidth: true
                }
            });

            // エラーハンドラーをオーバーライド
            mermaid.parseError = (err, hash) => {
                // エラーの表示を完全に抑制
                console.debug('Mermaid構文エラー:', err);
                return '';
            };
            
            return Promise.resolve(true);
        } catch (error) {
            console.error('Mermaidの初期化に失敗しました:', error);
            return Promise.resolve(false);
        }
    },
};