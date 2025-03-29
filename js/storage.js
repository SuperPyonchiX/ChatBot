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
     * LocalStorageが利用可能かどうかを確認
     * @private
     * @returns {boolean} LocalStorageが利用可能な場合はtrue
     */
    _isLocalStorageAvailable: function() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * ローカルストレージにアイテムを保存
     * @private
     * @param {string} key - 保存するキー
     * @param {*} value - 保存する値
     */
    _setItem: function(key, value) {
        if (!this._isLocalStorageAvailable()) {
            console.warn('LocalStorageが利用できないため、データを保存できません');
            return;
        }
        
        try {
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, String(value));
            }
        } catch (error) {
            // QuotaExceededErrorの場合、一部の古いデータを削除して再試行
            if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.warn('ストレージ容量が不足しています。古いデータを削除します');
                this._cleanupOldData();
                try {
                    if (typeof value === 'object') {
                        localStorage.setItem(key, JSON.stringify(value));
                    } else {
                        localStorage.setItem(key, String(value));
                    }
                } catch (retryError) {
                    console.error(`ストレージへの保存に失敗しました: ${key}`, retryError);
                }
            } else {
                console.error(`ストレージへの保存に失敗しました: ${key}`, error);
            }
        }
    },

    /**
     * ストレージ容量不足時に古いデータを削除
     * @private
     */
    _cleanupOldData: function() {
        try {
            // 会話履歴を取得
            const conversations = this.loadConversations();
            if (conversations.length > 10) {
                // 古い会話を削除（最新の10件を残す）
                const newConversations = conversations.slice(0, 10);
                this.saveConversations(newConversations);
            }
        } catch (error) {
            console.error('古いデータのクリーンアップに失敗しました', error);
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
        if (!this._isLocalStorageAvailable()) {
            console.warn('LocalStorageが利用できないため、データを読み込めません');
            return defaultValue;
        }
        
        try {
            const value = localStorage.getItem(key);
            if (value === null) {
                return defaultValue;
            }
            
            if (isJson) {
                try {
                    return JSON.parse(value);
                } catch (parseError) {
                    console.error(`JSONのパースに失敗しました: ${key}`, parseError);
                    return defaultValue;
                }
            }
            
            return value;
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
        this._setItem(this._KEYS.SIDEBAR, !!isCollapsed);
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
            if (!model) return;
            
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
                if (!model) return;
                
                const endpointKey = this._KEYS.AZURE_ENDPOINT_PREFIX + model;
                const endpoint = apiSettings.azureEndpoints[model] || '';
                this._setItem(endpointKey, endpoint);
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
        const templates = this._getItem(
            this._KEYS.PROMPT_TEMPLATES, 
            this._DEFAULTS.PROMPT_TEMPLATES, 
            true
        );
        
        // デフォルトテンプレートが必ず存在するようにする
        if (!templates.default) {
            templates.default = this._DEFAULTS.PROMPT_TEMPLATES.default;
        }
        
        return templates;
    },

    /**
     * プロンプトテンプレートを保存
     * @param {Object} promptTemplates - 保存するプロンプトテンプレート
     */
    savePromptTemplates: function(promptTemplates) {
        if (!promptTemplates || typeof promptTemplates !== 'object') return;
        
        // デフォルトテンプレートが必ず存在するようにする
        if (!promptTemplates.default) {
            promptTemplates.default = this._DEFAULTS.PROMPT_TEMPLATES.default;
        }
        
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
        categoryStates[categoryName] = !!isExpanded;
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
        const conversations = this._getItem(this._KEYS.CONVERSATIONS, [], true);
        
        // 無効なデータがあれば修正する
        return Array.isArray(conversations) ? conversations : [];
    },

    /**
     * 会話履歴をローカルストレージに保存
     * @param {Array} conversations - 保存する会話の配列
     */
    saveConversations: function(conversations) {
        if (!Array.isArray(conversations)) return;
        
        // 保存前に会話データの大きさをチェック
        if (conversations.length > 100) {
            // 最新の100件のみ保持
            conversations = conversations.slice(0, 100);
        }
        
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
        if (!this._isLocalStorageAvailable()) {
            console.warn('LocalStorageが利用できないため、データを削除できません');
            return;
        }
        
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
        if (!this._isLocalStorageAvailable()) {
            console.warn('LocalStorageが利用できないため、データをクリアできません');
            return;
        }
        
        try {
            localStorage.clear();
            console.log('ストレージの全データをクリアしました');
        } catch (error) {
            console.error('ストレージのクリアに失敗しました', error);
        }
    },
    
    /**
     * ストレージの使用状況を取得
     * @returns {Object} 使用容量と合計容量を含むオブジェクト
     */
    getStorageUsage: function() {
        if (!this._isLocalStorageAvailable()) {
            return { used: 0, total: 0, percentage: 0 };
        }
        
        let totalSize = 0;
        let storageSize = 5 * 1024 * 1024; // デフォルトは5MB (ブラウザによって異なる)
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                totalSize += (key.length + value.length) * 2; // UTF-16のため2倍
            }
            
            return {
                used: totalSize,
                total: storageSize,
                percentage: Math.floor((totalSize / storageSize) * 100)
            };
        } catch (error) {
            console.error('ストレージ使用状況の取得に失敗しました', error);
            return { used: 0, total: 0, percentage: 0 };
        }
    }
};