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

document.addEventListener('DOMContentLoaded', function() {
    // 初期化
    _init();

    // 外部ライブラリの読み込み - Markdown用
    window.Markdown.loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js')
        .then(() => {
            console.log('Marked.js loaded successfully');
            window.Markdown.initializeMarkdown();
        })
        .catch(err => console.error('Failed to load Marked.js:', err));
        
    // Prism.jsコンポーネントの読み込み
    _loadPrismComponents();

    /**
     * アプリケーションを初期化します
     * API設定の確認、会話履歴の読み込み、イベントリスナーの設定を行います
     * 
     * @function _init
     * @private
     */
    function _init() {
        // UI初期化
        if (window.UI && window.UI.initialize) {
            window.UI.initialize();
        } else {
            console.warn('UI.initializeが見つかりません');
            // フォールバック: サイドバートグルボタンを個別に作成
            if (window.UI && window.UI.Components.Sidebar.createSidebarToggle) {
                window.UI.Components.Sidebar.createSidebarToggle();
            }
        }
        
        // プロンプトマネージャーの初期化
        if (window.PromptManager) {
            window.PromptManager.init();
        }
        
        // プロンプトマネージャーのUIイベント設定
        if (window.UI && window.UI.setupPromptManagerEvents) {
            window.UI.setupPromptManagerEvents();
        }
        
        _loadConversations();
        _setupEventListeners();
    }

    /**
     * 会話履歴を読み込みます
     * 保存されている会話をロードし、現在の会話を設定します
     * 
     * @function _loadConversations
     * @private
     */
    function _loadConversations() {
        if (!window.AppState) {
            console.error('AppState module is not loaded');
            return;
        }

        if (window.AppState.conversations.length > 0) {
            window.Chat.Actions.renderChatHistory();
        }

        // 新しい会話を作成または既存の会話を読み込む
        if (window.AppState.conversations.length === 0) {
            window.Chat.Actions.createNewConversation();
        } else {
            _loadCurrentConversation();
        }
    }

    /**
     * イベントリスナーをセットアップします
     * アプリケーションで使用する全てのイベントリスナーを初期化します
     * 
     * @function _setupEventListeners
     * @private
     */
    function _setupEventListeners() {
        if (!window.EventHandlers) {
            console.error('EventHandlers module is not loaded');
            return;
        }

        window.EventHandlers.setupChatEvents();
        window.EventHandlers.setupSettingsEvents();
        window.EventHandlers.setupFileEvents();
        window.EventHandlers.setupModalEvents();
        window.EventHandlers.setupGlobalEvents();
        
        // プロンプト候補表示機能を初期化
        if (window.UI && window.UI.initPromptSuggestions) {
            window.UI.initPromptSuggestions();
        }
    }

    /**
     * 現在の会話を読み込みます
     * 現在選択されている会話をUIに表示します
     * 
     * @function _loadCurrentConversation
     * @private
     */
    function _loadCurrentConversation() {
        if (!window.AppState.currentConversationId || 
            !window.AppState.getConversationById(window.AppState.currentConversationId)) {
            window.AppState.currentConversationId = window.AppState.conversations[0]?.id;
            if (!window.AppState.currentConversationId) {
                window.Chat.Actions.createNewConversation();
                return;
            }
        }

        // 会話履歴から現在の会話を選択状態にする
        window.Chat.History.updateActiveChatInHistory(window.AppState.currentConversationId);

        // チャットメッセージを表示
        if (window.Elements.chatMessages && window.Elements.modelSelect) {
            window.Chat.History.displayConversation(
                window.AppState.getConversationById(window.AppState.currentConversationId),
                window.Elements.chatMessages,
                window.Elements.modelSelect
            );
            
            // 添付ファイルを表示
            window.UI.Components.FileAttachment.displaySavedAttachments(window.AppState.currentConversationId, window.Elements.chatMessages);
        }
    }

    /**
     * Prism.jsの各言語コンポーネントを動的に読み込みます
     * 
     * @function _loadPrismComponents
     * @private
     */
    function _loadPrismComponents() {
        const prismComponents = [
            // 基本コンポーネント (他の言語の基本となるもの)
            'prism-clike.min.js',
            'prism-markup.min.js',
            
            // 一般的な言語
            'prism-javascript.min.js',
            'prism-css.min.js',
            'prism-python.min.js',
            'prism-json.min.js',
            'prism-typescript.min.js',
            'prism-c.min.js',
            'prism-cpp.min.js',
            'prism-csharp.min.js',
            'prism-java.min.js',
            'prism-go.min.js',
            'prism-rust.min.js',
            'prism-sql.min.js',
            'prism-bash.min.js',
            
            // Visual Basic系言語 (依存関係の順序に注意)
            'prism-basic.min.js',            // Basic言語の基本コンポーネント
            'prism-visual-basic.min.js',     // Visual Basic
            'prism-vbnet.min.js'             // VB.NET
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
        
        // コンポーネントの読み込み
        Promise.all(
            prismComponents.map(component => 
                loadScript(`https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/${component}`)
            )
        )
        .then(() => {
            console.log('Prism language components loaded successfully');
            // プラグインの読み込み
            return Promise.all(
                plugins.map(plugin => 
                    loadScript(`https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/${plugin}`)
                )
            );
        })
        .then(() => {
            console.log('Prism plugins loaded successfully');
            // Prismの初期化（クライアント側のHTMLをハイライト）
            if (typeof Prism !== 'undefined') {
                Prism.highlightAll();
            }
        })
        .catch(err => console.error('Failed to load Prism components:', err));
    }
});