/**
 * promptManager.js
 * ユーザープロンプト管理機能を提供します
 * - 階層的プロンプト管理
 * - 条件付きプロンプト構築
 * - プロンプトライブラリ
 */
class PromptManager {
    static #instance = null;
    
    // プロンプトカテゴリのデフォルト設定
    static DEFAULT_CATEGORIES = {
        'all': {
            name: '全体',
            description: 'すべてのプロンプト',
            order: -1  // 最上部に表示
        },
        'general': {
            name: '一般',
            description: '一般的な会話や質問用のプロンプト',
            order: 0
        },
        'programming': {
            name: 'プログラミング',
            description: 'コード生成や技術的な質問用のプロンプト',
            order: 1
        },
        'writing': {
            name: '文章作成',
            description: '文章作成や編集用のプロンプト',
            order: 2
        },
        'custom': {
            name: 'カスタム',
            description: 'ユーザー定義のプロンプト',
            order: 3
        }
    };

    constructor() {
        if (PromptManager.#instance) {
            return PromptManager.#instance;
        }
        
        // プロンプト変数の記号
        this.VARIABLE_REGEX = /\{\{([^{}]+)\}\}/g;
        
        // 条件分岐の記号
        this.CONDITION_REGEX = /\{\%\s*if\s+([^{}%]+)\s*\%\}([\s\S]*?)(?:\{\%\s*else\s*\%\}([\s\S]*?))?\{\%\s*endif\s*\%\}/g;

        // ストレージキー
        this.STORAGE_KEYS = {
            PROMPT_LIBRARY: 'promptLibrary',
            PROMPT_CATEGORIES: 'promptCategories',
            PROMPT_VARIABLES: 'promptVariables'
        };

        // デフォルトのプロンプトテンプレート
        this.DEFAULT_PROMPTS = [
            {
                name: '詳細な説明要求',
                content: 'この{{topic}}について、初心者にもわかりやすく詳細に説明してください。具体例を交えて説明し、重要なポイントを箇条書きでまとめてください。',
                description: 'トピックについて詳細な説明を求めるプロンプト',
                category: 'general',
                tags: ['説明', '初心者向け']
            },
            {
                name: '比較分析',
                content: '{{option1}}と{{option2}}を以下の観点から比較してください：\n1. メリット\n2. デメリット\n3. 使用シーン\n4. コスト\n5. 将来性',
                description: '2つの選択肢を複数の観点から比較するプロンプト',
                category: 'general',
                tags: ['比較', '分析']
            },
            {
                name: 'コード生成',
                content: '以下の要件を満たす{{language}}のコードを書いてください。\n\n【機能要件】\n{{requirements}}\n\n【追加条件】\n- コードは読みやすく、メンテナンスしやすいものにしてください\n- エラーハンドリングを適切に実装してください\n- コードの説明をコメントとして含めてください',
                description: '指定された言語でコードを生成するプロンプト',
                category: 'programming',
                tags: ['コード生成', 'プログラミング']
            },
            {
                name: 'バグ修正',
                content: '以下の{{language}}コードにバグがあります。問題を特定して修正してください：\n\n```{{language}}\n{{code}}\n```\n\n【エラー内容】\n{{error_message}}\n\n修正したコードと、何が問題だったのかの説明を提供してください。',
                description: 'コードのバグを修正するプロンプト',
                category: 'programming',
                tags: ['デバッグ', 'バグ修正']
            },
            {
                name: 'リファクタリング提案',
                content: '以下の{{language}}コードをリファクタリングしてください：\n\n```{{language}}\n{{code}}\n```\n\n以下の点を改善してください：\n- コードの読みやすさ\n- パフォーマンス\n- ベストプラクティスの適用\n- 重複コードの削除\n\n改善点と理由を説明してください。',
                description: 'コードのリファクタリング提案をするプロンプト',
                category: 'programming',
                tags: ['リファクタリング', 'コード改善']
            },
            {
                name: 'メール文章作成',
                content: '{{recipient}}宛てのビジネスメールを作成してください。\n\n【目的】\n{{purpose}}\n\n【トーン】\n{% if formal %}フォーマル{% else %}カジュアル{% endif %}\n\n【追加情報】\n{{additional_info}}',
                description: 'ビジネスメールを作成するプロンプト',
                category: 'writing',
                tags: ['メール', 'ビジネス文書']
            },
            {
                name: 'ブログ記事作成',
                content: '{{topic}}に関するブログ記事を作成してください。\n\n【対象読者】\n{{audience}}\n\n【記事の長さ】\n約{{length}}文字\n\n【キーポイント】\n{{key_points}}\n\n【記事のトーン】\n{{tone}}\n\nSEOに最適化し、読者の興味を引く見出しと導入部から始めてください。適切な小見出しを使い、読みやすく構成してください。',
                description: 'ブログ記事を作成するプロンプト',
                category: 'writing',
                tags: ['ブログ', 'コンテンツ作成']
            },
            {
                name: '要約',
                content: '以下のテキストを要約してください。重要なポイントが含まれるように、約{{summary_length}}文字でまとめてください。\n\n{{text_to_summarize}}',
                description: 'テキストを要約するプロンプト',
                category: 'writing',
                tags: ['要約', 'テキスト処理']
            }
        ];

        PromptManager.#instance = this;
        this.init();
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!PromptManager.#instance) {
            PromptManager.#instance = new PromptManager();
        }
        return PromptManager.#instance;
    }

    /**
     * 初期化
     * @public
     */
    init() {
        // 初回実行時にデフォルトカテゴリを設定
        const categories = this.loadCategories();
        if (Object.keys(categories).length === 0) {
            this.#saveCategories(PromptManager.DEFAULT_CATEGORIES);
        }
        
        // 変数のデフォルト値を設定
        const variables = this.#loadVariables();
        if (Object.keys(variables).length === 0) {
            this.#saveVariables({
                'current_date': new Date().toISOString().split('T')[0],
                'user_name': 'ユーザー'
            });
        }

        // デフォルトプロンプトテンプレートを追加（既存のプロンプトが無い場合のみ）
        const library = this.loadPromptLibrary();
        if (library.length === 0) {
            console.log('デフォルトプロンプトテンプレートを追加します');
            this.DEFAULT_PROMPTS.forEach(prompt => {
                this.addPrompt(prompt);
            });
        }
    }

    /**
     * プロンプトライブラリを読み込む
     * @public
     * @returns {Array} プロンプトの配列
     */
    loadPromptLibrary() {
        // @ts-ignore - Storageはカスタムクラス(型定義あり)
        return Storage.getInstance.getItem(this.STORAGE_KEYS.PROMPT_LIBRARY, [], true);
    }

    /**
     * カテゴリを読み込む
     * @returns {Object} カテゴリオブジェクト
     */
    loadCategories() {
        // @ts-ignore - Storageはカスタムクラス(型定義あり)
        return Storage.getInstance.getItem(this.STORAGE_KEYS.PROMPT_CATEGORIES, {}, true);
    }

    /**
     * プロンプトを追加する
     * @public
     * @param {Object} prompt - プロンプトオブジェクト
     * @returns {string} 生成されたプロンプトID
     */
    addPrompt(prompt) {
        if (!prompt || !prompt.name || !prompt.content) {
            throw new Error('プロンプトには名前と内容が必要です');
        }

        const library = this.loadPromptLibrary();
        const promptId = this.#generateUniqueId();
        
        const newPrompt = {
            id: promptId,
            name: prompt.name,
            content: prompt.content,
            description: prompt.description || '',
            category: prompt.category || 'general',
            tags: Array.isArray(prompt.tags) ? prompt.tags : [],
            variables: this.#extractVariables(prompt.content),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        library.push(newPrompt);
        this.#savePromptLibrary(library);
        
        return promptId;
    }

    /**
     * プロンプトを更新する
     * @public
     * @param {string} promptId - 更新するプロンプトのID
     * @param {Object} updatedData - 更新データ
     * @returns {boolean} 更新成功時true
     */
    updatePrompt(promptId, updatedData) {
        if (!promptId || !updatedData) return false;
        
        const library = this.loadPromptLibrary();
        const index = library.findIndex(p => p.id === promptId);
        
        if (index === -1) return false;
        
        // 更新可能なフィールドを更新
        const validFields = ['name', 'content', 'description', 'category', 'tags'];
        validFields.forEach(field => {
            if (updatedData[field] !== undefined) {
                library[index][field] = updatedData[field];
            }
        });
        
        // 内容が更新された場合は変数も再抽出
        if (updatedData.content !== undefined) {
            library[index].variables = this.#extractVariables(updatedData.content);
        }
        
        library[index].updatedAt = Date.now();
        this.#savePromptLibrary(library);
        
        return true;
    }

    /**
     * プロンプトを削除する
     * @public
     * @param {string} promptId - 削除するプロンプトのID
     * @returns {boolean} 削除成功時true
     */
    deletePrompt(promptId) {
        if (!promptId) return false;
        
        const library = this.loadPromptLibrary();
        const filteredLibrary = library.filter(p => p.id !== promptId);
        
        if (filteredLibrary.length === library.length) {
            return false; // 削除対象が見つからなかった
        }
        
        this.#savePromptLibrary(filteredLibrary);
        return true;
    }

    /**
     * プロンプトを検索する
     * @param {Object} filter - フィルタリング条件
     * @returns {Array} フィルタリングされたプロンプト配列
     */
    searchPrompts(filter = {}) {
        const prompts = this.loadPromptLibrary();
        console.log('検索フィルター:', filter, '全プロンプト数:', prompts.length);
        
        return prompts.filter(prompt => {
            // カテゴリフィルタリング
            if (filter.category && filter.category !== 'all') {
                if (prompt.category !== filter.category) {
                    return false;
                }
            }
            
            // テキスト検索
            if (filter.searchText) {
                const searchText = filter.searchText.toLowerCase();
                const matchesName = prompt.name.toLowerCase().includes(searchText);
                const matchesDescription = prompt.description?.toLowerCase().includes(searchText);
                const matchesContent = prompt.content.toLowerCase().includes(searchText);
                const matchesTags = prompt.tags?.some(tag => tag.toLowerCase().includes(searchText));
                
                return matchesName || matchesDescription || matchesContent || matchesTags;
            }
            
            return true;
        });
    }

    /**
     * 新しいカテゴリを追加
     * @public
     * @param {string} categoryName - カテゴリ名
     * @returns {boolean} 作成成功時true
     */
    addCategory(categoryName) {
        if (!categoryName) {
            console.error('カテゴリ名が空です');
            return false;
        }
        
        // カテゴリキーを生成
        const categoryKey = this.#generateCategoryKey(categoryName);
        
        if (!categoryKey) {
            console.error('カテゴリ名が不正です: ', categoryName);
            return false;
        }
        
        const categories = this.loadCategories();
        
        // 既に同じキーが存在する場合は失敗
        if (categories[categoryKey]) {
            console.error('カテゴリキーが既に存在します: ', categoryKey);
            return false;
        }
        
        // 既に同じ名前が存在する場合は失敗（大文字小文字を区別しない）
        const nameExists = Object.values(categories).some(cat => 
            cat.name.toLowerCase() === categoryName.toLowerCase()
        );
        if (nameExists) {
            console.error('カテゴリ名が既に存在します: ', categoryName);
            return false;
        }
        
        // カテゴリを作成
        const success = this.#createCategory(categoryKey, {
            name: categoryName,
            description: '',
            order: Object.keys(categories).length
        });
        
        if (!success) {
            console.error('カテゴリの保存に失敗しました: ', categoryName);
        }
        
        return success;
    }

    /**
     * カテゴリを更新する
     * @public
     * @param {string} categoryKey - 更新するカテゴリのキー
     * @param {Object} updateData - 更新データ
     * @param {string} updateData.name - 新しいカテゴリ名
     * @returns {boolean} 更新の成否
     */
    updateCategory(categoryKey, updateData) {
        if (!categoryKey || !updateData || !updateData.name) {
            console.error('カテゴリ更新に必要なデータが不足しています');
            return false;
        }

        try {
            // カテゴリ一覧を取得
            const categories = this.loadCategories();
            
            // カテゴリの存在確認
            if (!categories[categoryKey]) {
                console.error('指定されたカテゴリが見つかりません:', categoryKey);
                return false;
            }
            
            // generalカテゴリは編集不可
            if (categoryKey === 'general') {
                console.error('一般カテゴリは編集できません');
                return false;
            }
            
            // カテゴリを更新
            categories[categoryKey].name = updateData.name.trim();
            
            // 保存
            this.#saveCategories(categories);
            
            return true;
        } catch (error) {
            console.error('カテゴリの更新中にエラーが発生しました:', error);
            return false;
        }
    }

    /**
     * カテゴリを削除する
     * @public
     * @param {string} categoryKey - 削除するカテゴリのキー
     * @returns {boolean} 削除の成否
     */
    deleteCategory(categoryKey) {
        if (!categoryKey) {
            console.error('カテゴリキーが指定されていません');
            return false;
        }

        try {
            // カテゴリ一覧を取得
            const categories = this.loadCategories();
            
            // カテゴリの存在確認
            if (!categories[categoryKey]) {
                console.error('指定されたカテゴリが見つかりません:', categoryKey);
                return false;
            }
            
            // generalカテゴリは削除不可
            if (categoryKey === 'general') {
                console.error('一般カテゴリは削除できません');
                return false;
            }
            
            // プロンプト一覧を取得
            const prompts = this.loadPromptLibrary();
            
            // カテゴリ内のプロンプトを「一般」カテゴリに移動
            prompts.forEach(prompt => {
                if (prompt.category === categoryKey) {
                    prompt.category = 'general';
                }
            });
            
            // カテゴリを削除
            delete categories[categoryKey];
            
            // 変更を保存
            this.#saveCategories(categories);
            this.#savePromptLibrary(prompts);
            
            return true;
        } catch (error) {
            console.error('カテゴリの削除中にエラーが発生しました:', error);
            return false;
        }
    }

    /**
     * 変数を設定
     * @public
     * @param {string} name - 変数名
     * @param {string} value - 変数値
     */
    setVariable(name, value) {
        if (!name) return;
        
        const variables = this.#loadVariables();
        variables[name] = value;
        this.#saveVariables(variables);
    }

    /**
     * プロンプトを構築する
     * @public
     * @param {string} promptId - プロンプトID
     * @param {Object} customVariables - カスタム変数（オプション）
     * @returns {string} 構築されたプロンプト
     */
    buildPrompt(promptId, customVariables = {}) {
        const library = this.loadPromptLibrary();
        const prompt = library.find(p => p.id === promptId);
        
        if (!prompt) {
            throw new Error(`プロンプトID "${promptId}" が見つかりません`);
        }
        
        return this.#processPromptTemplate(prompt.content, customVariables);
    }

    /**
     * プロンプトライブラリを保存
     * @param {Array} promptLibrary - プロンプトの配列
     */
    #savePromptLibrary(promptLibrary) {
        if (!Array.isArray(promptLibrary)) return;
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.setItem(this.STORAGE_KEYS.PROMPT_LIBRARY, promptLibrary);
    }

    /**
     * カテゴリを保存
     * @param {Object} categories - カテゴリオブジェクト
     */
    #saveCategories(categories) {
        if (!categories || typeof categories !== 'object') return;
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.setItem(this.STORAGE_KEYS.PROMPT_CATEGORIES, categories);
    }

    /**
     * 変数を読み込む
     * @returns {Object} 変数オブジェクト
     */
    #loadVariables() {
        // @ts-ignore - Storageはカスタムクラス(型定義あり)
        return Storage.getInstance.getItem(this.STORAGE_KEYS.PROMPT_VARIABLES, {}, true);
    }

    /**
     * 変数を保存
     * @param {Object} variables - 変数オブジェクト
     */
    #saveVariables(variables) {
        if (!variables || typeof variables !== 'object') return;
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.setItem(this.STORAGE_KEYS.PROMPT_VARIABLES, variables);
    }

    /**
     * カテゴリを作成
     * @param {string} categoryKey - カテゴリキー
     * @param {Object} categoryData - カテゴリデータ
     * @returns {boolean} 作成成功時true
     */
    #createCategory(categoryKey, categoryData) {
        if (!categoryKey || !categoryData || !categoryData.name) {
            return false;
        }
        
        const categories = this.loadCategories();
        
        // 既に存在する場合は失敗
        if (categories[categoryKey]) {
            return false;
        }
        
        categories[categoryKey] = {
            name: categoryData.name,
            description: categoryData.description || '',
            order: categoryData.order !== undefined ? categoryData.order : Object.keys(categories).length
        };
        
        this.#saveCategories(categories);
        return true;
    }

    /**
     * プロンプトテンプレートを処理する（変数置換と条件処理）
     * @param {string} template - プロンプトテンプレート
     * @param {Object} customVariables - カスタム変数
     * @returns {string} 処理されたプロンプト
     */
    #processPromptTemplate(template, customVariables = {}) {
        if (!template) return '';
        
        // システム変数の設定
        const systemVariables = {
            'current_date': new Date().toISOString().split('T')[0],
            'current_time': new Date().toTimeString().split(' ')[0]
        };
        
        // 保存済みの変数を読み込む
        const savedVariables = this.#loadVariables();
        
        // すべての変数をマージ（優先順位: カスタム > システム > 保存済み）
        const allVariables = {
            ...savedVariables,
            ...systemVariables,
            ...customVariables
        };
        
        // まず条件分岐を処理
        let processedTemplate = this.#processConditions(template, allVariables);
        
        // 次に変数を置換
        processedTemplate = processedTemplate.replace(this.VARIABLE_REGEX, (match, varName) => {
            const trimmedName = varName.trim();
            // 変数が存在すれば値を返し、なければプレースホルダーをそのまま残す
            return allVariables[trimmedName] !== undefined ? allVariables[trimmedName] : match;
        });
        
        return processedTemplate;
    }

    /**
     * 条件分岐を処理する
     * @param {string} template - プロンプトテンプレート
     * @param {Object} variables - 変数オブジェクト
     * @returns {string} 条件処理後のテンプレート
     */
    #processConditions(template, variables) {
        return template.replace(this.CONDITION_REGEX, (match, condition, ifBlock, elseBlock = '') => {
            try {
                // 条件式の評価
                const conditionResult = this.#evaluateCondition(condition, variables);
                return conditionResult ? ifBlock : elseBlock;
            } catch (e) {
                console.error('条件評価エラー:', e);
                return match; // エラー時は元のままを返す
            }
        });
    }

    /**
     * 条件式を評価する
     * @param {string} condition - 条件式
     * @param {Object} variables - 変数オブジェクト
     * @returns {boolean} 評価結果
     */
    #evaluateCondition(condition, variables) {
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
     * @param {string} template - プロンプトテンプレート
     * @returns {Array} 変数名の配列
     */
    #extractVariables(template) {
        if (!template) return [];
        
        const variables = new Set();
        let match;
        
        // 変数の抽出
        while ((match = this.VARIABLE_REGEX.exec(template)) !== null) {
            variables.add(match[1].trim());
        }
        
        return Array.from(variables);
    }

    /**
     * 一意のIDを生成する
     * @returns {string} 生成されたID
     */
    #generateUniqueId() {
        return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    }

    /**
     * 日本語を含むカテゴリ名を一意のキーに変換する
     * @param {string} categoryName - カテゴリ名
     * @returns {string} 一意のカテゴリキー
     */
    #generateCategoryKey(categoryName) {
        if (!categoryName) return '';

        // ハッシュ関数を使用して一意のキーを生成
        const hash = Array.from(categoryName).reduce((acc, char) => {
            return acc + char.charCodeAt(0).toString(16);
        }, '');

        return `cat_${hash}`;
    }
}