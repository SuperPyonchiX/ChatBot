/**
 * storage.js
 * ローカルストレージの読み書き機能を提供します
 */

// グローバルスコープに関数を公開
window.Storage = {
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
     * 保存前にセンシティブデータを暗号化する
     * @private
     * @param {string} key - 保存するキー
     * @param {*} value - 保存する値
     * @returns {*} 必要に応じて暗号化された値
     */
    _encryptSensitiveData: function(key, value) {
        // 暗号化対象のキーかどうかを判断
        const sensitiveKeys = [
            window.CONFIG.STORAGE.KEYS.OPENAI_API_KEY,
            window.CONFIG.STORAGE.KEYS.AZURE_API_KEY
        ];
        
        // Azureエンドポイント用のキーもチェック
        if (key.startsWith(window.CONFIG.STORAGE.KEYS.AZURE_ENDPOINT_PREFIX)) {
            sensitiveKeys.push(key);
        }
        
        // センシティブなデータかつ値が存在する場合は暗号化
        if (sensitiveKeys.includes(key) && value) {
            return window.CryptoHelper.encrypt(value);
        }
        
        return value;
    },
    
    /**
     * 読み込み後にセンシティブデータを復号化する
     * @private
     * @param {string} key - 読み込むキー
     * @param {*} value - 読み込んだ値
     * @returns {*} 必要に応じて復号化された値
     */
    _decryptSensitiveData: function(key, value) {
        // 暗号化対象のキーかどうかを判断
        const sensitiveKeys = [
            window.CONFIG.STORAGE.KEYS.OPENAI_API_KEY,
            window.CONFIG.STORAGE.KEYS.AZURE_API_KEY
        ];
        
        // Azureエンドポイント用のキーもチェック
        if (key.startsWith(window.CONFIG.STORAGE.KEYS.AZURE_ENDPOINT_PREFIX)) {
            sensitiveKeys.push(key);
        }
        
        // センシティブなデータかつ暗号化されている場合は復号化
        if (sensitiveKeys.includes(key) && window.CryptoHelper.isEncrypted(value)) {
            return window.CryptoHelper.decrypt(value);
        }
        
        return value;
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
            // センシティブデータの場合は暗号化
            const valueToStore = this._encryptSensitiveData(key, value);
            
            if (typeof valueToStore === 'object') {
                localStorage.setItem(key, JSON.stringify(valueToStore));
            } else {
                localStorage.setItem(key, String(valueToStore));
            }
        } catch (error) {
            // QuotaExceededErrorの場合、一部の古いデータを削除して再試行
            if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.warn('ストレージ容量が不足しています。古いデータを削除します');
                this._cleanupOldData();
                try {
                    // 再度暗号化処理を実行
                    const valueToStore = this._encryptSensitiveData(key, value);
                    
                    if (typeof valueToStore === 'object') {
                        localStorage.setItem(key, JSON.stringify(valueToStore));
                    } else {
                        localStorage.setItem(key, String(valueToStore));
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
            
            // JSON形式の場合
            if (isJson) {
                try {
                    const parsedValue = JSON.parse(value);
                    return parsedValue;
                } catch (parseError) {
                    console.error(`JSONのパースに失敗しました: ${key}`, parseError);
                    return defaultValue;
                }
            }
            
            // センシティブデータの場合は復号化
            return this._decryptSensitiveData(key, value);
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
        this._setItem(window.CONFIG.STORAGE.KEYS.SIDEBAR, !!isCollapsed);
    },

    /**
     * サイドバーの状態を読み込む
     * @returns {boolean} サイドバーが折りたたまれているかどうか
     */
    loadSidebarState: function() {
        return this._getItem(window.CONFIG.STORAGE.KEYS.SIDEBAR) === 'true';
    },

    /**
     * APIキー設定を読み込む
     * @returns {Object} API設定オブジェクト
     */
    loadApiSettings: function() {
        const azureEndpoints = {};
        
        // サポートされているモデルのエンドポイント設定を読み込む
        window.CONFIG.MODELS.SUPPORTED.forEach(model => {
            if (!model) return;
            
            const endpointKey = window.CONFIG.STORAGE.KEYS.AZURE_ENDPOINT_PREFIX + model;
            azureEndpoints[model] = this._getItem(endpointKey, '');
        });
        
        return {
            openaiApiKey: this._getItem(window.CONFIG.STORAGE.KEYS.OPENAI_API_KEY, ''),
            azureApiKey: this._getItem(window.CONFIG.STORAGE.KEYS.AZURE_API_KEY, ''),
            apiType: this._getItem(window.CONFIG.STORAGE.KEYS.API_TYPE, window.CONFIG.STORAGE.DEFAULT_API_TYPE),
            azureEndpoints
        };
    },
    
    /**
     * APIキー設定を保存
     * @param {Object} apiSettings - API設定オブジェクト
     */
    saveApiSettings: function(apiSettings) {
        if (!apiSettings) return;
        
        // 基本設定を保存
        this._setItem(window.CONFIG.STORAGE.KEYS.OPENAI_API_KEY, apiSettings.openaiApiKey || '');
        this._setItem(window.CONFIG.STORAGE.KEYS.AZURE_API_KEY, apiSettings.azureApiKey || '');
        this._setItem(window.CONFIG.STORAGE.KEYS.API_TYPE, apiSettings.apiType || window.CONFIG.STORAGE.DEFAULT_API_TYPE);
        
        // Azureエンドポイント設定を保存
        if (apiSettings.azureEndpoints) {
            window.CONFIG.MODELS.SUPPORTED.forEach(model => {
                if (!model) return;
                
                const endpointKey = window.CONFIG.STORAGE.KEYS.AZURE_ENDPOINT_PREFIX + model;
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
        return this._getItem(window.CONFIG.STORAGE.KEYS.SYSTEM_PROMPT, window.CONFIG.SYSTEM_PROMPTS.DEFAULT_SYSTEM_PROMPT);
    },

    /**
     * システムプロンプトを保存
     * @param {string} systemPrompt - 保存するシステムプロンプト
     */
    saveSystemPrompt: function(systemPrompt) {
        if (systemPrompt === undefined || systemPrompt === null) return;
        this._setItem(window.CONFIG.STORAGE.KEYS.SYSTEM_PROMPT, systemPrompt);
    },

    /**
     * システムプロンプトテンプレートを読み込む
     * @returns {Object} プロンプトテンプレートのオブジェクト
     */
    loadSystemPromptTemplates: function() {
        // カスタムテンプレートを読み込む
        const customTemplates = this._getItem(window.CONFIG.STORAGE.KEYS.SYSTEM_PROMPT_TEMPLATES, {}, true);
        
        // デフォルトのテンプレートを構築
        const defaultPrompts = {};
        Object.entries(window.CONFIG.SYSTEM_PROMPTS.TEMPLATES.CATEGORIES).forEach(([category, templates]) => {
            Object.entries(templates).forEach(([systemPromptName, systemPrompt]) => {
                defaultPrompts[systemPromptName] = {
                    content: systemPrompt,
                    category: category,
                    description: '',
                    tags: []
                };
            });
        });
        
        // デフォルトのテンプレートとカスタムテンプレートを結合
        return { ...defaultPrompts, ...customTemplates };
    },

    /**
     * システムプロンプトテンプレートを保存
     * @param {Object} templates - プロンプトテンプレートのオブジェクト
     */
    saveSystemPromptTemplates: function(templates) {
        if (!templates || typeof templates !== 'object') return;
        
        try {
            // AppStateの更新
            if (typeof window.AppState.systemPromptTemplates === 'function') {
                window.AppState.systemPromptTemplates(templates);
            }
            
            // ストレージへの保存
            this._setItem(window.CONFIG.STORAGE.KEYS.SYSTEM_PROMPT_TEMPLATES, templates);
        } catch (error) {
            console.error('システムプロンプトテンプレートの保存に失敗しました:', error);
        }
    },

    /**
     * システムプロンプトテンプレートを追加
     * @param {string} name - テンプレート名
     * @param {string} prompt - プロンプト内容
     * @returns {boolean} 保存成功時はtrue
     */
    addSystemPromptTemplate: function(name, prompt) {
        if (!name || !prompt) return false;
        
        const templates = this.loadSystemPromptTemplates() || {};
        templates[name] = prompt;
        this.saveSystemPromptTemplates(templates);
        return true;
    },

    /**
     * システムプロンプトテンプレートを削除
     * @param {string} name - 削除するテンプレート名
     * @returns {boolean} 削除成功時はtrue
     */
    removeSystemPromptTemplate: function(name) {
        if (!name) return false;
        
        const templates = this.loadSystemPromptTemplates();
        if (templates[name]) {
            delete templates[name];
            this.saveSystemPromptTemplates(templates);
            return true;
        }
        return false;
    },

    /**
     * カテゴリの状態を保存
     * @param {string} categoryName - カテゴリ名
     * @param {boolean} isExpanded - カテゴリが展開されているか
     */
    saveCategoryState: function(categoryName, isExpanded) {
        if (!categoryName) return;
        
        const categoryStates = this.loadCategoryStates();
        categoryStates[categoryName] = !!isExpanded;
        this._setItem(window.CONFIG.STORAGE.KEYS.CATEGORY_STATES, categoryStates);
    },

    /**
     * カテゴリの状態を保存
     * @param {string} categoryName - カテゴリ名
     * @param {boolean} isCollapsed - カテゴリが折りたたまれているか
     */
    saveCategoryState: function(categoryName, isCollapsed) {
        if (!categoryName) return;
        
        try {
            const states = this.loadCategoryStates();
            states[categoryName] = isCollapsed;
            localStorage.setItem('categoryStates', JSON.stringify(states));
        } catch (e) {
            console.warn('カテゴリ状態の保存に失敗しました:', e);
        }
    },

    /**
     * カテゴリの状態を読み込む
     * @param {string} categoryName - カテゴリ名
     * @returns {boolean} カテゴリが折りたたまれているか
     */
    loadCategoryState: function(categoryName) {
        if (!categoryName) return false;
        
        try {
            const states = this.loadCategoryStates();
            return states[categoryName] || false;
        } catch (e) {
            console.warn('カテゴリ状態の読み込みに失敗しました:', e);
            return false;
        }
    },

    /**
     * すべてのカテゴリの状態を読み込む
     * @returns {Object} カテゴリ名をキーとした状態のオブジェクト
     */
    loadCategoryStates: function() {
        try {
            const states = localStorage.getItem('categoryStates');
            return states ? JSON.parse(states) : {};
        } catch (e) {
            console.warn('カテゴリ状態の読み込みに失敗しました:', e);
            return {};
        }
    },

    /**
     * カテゴリー設定状態を読み込む
     * @returns {Object} カテゴリーの状態オブジェクト
     */
    loadCategoryStates: function() {
        return this._getItem(window.CONFIG.STORAGE.KEYS.CATEGORY_STATES, {}, true);
    },

    /**
     * 会話を保存
     * @param {Array} conversations - 保存する会話の配列
     */
    saveConversations: function(conversations) {
        if (!Array.isArray(conversations)) return;
        
        try {
            // タイムスタンプを確実に保持
            const processedConversations = conversations.map(conversation => {
                if (!conversation) return null;

                // メッセージのタイムスタンプを確認・修正
                const messages = conversation.messages.map(msg => {
                    if (!msg) return null;
                    return {
                        ...msg,
                        timestamp: msg.timestamp || Date.now() // タイムスタンプがない場合は現在時刻を設定
                    };
                }).filter(Boolean);

                return {
                    ...conversation,
                    messages,
                    updatedAt: Date.now()
                };
            }).filter(Boolean);

            this._setItem(window.CONFIG.STORAGE.KEYS.CONVERSATIONS, processedConversations);
        } catch (error) {
            console.error('会話の保存中にエラーが発生しました:', error);
        }
    },

    /**
     * 会話を読み込む
     * @returns {Array} 読み込んだ会話の配列
     */
    loadConversations: function() {
        try {
            const conversations = this._getItem(window.CONFIG.STORAGE.KEYS.CONVERSATIONS, [], true);
            if (!Array.isArray(conversations)) return [];

            // タイムスタンプを確認・修正
            return conversations.map(conversation => {
                if (!conversation) return null;

                // メッセージのタイムスタンプを確認
                const messages = conversation.messages.map(msg => {
                    if (!msg) return null;
                    return {
                        ...msg,
                        timestamp: msg.timestamp || Date.now() // タイムスタンプがない場合は現在時刻を設定
                    };
                }).filter(Boolean);

                return {
                    ...conversation,
                    messages,
                    updatedAt: conversation.updatedAt || Date.now()
                };
            }).filter(Boolean);
        } catch (error) {
            console.error('会話の読み込み中にエラーが発生しました:', error);
            return [];
        }
    },

    /**
     * 現在の会話IDをローカルストレージから読み込む
     * @returns {string|null} 現在の会話ID
     */
    loadCurrentConversationId: function() {
        return this._getItem(window.CONFIG.STORAGE.KEYS.CURRENT_CONVERSATION_ID, null);
    },

    /**
     * 現在の会話IDをローカルストレージに保存
     * @param {string} currentConversationId - 保存する会話ID
     */
    saveCurrentConversationId: function(currentConversationId) {
        if (!currentConversationId) return;
        this._setItem(window.CONFIG.STORAGE.KEYS.CURRENT_CONVERSATION_ID, currentConversationId);
    },

    /**
     * 添付ファイルをローカルストレージに保存
     * @param {string} conversationId - 会話ID
     * @param {Object} attachmentData - タイムスタンプと添付ファイルを含むオブジェクト
     */
    saveAttachments: function(conversationId, attachmentData) {
        if (!conversationId) return;
        
        try {
            let dataToSave;
            
            if (Array.isArray(attachmentData)) {
                // 旧形式（配列のみ）の場合は新形式に変換
                dataToSave = {
                    files: this._optimizeAttachments(attachmentData.map(file => ({
                        ...file,
                        timestamp: Date.now()
                    })))
                };
            } else if (attachmentData && typeof attachmentData === 'object') {
                // 新形式の場合は各ファイルに個別のタイムスタンプを設定
                const files = Array.isArray(attachmentData.files) ? attachmentData.files : [];
                dataToSave = {
                    files: this._optimizeAttachments(files.map(file => ({
                        ...file,
                        timestamp: file.timestamp || attachmentData.timestamp || Date.now()
                    })))
                };
            } else {
                console.error('無効な添付ファイルデータ形式です');
                return;
            }
            
            // 添付ファイルを保存
            const key = window.CONFIG.STORAGE.KEYS.ATTACHMENTS_PREFIX + conversationId;
            this._setItem(key, dataToSave);
        } catch (error) {
            console.error('添付ファイルの保存中にエラーが発生しました:', error);
        }
    },

    /**
     * 添付ファイルを最適化
     * @private
     * @param {Array<Object>} attachments - 添付ファイルの配列
     * @returns {Array<Object>} 最適化された添付ファイルの配列
     */
    _optimizeAttachments: function(attachments) {
        if (!Array.isArray(attachments)) return [];
        
        return attachments.map(attachment => {
            if (!attachment) return null;
            
            // 基本的なメタデータのみを保持
            const optimized = {
                type: attachment.type,
                name: attachment.name,
                mimeType: attachment.mimeType,
                size: attachment.size,
                timestamp: attachment.timestamp || Date.now() // 個別のタイムスタンプを保持
            };
            
            // データ部分は画像やファイルの種類によって最適化
            if (attachment.data) {
                optimized.data = attachment.data;
            }
            // コンテンツ部分は画像やファイルの種類によって最適化
            if (attachment.content) {
                optimized.content = attachment.content;
            }
            
            return optimized;
        }).filter(Boolean); // null/undefinedを除外
    },

    /**
     * 添付ファイルをローカルストレージから読み込む
     * @param {string} conversationId - 会話ID
     * @returns {Object} タイムスタンプとファイルを含むオブジェクト
     */
    loadAttachments: function(conversationId) {
        if (!conversationId) return { files: [] };
        
        try {
            const key = window.CONFIG.STORAGE.KEYS.ATTACHMENTS_PREFIX + conversationId;
            const data = this._getItem(key, null, true);
            
            // データが存在しない場合
            if (!data) {
                return { files: [] };
            }
            
            // 新形式（オブジェクト）か旧形式（配列）かを判定
            let result;
            if (Array.isArray(data)) {
                // 旧形式の場合は新形式に変換し、各ファイルに同じタイムスタンプを設定
                const timestamp = Date.now();
                result = {
                    files: data.map(file => ({
                        ...file,
                        timestamp: timestamp
                    }))
                };
            } else if (data && typeof data === 'object' && 'files' in data) {
                // ファイルが配列形式であることを確認
                if (Array.isArray(data.files)) {
                    // 各ファイルにタイムスタンプが設定されていることを確認
                    result = {
                        files: data.files.map(file => ({
                            ...file,
                            // タイムスタンプがない場合は追加
                            timestamp: file.timestamp || data.timestamp || Date.now()
                        }))
                    };
                } else {
                    // filesが配列でない場合は空の配列を返す
                    console.error(`無効な添付ファイル形式です（会話ID: ${conversationId}）`, data);
                    result = { files: [] };
                }
            } else {
                console.error(`不明な添付ファイル形式です（会話ID: ${conversationId}）`, data);
                return { files: [] };
            }
            
            return result;
        } catch (error) {
            console.error('[ERROR] 添付ファイルの読み込み中にエラーが発生しました:', error);
            return { files: [] };
        }
    },

    /**
     * 添付ファイルをローカルストレージから削除
     * @param {string} conversationId - 会話ID
     */
    removeAttachments: function(conversationId) {
        if (!conversationId) return;
        
        try {
            const key = window.CONFIG.STORAGE.KEYS.ATTACHMENTS_PREFIX + conversationId;
            this.removeItem(key);
        } catch (error) {
            console.error('添付ファイルの削除中にエラーが発生しました:', error);
        }
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