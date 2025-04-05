/**
 * systemPromptManager.js
 * システムプロンプト管理機能を提供します
 * - システムプロンプトの設定と保存
 * - システムプロンプトテンプレートの管理
 * - テンプレートUI管理
 */

window.SystemPromptManager = (function() {
    /**
     * システムプロンプトとして設定する
     * @public
     * @param {string} promptId - プロンプトID
     * @param {Object} customVariables - カスタム変数（オプション）
     * @returns {string} 構築されたシステムプロンプト
     */
    function setAsSystemPrompt(promptId, customVariables = {}) {
        const promptText = window.PromptManager.buildPrompt(promptId, customVariables);
        if (!promptText) {
            throw new Error('システムプロンプトの構築に失敗しました');
        }
        
        // システムプロンプトを保存
        window.Storage.saveSystemPrompt(promptText);
        
        // システムプロンプトイベントを発火
        const event = new CustomEvent('system-prompt-updated', { 
            detail: { promptText, promptId } 
        });
        document.dispatchEvent(event);
        
        return promptText;
    }

    /**
     * プロンプトをシステムプロンプトテンプレートとして保存
     * @public
     * @param {string} promptId - プロンプトID
     * @param {string} templateName - テンプレート名
     * @returns {boolean} 保存成功時true
     */
    function saveAsSystemPromptTemplate(promptId, templateName) {
        if (!promptId || !templateName) return false;
        
        const library = window.PromptManager.loadPromptLibrary();
        const prompt = library.find(p => p.id === promptId);
        
        if (!prompt) {
            throw new Error(`プロンプトID "${promptId}" が見つかりません`);
        }
        
        // プロンプトテンプレートを読み込む
        const systemPromptTemplates = window.Storage.loadSystemPromptTemplates();
        
        // テンプレートに追加
        systemPromptTemplates[templateName] = prompt.content;
        
        // 保存
        window.Storage.saveSystemPromptTemplates(systemPromptTemplates);
        
        // イベント発火
        const event = new CustomEvent('prompt-template-added', { 
            detail: { templateName, content: prompt.content } 
        });
        document.dispatchEvent(event);
        
        return true;
    }

    /**
     * システムプロンプトテンプレートをプロンプトライブラリに追加
     * @public
     * @param {string} templateName - テンプレート名
     * @returns {string} 生成されたプロンプトID
     */
    function importSystemPromptTemplate(templateName) {
        if (!templateName) {
            throw new Error('テンプレート名が指定されていません');
        }
        
        // テンプレートを読み込む
        const systemPromptTemplates = window.Storage.loadSystemPromptTemplates();
        
        const templateContent = systemPromptTemplates[templateName];
        if (!templateContent) {
            throw new Error(`テンプレート "${templateName}" が見つかりません`);
        }
        
        // プロンプトとして追加
        return window.PromptManager.addPrompt({
            name: `${templateName} (システムプロンプト)`,
            content: templateContent,
            description: 'システムプロンプトテンプレートからインポート',
            category: 'system',
            tags: ['システムプロンプト', templateName]
        });
    }

    /**
     * テンプレート選択UIを初期化
     * @public
     */
    function initializeTemplateSelector() {
        const templateSelector = document.querySelector('#template-selector');
        if (!templateSelector) return;
        
        // テンプレートのリストをクリア
        templateSelector.innerHTML = '';
        
        // デフォルトオプション
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'テンプレートを選択...';
        templateSelector.appendChild(defaultOption);
        
        // テンプレートを取得して選択肢を追加
        const templates = window.Storage.loadSystemPromptTemplates();
        
        if (templates && typeof templates === 'object') {
            // テンプレートをアルファベット順にソート
            const sortedTemplateNames = Object.keys(templates).sort();
            
            sortedTemplateNames.forEach(templateName => {
                const option = document.createElement('option');
                option.value = templateName;
                option.textContent = templateName;
                templateSelector.appendChild(option);
            });
        }
        
        // テンプレート選択時のイベント
        templateSelector.addEventListener('change', (event) => {
            const selectedTemplate = event.target.value;
            if (!selectedTemplate) return;
            
            const templates = window.Storage.loadSystemPromptTemplates();
            if (templates && templates[selectedTemplate]) {
                // システムプロンプトの更新
                setAsSystemPrompt(selectedTemplate, templates[selectedTemplate]);
                
                // UIの更新
                const promptInput = document.querySelector('#system-prompt-input');
                if (promptInput) {
                    promptInput.value = templates[selectedTemplate];
                    promptInput.dispatchEvent(new Event('input'));
                }
                
                // セレクターをリセット
                event.target.value = '';
                
                console.log(`テンプレート "${selectedTemplate}" を適用しました`);
            }
        });
    }

    // 公開API
    return {
        setAsSystemPrompt,
        saveAsSystemPromptTemplate,
        importSystemPromptTemplate,
        initializeTemplateSelector
    };
})();