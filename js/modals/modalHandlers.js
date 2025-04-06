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
        Storage.getInstance.saveApiSettings(window.AppState.apiSettings);
        window.UI.Core.Notification.show('API設定を保存しました', 'success');
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
                Storage.getInstance.saveConversations(window.AppState.conversations);
                ChatActions.getInstance.renderChatHistory();
            }
        }

        // モーダルを閉じる
        window.UI.Core.Modal.hideRenameChatModal();
    }
    
    /**
     * 新しいシステムプロンプトを保存します
     */
    saveNewSystemPrompt() {
        const systemPromptName = UICache.getInstance.get('newSystemPromptName').value.trim();
        const templateCategory = UICache.getInstance.get('newTemplateCategory').value.trim();
        const systemPrompt = UICache.getInstance.get('systemPromptInput').value.trim();
        
        if (!systemPromptName || !systemPrompt) {
            window.UI.Core.Notification.show('システムプロンプト名と内容を入力してください', 'error');
            return;
        }

        if (!templateCategory) {
            window.UI.Core.Notification.show('カテゴリを入力してください', 'error');
            return;
        }

        const templates = window.AppState.systemPromptTemplates;
        
        // 重複チェック
        if (templates[systemPromptName]) {
            window.UI.Core.Notification.show('同じ名前のシステムプロンプトが既に存在します', 'error');
            return;
        }
        
        // システムプロンプトを保存
        templates[systemPromptName] = {
            content: systemPrompt,
            category: templateCategory,
            description: '',
            tags: []
        };
        
        Storage.getInstance.saveSystemPromptTemplates(templates);
        
        // 入力をクリア
        UICache.getInstance.get('newSystemPromptName').value = '';
        UICache.getInstance.get('newTemplateCategory').value = '';
        
        // システムプロンプト一覧を更新
        SystemPromptModal.getInstance.updateList(templates, this.onTemplateSelect.bind(this), this.onTemplateDelete.bind(this));
        window.UI.Core.Notification.show('システムプロンプトを保存しました', 'success');
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
            Storage.getInstance.saveSystemPromptTemplates(window.AppState.systemPromptTemplates);
            
            // システムプロンプト一覧を更新
            SystemPromptModal.getInstance.updateList(
                window.AppState.systemPromptTemplates, 
                this.onTemplateSelect.bind(this), 
                this.onTemplateDelete.bind(this)
            );
            window.UI.Core.Notification.show('システムプロンプトを削除しました', 'success');
        }
    }
}
