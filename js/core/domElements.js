/**
 * domElements.js
 * UIで使用する主要なDOM要素の管理を担当するモジュール
 */

window.Elements = (function() {
    /**
     * 指定したIDのDOM要素を取得します
     * @param {Array<string>} selectors - 取得するDOM要素のID
     * @returns {Object} ID名をキーとした要素オブジェクト
     * @private
     */
    function getElements(selectors) {
        const elements = {};
        
        selectors.forEach(id => {
            // UICache.getInstanceを使用して要素を取得
            const element = UICache.getInstance.get(id);
            
            if (element) {
                elements[id] = element;
            } else {
                console.warn(`Element with id "${id}" not found.`);
                elements[id] = null;
            }
        });
        
        return elements;
    }
    
    // 主要な要素のID一覧
    const ids = [
        // チャット関連
        'chatMessages', 'userInput', 'sendButton', 'modelSelect', 'chatHistory', 'chatInputContainer',
        'webSearchToggle',
        
        // ボタン関連
        'newChatButton', 'clearHistoryButton', 'settingsButton', 'settingsMenu',
        'openSystemPromptSettings', 'openApiSettings', 'openPromptManager',
        
        // ファイル関連
        'fileInput',
        
        // システムプロンプト関連
        'systemPromptModal', 'systemPromptInput', 'saveSystemPrompt',
        'cancelSystemPrompt', 'saveNewSystemPrompt', 'newSystemPromptName', 'newTemplateCategory',
        
        // API設定関連
        'apiKeyModal', 'saveApiKey', 'cancelApiKey', 'openaiRadio', 'azureRadio',
        'apiKeyInput', 'azureApiKeyInput', 'azureEndpointGpt4oMini', 
        'azureEndpointGpt4o', 'azureEndpointGpt5Mini', 'azureEndpointGpt5',
        'azureEndpointO1Mini', 'azureEndpointO1',
        
        // チャット名前変更関連
        'saveRenameChat', 'cancelRenameChat', 'renameChatModal', 'chatTitleInput',
        
        // プロンプトマネージャー関連
        'promptManagerModal', 'closePromptManager', 'addCategoryButton',
        'addPromptButton', 'promptSearchInput', 'promptEditModal',
        'savePromptEdit', 'cancelPromptEdit', 'promptNameInput',
        'promptCategorySelect', 'promptTagsInput',
        'promptDescriptionInput', 'promptContentInput'
    ];
    
    return getElements(ids);
})();