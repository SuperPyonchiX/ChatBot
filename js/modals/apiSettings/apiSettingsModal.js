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
            azureApiKeyInput: UICache.getInstance.get('azureApiKeyInput'),
            openaiRadio: UICache.getInstance.get('openaiRadio'),
            azureRadio: UICache.getInstance.get('azureRadio'),
            geminiRadio: UICache.getInstance.get('geminiRadio'),
            apiKeyInput: UICache.getInstance.get('apiKeyInput'),
            geminiApiKeyInput: UICache.getInstance.get('geminiApiKeyInput'),
            openaiSettings: UICache.getInstance.get('openaiSettings'),
            azureSettings: UICache.getInstance.get('azureSettings'),
            geminiSettings: UICache.getInstance.get('geminiSettings'),
            azureEndpointGpt4oMini: UICache.getInstance.get('azureEndpointGpt4oMini'),
            azureEndpointGpt4o: UICache.getInstance.get('azureEndpointGpt4o'),
            azureEndpointGpt5Mini: UICache.getInstance.get('azureEndpointGpt5Mini'),
            azureEndpointGpt5: UICache.getInstance.get('azureEndpointGpt5'),
            azureEndpointO1Mini: UICache.getInstance.get('azureEndpointO1Mini'),
            azureEndpointO1: UICache.getInstance.get('azureEndpointO1')
        };
        
        // APIタイプに応じて設定を表示
        if (apiSettings.apiType === 'azure') {
            elements.azureRadio.checked = true;
            elements.azureApiKeyInput.value = apiSettings.azureApiKey;
            UIUtils.getInstance.toggleVisibility(elements.openaiSettings, false);
            UIUtils.getInstance.toggleVisibility(elements.azureSettings, true);
            UIUtils.getInstance.toggleVisibility(elements.geminiSettings, false);
            
            // Azureエンドポイント設定を適用
            elements.azureEndpointGpt4oMini.value = apiSettings.azureEndpoints['gpt-4o-mini'];
            elements.azureEndpointGpt4o.value = apiSettings.azureEndpoints['gpt-4o'];
            elements.azureEndpointGpt5Mini.value = apiSettings.azureEndpoints['gpt-5-mini'];
            elements.azureEndpointGpt5.value = apiSettings.azureEndpoints['gpt-5'];
            elements.azureEndpointO1Mini.value = apiSettings.azureEndpoints['o1-mini'];
            elements.azureEndpointO1.value = apiSettings.azureEndpoints['o1'];
        } else if (apiSettings.apiType === 'gemini') {
            elements.geminiRadio.checked = true;
            elements.geminiApiKeyInput.value = apiSettings.geminiApiKey;
            UIUtils.getInstance.toggleVisibility(elements.openaiSettings, false);
            UIUtils.getInstance.toggleVisibility(elements.azureSettings, false);
            UIUtils.getInstance.toggleVisibility(elements.geminiSettings, true);
        } else {
            elements.openaiRadio.checked = true;
            elements.apiKeyInput.value = apiSettings.openaiApiKey;
            UIUtils.getInstance.toggleVisibility(elements.openaiSettings, true);
            UIUtils.getInstance.toggleVisibility(elements.azureSettings, false);
            UIUtils.getInstance.toggleVisibility(elements.geminiSettings, false);
        }
    }
    
    /**
     * API設定モーダルを非表示にします
     */
    hideApiKeyModal() {
        UIUtils.getInstance.toggleModal('apiKeyModal', false);
    }
    
    /**
     * Azure設定の表示/非表示を切り替えます
     */
    toggleAzureSettings() {
        const openaiSettings = UICache.getInstance.get('openaiSettings');
        const azureSettings = UICache.getInstance.get('azureSettings');
        const geminiSettings = UICache.getInstance.get('geminiSettings');
        const azureRadio = UICache.getInstance.get('azureRadio');
        const geminiRadio = UICache.getInstance.get('geminiRadio');
        
        const isOpenai = !azureRadio.checked && !geminiRadio.checked;
        const isAzure = azureRadio.checked;
        const isGemini = geminiRadio.checked;
        
        UIUtils.getInstance.toggleVisibility(openaiSettings, isOpenai);
        UIUtils.getInstance.toggleVisibility(azureSettings, isAzure);
        UIUtils.getInstance.toggleVisibility(geminiSettings, isGemini);
    }
}
