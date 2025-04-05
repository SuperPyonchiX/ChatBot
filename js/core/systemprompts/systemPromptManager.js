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
     * @param {string} category - カテゴリ名
     * @returns {boolean} 保存成功時true
     */
    function saveAsSystemPromptTemplate(promptId, templateName, category = '基本') {
        if (!promptId || !templateName) return false;
        
        const library = window.PromptManager.loadPromptLibrary();
        const prompt = library.find(p => p.id === promptId);
        
        if (!prompt) {
            throw new Error(`プロンプトID "${promptId}" が見つかりません`);
        }
        
        // プロンプトテンプレートを読み込む
        const systemPromptTemplates = window.AppState.systemPromptTemplates || {};
        
        // テンプレートに追加
        systemPromptTemplates[templateName] = {
            content: prompt.content,
            category: category,
            tags: prompt.tags || [],
            description: prompt.description || ''
        };
        
        // 保存
        window.Storage.saveSystemPromptTemplates(systemPromptTemplates);
        
        // イベント発火
        const event = new CustomEvent('prompt-template-added', { 
            detail: { 
                templateName, 
                content: prompt.content,
                category: category
            } 
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
        const systemPromptTemplates = window.AppState.systemPromptTemplates;;
        
        const template = systemPromptTemplates[templateName];
        if (!template) {
            throw new Error(`テンプレート "${templateName}" が見つかりません`);
        }
        
        // プロンプトとして追加
        return window.PromptManager.addPrompt({
            name: `${templateName} (システムプロンプト)`,
            content: template.content,
            description: template.description || 'システムプロンプトテンプレートからインポート',
            category: template.category || 'system',
            tags: template.tags || ['システムプロンプト', templateName]
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
        
        // テンプレートを取得
        const templates = window.AppState.systemPromptTemplates;;
        
        if (templates && typeof templates === 'object') {
            // カテゴリごとにテンプレートをグループ化
            const categorizedTemplates = {};
            Object.entries(templates).forEach(([name, template]) => {
                const category = template.category || '基本';
                if (!categorizedTemplates[category]) {
                    categorizedTemplates[category] = [];
                }
                categorizedTemplates[category].push({ name, ...template });
            });
            
            // カテゴリごとにoptgroupを作成
            Object.entries(categorizedTemplates).forEach(([category, templateList]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = category;
                
                // カテゴリ内のテンプレートをアルファベット順にソート
                templateList.sort((a, b) => a.name.localeCompare(b.name, 'ja')).forEach(template => {
                    const option = document.createElement('option');
                    option.value = template.name;
                    option.textContent = template.name;
                    optgroup.appendChild(option);
                });
                
                templateSelector.appendChild(optgroup);
            });
        }
        
        // テンプレート選択時のイベント
        templateSelector.addEventListener('change', (event) => {
            const selectedTemplate = event.target.value;
            if (!selectedTemplate) return;
            
            const templates = window.AppState.systemPromptTemplates;
            if (templates && templates[selectedTemplate]) {
                // システムプロンプトの更新
                const template = templates[selectedTemplate];
                setAsSystemPrompt(selectedTemplate, { content: template.content });
                
                // UIの更新
                const promptInput = document.querySelector('#system-prompt-input');
                if (promptInput) {
                    promptInput.value = template.content;
                    promptInput.dispatchEvent(new Event('input'));
                }
                
                // セレクターをリセット
                event.target.value = '';
                
                console.log(`テンプレート "${selectedTemplate}" (${template.category}) を適用しました`);
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