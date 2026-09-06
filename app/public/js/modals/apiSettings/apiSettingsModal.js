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
            claudeSystemRadio: UICache.getInstance.get('claudeSystemRadio'),
            openaiRadio: UICache.getInstance.get('openaiRadio'),
            azureRadio: UICache.getInstance.get('azureRadio'),
            apiKeyInput: UICache.getInstance.get('apiKeyInput'),
            azureApiKeyInput: UICache.getInstance.get('azureApiKeyInput'),
            geminiApiKeyInput: UICache.getInstance.get('geminiApiKeyInput'),
            claudeApiKeyInput: UICache.getInstance.get('claudeApiKeyInput'),
            openaiSystemSettings: UICache.getInstance.get('openaiSystemSettings'),
            geminiSystemSettings: UICache.getInstance.get('geminiSystemSettings'),
            claudeSystemSettings: UICache.getInstance.get('claudeSystemSettings'),
            openaiSettings: UICache.getInstance.get('openaiSettings'),
            azureSettings: UICache.getInstance.get('azureSettings')
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
        
        // Azure設定は apiType に関わらず先に反映しておく
        // （openai で開いてから azure に切り替えて保存したときに空で上書きされるのを防ぐ）
        this.#renderAzureEndpointFields(apiSettings.azureEndpoints);

        const embeddingEndpoint = document.getElementById('azureEndpointEmbedding');
        if (embeddingEndpoint) {
            embeddingEndpoint.value = Storage.getInstance.getItem(
                window.CONFIG.STORAGE.KEYS.AZURE_EMBEDDING_ENDPOINT,
                ''
            );
        }

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
                
            } else {
                elements.openaiRadio.checked = true;
                UIUtils.getInstance.toggleVisibility(elements.openaiSettings, true);
                UIUtils.getInstance.toggleVisibility(elements.azureSettings, false);
            }
        }
    }
    
    /**
     * Azureのモデル別エンドポイント入力欄を CONFIG.MODELS.OPENAI から生成します
     * モデル一覧を増減してもこのメソッドだけで追従するため、HTML側に固定の入力欄を持ちません
     * @param {Object} [azureEndpoints] - モデル名をキーにしたエンドポイントURLのマップ
     * @returns {void}
     */
    #renderAzureEndpointFields(azureEndpoints) {
        const container = document.getElementById('azureModelEndpoints');
        if (!container) return;

        const endpoints = azureEndpoints || {};
        const placeholder = window.CONFIG.AIAPI.AZURE_ENDPOINT_PLACEHOLDER;

        container.innerHTML = '';

        window.CONFIG.MODELS.OPENAI.forEach(model => {
            if (!model) return;

            const inputId = `azureEndpoint-${model}`;

            const group = document.createElement('div');
            group.className = 'form-group';

            const label = document.createElement('label');
            label.setAttribute('for', inputId);
            label.textContent = `${model} エンドポイントURL:`;

            const input = document.createElement('input');
            input.type = 'text';
            input.id = inputId;
            input.dataset.model = model;
            input.placeholder = placeholder;
            input.value = endpoints[model] || '';

            group.appendChild(label);
            group.appendChild(input);
            container.appendChild(group);
        });
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
}
