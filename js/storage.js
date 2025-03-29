/**
 * storage.js
 * ローカルストレージの読み書き機能を提供します
 */

// グローバルスコープに関数を公開
window.Storage = {
    /**
     * ストレージキーの定数
     * @private
     * @type {Object}
     */
    _KEYS: {
        SIDEBAR: 'sidebarCollapsed',
        OPENAI_API_KEY: 'openaiApiKey',
        AZURE_API_KEY: 'azureApiKey',
        API_TYPE: 'apiType',
        AZURE_ENDPOINT_PREFIX: 'azureEndpoint_',
        SYSTEM_PROMPT: 'systemPrompt',
        PROMPT_TEMPLATES: 'promptTemplates',
        CATEGORY_STATES: 'categoryStates',
        CONVERSATIONS: 'conversations',
        CURRENT_CONVERSATION_ID: 'currentConversationId'
    },

    /**
     * デフォルト値の定数
     * @private
     * @type {Object}
     */
    _DEFAULTS: {
        API_TYPE: 'openai',
        SYSTEM_PROMPT: 'あなたは知的で頼れる存在であり、熟練した開発者として、常に正確な回答を提供し、指示されたことのみを実行します。常に真実を述べ、事実に基づかない情報を作り出すことはありません。（以下のプロンプトに応答する際は、GitHub Flavored Markdown を適切に使用して回答をスタイリングしてください。見出し、リスト、色付きのテキスト、コードブロック、ハイライトなどにMarkdown構文を使用してください。ただし、Markdownやスタイリングについて言及しないようにしてください。）',
        PROMPT_TEMPLATES: {
            'default': 'あなたは知的で頼れる存在であり、熟練した開発者として、常に正確な回答を提供し、指示されたことのみを実行します。常に真実を述べ、事実に基づかない情報を作り出すことはありません。（以下のプロンプトに応答する際は、GitHub Flavored Markdown を適切に使用して回答をスタイリングしてください。見出し、リスト、色付きのテキスト、コードブロック、ハイライトなどにMarkdown構文を使用してください。ただし、Markdownやスタイリングについて言及しないようにしてください。）',
            'creative': 'あなたはクリエイティブで革新的なアイデアを提案できるAIアシスタントです。ユーザーの要望に対して、独創的で実現可能なソリューションを提供してください。',
            'technical': 'あなたは技術的な専門知識を持つエキスパートエンジニアです。コードの品質、セキュリティ、パフォーマンスを重視し、ベストプラクティスに基づいたアドバイスを提供してください。'
        },
        SUPPORTED_MODELS: ['gpt-4o-mini', 'gpt-4o', 'o1-mini', 'o1']
    },

    /**
     * ローカルストレージにアイテムを保存
     * @private
     * @param {string} key - 保存するキー
     * @param {*} value - 保存する値
     */
    _setItem: function(key, value) {
        try {
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
        } catch (error) {
            console.error(`ストレージへの保存に失敗しました: ${key}`, error);
        }
    },

    /**
     * ローカルストレージからアイテムを取得
     * @private
     * @param {string} key - 取得するキー
     * @param {*} defaultValue - 値が存在しない場合のデフォルト値
     * @param {boolean} isJson - JSONとしてパースするかどうか
     * @returns {*} 取得した値、またはデフォルト値
     */
    _getItem: function(key, defaultValue = '', isJson = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) {
                return defaultValue;
            }
            
            return isJson ? JSON.parse(value) : value;
        } catch (error) {
            console.error(`ストレージからの読み込みに失敗しました: ${key}`, error);
            return defaultValue;
        }
    },

    /**
     * サイドバーの状態を保存
     * @param {boolean} isCollapsed - サイドバーが折りたたまれているかどうか
     */
    saveSidebarState: function(isCollapsed) {
        this._setItem(this._KEYS.SIDEBAR, isCollapsed);
    },

    /**
     * サイドバーの状態を読み込む
     * @returns {boolean} サイドバーが折りたたまれているかどうか
     */
    loadSidebarState: function() {
        return this._getItem(this._KEYS.SIDEBAR) === 'true';
    },

    /**
     * APIキー設定を読み込む
     * @returns {Object} API設定オブジェクト
     */
    loadApiSettings: function() {
        const azureEndpoints = {};
        
        // サポートされているモデルのエンドポイント設定を読み込む
        this._DEFAULTS.SUPPORTED_MODELS.forEach(model => {
            const endpointKey = this._KEYS.AZURE_ENDPOINT_PREFIX + model;
            azureEndpoints[model] = this._getItem(endpointKey, '');
        });
        
        return {
            openaiApiKey: this._getItem(this._KEYS.OPENAI_API_KEY, ''),
            azureApiKey: this._getItem(this._KEYS.AZURE_API_KEY, ''),
            apiType: this._getItem(this._KEYS.API_TYPE, this._DEFAULTS.API_TYPE),
            azureEndpoints: azureEndpoints
        };
    },

    /**
     * API設定を保存
     * @param {Object} apiSettings - 保存するAPI設定オブジェクト
     */
    saveApiSettings: function(apiSettings) {
        if (!apiSettings) return;
        
        this._setItem(this._KEYS.OPENAI_API_KEY, apiSettings.openaiApiKey || '');
        this._setItem(this._KEYS.AZURE_API_KEY, apiSettings.azureApiKey || '');
        this._setItem(this._KEYS.API_TYPE, apiSettings.apiType || this._DEFAULTS.API_TYPE);
        
        // Azureエンドポイント設定を保存
        if (apiSettings.azureEndpoints) {
            this._DEFAULTS.SUPPORTED_MODELS.forEach(model => {
                const endpointKey = this._KEYS.AZURE_ENDPOINT_PREFIX + model;
                this._setItem(endpointKey, apiSettings.azureEndpoints[model] || '');
            });
        }
    },

    /**
     * システムプロンプトを読み込む
     * @returns {string} システムプロンプト
     */
    loadSystemPrompt: function() {
        return this._getItem(this._KEYS.SYSTEM_PROMPT, this._DEFAULTS.SYSTEM_PROMPT);
    },

    /**
     * システムプロンプトを保存
     * @param {string} systemPrompt - 保存するシステムプロンプト
     */
    saveSystemPrompt: function(systemPrompt) {
        if (typeof systemPrompt !== 'string') return;
        this._setItem(this._KEYS.SYSTEM_PROMPT, systemPrompt);
    },

    /**
     * プロンプトテンプレートを読み込む
     * @returns {Object} プロンプトテンプレートのオブジェクト
     */
    loadPromptTemplates: function() {
        return this._getItem(
            this._KEYS.PROMPT_TEMPLATES, 
            this._DEFAULTS.PROMPT_TEMPLATES, 
            true
        );
    },

    /**
     * プロンプトテンプレートを保存
     * @param {Object} promptTemplates - 保存するプロンプトテンプレート
     */
    savePromptTemplates: function(promptTemplates) {
        if (!promptTemplates || typeof promptTemplates !== 'object') return;
        this._setItem(this._KEYS.PROMPT_TEMPLATES, promptTemplates);
    },

    /**
     * カテゴリー設定状態（展開/折りたたみ）を保存
     * @param {string} categoryName - カテゴリー名
     * @param {boolean} isExpanded - 展開状態かどうか
     */
    saveCategoryState: function(categoryName, isExpanded) {
        if (!categoryName) return;
        
        const categoryStates = this.loadCategoryStates();
        categoryStates[categoryName] = isExpanded;
        this._setItem(this._KEYS.CATEGORY_STATES, categoryStates);
    },

    /**
     * カテゴリー設定状態を読み込む
     * @returns {Object} カテゴリーの状態オブジェクト
     */
    loadCategoryStates: function() {
        return this._getItem(this._KEYS.CATEGORY_STATES, {}, true);
    },

    /**
     * 会話履歴をローカルストレージから読み込む
     * @returns {Array} 会話オブジェクトの配列
     */
    loadConversations: function() {
        return this._getItem(this._KEYS.CONVERSATIONS, [], true);
    },

    /**
     * 会話履歴をローカルストレージに保存
     * @param {Array} conversations - 保存する会話の配列
     */
    saveConversations: function(conversations) {
        if (!Array.isArray(conversations)) return;
        this._setItem(this._KEYS.CONVERSATIONS, conversations);
    },

    /**
     * 現在の会話IDをローカルストレージから読み込む
     * @returns {string|null} 現在の会話ID
     */
    loadCurrentConversationId: function() {
        return this._getItem(this._KEYS.CURRENT_CONVERSATION_ID, null);
    },

    /**
     * 現在の会話IDをローカルストレージに保存
     * @param {string} currentConversationId - 保存する会話ID
     */
    saveCurrentConversationId: function(currentConversationId) {
        if (!currentConversationId) return;
        this._setItem(this._KEYS.CURRENT_CONVERSATION_ID, currentConversationId);
    },

    /**
     * 指定されたキーのデータを削除する
     * @param {string} key - 削除するキー
     */
    removeItem: function(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`ストレージからの削除に失敗しました: ${key}`, error);
        }
    },

    /**
     * すべてのデータをクリアする
     */
    clearAll: function() {
        try {
            localStorage.clear();
            console.log('ストレージの全データをクリアしました');
        } catch (error) {
            console.error('ストレージのクリアに失敗しました', error);
        }
    }
};