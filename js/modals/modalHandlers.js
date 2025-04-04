/**
 * modalHandlers.js
 * モーダル関連のイベントハンドラーを管理するモジュール
 */

window.ModalHandlers = {
    /**
     * API設定を保存します
     */
    saveApiSettings() {
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
        window.Modal.ApiSettings.hideApiKeyModal();
    },

    /**
     * チャット名を保存します
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
                window.ChatActions.renderChatHistory();
            }
        }
        
        // モーダルを閉じる
        window.Modal.RenameChat.hideRenameChatModal();
    },

    /**
     * 新規テンプレートとして保存します
     */
    saveNewTemplate() {
        const templateName = document.getElementById('newTemplateName').value.trim();
        const templateCategory = document.getElementById('newTemplateCategory').value.trim();
        const systemPrompt = document.getElementById('systemPromptInput').value.trim();
        
        if (!templateName || !systemPrompt) {
            window.UI.notify('テンプレート名とプロンプト内容を入力してください', 'error');
            return;
        }

        if (!templateCategory) {
            window.UI.notify('カテゴリを入力してください', 'error');
            return;
        }
        
        const templates = window.AppState.promptTemplates;
        if (templates[templateName]) {
            window.UI.notify('同じ名前のテンプレートが既に存在します', 'error');
            return;
        }
                
        // テンプレートを保存
        templates[templateName] = systemPrompt;
        window.Storage.savePromptTemplates(templates);
        
        // 入力をクリア
        document.getElementById('newTemplateName').value = '';
        document.getElementById('newTemplateCategory').value = '';
        
        // テンプレート一覧を更新
        window.Modal.SystemPrompt.updateTemplateList(templates, this.onTemplateSelect, this.onTemplateDelete);
        
        window.UI.notify('新規テンプレートを保存しました', 'success');
    },

    /**
     * テンプレート選択時の処理
     */
    onTemplateSelect(templateName) {
        if (!window.Elements.systemPromptInput) return;
        
        const template = window.AppState.promptTemplates[templateName];
        if (template) {
            window.Elements.systemPromptInput.value = template;
        }
    },

    /**
     * テンプレート削除時の処理
     */
    onTemplateDelete(templateName) {
        if (confirm(`テンプレート "${templateName}" を削除してもよろしいですか？`)) {
            delete window.AppState.promptTemplates[templateName];
            window.Storage.savePromptTemplates(window.AppState.promptTemplates);
            window.Modal.SystemPrompt.updateTemplateList(
                window.AppState.promptTemplates, 
                this.onTemplateSelect, 
                this.onTemplateDelete
            );
        }
    }
};
