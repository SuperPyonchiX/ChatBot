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
            apiKeyInput: UICache.getInstance.get('apiKeyInput'),
            openaiSettings: UICache.getInstance.get('openaiSettings'),
            azureSettings: UICache.getInstance.get('azureSettings'),
            azureEndpointGpt4oMini: UICache.getInstance.get('azureEndpointGpt4oMini'),
            azureEndpointGpt4o: UICache.getInstance.get('azureEndpointGpt4o'),
            azureEndpointO1Mini: UICache.getInstance.get('azureEndpointO1Mini'),
            azureEndpointO1: UICache.getInstance.get('azureEndpointO1')
        };
        
        // APIタイプに応じて設定を表示
        if (apiSettings.apiType === 'azure') {
            elements.azureRadio.checked = true;
            elements.azureApiKeyInput.value = apiSettings.azureApiKey;
            UIUtils.getInstance.toggleVisibility(elements.openaiSettings, false);
            UIUtils.getInstance.toggleVisibility(elements.azureSettings, true);
            
            // Azureエンドポイント設定を適用
            elements.azureEndpointGpt4oMini.value = apiSettings.azureEndpoints['gpt-4o-mini'];
            elements.azureEndpointGpt4o.value = apiSettings.azureEndpoints['gpt-4o'];
            elements.azureEndpointO1Mini.value = apiSettings.azureEndpoints['o1-mini'];
            elements.azureEndpointO1.value = apiSettings.azureEndpoints['o1'];
        } else {
            elements.openaiRadio.checked = true;
            elements.apiKeyInput.value = apiSettings.openaiApiKey;
            UIUtils.getInstance.toggleVisibility(elements.openaiSettings, true);
            UIUtils.getInstance.toggleVisibility(elements.azureSettings, false);
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
        const azureRadio = UICache.getInstance.get('azureRadio');
        
        UIUtils.getInstance.toggleVisibility(openaiSettings, !azureRadio.checked);
        UIUtils.getInstance.toggleVisibility(azureSettings, azureRadio.checked);
    }
}

// グローバルアクセスのために window.UI.Core.Modal に設定
window.UI = window.UI || {};
window.UI.Core = window.UI.Core || {};
window.UI.Core.Modal = ApiSettingsModal.getInstance;