/**
 * ChatUI.js
 * チャットUIの基本機能を提供します
 */
class ChatUI {
    // シングルトンインスタンス
    static #instance = null;

    // プライベートフィールド
    #cache = {
        elements: new Map(),
        templates: new Map()
    };
    
    // コードエディターモーダル関連
    #codeEditorModal = null;
    #activeCodeBlock = null;
    #editorInstance = null;
    #currentLanguage = 'javascript';
    #simpleEditorFallbackUsed = false; // シンプルエディタフォールバックのフラグ

    /**
     * プライベートコンストラクタ
     * @private
     */
    constructor() {
        if (ChatUI.#instance) {
            throw new Error('ChatUIクラスは直接インスタンス化できません。ChatUI.instanceを使用してください。');
        }
    }

    /**
     * シングルトンインスタンスを取得します
     * @returns {ChatUI} ChatUIのシングルトンインスタンス
     */
    static get getInstance() {
        if (!ChatUI.#instance) {
            ChatUI.#instance = new ChatUI();
        }
        return ChatUI.#instance;
    }

    /**
     * DOM要素を作成します
     * @param {string} tag - 作成する要素のタグ名
     * @param {Object} options - 要素のオプション
     * @param {string|string[]} [options.classList] - 追加するクラス名
     * @param {Object} [options.attributes] - 設定する属性
     * @param {string} [options.innerHTML] - 設定するHTML
     * @param {string} [options.textContent] - 設定するテキスト
     * @param {HTMLElement[]} [options.children] - 追加する子要素
     * @returns {HTMLElement} 作成されたDOM要素
     */
    createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.classList) {
            if (Array.isArray(options.classList)) {
                element.classList.add(...options.classList);
            } else {
                element.classList.add(options.classList);
            }
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                if (value !== undefined) {
                    element.setAttribute(key, value);
                }
            });
        }
        
        if (options.innerHTML !== undefined) {
            element.innerHTML = options.innerHTML;
        }
        
        if (options.textContent !== undefined) {
            element.textContent = options.textContent;
        }
        
        if (options.children && Array.isArray(options.children)) {
            options.children.forEach(child => {
                if (child) {
                    element.appendChild(child);
                }
            });
        }
        
        return element;
    }

    /**
     * コードエディターモーダルを初期化します
     */
    initializeCodeEditor() {
        // モーダル要素を取得
        this.#codeEditorModal = document.getElementById('codeEditorModal');
        if (!this.#codeEditorModal) {
            console.error('コードエディターモーダルが見つかりません');
            return;
        }

        // 言語選択
        const languageSelect = document.getElementById('editorLanguageSelect');
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                const language = e.target.value;
                this.#currentLanguage = language;
                
                // エディターのモデルを更新
                if (this.#editorInstance) {
                    const code = this.#editorInstance.getCode();
                    this.#editorInstance.updateModel(code, language);
                }
            });
        }

        // 実行ボタン
        const runButton = document.getElementById('runCodeButton');
        if (runButton) {
            runButton.addEventListener('click', () => {
                this.#executeEditorCode();
            });
        }

        // 適用ボタン
        const applyButton = document.getElementById('applyCodeChanges');
        if (applyButton) {
            applyButton.addEventListener('click', () => {
                this.#applyCodeChanges();
            });
        }

        // キャンセルボタン
        const cancelButton = document.getElementById('cancelCodeChanges');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                this.#hideCodeEditorModal();
            });
        }
        
        // モーダル自体のイベント
        if (this.#codeEditorModal) {
            // モーダルが表示された後の処理
            this.#codeEditorModal.addEventListener('transitionend', (e) => {
                if (e.propertyName === 'opacity' && this.#codeEditorModal.classList.contains('active')) {
                    // モーダルが完全に表示された後にエディタの再描画を試みる
                    try {
                        // DOM要素の順序を再確認（エディタが先、実行結果が後）
                        this.#fixEditorContainerOrder();
                        
                        if (this.#editorInstance && typeof this.#editorInstance.resizeEditor === 'function') {
                            console.log('[ChatUI] モーダル表示後にエディタをリサイズします');
                            this.#editorInstance.resizeEditor();
                        }
                        
                        // エディタにフォーカス
                        if (this.#editorInstance && typeof this.#editorInstance.focus === 'function') {
                            this.#editorInstance.focus();
                        } else {
                            const simpleEditor = document.getElementById('simpleCodeEditor');
                            if (simpleEditor) {
                                simpleEditor.focus();
                            }
                        }
                    } catch (err) {
                        console.warn('[ChatUI] モーダル表示後の処理でエラー:', err);
                    }
                }
            });
        }
    }

    /**
     * コードエディターを表示します
     * @param {HTMLElement} codeBlock - 編集対象のコードブロック要素
     * @param {string} code - 編集するコード
     * @param {string} language - コードの言語
     */
    showCodeEditor(codeBlock, code, language) {
        if (!this.#codeEditorModal) {
            this.initializeCodeEditor();
        }

        // コードが空の場合は空文字列に設定
        code = code || '';
        
        // 編集対象のコードブロックとコードを保存
        this.#activeCodeBlock = codeBlock;
        this.#currentLanguage = language || 'javascript';

        // 言語セレクタを更新
        const languageSelect = document.getElementById('editorLanguageSelect');
        if (languageSelect) {
            languageSelect.value = this.#currentLanguage;
        }

        // モーダルを表示する前に、一度アクティブクラスを削除してリセット
        this.#codeEditorModal.classList.remove('active');
        
        // 少し遅延してからモーダルを表示（CSSアニメーションが確実に動作するように）
        setTimeout(() => {
            // モーダル表示前にDOM要素の順序を強制的に修正
            this.#fixEditorContainerOrder();
            
            // モーダルを表示
            this.#codeEditorModal.classList.add('active');
            
            // エディタコンテナを取得
            const editorContainer = document.getElementById('monacoEditorContainer');
            if (editorContainer) {
                // エディタコンテナの表示を強制
                editorContainer.style.display = 'block';
                editorContainer.style.visibility = 'visible';
                editorContainer.style.opacity = '1';
            }
        }, 10);

        // 実行結果をリセット
        const resultElement = document.querySelector('#codeExecutionPreview .code-execution-result');
        if (resultElement) {
            const statusElement = resultElement.querySelector('.execution-status');
            if (statusElement) {
                statusElement.textContent = '準備完了';
                statusElement.classList.remove('execution-error', 'execution-complete');
            }
            
            // 実行時間表示も初期化
            const timeElement = resultElement.querySelector('#executionTimeDisplay');
            if (timeElement) {
                timeElement.innerHTML = '';
                timeElement.style.display = 'none'; // 初期状態は非表示
            }

            const outputElement = resultElement.querySelector('.realtime-output');
            if (outputElement) {
                outputElement.innerHTML = '';
            }

            const htmlContainer = resultElement.querySelector('.html-result-container');
            if (htmlContainer) {
                htmlContainer.innerHTML = '';
            }
        }

        // Monaco Editorを初期化または更新
        const editorContainer = document.getElementById('monacoEditorContainer');
        if (editorContainer) {
            // エディター表示前にデバッグ情報を出力
            console.log('編集するコード(showCodeEditor):', code);
            console.log('コード長さ:', code ? code.length : 0);
            console.log('編集する言語(showCodeEditor):', this.#currentLanguage);
            
            // タイムアウト処理用の変数
            let editorInitTimeout;                // エディタコンテナのスタイルを明示的に設定
                editorContainer.style.display = 'block';
                editorContainer.style.visibility = 'visible';
                editorContainer.style.height = '270px';
                editorContainer.style.width = '100%';
                editorContainer.style.position = 'relative';
                editorContainer.style.order = '1'; // エディタを上部に表示
                
                // 実行結果エリアのスタイルも設定
                const executionPreview = document.getElementById('codeExecutionPreview');
                if (executionPreview) {
                    executionPreview.style.display = 'block';
                    executionPreview.style.order = '2'; // 実行結果を下部に表示
                }
            
            // エディタの状態に応じて処理を分岐
            if (this.#editorInstance) {
                // 既存のエディタインスタンスがある場合はローディング表示をしない
                // ただし、前回のエディタコンテンツをクリアしておく
                const loadingEls = document.querySelectorAll('#editor-loading-indicator, #monaco-loading-indicator');
                loadingEls.forEach(el => {
                    try {
                        if (el && el.parentNode) el.parentNode.removeChild(el);
                    } catch (e) {}
                });
            } else {
                // 新規エディタの場合のみローディング表示を設定
                editorContainer.innerHTML = '<div id="editor-loading-indicator" style="display:flex;justify-content:center;align-items:center;height:100%;background:#1e1e1e;color:#fff;position:absolute;top:0;left:0;right:0;bottom:0;z-index:10;"><span>エディターを準備中...</span></div>';
            }
            
            // エディターのセットアップを簡素化
            const setupEditor = () => {
                // タイムアウト設定 - 5秒以内にエディタが初期化されなければフォールバック
                editorInitTimeout = setTimeout(() => {
                    console.warn('エディタ初期化がタイムアウトしました。シンプルエディタを表示します。');
                    if (!this.#editorInstance) {
                        this.#showSimpleEditorFallback(editorContainer, code, this.#currentLanguage);
                    }
                }, 5000);
                
                // インスタンスが既に存在する場合は使用
                if (this.#editorInstance) {
                    console.log('既存のエディタインスタンスを使用します');
                    try {
                        // エディタとコード実行結果の順序を正しく設定
                        this.#fixEditorContainerOrder();
                        
                        // エディタのDOMを確実に表示
                        // まずエディタのコンテナを取得して表示状態に
                        if (editorContainer) {
                            // エディタコンテナの表示スタイルを強制設定
                            editorContainer.style.display = 'block';
                            editorContainer.style.visibility = 'visible';
                            editorContainer.style.opacity = '1';
                            editorContainer.style.height = '270px';
                            editorContainer.style.width = '100%';
                            
                            // インライン要素としてDOM内に追加すると確実に表示される
                            const containerParent = editorContainer.parentNode;
                            if (containerParent) {
                                containerParent.style.display = 'block';
                            }
                        }
                        
                        // ローディング表示を全て消去
                        const loadingEls = document.querySelectorAll('#editor-loading-indicator, #monaco-loading-indicator');
                        loadingEls.forEach(el => {
                            try {
                                if (el && el.parentNode) el.parentNode.removeChild(el);
                            } catch (e) {
                                console.warn('ローディング表示の削除に失敗:', e);
                            }
                        });
                        
                        // エディタ内容を更新
                        console.log('既存エディタの内容を更新します:', code.substring(0, 30) + '...');
                        
                        // フラッシュ効果でエディタが表示されていることを視覚的にわかりやすくする
                        if (editorContainer) {
                            editorContainer.style.transition = 'background-color 0.3s';
                            editorContainer.style.backgroundColor = '#4a4a4a';
                            setTimeout(() => {
                                editorContainer.style.backgroundColor = '';
                                
                                // エディタ内容の更新とフォーカス
                                this.#editorInstance.updateModel(code, this.#currentLanguage);
                                
                                // エディタにフォーカスを当てる
                                setTimeout(() => {
                                    if (this.#editorInstance && typeof this.#editorInstance.focus === 'function') {
                                        this.#editorInstance.focus();
                                    }
                                }, 100);
                                
                            }, 100);
                        } else {
                            this.#editorInstance.updateModel(code, this.#currentLanguage);
                        }
                        
                        clearTimeout(editorInitTimeout); // タイムアウトをクリア
                        return;
                    } catch (err) {
                        console.error('既存エディタの更新に失敗:', err);
                        this.#editorInstance = null;
                    }
                }
                
                try {
                    // 新しいインスタンスを作成
                    console.log('新しいエディタインスタンスを作成します');
                    
                    // エディタコンテナを確認
                    if (!editorContainer || !editorContainer.parentNode) {
                        throw new Error('エディタを表示するコンテナが見つかりません');
                    }
                    
                    // コンテナを表示可能な状態に
                    editorContainer.style.visibility = 'visible';
                    editorContainer.style.display = 'block';
                    editorContainer.style.height = '270px'; // 高さを明示的に設定
                    
                    if (!MonacoEditorController || !MonacoEditorController.getInstance) {
                        throw new Error('MonacoEditorController が利用できません');
                    }
                    
                    // モナコエディタコントローラーを初期化
                    MonacoEditorController.getInstance
                        .initialize(editorContainer, code, this.#currentLanguage)
                        .then(editor => {
                            clearTimeout(editorInitTimeout); // タイムアウトをクリア
                            this.#editorInstance = MonacoEditorController.getInstance;
                            
                            // ログ出力
                            console.log('エディタの初期化に成功しました', editor ? '(エディタあり)' : '(エディタなし)');
                            
                            // エディタがまだ見えない場合は表示
                            if (editorContainer) {
                                editorContainer.style.visibility = 'visible';
                                editorContainer.style.opacity = '1';
                                
                                // ローディング表示を削除（念のため）
                                const loadingEl = document.getElementById('editor-loading-indicator');
                                if (loadingEl) {
                                    try {
                                        loadingEl.parentNode.removeChild(loadingEl);
                                    } catch (e) {}
                                }
                            }
                            
                            // 実行コールバックを設定
                            if (this.#editorInstance) {
                                this.#editorInstance.setExecuteCallback((code, language) => {
                                    this.#executeEditorCode();
                                });
                                
                                // エディタにフォーカス
                                setTimeout(() => {
                                    if (this.#editorInstance && typeof this.#editorInstance.focus === 'function') {
                                        this.#editorInstance.focus();
                                    }
                                }, 300);
                            }
                        })
                        .catch(err => {
                            clearTimeout(editorInitTimeout); // タイムアウトをクリア
                            console.error('モナコエディタの初期化に失敗:', err);
                            
                            // フォールバック - 単純なテキストエリアを表示
                            this.#showSimpleEditorFallback(editorContainer, code, this.#currentLanguage);
                        });
                } catch (err) {
                    clearTimeout(editorInitTimeout); // タイムアウトをクリア
                    console.error('エディタの初期化中にエラーが発生:', err);
                    this.#showSimpleEditorFallback(editorContainer, code, this.#currentLanguage);
                }
            };
            
            // すぐにセットアップを開始
            // エディタセットアップの実行とエラーキャッチ
            try {
                setupEditor();
                console.log('エディタのセットアップを開始しました');
            } catch (err) {
                console.error('エディタセットアップ中のエラー:', err);
                // 致命的なエラーの場合はシンプルエディタを表示
                this.#showSimpleEditorFallback(editorContainer, code, this.#currentLanguage);
            }
        } else {
            console.error('エディタコンテナが見つかりません');
        }
    }

    /**
     * エディターのコードを実行します
     * @private
     */
    #executeEditorCode() {
        // エディターからコードと言語を取得
        let code = '';
        let language = this.#currentLanguage || 'javascript';
        
        if (this.#editorInstance) {
            // Monaco Editorからコードを取得
            code = this.#editorInstance.getCode();
            language = this.#editorInstance.getLanguage();
        } else {
            // シンプルなエディタからコードを取得
            const simpleEditor = document.getElementById('simpleCodeEditor');
            if (simpleEditor) {
                code = simpleEditor.value || '';
                console.log('シンプルエディタからコード実行:', code);
            } else {
                console.error('有効なエディタが見つかりません');
                return;
            }
        }
        
        // 実行結果を表示する要素
        const resultElement = document.querySelector('#codeExecutionPreview .code-execution-result');
        if (!resultElement) return;
        
        // ステータスを更新
        const statusElement = resultElement.querySelector('.execution-status');
        if (statusElement) {
            statusElement.textContent = '実行中...';
            statusElement.classList.remove('execution-error', 'execution-complete');
        }
        
        // 実行時間表示をクリア
        const timeElement = resultElement.querySelector('#executionTimeDisplay');
        if (timeElement) {
            timeElement.innerHTML = '';
            timeElement.style.display = 'none'; // 実行前は非表示
        }
        
        // 出力をクリア
        const outputElement = resultElement.querySelector('.realtime-output');
        if (outputElement) {
            outputElement.innerHTML = '';
        }
        
        // HTML結果をクリア
        const htmlContainer = resultElement.querySelector('.html-result-container');
        if (htmlContainer) {
            htmlContainer.innerHTML = '';
        }
        
        // コードを実行
        CodeExecutor.getInstance.executeCode(code, language, resultElement)
            .then(result => {
                console.log('コード実行結果:', result);
            })
            .catch(error => {
                console.error('コード実行エラー:', error);
            });
    }

    /**
     * コードの変更を適用します
     * @private
     */
    #applyCodeChanges() {
        if (!this.#activeCodeBlock) {
            this.#hideCodeEditorModal();
            return;
        }
        
        let newCode = '';
        let language = this.#currentLanguage;
        
        // モナコエディタからコードを取得するか、シンプルエディタからコードを取得する
        if (this.#editorInstance) {
            newCode = this.#editorInstance.getCode();
            language = this.#editorInstance.getLanguage();
        } else {
            // フォールバック: シンプルなテキストエリアからコードを取得
            const simpleEditor = document.getElementById('simpleCodeEditor');
            if (simpleEditor) {
                newCode = simpleEditor.value || '';
                console.log('シンプルエディタからコードを取得:', newCode);
            }
        }
        
        // コードブロックのコードを更新
        const codeElement = this.#activeCodeBlock.querySelector('code');
        if (codeElement) {
            // コードブロックのクラスを更新
            const languageClass = `language-${language}`;
            codeElement.className = languageClass;
            
            // コードを設定
            codeElement.textContent = newCode;
            
            // Prism.jsでシンタックスハイライトを適用
            if (typeof Prism !== 'undefined') {
                Prism.highlightElement(codeElement);
            }
        }
        
        // 実行ボタンのdata属性を更新
        const codeBlock = this.#activeCodeBlock.closest('.code-block');
        if (codeBlock) {
            const runButton = codeBlock.querySelector('.code-execute-button');
            if (runButton) {
                runButton.setAttribute('data-language', language);
            }
        }
        
        this.#hideCodeEditorModal();
    }

    /**
     * コードエディターモーダルを閉じます
     * @private
     */
    #hideCodeEditorModal() {
        if (this.#codeEditorModal) {
            this.#codeEditorModal.classList.remove('active');
        }
        this.#activeCodeBlock = null;
    }

    /**
     * モーダル内のエディタと実行結果の表示順序を修正する
     * @private
     */
    #fixEditorContainerOrder() {
        try {
            const codeEditorContainer = document.querySelector('.code-editor-container');
            if (!codeEditorContainer) return;
            
            // エディタと実行結果のDOMエレメントを取得
            const editorContainer = document.getElementById('monacoEditorContainer');
            const executionPreview = document.getElementById('codeExecutionPreview');
            if (!editorContainer || !executionPreview) return;

            console.log('[ChatUI] エディタと実行結果の順序を修正します');
            
            // 現在の親要素
            const parent = editorContainer.parentElement;
            if (!parent) return;
            
            // 一旦両方の要素を削除
            parent.removeChild(editorContainer);
            parent.removeChild(executionPreview);
            
            // 正しい順序で再追加（エディタが先、実行結果が後）
            parent.appendChild(editorContainer);
            parent.appendChild(executionPreview);
            
            // スタイルを明示的に設定
            editorContainer.style.order = '1';
            executionPreview.style.order = '2';
            
            // 各要素のスタイルを確保
            editorContainer.style.display = 'block';
            editorContainer.style.height = 'calc(50% - 10px)';
            editorContainer.style.minHeight = '300px';
            
            executionPreview.style.display = 'block';
            executionPreview.style.height = 'calc(50% - 20px)';
            executionPreview.style.marginTop = 'var(--spacing-md)';
            
            console.log('[ChatUI] エディタと実行結果の順序の修正が完了しました');
        } catch (err) {
            console.error('[ChatUI] エディタと実行結果の順序修正中にエラーが発生しました:', err);
        }
    }

    /**
     * エディターのロードに失敗した場合の単純なテキストエリアを表示する
     * @param {HTMLElement} container - エディタを表示するコンテナ要素
     * @param {string} code - 初期コード
     * @param {string} language - プログラミング言語
     * @private
     */
    #showSimpleEditorFallback(container, code, language) {
        console.log('[ChatUI] シンプルエディタフォールバックを表示します');
        
        // シンプルなエディタを作成
        const simpleEditor = document.createElement('div');
        simpleEditor.className = 'simple-editor-fallback';
        
        // シンプルエディタの上部ステータスバー
        const statusBar = document.createElement('div');
        statusBar.style.cssText = 'padding: 0.5rem; background-color: #300; color: #f88; margin-bottom: 10px; border-radius: 4px;';
        statusBar.innerHTML = '<p>拡張エディタをロードできませんでした。シンプルエディタを使用します。</p>';
        
        // テキストエリア作成
        const textArea = document.createElement('textarea');
        textArea.id = 'simpleCodeEditor';
        textArea.style.cssText = 'width: 100%; height: 270px; background: #1e1e1e; color: #ddd; border: 1px solid #444; padding: 10px; font-family: Consolas, monospace; tab-size: 4;';
        textArea.value = code || '';
        
        // 言語表示ラベル
        const languageLabel = document.createElement('div');
        languageLabel.style.cssText = 'margin-top: 10px; padding: 5px; background: #222; color: #aaa; font-size: 12px; border-radius: 4px;';
        languageLabel.textContent = `言語: ${language || 'javascript'}`;
        
        // コンテナの表示を強制的に有効化
        container.style.display = 'block'; 
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        container.style.height = '300px';
        container.style.width = '100%';
        container.style.backgroundColor = '#1e1e1e';
        
        // ローディング表示を全て消去
        const loadingEls = document.querySelectorAll('#editor-loading-indicator, #monaco-loading-indicator');
        loadingEls.forEach(el => {
            try {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            } catch (e) { /* エラー無視 */ }
        });
        
        // コンテナをクリアして要素を追加
        container.innerHTML = '';
        simpleEditor.appendChild(statusBar);
        simpleEditor.appendChild(textArea);
        simpleEditor.appendChild(languageLabel);
        container.appendChild(simpleEditor);
        
        // フォーカスをテキストエリアに設定 (少し遅延を長めに)
        setTimeout(() => {
            try {
                textArea.focus();
                textArea.selectionStart = 0;
                textArea.selectionEnd = 0;
                console.log('[ChatUI] シンプルエディタにフォーカスを当てました');
            } catch (err) {
                console.warn('[ChatUI] シンプルエディタのフォーカスに失敗:', err);
            }
            
            // Tab キーの処理（インデント用）
            textArea.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = textArea.selectionStart;
                    const end = textArea.selectionEnd;
                    
                    // カーソル位置にタブを挿入
                    textArea.value = textArea.value.substring(0, start) + '    ' + textArea.value.substring(end);
                    
                    // カーソル位置を調整
                    textArea.selectionStart = textArea.selectionEnd = start + 4;
                }
            });
            
            console.log('[ChatUI] シンプルエディタの準備が完了しました');
        }, 100);
        
        // シンプルエディタが使用されていることを記録
        this.#simpleEditorFallbackUsed = true;
    }
}
