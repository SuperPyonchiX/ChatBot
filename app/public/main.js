/**
 * main.js
 * アプリケーションのエントリーポイントとなるファイルです
 * 
 * アプリケーションの初期化、イベントリスナー設定、状態管理を担当します。
 * UI.js、API.js、Chat.js、Storage.jsなどの他のモジュールと連携して
 * チャットアプリケーション全体の動作を制御します。
 * 
 * @module Main
 */

document.addEventListener('DOMContentLoaded', async function() {
    // 初期化
    _init();

    // 外部ライブラリの読み込み - Markdown用
    Markdown.getInstance.loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js')
        .then(() => {
            console.log('Marked.js loaded successfully');
        })
        .catch(err => console.error('Failed to load Marked.js:', err));
        
    // Prism.jsコンポーネントの読み込み
    _loadPrismComponents();

    /**
     * アプリケーションを初期化します
     * API設定の確認、会話履歴の読み込み、イベントリスナーの設定を行います
     *
     * @function _init
     */
    function _init() {
        // UI初期化
        if (UI.getInstance && UI.getInstance.initialize) {
            UI.getInstance.initialize();
        } else {
            console.warn('UI.initializeが見つかりません');
            // フォールバック: サイドバートグルボタンを個別に作成
            if (UI.getInstance && Sidebar.getInstance.createSidebarToggle) {
                Sidebar.getInstance.createSidebarToggle();
            }
        }

        // ツールマネージャーの初期化
        if (typeof ToolManager !== 'undefined') {
            ToolManager.getInstance.initialize().catch(err => {
                console.warn('ToolManager初期化エラー:', err);
            });
        }

        _loadConversations();
        _setupEventListeners();
    }

    /**
     * 会話履歴を読み込みます
     * 保存されている会話をロードし、現在の会話を設定します
     * 
     * @function _loadConversations
     */
    function _loadConversations() {
        if (!window.AppState) {
            console.error('AppState module is not loaded');
            return;
        }

        if (window.AppState.conversations.length > 0) {
            ChatActions.getInstance.renderChatHistory();
        }

        // 新しい会話を作成または既存の会話を読み込む
        if (window.AppState.conversations.length === 0) {
            ChatActions.getInstance.createNewConversation();
        } else {
            _loadCurrentConversation();
        }
    }

    /**
     * イベントリスナーをセットアップします
     * アプリケーションで使用する全てのイベントリスナーを初期化します
     * 
     * @function _setupEventListeners
     */
    function _setupEventListeners() {
        if (!EventHandlers.getInstance) {
            console.error('EventHandlers module is not loaded');
            return;
        }

        EventHandlers.getInstance.setupChatEvents();
        EventHandlers.getInstance.setupSettingsEvents();
        EventHandlers.getInstance.setupFileEvents();
        EventHandlers.getInstance.setupModalEvents();
        EventHandlers.getInstance.setupGlobalEvents();
        
        ChatShell.getInstance.initialize();
    }

    /**
     * 現在の会話を読み込みます
     * 現在選択されている会話をUIに表示します
     * 
     * @function _loadCurrentConversation
     */
    function _loadCurrentConversation() {
        if (!window.AppState.currentConversationId || 
            !window.AppState.getConversationById(window.AppState.currentConversationId)) {
            window.AppState.currentConversationId = window.AppState.conversations[0]?.id;
            if (!window.AppState.currentConversationId) {
                ChatActions.getInstance.createNewConversation();
                return;
            }
        }

        // 会話履歴から現在の会話を選択状態にする
        ChatHistory.getInstance.updateActiveChatInHistory(window.AppState.currentConversationId);

        // チャットメッセージを表示
        if (window.Elements.chatMessages && window.Elements.modelSelect) {
            ChatHistory.getInstance.displayConversation(
                window.AppState.getConversationById(window.AppState.currentConversationId),
                window.Elements.chatMessages,
                window.Elements.modelSelect
            );
            
            // 添付ファイルを表示
            FileAttachment.getInstance.displaySavedAttachments(window.AppState.currentConversationId, window.Elements.chatMessages);
        }
    }

    /**
     * Prism.jsの各言語コンポーネントを動的に読み込みます
     * 
     * 言語コンポーネントには依存関係があり（clike → javascript / c / csharp / java / go、
     * c → cpp、javascript → typescript、basic → visual-basic → vbnet）、
     * 依存先より先に評価されると "Cannot set properties of undefined" で失敗する。
     * そのため段ごとに順番に読み込み、同じ段の中だけ並列にする。
     * 
     * @function _loadPrismComponents
     */
    function _loadPrismComponents() {
        // 依存の浅いものから順に。同じ配列の中は互いに独立しているので並列で読んでよい
        const componentStages = [
            // 1段目: 他の言語のベースになるもの
            ['prism-clike.min.js', 'prism-markup.min.js', 'prism-basic.min.js'],
            // 2段目: 1段目にのみ依存するもの
            [
                'prism-javascript.min.js',
                'prism-css.min.js',
                'prism-python.min.js',
                'prism-json.min.js',
                'prism-c.min.js',
                'prism-csharp.min.js',
                'prism-java.min.js',
                'prism-go.min.js',
                'prism-rust.min.js',
                'prism-sql.min.js',
                'prism-bash.min.js',
                'prism-visual-basic.min.js'
            ],
            // 3段目: 2段目に依存するもの
            ['prism-typescript.min.js', 'prism-cpp.min.js', 'prism-vbnet.min.js']
        ];
        
        const plugins = [
            // 'prism-toolbar.min.js',
            // 'prism-copy-to-clipboard.min.js',
            // 'prism-line-numbers.min.js',
            // 'prism-show-language.min.js'
        ];
        
        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.crossOrigin = "anonymous";
                script.referrerPolicy = "no-referrer";
                script.onload = () => resolve();
                script.onerror = (e) => reject(e);
                document.head.appendChild(script);
            });
        };
        
        const loadComponents = (components) => Promise.all(
            components.map(component => 
                loadScript(`https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/${component}`)
            )
        );
        
        // 段ごとに直列、段の中は並列で読み込む
        componentStages
            .reduce(
                (chain, stage) => chain.then(() => loadComponents(stage)),
                Promise.resolve()
            )
            .then(() => {
                console.log('[Main] Prism言語コンポーネントを読み込みました');
                // プラグインの読み込み
                return Promise.all(
                    plugins.map(plugin => 
                        loadScript(`https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/${plugin}`)
                    )
                );
            })
            .then(() => {
                console.log('[Main] Prismプラグインを読み込みました');
                // Prismの初期化（クライアント側のHTMLをハイライト）
                if (typeof Prism !== 'undefined') {
                    Prism.highlightAll();
                }
            })
            .catch(err => console.error('[Main] Prismコンポーネントの読み込みエラー:', err));
    }
});