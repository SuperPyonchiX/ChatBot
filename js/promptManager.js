/**
 * promptManager.js
 * 高度なプロンプト管理機能を提供します
 * - 階層的プロンプト管理
 * - 条件付きプロンプト構築
 * - プロンプトテンプレートライブラリ
 */

window.PromptManager = (function() {
    // プロンプトカテゴリのデフォルト設定
    const DEFAULT_CATEGORIES = {
        'general': {
            name: '一般',
            description: '一般的な会話や質問用のプロンプト',
            order: 0
        },
        'programming': {
            name: 'プログラミング',
            description: 'コード生成や技術的な質問用のプロンプト',
            order: 1,
            subcategories: {
                'javascript': { name: 'JavaScript', order: 0 },
                'python': { name: 'Python', order: 1 },
                'other': { name: 'その他言語', order: 2 }
            }
        },
        'writing': {
            name: '文章作成',
            description: '文章作成や編集用のプロンプト',
            order: 2
        },
        'system': {
            name: 'システム設定',
            description: 'システムプロンプト用のテンプレート',
            order: 3
        },
        'custom': {
            name: 'カスタム',
            description: 'ユーザー定義のプロンプト',
            order: 4
        }
    };

    // プロンプト変数の記号
    const VARIABLE_REGEX = /\{\{([^{}]+)\}\}/g;
    
    // 条件分岐の記号
    const CONDITION_REGEX = /\{\%\s*if\s+([^{}%]+)\s*\%\}([\s\S]*?)(?:\{\%\s*else\s*\%\}([\s\S]*?))?\{\%\s*endif\s*\%\}/g;

    /**
     * ストレージキー
     * @private
     */
    const STORAGE_KEYS = {
        PROMPT_LIBRARY: 'promptLibrary',
        PROMPT_CATEGORIES: 'promptCategories',
        PROMPT_VARIABLES: 'promptVariables'
    };

    /**
     * 初期化
     * @public
     */
    function init() {
        // 初回実行時にデフォルトカテゴリを設定
        const categories = loadCategories();
        if (Object.keys(categories).length === 0) {
            saveCategories(DEFAULT_CATEGORIES);
        }
        
        // 変数のデフォルト値を設定
        const variables = loadVariables();
        if (Object.keys(variables).length === 0) {
            saveVariables({
                'current_date': new Date().toISOString().split('T')[0],
                'user_name': 'ユーザー'
            });
        }
    }

    /**
     * プロンプトライブラリを読み込む
     * @public
     * @returns {Array} プロンプトの配列
     */
    function loadPromptLibrary() {
        return window.Storage._getItem(STORAGE_KEYS.PROMPT_LIBRARY, [], true);
    }

    /**
     * プロンプトライブラリを保存
     * @public
     * @param {Array} promptLibrary - プロンプトの配列
     */
    function savePromptLibrary(promptLibrary) {
        if (!Array.isArray(promptLibrary)) return;
        window.Storage._setItem(STORAGE_KEYS.PROMPT_LIBRARY, promptLibrary);
    }

    /**
     * カテゴリを読み込む
     * @public
     * @returns {Object} カテゴリオブジェクト
     */
    function loadCategories() {
        return window.Storage._getItem(STORAGE_KEYS.PROMPT_CATEGORIES, {}, true);
    }

    /**
     * カテゴリを保存
     * @public
     * @param {Object} categories - カテゴリオブジェクト
     */
    function saveCategories(categories) {
        if (!categories || typeof categories !== 'object') return;
        window.Storage._setItem(STORAGE_KEYS.PROMPT_CATEGORIES, categories);
    }

    /**
     * 変数を読み込む
     * @public
     * @returns {Object} 変数オブジェクト
     */
    function loadVariables() {
        return window.Storage._getItem(STORAGE_KEYS.PROMPT_VARIABLES, {}, true);
    }

    /**
     * 変数を保存
     * @public
     * @param {Object} variables - 変数オブジェクト
     */
    function saveVariables(variables) {
        if (!variables || typeof variables !== 'object') return;
        window.Storage._setItem(STORAGE_KEYS.PROMPT_VARIABLES, variables);
    }

    /**
     * プロンプトを追加する
     * @public
     * @param {Object} prompt - プロンプトオブジェクト
     * @returns {string} 生成されたプロンプトID
     */
    function addPrompt(prompt) {
        if (!prompt || !prompt.name || !prompt.content) {
            throw new Error('プロンプトには名前と内容が必要です');
        }

        const library = loadPromptLibrary();
        const promptId = generateUniqueId();
        
        const newPrompt = {
            id: promptId,
            name: prompt.name,
            content: prompt.content,
            description: prompt.description || '',
            category: prompt.category || 'general',
            subcategory: prompt.subcategory || '',
            tags: Array.isArray(prompt.tags) ? prompt.tags : [],
            variables: extractVariables(prompt.content),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        library.push(newPrompt);
        savePromptLibrary(library);
        
        return promptId;
    }

    /**
     * プロンプトを更新する
     * @public
     * @param {string} promptId - 更新するプロンプトのID
     * @param {Object} updatedData - 更新データ
     * @returns {boolean} 更新成功時true
     */
    function updatePrompt(promptId, updatedData) {
        if (!promptId || !updatedData) return false;
        
        const library = loadPromptLibrary();
        const index = library.findIndex(p => p.id === promptId);
        
        if (index === -1) return false;
        
        // 更新可能なフィールドを更新
        const validFields = ['name', 'content', 'description', 'category', 'subcategory', 'tags'];
        validFields.forEach(field => {
            if (updatedData[field] !== undefined) {
                library[index][field] = updatedData[field];
            }
        });
        
        // 内容が更新された場合は変数も再抽出
        if (updatedData.content !== undefined) {
            library[index].variables = extractVariables(updatedData.content);
        }
        
        library[index].updatedAt = Date.now();
        savePromptLibrary(library);
        
        return true;
    }

    /**
     * プロンプトを削除する
     * @public
     * @param {string} promptId - 削除するプロンプトのID
     * @returns {boolean} 削除成功時true
     */
    function deletePrompt(promptId) {
        if (!promptId) return false;
        
        const library = loadPromptLibrary();
        const filteredLibrary = library.filter(p => p.id !== promptId);
        
        if (filteredLibrary.length === library.length) {
            return false; // 削除対象が見つからなかった
        }
        
        savePromptLibrary(filteredLibrary);
        return true;
    }

    /**
     * プロンプトを検索する
     * @public
     * @param {Object} criteria - 検索条件
     * @returns {Array} 検索結果の配列
     */
    function searchPrompts(criteria = {}) {
        const library = loadPromptLibrary();
        
        return library.filter(prompt => {
            // カテゴリでフィルタリング
            if (criteria.category && prompt.category !== criteria.category) {
                return false;
            }
            
            // サブカテゴリでフィルタリング
            if (criteria.subcategory && prompt.subcategory !== criteria.subcategory) {
                return false;
            }
            
            // タグでフィルタリング
            if (criteria.tag && !prompt.tags.includes(criteria.tag)) {
                return false;
            }
            
            // テキスト検索
            if (criteria.query) {
                const query = criteria.query.toLowerCase();
                return (
                    prompt.name.toLowerCase().includes(query) ||
                    prompt.description.toLowerCase().includes(query) ||
                    prompt.content.toLowerCase().includes(query)
                );
            }
            
            return true;
        });
    }

    /**
     * カテゴリを作成
     * @public
     * @param {string} categoryKey - カテゴリキー
     * @param {Object} categoryData - カテゴリデータ
     * @returns {boolean} 作成成功時true
     */
    function createCategory(categoryKey, categoryData) {
        if (!categoryKey || !categoryData || !categoryData.name) {
            return false;
        }
        
        const categories = loadCategories();
        
        // 既に存在する場合は失敗
        if (categories[categoryKey]) {
            return false;
        }
        
        categories[categoryKey] = {
            name: categoryData.name,
            description: categoryData.description || '',
            order: categoryData.order !== undefined ? categoryData.order : Object.keys(categories).length,
            subcategories: categoryData.subcategories || {}
        };
        
        saveCategories(categories);
        return true;
    }

    /**
     * カテゴリを更新
     * @public
     * @param {string} categoryKey - カテゴリキー
     * @param {Object} categoryData - カテゴリデータ
     * @returns {boolean} 更新成功時true
     */
    function updateCategory(categoryKey, categoryData) {
        if (!categoryKey) {
            return false;
        }
        
        const categories = loadCategories();
        
        // 存在しない場合は失敗
        if (!categories[categoryKey]) {
            return false;
        }
        
        // 更新可能なフィールドを更新
        const validFields = ['name', 'description', 'order'];
        validFields.forEach(field => {
            if (categoryData[field] !== undefined) {
                categories[categoryKey][field] = categoryData[field];
            }
        });
        
        saveCategories(categories);
        return true;
    }

    /**
     * サブカテゴリを追加
     * @public
     * @param {string} categoryKey - 親カテゴリキー
     * @param {string} subcategoryKey - サブカテゴリキー
     * @param {Object} subcategoryData - サブカテゴリデータ
     * @returns {boolean} 追加成功時true
     */
    function addSubcategory(categoryKey, subcategoryKey, subcategoryData) {
        if (!categoryKey || !subcategoryKey || !subcategoryData || !subcategoryData.name) {
            return false;
        }
        
        const categories = loadCategories();
        
        // 親カテゴリが存在しない場合は失敗
        if (!categories[categoryKey]) {
            return false;
        }
        
        // サブカテゴリの初期化
        if (!categories[categoryKey].subcategories) {
            categories[categoryKey].subcategories = {};
        }
        
        // 既に存在する場合は失敗
        if (categories[categoryKey].subcategories[subcategoryKey]) {
            return false;
        }
        
        categories[categoryKey].subcategories[subcategoryKey] = {
            name: subcategoryData.name,
            order: subcategoryData.order !== undefined ? subcategoryData.order : 
                   Object.keys(categories[categoryKey].subcategories).length
        };
        
        saveCategories(categories);
        return true;
    }

    /**
     * 変数を設定
     * @public
     * @param {string} name - 変数名
     * @param {string} value - 変数値
     */
    function setVariable(name, value) {
        if (!name) return;
        
        const variables = loadVariables();
        variables[name] = value;
        saveVariables(variables);
    }

    /**
     * プロンプトを構築する
     * @public
     * @param {string} promptId - プロンプトID
     * @param {Object} customVariables - カスタム変数（オプション）
     * @returns {string} 構築されたプロンプト
     */
    function buildPrompt(promptId, customVariables = {}) {
        const library = loadPromptLibrary();
        const prompt = library.find(p => p.id === promptId);
        
        if (!prompt) {
            throw new Error(`プロンプトID "${promptId}" が見つかりません`);
        }
        
        return processPromptTemplate(prompt.content, customVariables);
    }

    /**
     * プロンプトを複数組み合わせる
     * @public
     * @param {Array} promptIds - プロンプトIDの配列
     * @param {Object} customVariables - カスタム変数（オプション）
     * @param {string} separator - 区切り文字（デフォルトは改行2つ）
     * @returns {string} 結合されたプロンプト
     */
    function combinePrompts(promptIds, customVariables = {}, separator = '\n\n') {
        if (!Array.isArray(promptIds) || promptIds.length === 0) {
            return '';
        }
        
        const library = loadPromptLibrary();
        const prompts = promptIds
            .map(id => library.find(p => p.id === id))
            .filter(Boolean)
            .map(prompt => processPromptTemplate(prompt.content, customVariables));
        
        return prompts.join(separator);
    }

    /**
     * プロンプトテンプレートを処理する（変数置換と条件処理）
     * @private
     * @param {string} template - プロンプトテンプレート
     * @param {Object} customVariables - カスタム変数
     * @returns {string} 処理されたプロンプト
     */
    function processPromptTemplate(template, customVariables = {}) {
        if (!template) return '';
        
        // システム変数の設定
        const systemVariables = {
            'current_date': new Date().toISOString().split('T')[0],
            'current_time': new Date().toTimeString().split(' ')[0]
        };
        
        // 保存済みの変数を読み込む
        const savedVariables = loadVariables();
        
        // すべての変数をマージ（優先順位: カスタム > システム > 保存済み）
        const allVariables = {
            ...savedVariables,
            ...systemVariables,
            ...customVariables
        };
        
        // まず条件分岐を処理
        let processedTemplate = processConditions(template, allVariables);
        
        // 次に変数を置換
        processedTemplate = processedTemplate.replace(VARIABLE_REGEX, (match, varName) => {
            const trimmedName = varName.trim();
            // 変数が存在すれば値を返し、なければプレースホルダーをそのまま残す
            return allVariables[trimmedName] !== undefined ? allVariables[trimmedName] : match;
        });
        
        return processedTemplate;
    }

    /**
     * 条件分岐を処理する
     * @private
     * @param {string} template - プロンプトテンプレート
     * @param {Object} variables - 変数オブジェクト
     * @returns {string} 条件処理後のテンプレート
     */
    function processConditions(template, variables) {
        return template.replace(CONDITION_REGEX, (match, condition, ifBlock, elseBlock = '') => {
            try {
                // 条件式の評価
                const conditionResult = evaluateCondition(condition, variables);
                return conditionResult ? ifBlock : elseBlock;
            } catch (e) {
                console.error('条件評価エラー:', e);
                return match; // エラー時は元のままを返す
            }
        });
    }

    /**
     * 条件式を評価する
     * @private
     * @param {string} condition - 条件式
     * @param {Object} variables - 変数オブジェクト
     * @returns {boolean} 評価結果
     */
    function evaluateCondition(condition, variables) {
        // 基本的な比較演算子をサポート
        
        // 等しい
        if (condition.includes('==')) {
            const [left, right] = condition.split('==').map(s => s.trim());
            const leftValue = variables[left] !== undefined ? variables[left] : left;
            const rightValue = variables[right] !== undefined ? variables[right] : right;
            return String(leftValue) === String(rightValue);
        }
        
        // 等しくない
        if (condition.includes('!=')) {
            const [left, right] = condition.split('!=').map(s => s.trim());
            const leftValue = variables[left] !== undefined ? variables[left] : left;
            const rightValue = variables[right] !== undefined ? variables[right] : right;
            return String(leftValue) !== String(rightValue);
        }
        
        // 変数の存在確認
        if (condition.startsWith('exists ')) {
            const varName = condition.replace('exists ', '').trim();
            return variables[varName] !== undefined && variables[varName] !== '';
        }
        
        // 変数の非存在確認
        if (condition.startsWith('not exists ')) {
            const varName = condition.replace('not exists ', '').trim();
            return variables[varName] === undefined || variables[varName] === '';
        }
        
        // 単一変数の真偽判定（存在し、値が空でなく、'false'でない）
        const varValue = variables[condition.trim()];
        return !!varValue && varValue !== 'false';
    }

    /**
     * テンプレートから変数を抽出する
     * @private
     * @param {string} template - プロンプトテンプレート
     * @returns {Array} 変数名の配列
     */
    function extractVariables(template) {
        if (!template) return [];
        
        const variables = new Set();
        let match;
        
        // 変数の抽出
        while ((match = VARIABLE_REGEX.exec(template)) !== null) {
            variables.add(match[1].trim());
        }
        
        return Array.from(variables);
    }

    /**
     * 一意のIDを生成する
     * @private
     * @returns {string} 生成されたID
     */
    function generateUniqueId() {
        return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    }

    /**
     * システムプロンプトとして設定する
     * @public
     * @param {string} promptId - プロンプトID
     * @param {Object} customVariables - カスタム変数（オプション）
     * @returns {string} 構築されたシステムプロンプト
     */
    function setAsSystemPrompt(promptId, customVariables = {}) {
        const promptText = buildPrompt(promptId, customVariables);
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
        
        const library = loadPromptLibrary();
        const prompt = library.find(p => p.id === promptId);
        
        if (!prompt) {
            throw new Error(`プロンプトID "${promptId}" が見つかりません`);
        }
        
        // プロンプトテンプレートを読み込む
        const promptTemplates = window.Storage.loadPromptTemplates();
        
        // テンプレートに追加
        promptTemplates[templateName] = prompt.content;
        
        // 保存
        window.Storage.savePromptTemplates(promptTemplates);
        
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
        const promptTemplates = window.Storage.loadPromptTemplates();
        
        const templateContent = promptTemplates[templateName];
        if (!templateContent) {
            throw new Error(`テンプレート "${templateName}" が見つかりません`);
        }
        
        // プロンプトとして追加
        return addPrompt({
            name: `${templateName} (システムプロンプト)`,
            content: templateContent,
            description: 'システムプロンプトテンプレートからインポート',
            category: 'system',
            tags: ['システムプロンプト', templateName]
        });
    }

    // 公開API
    return {
        init,
        loadPromptLibrary,
        savePromptLibrary,
        loadCategories,
        saveCategories,
        loadVariables,
        saveVariables,
        addPrompt,
        updatePrompt,
        deletePrompt,
        searchPrompts,
        createCategory,
        updateCategory,
        addSubcategory,
        setVariable,
        buildPrompt,
        combinePrompts,
        DEFAULT_CATEGORIES,
        setAsSystemPrompt,
        saveAsSystemPromptTemplate,
        importSystemPromptTemplate
    };
})();