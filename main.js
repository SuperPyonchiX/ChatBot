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
            window.FileHandler.displaySavedAttachments(window.AppState.currentConversationId, window.Elements.chatMessages);
        }
    }
});