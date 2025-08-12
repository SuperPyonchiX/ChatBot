/**
 * API設定モーダルを管理するクラス
 * @class ApiSettingsModal
 */
class ApiSettingsModal {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {ApiSettingsModal} ApiSettingsModalのインスタンス
     */
    static get getInstance() {
        if (!ApiSettingsModal.#instance) {
            ApiSettingsModal.#instance = new ApiSettingsModal();
        }
        return ApiSettingsModal.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (ApiSettingsModal.#instance) {
            throw new Error('ApiSettingsModalクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
    }

    /**
     * API設定モーダルを表示します
     * @param {Object} apiSettings - API設定オブジェクト
     */
    showApiKeyModal(apiSettings) {
        UIUtils.getInstance.toggleModal('apiKeyModal', true);
        
        // 必要な要素を一度に取得
        const elements = {
            openaiSystemRadio: UICache.getInstance.get('openaiSystemRadio'),
            geminiSystemRadio: UICache.getInstance.get('geminiSystemRadio'),
            openaiRadio: UICache.getInstance.get('openaiRadio'),
            azureRadio: UICache.getInstance.get('azureRadio'),
            apiKeyInput: UICache.getInstance.get('apiKeyInput'),
            azureApiKeyInput: UICache.getInstance.get('azureApiKeyInput'),
            geminiApiKeyInput: UICache.getInstance.get('geminiApiKeyInput'),
            claudeApiKeyInput: UICache.getInstance.get('claudeApiKeyInput'),
            claudeWebSearchToggle: UICache.getInstance.get('claudeWebSearchToggle'),
            claudeWebSearchSettings: UICache.getInstance.get('claudeWebSearchSettings'),
            claudeMaxSearches: UICache.getInstance.get('claudeMaxSearches'),
            claudeAllowedDomains: UICache.getInstance.get('claudeAllowedDomains'),
            claudeBlockedDomains: UICache.getInstance.get('claudeBlockedDomains'),
            claudeSearchRegion: UICache.getInstance.get('claudeSearchRegion'),
            openaiSystemSettings: UICache.getInstance.get('openaiSystemSettings'),
            geminiSystemSettings: UICache.getInstance.get('geminiSystemSettings'),
            claudeSystemSettings: UICache.getInstance.get('claudeSystemSettings'),
            openaiSettings: UICache.getInstance.get('openaiSettings'),
            azureSettings: UICache.getInstance.get('azureSettings'),
            azureEndpointGpt4oMini: UICache.getInstance.get('azureEndpointGpt4oMini'),
            azureEndpointGpt4o: UICache.getInstance.get('azureEndpointGpt4o'),
            azureEndpointGpt5Mini: UICache.getInstance.get('azureEndpointGpt5Mini'),
            azureEndpointGpt5: UICache.getInstance.get('azureEndpointGpt5'),
            azureEndpointO1Mini: UICache.getInstance.get('azureEndpointO1Mini'),
            azureEndpointO1: UICache.getInstance.get('azureEndpointO1')
        };
        
        // すべてのAPIキーを設定（保持）
        if (elements.apiKeyInput) {
            elements.apiKeyInput.value = apiSettings.openaiApiKey || '';
        }
        if (elements.azureApiKeyInput) {
            elements.azureApiKeyInput.value = apiSettings.azureApiKey || '';
        }
        if (elements.geminiApiKeyInput) {
            elements.geminiApiKeyInput.value = apiSettings.geminiApiKey || '';
        }
        if (elements.claudeApiKeyInput) {
            elements.claudeApiKeyInput.value = apiSettings.claudeApiKey || '';
        }

        // Claude Web検索設定を読み込み
        this.#loadClaudeWebSearchSettings(elements, apiSettings.claudeWebSearchSettings);
        
        // API系統を設定
        if (apiSettings.apiType === 'gemini') {
            elements.geminiSystemRadio.checked = true;
            UIUtils.getInstance.toggleVisibility(elements.openaiSystemSettings, false);
            UIUtils.getInstance.toggleVisibility(elements.geminiSystemSettings, true);
            UIUtils.getInstance.toggleVisibility(elements.claudeSystemSettings, false);
        } else if (apiSettings.apiType === 'claude') {
            elements.claudeSystemRadio.checked = true;
            UIUtils.getInstance.toggleVisibility(elements.openaiSystemSettings, false);
            UIUtils.getInstance.toggleVisibility(elements.geminiSystemSettings, false);
            UIUtils.getInstance.toggleVisibility(elements.claudeSystemSettings, true);
        } else {
            // openai または azure の場合はOpenAI系を選択
            elements.openaiSystemRadio.checked = true;
            UIUtils.getInstance.toggleVisibility(elements.openaiSystemSettings, true);
            UIUtils.getInstance.toggleVisibility(elements.geminiSystemSettings, false);
            UIUtils.getInstance.toggleVisibility(elements.claudeSystemSettings, false);
            
            // OpenAI系内でのサービス選択を設定
            if (apiSettings.apiType === 'azure') {
                elements.azureRadio.checked = true;
                UIUtils.getInstance.toggleVisibility(elements.openaiSettings, false);
                UIUtils.getInstance.toggleVisibility(elements.azureSettings, true);
                
                // Azureエンドポイント設定を適用
                if (apiSettings.azureEndpoints) {
                    elements.azureEndpointGpt4oMini.value = apiSettings.azureEndpoints['gpt-4o-mini'] || '';
                    elements.azureEndpointGpt4o.value = apiSettings.azureEndpoints['gpt-4o'] || '';
                    elements.azureEndpointGpt5Mini.value = apiSettings.azureEndpoints['gpt-5-mini'] || '';
                    elements.azureEndpointGpt5.value = apiSettings.azureEndpoints['gpt-5'] || '';
                    elements.azureEndpointO1Mini.value = apiSettings.azureEndpoints['o1-mini'] || '';
                    elements.azureEndpointO1.value = apiSettings.azureEndpoints['o1'] || '';
                }
            } else {
                elements.openaiRadio.checked = true;
                UIUtils.getInstance.toggleVisibility(elements.openaiSettings, true);
                UIUtils.getInstance.toggleVisibility(elements.azureSettings, false);
            }
        }
    }
    
    /**
     * API設定モーダルを非表示にします
     */
    hideApiKeyModal() {
        UIUtils.getInstance.toggleModal('apiKeyModal', false);
    }
    
    /**
     * API系統の表示/非表示を切り替えます (OpenAI系 / Gemini / Claude)
     */
    toggleApiSystem() {
        const openaiSystemSettings = UICache.getInstance.get('openaiSystemSettings');
        const geminiSystemSettings = UICache.getInstance.get('geminiSystemSettings');
        const claudeSystemSettings = UICache.getInstance.get('claudeSystemSettings');
        const openaiSystemRadio = UICache.getInstance.get('openaiSystemRadio');
        const geminiSystemRadio = UICache.getInstance.get('geminiSystemRadio');
        const claudeSystemRadio = UICache.getInstance.get('claudeSystemRadio');
        
        const isOpenAISystem = openaiSystemRadio.checked;
        const isGeminiSystem = geminiSystemRadio.checked;
        const isClaudeSystem = claudeSystemRadio.checked;
        
        UIUtils.getInstance.toggleVisibility(openaiSystemSettings, isOpenAISystem);
        UIUtils.getInstance.toggleVisibility(geminiSystemSettings, isGeminiSystem);
        UIUtils.getInstance.toggleVisibility(claudeSystemSettings, isClaudeSystem);
        
        // OpenAI系の場合は、デフォルトでOpenAI APIを選択
        if (isOpenAISystem) {
            const openaiRadio = UICache.getInstance.get('openaiRadio');
            const openaiSettings = UICache.getInstance.get('openaiSettings');
            const azureSettings = UICache.getInstance.get('azureSettings');
            
            if (openaiRadio) {
                openaiRadio.checked = true;
                UIUtils.getInstance.toggleVisibility(openaiSettings, true);
                UIUtils.getInstance.toggleVisibility(azureSettings, false);
            }
        }
    }
    
    /**
     * OpenAI系サービスの表示/非表示を切り替えます (OpenAI / Azure OpenAI)
     */
    toggleOpenAIService() {
        const openaiSettings = UICache.getInstance.get('openaiSettings');
        const azureSettings = UICache.getInstance.get('azureSettings');
        const openaiRadio = UICache.getInstance.get('openaiRadio');
        const azureRadio = UICache.getInstance.get('azureRadio');
        
        const isOpenAI = openaiRadio.checked;
        const isAzure = azureRadio.checked;
        
        UIUtils.getInstance.toggleVisibility(openaiSettings, isOpenAI);
        UIUtils.getInstance.toggleVisibility(azureSettings, isAzure);
    }
    
    /**
     * Azure設定の表示/非表示を切り替えます（後方互換性のため）
     * @deprecated 新しいUI構造では toggleApiSystem と toggleOpenAIService を使用
     */
    toggleAzureSettings() {
        // 後方互換性のため残しておくが、新しいメソッドにリダイレクト
        this.toggleApiSystem();
        this.toggleOpenAIService();
    }

    /**
     * Claude Web検索設定を読み込み
     * @private
     * @param {Object} elements - UI要素
     * @param {Object} webSearchSettings - Web検索設定
     */
    #loadClaudeWebSearchSettings(elements, webSearchSettings) {
        if (!webSearchSettings) {
            webSearchSettings = {
                enabled: false,
                maxSearches: 5,
                allowedDomains: [],
                blockedDomains: [],
                searchRegion: ''
            };
        }

        // Web検索有効フラグ
        if (elements.claudeWebSearchToggle) {
            elements.claudeWebSearchToggle.checked = webSearchSettings.enabled || false;
            
            // 設定パネルの表示/非表示
            if (elements.claudeWebSearchSettings) {
                if (webSearchSettings.enabled) {
                    elements.claudeWebSearchSettings.classList.remove('hidden');
                } else {
                    elements.claudeWebSearchSettings.classList.add('hidden');
                }
            }
        }

        // 最大検索回数
        if (elements.claudeMaxSearches) {
            elements.claudeMaxSearches.value = webSearchSettings.maxSearches || 5;
        }

        // 許可ドメイン
        if (elements.claudeAllowedDomains) {
            elements.claudeAllowedDomains.value = (webSearchSettings.allowedDomains || []).join(', ');
        }

        // 禁止ドメイン
        if (elements.claudeBlockedDomains) {
            elements.claudeBlockedDomains.value = (webSearchSettings.blockedDomains || []).join(', ');
        }

        // 検索地域
        if (elements.claudeSearchRegion) {
            elements.claudeSearchRegion.value = webSearchSettings.searchRegion || '';
        }
    }
}
