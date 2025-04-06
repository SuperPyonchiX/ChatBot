/**
 * appState.js
 * アプリケーションの状態管理を担当するモジュール
 */

window.AppState = (function() {
    // プライベート変数
    let _apiSettings = null;
    let _systemPrompt = '';
    let _systemPromptTemplates = {};
    let _conversations = [];
    let _currentConversationId = null;
    let _currentAttachments = [];

    return {
        /**
         * 初期化
         */
        initialize() {
            if (Storage.getInstance) {
                _apiSettings = Storage.getInstance.loadApiSettings() || {};
                _systemPrompt = Storage.getInstance.loadSystemPrompt() || '';
                _systemPromptTemplates = Storage.getInstance.loadSystemPromptTemplates() || {};
                _conversations = Storage.getInstance.loadConversations() || [];
                _currentConversationId = Storage.getInstance.loadCurrentConversationId() || null;
            } else {
                console.error('Storage module is not loaded');
                _apiSettings = {};
            }

            // グローバル設定を更新
            this.updateGlobalSettings();
            return this;
        },

        // Getters
        get conversations() { return _conversations; },
        set conversations(value) { _conversations = value; },
        
        get currentConversationId() { return _currentConversationId; },
        set currentConversationId(value) { _currentConversationId = value; },
        
        get apiSettings() { return _apiSettings; },
        set apiSettings(value) { _apiSettings = value; },
        
        get systemPrompt() { return _systemPrompt; },
        set systemPrompt(value) { _systemPrompt = value; },
        
        get systemPromptTemplates() { return _systemPromptTemplates; },
        set systemPromptTemplates(value) { _systemPromptTemplates = value; },
        
        get currentAttachments() { return _currentAttachments; },
        set currentAttachments(value) { _currentAttachments = value; },

        /**
         * 指定したIDの会話を取得します
         * @param {string} id - 会話ID
         * @returns {Object|null} - 会話オブジェクトまたはnull
         */
        getConversationById(id) {
            return _conversations.find(conv => conv.id === id) || null;
        },

        /**
         * グローバル設定を更新します
         */
        updateGlobalSettings() {
            window.apiSettings = _apiSettings;
        },

        /**
         * 現在のモデル名を取得します
         * @returns {string} 現在選択されているモデル名
         */
        getCurrentModel() {
            const modelSelect =window.UI.Cache.get('modelSelect');
            return modelSelect ? modelSelect.value : 'gpt-4o-mini';
        }
    }.initialize(); // 即時実行して初期化済みのオブジェクトを返す
})();