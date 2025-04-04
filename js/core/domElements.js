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
            elements[id] = document.getElementById(id);
            
            if (!elements[id]) {
                console.warn(`Element with id "${id}" not found.`);
            }
        });
        
        return elements;
    }
    
    // 主要な要素をキャッシュ
    const ids = [
        // チャット関連
        'chatMessages', 'userInput', 'sendButton', 'modelSelect', 'chatHistory', 'chatInputContainer',
        
        // ボタン関連
        'newChatButton', 'clearHistoryButton', 'settingsButton', 'settingsMenu',
        'openSystemPromptSettings', 'openApiSettings', 'openPromptManager',
        
        // ファイル関連
        'fileInput',
        
        // システムプロンプト関連
        'systemPromptModal', 'systemPromptInput', 'saveSystemPrompt',
        'cancelSystemPrompt', 'saveNewTemplate', 'newTemplateName', 'newTemplateCategory',
        
        // API設定関連
        'apiKeyModal', 'saveApiKey', 'cancelApiKey', 'openaiRadio', 'azureRadio',
        'apiKeyInput', 'azureApiKeyInput', 'azureEndpointGpt4oMini', 
        'azureEndpointGpt4o', 'azureEndpointO1Mini', 'azureEndpointO1',
        
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