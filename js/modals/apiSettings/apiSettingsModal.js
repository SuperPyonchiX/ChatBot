window.UI = window.UI || {};
window.UI.Core = window.UI.Core || {};
window.UI.Core.Modal = window.UI.Core.Modal || {};

/**
 * API設定モーダル
 * @namespace UI.Core.Modal
 */
Object.assign(window.UI.Core.Modal, {
    /**
     * API設定モーダルを表示します
     * @param {Object} apiSettings - API設定オブジェクト
     */
    showApiKeyModal: function(apiSettings) {
        window.UI.Utils.toggleModal('apiKeyModal', true);
        
        // 必要な要素を一度に取得
        const elements = {
            azureApiKeyInput: window.UI.Cache.get('azureApiKeyInput'),
            openaiRadio: window.UI.Cache.get('openaiRadio'),
            azureRadio: window.UI.Cache.get('azureRadio'),
            apiKeyInput: window.UI.Cache.get('apiKeyInput'),
            openaiSettings: window.UI.Cache.get('openaiSettings'),
            azureSettings: window.UI.Cache.get('azureSettings'),
            azureEndpointGpt4oMini: window.UI.Cache.get('azureEndpointGpt4oMini'),
            azureEndpointGpt4o: window.UI.Cache.get('azureEndpointGpt4o'),
            azureEndpointO1Mini: window.UI.Cache.get('azureEndpointO1Mini'),
            azureEndpointO1: window.UI.Cache.get('azureEndpointO1')
        };
        
        // APIタイプに応じて設定を表示
        if (apiSettings.apiType === 'azure') {
            elements.azureRadio.checked = true;
            elements.azureApiKeyInput.value = apiSettings.azureApiKey;
            window.UI.Utils.toggleVisibility(elements.openaiSettings, false);
            window.UI.Utils.toggleVisibility(elements.azureSettings, true);
            
            // Azureエンドポイント設定を適用
            elements.azureEndpointGpt4oMini.value = apiSettings.azureEndpoints['gpt-4o-mini'];
            elements.azureEndpointGpt4o.value = apiSettings.azureEndpoints['gpt-4o'];
            elements.azureEndpointO1Mini.value = apiSettings.azureEndpoints['o1-mini'];
            elements.azureEndpointO1.value = apiSettings.azureEndpoints['o1'];
        } else {
            elements.openaiRadio.checked = true;
            elements.apiKeyInput.value = apiSettings.openaiApiKey;
            window.UI.Utils.toggleVisibility(elements.openaiSettings, true);
            window.UI.Utils.toggleVisibility(elements.azureSettings, false);
        }
    },
    
    /**
     * API設定モーダルを非表示にします
     */
    hideApiKeyModal: function() {
        window.UI.Utils.toggleModal('apiKeyModal', false);
    },
    
    /**
     * Azure設定の表示/非表示を切り替えます
     */
    toggleAzureSettings: function() {
        const openaiSettings = window.UI.Cache.get('openaiSettings');
        const azureSettings = window.UI.Cache.get('azureSettings');
        const azureRadio = window.UI.Cache.get('azureRadio');
        
        window.UI.Utils.toggleVisibility(openaiSettings, !azureRadio.checked);
        window.UI.Utils.toggleVisibility(azureSettings, azureRadio.checked);
    }
});