window.UI = window.UI || {};
window.UI.Core = window.UI.Core || {};
window.UI.Core.Modal = window.UI.Core.Modal || {};
window.UI.Core.Modal.Handlers = window.UI.Core.Modal.Handlers || {};
/**
 * モーダルのイベントハンドラー
 * @namespace UI.Core.Modal.Handlers
 */
Object.assign(window.UI.Core.Modal.Handlers, {
    /**
     * API設定を保存します
     */
    saveApiSettings: function() {
        if (!window.Elements.apiKeyInput || !window.Elements.openaiRadio || !window.Elements.azureRadio) return;
        
        // API種別を設定
        window.AppState.apiSettings.apiType = window.Elements.openaiRadio.checked ? 'openai' : 'azure';
        
        // OpenAI APIキーを設定
        if (window.Elements.apiKeyInput) {
            window.AppState.apiSettings.openaiApiKey = window.Elements.apiKeyInput.value.trim();
        }
        
        // Azure OpenAI APIキーとエンドポイントを設定
        if (window.AppState.apiSettings.apiType === 'azure') {
            if (window.Elements.azureApiKeyInput) {
                window.AppState.apiSettings.azureApiKey = window.Elements.azureApiKeyInput.value.trim();
            }
            
            // モデルごとのエンドポイントを設定
            const endpoints = {
                'gpt-4o-mini': window.Elements.azureEndpointGpt4oMini,
                'gpt-4o': window.Elements.azureEndpointGpt4o,
                'o1-mini': window.Elements.azureEndpointO1Mini,
                'o1': window.Elements.azureEndpointO1
            };
            
            // 各エンドポイントを保存
            Object.entries(endpoints).forEach(([model, element]) => {
                if (element) {
                    window.AppState.apiSettings.azureEndpoints = window.AppState.apiSettings.azureEndpoints || {};
                    window.AppState.apiSettings.azureEndpoints[model] = element.value.trim();
                }
            });
        }

        // グローバル設定を更新
        window.AppState.updateGlobalSettings();

        // ローカルストレージに保存
        window.Storage.saveApiSettings(window.AppState.apiSettings);
        window.UI.Core.Notification.show('API設定を保存しました', 'success');
        window.UI.Core.Modal.hideApiKeyModal();
    },
    
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
                window.Storage.saveConversations(window.AppState.conversations);
                window.Chat.Actions.renderChatHistory();
            }
        }

        // モーダルを閉じる
                window.UI.Core.Modal.hideRenameChatModal();
    },
    
    /**
     * 新しいテンプレートを保存します
     */
    saveNewTemplate: function() {
        const templateName =window.UI.Cache.get('newTemplateName').value.trim();
        const templateCategory =window.UI.Cache.get('newTemplateCategory').value.trim();
        const systemPrompt =window.UI.Cache.get('systemPromptInput').value.trim();
        
        if (!templateName || !systemPrompt) {
            window.UI.Core.Notification.show('テンプレート名と内容を入力してください', 'error');
            return;
        }

        if (!templateCategory) {
            window.UI.Core.Notification.show('カテゴリを入力してください', 'error');
            return;
        }

        const templates = window.AppState.promptTemplates;
        
        // 重複チェック
        if (templates[templateName]) {
            window.UI.Core.Notification.show('同じ名前のテンプレートが既に存在します', 'error');
            return;
        }
        
        // テンプレートを保存
        templates[templateName] = systemPrompt;
        window.AppState.promptTemplates = templates;
        window.Storage.savePromptTemplates(templates);
        
        // 入力をクリア
       window.UI.Cache.get('newTemplateName').value = '';
       window.UI.Cache.get('newTemplateCategory').value = '';
        
        // テンプレート一覧を更新
        window.UI.Core.Modal.updateTemplateList(templates, this.onTemplateSelect, this.onTemplateDelete);
        
        window.UI.Core.Notification.show('テンプレートを保存しました', 'success');
    },
    
    /**
     * テンプレート選択時のハンドラー
     */
    onTemplateSelect: function(templateName) {
        if (!window.Elements.systemPromptInput) return;
        
        const template = window.AppState.promptTemplates[templateName];
        if (template) {
            window.Elements.systemPromptInput.value = template;
        }
    },
    
    /**
     * テンプレート削除時のハンドラー
     */
    onTemplateDelete: function(templateName) {
        if (confirm(`テンプレート "${templateName}" を削除してもよろしいですか？`)) {
            delete window.AppState.promptTemplates[templateName];
            window.Storage.savePromptTemplates(window.AppState.promptTemplates); 
            window.UI.Core.Modal.updateTemplateList(
                window.AppState.promptTemplates, 
                this.onTemplateSelect, 
                this.onTemplateDelete
            );
        }
        window.UI.Core.Notification.show('テンプレートを削除しました', 'success');
    }
});
