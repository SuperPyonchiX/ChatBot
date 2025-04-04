window.UI = window.UI || {};
window.UI.Modal = window.UI.Modal || {};
window.UI.Modal.ApiSettings = window.UI.Modal.ApiSettings || {};

/**
 * APIキーモーダル関連の機能
 */
Object.assign(window.UI.Modal.ApiSettings, {
    /**
     * APIキーモーダルを表示します
     * API設定を編集するためのモーダルダイアログを表示します
     * 
     * @param {Object} apiSettings - API設定オブジェクト
     */
    showApiKeyModal: function(apiSettings) {
        UIUtils.toggleModal('apiKeyModal', true);
        
        // 必要な要素を一度に取得
        const elements = {
            azureApiKeyInput: UICache.get('azureApiKeyInput'),
            openaiRadio: UICache.get('openaiRadio'),
            azureRadio: UICache.get('azureRadio'),
            apiKeyInput: UICache.get('apiKeyInput'),
            openaiSettings: UICache.get('openaiSettings'),
            azureSettings: UICache.get('azureSettings'),
            azureEndpointGpt4oMini: UICache.get('azureEndpointGpt4oMini'),
            azureEndpointGpt4o: UICache.get('azureEndpointGpt4o'),
            azureEndpointO1Mini: UICache.get('azureEndpointO1Mini'),
            azureEndpointO1: UICache.get('azureEndpointO1')
        };
        
        // APIタイプに応じて設定を表示
        if (apiSettings.apiType === 'azure') {
            elements.azureRadio.checked = true;
            elements.azureApiKeyInput.value = apiSettings.azureApiKey;
            UIUtils.toggleVisibility(elements.openaiSettings, false);
            UIUtils.toggleVisibility(elements.azureSettings, true);
            
            // Azureエンドポイント設定を適用
            elements.azureEndpointGpt4oMini.value = apiSettings.azureEndpoints['gpt-4o-mini'];
            elements.azureEndpointGpt4o.value = apiSettings.azureEndpoints['gpt-4o'];
            elements.azureEndpointO1Mini.value = apiSettings.azureEndpoints['o1-mini'];
            elements.azureEndpointO1.value = apiSettings.azureEndpoints['o1'];
        } else {
            elements.openaiRadio.checked = true;
            elements.apiKeyInput.value = apiSettings.openaiApiKey;
            UIUtils.toggleVisibility(elements.openaiSettings, true);
            UIUtils.toggleVisibility(elements.azureSettings, false);
        }
    },

    /**
     * APIキーモーダルを非表示にします
     */
    hideApiKeyModal: function() {
        UIUtils.toggleModal('apiKeyModal', false);
    },

    /**
     * Azure設定の表示/非表示を切り替えます
     */
    toggleAzureSettings: function() {
        const openaiSettings = UICache.get('openaiSettings');
        const azureSettings = UICache.get('azureSettings');
        const azureRadio = UICache.get('azureRadio');
        
        UIUtils.toggleVisibility(openaiSettings, !azureRadio.checked);
        UIUtils.toggleVisibility(azureSettings, azureRadio.checked);
    }
});