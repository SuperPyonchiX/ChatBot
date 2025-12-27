/**
 * MonacoEditorController.js
 * Monaco Editorの管理と操作を行うクラス
 */
class MonacoEditorController {
    // シングルトンインスタンス
    static #instance = null;
    
    // プライベートフィールド
    #editor = null;
    #monaco = null;
    #executeCallback = null;
    #currentLanguage = 'javascript';
    #isInitialized = false;
    
    /**
     * プライベートコンストラクタ
     */
    constructor() {
        if (MonacoEditorController.#instance) {
            throw new Error('MonacoEditorControllerクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
    }
    
    /**
     * シングルトンインスタンスを取得します
     * @returns {MonacoEditorController} MonacoEditorControllerのインスタンス
     */
    static get getInstance() {
        if (!MonacoEditorController.#instance) {
            MonacoEditorController.#instance = new MonacoEditorController();
        }
        return MonacoEditorController.#instance;
    }
    
    /**
     * Monacoエディタを初期化します
     * @param {HTMLElement} container - エディタを配置するコンテナ要素
     * @param {string} code - 初期コード
     * @param {string} language - コードの言語
     * @returns {Promise<object>} Monacoエディタインスタンス
     */    async initialize(container, code, language = 'javascript') {
        // 初期化開始時間を記録（デバッグ用）
        const startTime = Date.now();
        
        if (!container) {
            throw new Error('エディタコンテナが指定されていません');
        }
        
        this.#currentLanguage = language || 'javascript';
        
        console.log('[MonacoEditorController] initialize - コード長さ:', code ? code.length : 0);
        console.log('[MonacoEditorController] initialize - 言語:', language);
          // 既存のローディング表示を削除
        const existingLoadingEl = document.getElementById('editor-loading-indicator');
        if (existingLoadingEl) {
            existingLoadingEl.remove();
        }
        
        // コンテナが空でない場合、エディタインスタンスが既に存在する可能性がある
        // その場合は内容を保持する
        if (!this.#isInitialized || !this.#editor) {
            container.innerHTML = '';
        }
        
        // コンテナにローディングメッセージを表示
        const loadingElement = document.createElement('div');
        loadingElement.id = 'monaco-loading-indicator'; // IDを設定
        loadingElement.style.cssText = 'display:flex; justify-content:center; align-items:center; height:100%; background:#1e1e1e; color:#fff; position:absolute; top:0; left:0; right:0; bottom:0; z-index:10;';
        loadingElement.textContent = 'エディタを読み込み中...';
        container.appendChild(loadingElement);
        
        return new Promise((resolve, reject) => {
            // 既に初期化済みの場合
            if (this.#isInitialized && this.#editor) {
                console.log('[MonacoEditorController] エディタはすでに初期化されています。モデルを更新します');
                try {
                    this.updateModel(code, language);
                    resolve(this.#editor);
                } catch (err) {
                    console.error('既存エディタの更新に失敗:', err);
                    // エラーが発生した場合は再初期化を試みる
                    this.#isInitialized = false;
                    this.#editor = null;
                }
                return;
            }            // モナコエディタを直接インラインで初期化する方法
            const setupMonacoDirectly = () => {
                try {
                    // 完全に新しいアプローチ - スタンドアロンモードを使用する
                    console.log('スタンドアロンモードでMonacoエディタを初期化します');
                    
                    // スタイルを追加
                    const addStyles = () => {
                        if (!document.getElementById('monaco-standalone-styles')) {
                            const style = document.createElement('style');
                            style.id = 'monaco-standalone-styles';
                            style.textContent = `
                                .monaco-editor { width: 100%; height: 100%; }
                                .monaco-editor .monaco-editor-background { background-color: #1e1e1e; }
                                .monaco-editor .margin { background-color: #1e1e1e; }
                                .monaco-editor .lines-content { color: #d4d4d4; }
                            `;
                            document.head.appendChild(style);
                        }
                    };
                    
                    addStyles();
                    
                    // 新しい要素を作成して、Monaco Editor用の独自のコンテンツを持たせる
                    container.innerHTML = '';
                    const editorElement = document.createElement('div');
                    editorElement.style.width = '100%';
                    editorElement.style.height = '100%';
                    editorElement.style.position = 'relative';
                    editorElement.style.backgroundColor = '#1e1e1e';
                    editorElement.style.color = '#d4d4d4';
                    editorElement.textContent = code || '';
                    container.appendChild(editorElement);
                    
                    // 直接ライブラリをロードする代わりに、編集可能なテキストエリアを表示
                    const editorArea = document.createElement('textarea');
                    editorArea.value = code || '';
                    editorArea.style.width = '100%';
                    editorArea.style.height = '100%';
                    editorArea.style.backgroundColor = '#1e1e1e';
                    editorArea.style.color = '#d4d4d4';
                    editorArea.style.fontFamily = 'Consolas, "Courier New", monospace';
                    editorArea.style.fontSize = '14px';
                    editorArea.style.lineHeight = '1.5';
                    editorArea.style.padding = '10px';
                    editorArea.style.border = 'none';
                    editorArea.style.resize = 'none';
                    editorArea.style.outline = 'none';
                    
                    // テキストエリアに変更イベントを追加
                    editorArea.addEventListener('input', () => {
                        // ここで必要に応じてコードの変更を処理
                    });
                      // コンテナをクリアして、テキストエリアを追加
                    console.log('[MonacoEditorController] シンプルエディタを配置します', code.length);
                    container.innerHTML = '';
                    container.appendChild(editorArea);
                    
                    // 基本的なエディタとして振る舞うオブジェクトを作成
                    this.#monaco = {
                        editor: {
                            create: function() { 
                                console.log('[MonacoEditorController] シンプルエディタを作成しました');
                                return editorArea; 
                            }
                        },
                        KeyMod: {
                            CtrlCmd: 1
                        },
                        KeyCode: {
                            KeyS: 83, 
                            Enter: 13
                        }
                    };
                    
                    console.log('[MonacoEditorController] エディタオブジェクトを設定します');
                    this.#editor = editorArea;
                    
                    // モデルを模倣するメソッドを追加
                    this.#editor.getValue = function() {
                        return editorArea.value;
                    };
                    
                    this.#editor.setValue = function(value) {
                        editorArea.value = value;
                    };
                    
                    this.#editor.getModel = function() {
                        return { 
                            getValue: function() { return editorArea.value; },
                            setLanguage: function() {}
                        };
                    };
                    
                    this.#editor.addCommand = function(keyCombination, handler) {
                        editorArea.addEventListener('keydown', function(e) {
                            if ((e.ctrlKey || e.metaKey) && e.keyCode === keyCombination - 1) {
                                handler();
                            }
                        });
                    };
                    
                    this.#editor.layout = function() {};
                    this.#editor.focus = function() { 
                        setTimeout(() => editorArea.focus(), 10); 
                    };
                    this.#editor.dispose = function() {};
                    
                    // 成功として解決
                    this.#isInitialized = true;
                    console.log('シンプルエディタの初期化が完了しました');
                    resolve(this.#editor);
                    
                } catch (err) {
                    console.error('エディタ初期化エラー:', err);
                    reject(err);
                }
            };
            
            // Monaco が既にロードされているか確認
            // @ts-ignore - monaco は動的にロードされるグローバル変数
            if (window.monaco && window.monaco.editor) {
                console.log('[MonacoEditorController] Monaco はすでに利用可能です');
                this.#setupMonacoEditor(container, code, language);
                if (this.#editor) {
                    resolve(this.#editor);
                } else {
                    reject(new Error('既存のMonacoでエディタを初期化できませんでした'));
                }
            } else {
                // すでにスクリプトが読み込まれているか確認
                const monacoScript = document.querySelector('script[src*="monaco-editor"]');
                if (monacoScript) {
                    console.log('[MonacoEditorController] Monaco スクリプトはページ内に既に存在します');
                    // スクリプトがあるけどmonaco objectがまだない場合は少し待つ
                    setTimeout(() => {
                        // @ts-ignore - monaco は動的にロードされるグローバル変数
                        if (window.monaco) {
                            this.#setupMonacoEditor(container, code, language);
                            resolve(this.#editor);
                        } else {
                            // 直接読み込み方式を試す
                            setupMonacoDirectly();
                        }
                    }, 500);
                } else {
                    console.log('[MonacoEditorController] 新規にMonacoをロードします');
                    setupMonacoDirectly();
                }
            }
        });
    }    /**
     * Monaco Editorをセットアップします
     * @param {HTMLElement} container - エディタを配置するコンテナ要素
     * @param {string} code - 初期コード
     * @param {string} language - コードの言語
     */
    #setupMonacoEditor(container, code, language) {
        console.log("[MonacoEditorController] setupMonacoEditor 開始");
        
        try {
            // 再度初期化する場合は、既存のエディタを破棄
            if (this.#editor) {
                this.#editor.dispose();
                this.#editor = null;
            }
            
            // @ts-ignore - monaco は動的にロードされるグローバル変数
            if (!window.monaco) {
                console.error("Monaco が初期化されていません");
                container.innerHTML = '<div style="color:red; padding:20px;">Monaco Editorが見つかりません。</div>';
                return;
            }
            
            // @ts-ignore - monaco は動的にロードされるグローバル変数
            this.#monaco = window.monaco;
            
            // コードのデバッグログ追加
            console.log("Monaco Editorに設定するコード:", code);
            console.log("Monaco Editorに設定する言語:", language);
            
            // コンテナのスタイルを設定
            container.style.width = '100%';
            container.style.height = '300px';
            container.style.border = '1px solid #444';
            container.style.overflow = 'hidden';
            container.style.position = 'relative';
            
            // ローディング表示を挿入
            container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; background:#1e1e1e; color:#fff;">エディタを準備中...</div>';
            
            // 編集するコードを確保
            const editCode = code || '';
            const editLang = language || 'javascript';
            
            console.log(`エディタに設定するコード(${editCode.length}文字):`, editCode.substring(0, 50) + (editCode.length > 50 ? '...' : ''));
            
            // スタンドアロンで動作するためのエディタ作成関数
            const createEditor = () => {
                // ローディング表示を削除
                container.innerHTML = '';
                
                try {
                    // エディタオプション
                    const options = {
                        value: editCode,
                        language: this.#mapLanguage(editLang),
                        theme: 'vs-dark',
                        automaticLayout: true,
                        fontFamily: 'Consolas, "Courier New", monospace',
                        fontSize: 14,
                        tabSize: 2,
                        minimap: {
                            enabled: false
                        },
                        scrollBeyondLastLine: false,
                        scrollbar: {
                            alwaysConsumeMouseWheel: false
                        },
                        folding: true,
                        lineNumbers: 'on',
                        wordWrap: 'on'
                    };
                      // エディタを作成する前に重要なチェック
                    console.log("モナコエディタを作成します...");
                    if (!this.#monaco || !this.#monaco.editor || typeof this.#monaco.editor.create !== 'function') {
                        console.error("有効なモナコエディタオブジェクトが見つかりません");
                        console.log("monaco:", this.#monaco);
                        container.innerHTML = '<div style="color:red; padding:20px;">有効なモナコエディタが見つかりません</div>';
                        return false;
                    }
                    
                    try {
                        this.#editor = this.#monaco.editor.create(container, options);
                    } catch (e) {
                        console.error("エディタの作成中にエラーが発生しました:", e);
                        container.innerHTML = '<div style="color:red; padding:20px;">エディタの作成に失敗しました: ' + e.message + '</div>';
                        return false;
                    }
                    
                    if (!this.#editor) {
                        console.error("エディタの作成に失敗しました");
                        container.innerHTML = '<div style="color:red; padding:20px;">エディタの作成に失敗しました。</div>';
                        return false;
                    }
                    
                    // モデルを確認
                    const model = this.#editor.getModel();
                    if (!model) {
                        // モデルがない場合は新しいモデルを作成
                        try {
                            const newModel = this.#monaco.editor.createModel(
                                editCode,
                                this.#mapLanguage(editLang)
                            );
                            this.#editor.setModel(newModel);
                            console.log("新しいエディタモデルを作成しました");
                        } catch (modelErr) {
                            console.warn("エディタモデルの作成に失敗:", modelErr);
                        }
                    } else {
                        console.log("エディタモデルが正常に作成されました");
                    }
                    
                    // キーボードショートカットの設定
                    try {
                        this.#editor.addCommand(
                            this.#monaco.KeyMod.CtrlCmd | this.#monaco.KeyCode.KeyS,
                            () => {
                                console.log("ショートカット: 保存");
                            }
                        );
                        
                        this.#editor.addCommand(
                            this.#monaco.KeyMod.CtrlCmd | this.#monaco.KeyCode.Enter,
                            () => {
                                console.log("ショートカット: 実行");
                                if (this.#executeCallback) {
                                    this.#executeCallback(this.getCode(), this.getLanguage());
                                }
                            }
                        );
                    } catch (commandErr) {
                        console.warn("キーボードショートカット設定エラー:", commandErr);
                    }
                    
                    // サイズ変更処理を追加
                    window.addEventListener('resize', () => {
                        if (this.#editor) {
                            this.#editor.layout();
                        }
                    });
                    
                    // 初期化フラグを設定
                    this.#isInitialized = true;
                    console.log('Monaco Editorの初期化が完了しました');
                    
                    // フォーカスを設定
                    setTimeout(() => {
                        if (this.#editor) {
                            try {
                                this.#editor.focus();
                            } catch (focusErr) {
                                console.warn("フォーカス設定エラー:", focusErr);
                            }
                        }
                    }, 100);
                    
                    return true;
                } catch (error) {
                    console.error('Monaco Editorの作成に失敗しました:', error);
                    container.innerHTML = '<div style="color:red; padding:20px;">エディタの初期化に失敗しました。</div>';
                    return false;
                }
            };
            
            // 少し遅延させてエディタを作成（DOMが確実に準備できるように）
            setTimeout(createEditor, 200);
            
        } catch (error) {
            console.error('Monaco Editorのセットアップエラー:', error);
            container.innerHTML = '<div style="color:red; padding:20px;">エディタのセットアップに失敗しました。</div>';
        }
    }    /**
     * エディタのモデルを更新します
     * @param {string} code - 新しいコード
     * @param {string} language - 新しい言語
     */
    updateModel(code, language) {
        if (!this.#editor) {
            console.error('エディタが初期化されていません');
            return;
        }
        
        try {
            console.log('[MonacoEditorController] updateModel - コード更新:', code);
            console.log('[MonacoEditorController] updateModel - 言語更新:', language);
            
            // コードを安全に処理
            const safeCode = code || '';
            this.#currentLanguage = language || 'javascript';
              // エディタコンテナからローディング表示を削除
            const editorContainer = this.#editor.parentElement;
            if (editorContainer) {
                const loadingEls = editorContainer.querySelectorAll('div[style*="display:flex;justify-content:center"]');
                loadingEls.forEach(el => editorContainer.removeChild(el));
            }            // エディタ周辺のローディング表示を削除
            try {
                // すべてのローディングインジケータを削除
                const allLoadingEls = document.querySelectorAll('#editor-loading-indicator, #monaco-loading-indicator');
                allLoadingEls.forEach(el => {
                    try {
                        if (el && el.parentNode) {
                            el.parentNode.removeChild(el);
                        }
                    } catch (e) {
                        console.warn('ローディング表示削除エラー:', e);
                    }
                });
                
                // エディタのコンテナが見つかれば表示設定を調整
                const editorParent = this.#editor.parentElement;
                if (editorParent) {
                    editorParent.style.display = 'block';
                    editorParent.style.visibility = 'visible';
                    editorParent.style.opacity = '1';
                    
                    // サイズも明示的に設定
                    editorParent.style.height = editorParent.style.height || '270px';
                    editorParent.style.width = '100%';
                    
                    console.log('[MonacoEditorController] エディタコンテナのスタイルを調整しました');
                }
            } catch (err) {
                console.warn('[MonacoEditorController] エディタコンテナのスタイル調整中にエラー:', err);
            }
            
            // エディタがテキストエリアの場合（シンプルモード）
            if (this.#editor.tagName && this.#editor.tagName.toLowerCase() === 'textarea') {
                this.#editor.value = safeCode;
                // テキストエリアも明示的に表示
                this.#editor.style.display = 'block';
                this.#editor.style.visibility = 'visible';
                console.log('[MonacoEditorController] シンプルエディタを更新しました');
                return;
            }
            
            // Monaco Editorの場合
            if (this.#monaco && typeof this.#editor.getValue === 'function') {
                try {
                    // モデルを取得
                    const model = this.#editor.getModel();
                    
                    if (model) {
                        // 言語を設定（可能な場合のみ）
                        if (this.#monaco.editor && typeof this.#monaco.editor.setModelLanguage === 'function') {
                            const safeLang = this.#mapLanguage(this.#currentLanguage);
                            this.#monaco.editor.setModelLanguage(model, safeLang);
                        }
                        
                        // 値を設定（複数の方法を試行）
                        if (typeof this.#editor.executeEdits === 'function') {
                            try {
                                this.#editor.executeEdits('update-model', [{
                                    range: model.getFullModelRange(),
                                    text: safeCode,
                                    forceMoveMarkers: true
                                }]);
                            } catch (e) {
                                console.warn('executeEditsによる更新に失敗:', e);
                                
                                // バックアップ方法
                                if (typeof this.#editor.setValue === 'function') {
                                    this.#editor.setValue(safeCode);
                                }
                            }
                        } else if (typeof this.#editor.setValue === 'function') {
                            this.#editor.setValue(safeCode);
                        }
                        
                        console.log('エディタモデルを正常に更新しました');
                    } else {
                        console.warn('エディタモデルがnullです - 直接値を設定します');
                        if (typeof this.#editor.setValue === 'function') {
                            this.#editor.setValue(safeCode);
                        }
                    }
                } catch (error) {
                    console.error('Monaco エディタの更新に失敗:', error);
                    
                    // 最後の手段 - テキストベースで値を設定
                    if (typeof this.#editor.setValue === 'function') {
                        this.#editor.setValue(safeCode);
                    }
                }
            } else {
                console.error('互換性のあるエディタインターフェースが見つかりません');
            }
        } catch (error) {
            console.error('エディタモデルの更新に失敗しました:', error);
        }
    }
    
    /**
     * 言語名をMonacoエディタで使用される言語IDにマッピングします
     * @param {string} languageName - マッピングする言語名
     * @returns {string} Monacoエディタの言語ID
     */
    #mapLanguage(languageName) {
        if (!languageName) return 'plaintext';
        
        const languageMap = {
            'js': 'javascript',
            'javascript': 'javascript',
            'ts': 'typescript',
            'typescript': 'typescript',
            'python': 'python',
            'py': 'python',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'java': 'java',
            'csharp': 'csharp',
            'cs': 'csharp',
            'c': 'c',
            'cpp': 'cpp',
            'php': 'php',
            'ruby': 'ruby',
            'rb': 'ruby',
            'go': 'go',
            'rust': 'rust',
            'swift': 'swift',
            'kotlin': 'kotlin',
            'sql': 'sql',
            'bash': 'shell',
            'shell': 'shell',
            'sh': 'shell',
            'markdown': 'markdown',
            'md': 'markdown',
            'yaml': 'yaml',
            'yml': 'yaml',
            'xml': 'xml',
            'plaintext': 'plaintext'
        };
        
        return languageMap[languageName.toLowerCase()] || 'plaintext';
    }    /**
     * 現在のコードを取得します
     * @returns {string} 現在のコード
     */
    getCode() {
        try {
            if (!this.#editor) {
                console.warn('エディタが初期化されていません');
                return '';
            }
            
            // テキストエリアの場合（シンプルモード）
            if (this.#editor.tagName && this.#editor.tagName.toLowerCase() === 'textarea') {
                return this.#editor.value || '';
            }
            
            // Monaco Editor の場合
            if (typeof this.#editor.getValue === 'function') {
                return this.#editor.getValue() || '';
            }
            
            console.warn('互換性のあるエディタメソッドが見つかりません');
            return '';
        } catch (error) {
            console.error('コード取得エラー:', error);
            return '';
        }
    }
    
    /**
     * 現在の言語を取得します
     * @returns {string} 現在の言語
     */
    getLanguage() {
        return this.#currentLanguage || 'javascript';
    }
    
    /**
     * コード実行コールバックを設定します
     * @param {Function} callback - コード実行時に呼び出されるコールバック
     */
    setExecuteCallback(callback) {
        if (typeof callback === 'function') {
            this.#executeCallback = callback;
        }
    }
    
    /**
     * エディタのサイズをコンテナに合わせて調整します
     */
    resizeEditor() {
        if (this.#editor) {
            this.#editor.layout();
        }
    }
    
    /**
     * エディタを破棄します
     */
    dispose() {
        if (this.#editor) {
            this.#editor.dispose();
            this.#editor = null;
        }
    }
    
    /**
     * エディタにフォーカスを当てる
     */
    focus() {
        if (!this.#editor) {
            console.warn('[MonacoEditorController] フォーカスするエディタがありません');
            return false;
        }
        
        try {
            if (this.#editor.tagName && this.#editor.tagName.toLowerCase() === 'textarea') {
                // シンプルエディタ（テキストエリア）の場合
                this.#editor.focus();
                console.log('[MonacoEditorController] シンプルエディタにフォーカスしました');
                return true;
            } else if (typeof this.#editor.focus === 'function') {
                // Monacoエディタの場合
                this.#editor.focus();
                console.log('[MonacoEditorController] Monacoエディタにフォーカスしました');
                return true;
            } else {
                console.warn('[MonacoEditorController] エディタのフォーカスメソッドが見つかりません');
                return false;
            }
        } catch (err) {
            console.error('[MonacoEditorController] フォーカス設定中にエラー:', err);
            return false;
        }
    }
}