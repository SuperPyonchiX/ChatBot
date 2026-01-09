/**
 * モーダルのイベントハンドラークラス
 * @class ModalHandlers
 */
class ModalHandlers {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {ModalHandlers} ModalHandlersのインスタンス
     */
    static get getInstance() {
        if (!ModalHandlers.#instance) {
            ModalHandlers.#instance = new ModalHandlers();
        }
        return ModalHandlers.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (ModalHandlers.#instance) {
            throw new Error('ModalHandlersクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
    }

    /**
     * API設定を保存します
     */
    saveApiSettings() {
        if (!window.Elements.apiKeyInput || !window.Elements.openaiSystemRadio || 
            !window.Elements.geminiSystemRadio || !window.Elements.claudeSystemRadio || !window.Elements.openaiRadio || 
            !window.Elements.azureRadio) return;
        
        // 現在の設定を取得（既存のAPIキーを保持）
        const currentSettings = Storage.getInstance.loadApiSettings();
        
        // API系統を判定
        if (window.Elements.geminiSystemRadio.checked) {
            // Gemini系を選択
            window.AppState.apiSettings.apiType = 'gemini';
            
            // Gemini APIキーのみ更新
            if (window.Elements.geminiApiKeyInput) {
                window.AppState.apiSettings.geminiApiKey = window.Elements.geminiApiKeyInput.value.trim();
            }
        } else if (window.Elements.claudeSystemRadio.checked) {
            // Claude系を選択
            window.AppState.apiSettings.apiType = 'claude';
            
            // Claude APIキーのみ更新
            if (window.Elements.claudeApiKeyInput) {
                window.AppState.apiSettings.claudeApiKey = window.Elements.claudeApiKeyInput.value.trim();
            }
            
            // Claude Web検索設定を取得・更新
            window.AppState.apiSettings.claudeWebSearchSettings = this.#getClaudeWebSearchSettings();
        } else {
            // OpenAI系を選択 - OpenAI または Azure OpenAI を判定
            if (window.Elements.azureRadio.checked) {
                window.AppState.apiSettings.apiType = 'azure';

                // Azure OpenAI APIキーとエンドポイントを更新
                if (window.Elements.azureApiKeyInput) {
                    window.AppState.apiSettings.azureApiKey = window.Elements.azureApiKeyInput.value.trim();
                }

                // モデルごとのエンドポイントを設定
                const endpointIds = {
                    'gpt-4o-mini': 'azureEndpointGpt4oMini',
                    'gpt-4o': 'azureEndpointGpt4o',
                    'gpt-5-mini': 'azureEndpointGpt5Mini',
                    'gpt-5': 'azureEndpointGpt5',
                    'gpt-5.2-mini': 'azureEndpointGpt52Mini',
                    'gpt-5.2': 'azureEndpointGpt52',
                    'o1-mini': 'azureEndpointO1Mini',
                    'o1': 'azureEndpointO1'
                };

                // 各エンドポイントを保存（window.ElementsまたはUICacheから取得）
                window.AppState.apiSettings.azureEndpoints = {};
                Object.entries(endpointIds).forEach(([model, elementId]) => {
                    const element = window.Elements[elementId] || UICache.getInstance.get(elementId);
                    if (element && element.value !== undefined) {
                        window.AppState.apiSettings.azureEndpoints[model] = element.value.trim();
                    }
                });

                // Azure埋め込みエンドポイントを保存（RAG用）
                const embeddingEndpoint = document.getElementById('azureEndpointEmbedding');
                if (embeddingEndpoint && embeddingEndpoint.value !== undefined) {
                    Storage.getInstance.setItem(
                        window.CONFIG.STORAGE.KEYS.AZURE_EMBEDDING_ENDPOINT,
                        embeddingEndpoint.value.trim()
                    );
                }
            } else {
                window.AppState.apiSettings.apiType = 'openai';
                
                // OpenAI APIキーのみ更新
                if (window.Elements.apiKeyInput) {
                    window.AppState.apiSettings.openaiApiKey = window.Elements.apiKeyInput.value.trim();
                }
            }
        }
        
        // 他のAPIキーは既存の値を保持
        window.AppState.apiSettings.openaiApiKey = window.AppState.apiSettings.openaiApiKey || currentSettings.openaiApiKey;
        window.AppState.apiSettings.azureApiKey = window.AppState.apiSettings.azureApiKey || currentSettings.azureApiKey;
        window.AppState.apiSettings.geminiApiKey = window.AppState.apiSettings.geminiApiKey || currentSettings.geminiApiKey;
        window.AppState.apiSettings.claudeApiKey = window.AppState.apiSettings.claudeApiKey || currentSettings.claudeApiKey;
        window.AppState.apiSettings.azureEndpoints = window.AppState.apiSettings.azureEndpoints || currentSettings.azureEndpoints;

        // グローバル設定を更新
        window.AppState.updateGlobalSettings();

        // ローカルストレージに保存
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.saveApiSettings(window.AppState.apiSettings);

        // 埋め込みAPIのモードを再検出（APIキー変更に対応）
        if (typeof EmbeddingAPI !== 'undefined') {
            EmbeddingAPI.getInstance.refreshMode();
        }

        UI.getInstance.Core.Notification.show('API設定を保存しました', 'success');
        ApiSettingsModal.getInstance.hideApiKeyModal();
    }
    
    /**
     * チャット名の変更を保存します
     */
    saveRenamedChat() {
        if (!window.Elements.renameChatModal || !window.Elements.chatTitleInput) return;
        
        const conversationId = window.Elements.renameChatModal.dataset.conversationId;
        const newTitle = window.Elements.chatTitleInput.value.trim();
        
        // 新しいタイトルが空でなければ保存
        if (newTitle) {
            const conversation = window.AppState.getConversationById(conversationId);
            if (conversation) {
                conversation.title = newTitle;
                // @ts-ignore - Storageはカスタムクラス（型定義あり）
                Storage.getInstance.saveConversations(window.AppState.conversations);
                ChatActions.getInstance.renderChatHistory();
            }
        }

        // モーダルを閉じる
        RenameChatModal.getInstance.hideRenameChatModal();
    }
    
    /**
     * 新しいシステムプロンプトを保存します
     */
    saveNewSystemPrompt() {
        const systemPromptName = UICache.getInstance.get('newSystemPromptName').value.trim();
        const templateCategory = UICache.getInstance.get('newTemplateCategory').value.trim();
        const systemPrompt = UICache.getInstance.get('systemPromptInput').value.trim();
        
        if (!systemPromptName || !systemPrompt) {
            UI.getInstance.Core.Notification.show('システムプロンプト名と内容を入力してください', 'error');
            return;
        }

        if (!templateCategory) {
            UI.getInstance.Core.Notification.show('カテゴリを入力してください', 'error');
            return;
        }

        const templates = window.AppState.systemPromptTemplates;
        
        // // 重複チェック
        // if (templates[systemPromptName]) {
        //     UI.getInstance.Core.Notification.show('同じ名前のシステムプロンプトが既に存在します', 'error');
        //     return;
        // }
        
        // システムプロンプトを保存
        templates[systemPromptName] = {
            content: systemPrompt,
            category: templateCategory,
            description: '',
            tags: []
        };
        
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        
        Storage.getInstance.saveSystemPromptTemplates(templates);
        
        // 入力をクリア
        UICache.getInstance.get('newSystemPromptName').value = '';
        UICache.getInstance.get('newTemplateCategory').value = '';
        
        // システムプロンプト一覧を更新
        SystemPromptModal.getInstance.updateList(templates);
        UI.getInstance.Core.Notification.show('システムプロンプトを保存しました', 'success');
    }
    
    /**
     * システムプロンプト選択時のハンドラー
     * @param {string} promptName - プロンプト名
     */
    onTemplateSelect(promptName) {
        if (!window.Elements.systemPromptInput) return;
        
        const prompt = window.AppState.systemPromptTemplates[promptName];
        if (prompt) {
            window.Elements.systemPromptInput.value = prompt.content;
            window.Elements.systemPromptInput.dispatchEvent(new Event('input'));
        }
    }
    
    /**
     * システムプロンプト削除時のハンドラー
     * @param {string} promptName - プロンプト名
     */
    onTemplateDelete(promptName) {
        if (confirm(`システムプロンプト "${promptName}" を削除してもよろしいですか？`)) {
            delete window.AppState.systemPromptTemplates[promptName];
            // @ts-ignore - Storageはカスタムクラス（型定義あり）
            Storage.getInstance.saveSystemPromptTemplates(window.AppState.systemPromptTemplates);
            
            // システムプロンプト一覧を更新
            SystemPromptModal.getInstance.updateList(
                window.AppState.systemPromptTemplates, 
                this.onTemplateSelect.bind(this), 
                this.onTemplateDelete.bind(this)
            );
            UI.getInstance.Core.Notification.show('システムプロンプトを削除しました', 'success');
        }
    }

    /**
     * Claude Web検索設定を取得
     * @returns {Object} Web検索設定
     */
    #getClaudeWebSearchSettings() {
        const settings = {
            enabled: false,
            maxSearches: 5,
            allowedDomains: [],
            blockedDomains: [],
            searchRegion: ''
        };

        // Web検索有効フラグ
        const webSearchToggle = window.Elements.claudeWebSearchToggle;
        if (webSearchToggle) {
            settings.enabled = webSearchToggle.checked;
        }

        // 最大検索回数
        const maxSearches = window.Elements.claudeMaxSearches;
        if (maxSearches && maxSearches.value) {
            settings.maxSearches = parseInt(maxSearches.value) || 5;
        }

        // 許可ドメイン
        const allowedDomains = window.Elements.claudeAllowedDomains;
        if (allowedDomains && allowedDomains.value.trim()) {
            settings.allowedDomains = allowedDomains.value.split(',').map(domain => domain.trim()).filter(Boolean);
        }

        // 禁止ドメイン
        const blockedDomains = window.Elements.claudeBlockedDomains;
        if (blockedDomains && blockedDomains.value.trim()) {
            settings.blockedDomains = blockedDomains.value.split(',').map(domain => domain.trim()).filter(Boolean);
        }

        // 検索地域
        const searchRegion = window.Elements.claudeSearchRegion;
        if (searchRegion && searchRegion.value) {
            settings.searchRegion = searchRegion.value;
        }

        return settings;
    }
}