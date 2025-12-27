/**
 * promptManager.js
 * ユーザープロンプト管理機能を提供します
 * - シンプルなプロンプトライブラリ
 * - お気に入り機能
 * - 使用回数トラッキング
 */
class PromptManager {
    static #instance = null;

    constructor() {
        if (PromptManager.#instance) {
            return PromptManager.#instance;
        }

        // ストレージキー
        this.STORAGE_KEYS = {
            PROMPT_LIBRARY: 'promptLibrary'
        };

        // デフォルトのプロンプトテンプレート（変数なしの固定テキスト）
        this.DEFAULT_PROMPTS = [
            {
                name: '詳細な説明要求',
                content: '以下のトピックについて、初心者にもわかりやすく詳細に説明してください。具体例を交えて説明し、重要なポイントを箇条書きでまとめてください。',
                description: 'トピックについて詳細な説明を求めるプロンプト',
                tags: ['説明', '初心者向け']
            },
            {
                name: '比較分析',
                content: '以下の2つの選択肢を比較してください：\n1. メリット\n2. デメリット\n3. 使用シーン\n4. コスト\n5. 将来性',
                description: '2つの選択肢を複数の観点から比較するプロンプト',
                tags: ['比較', '分析']
            },
            {
                name: 'コード生成',
                content: '以下の要件を満たすコードを書いてください。\n\n【機能要件】\n\n【追加条件】\n- コードは読みやすく、メンテナンスしやすいものにしてください\n- エラーハンドリングを適切に実装してください\n- コードの説明をコメントとして含めてください',
                description: 'コードを生成するプロンプト',
                tags: ['コード生成', 'プログラミング']
            },
            {
                name: 'バグ修正',
                content: '以下のコードにバグがあります。問題を特定して修正してください：\n\n```\n（ここにコードを貼り付け）\n```\n\n【エラー内容】\n\n修正したコードと、何が問題だったのかの説明を提供してください。',
                description: 'コードのバグを修正するプロンプト',
                tags: ['デバッグ', 'バグ修正']
            },
            {
                name: 'リファクタリング提案',
                content: '以下のコードをリファクタリングしてください：\n\n```\n（ここにコードを貼り付け）\n```\n\n以下の点を改善してください：\n- コードの読みやすさ\n- パフォーマンス\n- ベストプラクティスの適用\n- 重複コードの削除\n\n改善点と理由を説明してください。',
                description: 'コードのリファクタリング提案をするプロンプト',
                tags: ['リファクタリング', 'コード改善']
            },
            {
                name: 'メール文章作成',
                content: 'ビジネスメールを作成してください。\n\n【宛先】\n\n【目的】\n\n【トーン】フォーマル / カジュアル\n\n【追加情報】',
                description: 'ビジネスメールを作成するプロンプト',
                tags: ['メール', 'ビジネス文書']
            },
            {
                name: 'ブログ記事作成',
                content: 'ブログ記事を作成してください。\n\n【トピック】\n\n【対象読者】\n\n【記事の長さ】約〇〇文字\n\n【キーポイント】\n\nSEOに最適化し、読者の興味を引く見出しと導入部から始めてください。適切な小見出しを使い、読みやすく構成してください。',
                description: 'ブログ記事を作成するプロンプト',
                tags: ['ブログ', 'コンテンツ作成']
            },
            {
                name: '要約',
                content: '以下のテキストを要約してください。重要なポイントが含まれるように、簡潔にまとめてください。\n\n（ここにテキストを貼り付け）',
                description: 'テキストを要約するプロンプト',
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
        // 既存データのマイグレーション
        this.#migrateOldData();

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
     * 既存データを新しい形式にマイグレーション
     */
    #migrateOldData() {
        const library = this.loadPromptLibrary();
        let needsMigration = false;

        const migratedLibrary = library.map(prompt => {
            // 新フィールドがない場合は追加
            if (prompt.isFavorite === undefined) {
                needsMigration = true;
                return {
                    ...prompt,
                    isFavorite: false,
                    useCount: 0,
                    lastUsedAt: null
                };
            }
            return prompt;
        });

        if (needsMigration) {
            this.#savePromptLibrary(migratedLibrary);
            console.log('プロンプトデータをマイグレーションしました');
        }

        // 不要になったストレージキーを削除
        try {
            localStorage.removeItem('promptCategories');
            localStorage.removeItem('promptVariables');
        } catch (e) {
            // ストレージアクセスエラーは無視
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
            tags: Array.isArray(prompt.tags) ? prompt.tags : [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isFavorite: false,
            useCount: 0,
            lastUsedAt: null
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
        const validFields = ['name', 'content', 'description', 'tags'];
        validFields.forEach(field => {
            if (updatedData[field] !== undefined) {
                library[index][field] = updatedData[field];
            }
        });

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

        return prompts.filter(prompt => {
            // お気に入りフィルタリング
            if (filter.favoriteOnly && !prompt.isFavorite) {
                return false;
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
     * お気に入りをトグルする
     * @public
     * @param {string} promptId - プロンプトID
     * @returns {boolean} 更新成功時true
     */
    toggleFavorite(promptId) {
        if (!promptId) return false;

        const library = this.loadPromptLibrary();
        const index = library.findIndex(p => p.id === promptId);

        if (index === -1) return false;

        library[index].isFavorite = !library[index].isFavorite;
        library[index].updatedAt = Date.now();
        this.#savePromptLibrary(library);

        return true;
    }

    /**
     * 使用回数をインクリメントする
     * @public
     * @param {string} promptId - プロンプトID
     * @returns {boolean} 更新成功時true
     */
    incrementUseCount(promptId) {
        if (!promptId) return false;

        const library = this.loadPromptLibrary();
        const index = library.findIndex(p => p.id === promptId);

        if (index === -1) return false;

        library[index].useCount = (library[index].useCount || 0) + 1;
        library[index].lastUsedAt = Date.now();
        this.#savePromptLibrary(library);

        return true;
    }

    /**
     * ソートされたプロンプト一覧を取得する
     * @public
     * @param {string} sortBy - ソート方法 ('recent' | 'mostUsed' | 'name' | 'favorite')
     * @returns {Array} ソートされたプロンプト配列
     */
    getPromptsSorted(sortBy = 'recent') {
        const prompts = this.loadPromptLibrary();

        switch (sortBy) {
            case 'mostUsed':
                // お気に入り優先、次に使用回数降順
                return prompts.sort((a, b) => {
                    if (a.isFavorite !== b.isFavorite) {
                        return b.isFavorite ? 1 : -1;
                    }
                    return (b.useCount || 0) - (a.useCount || 0);
                });

            case 'name':
                // 名前順（あいうえお順）
                return prompts.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

            case 'favorite':
                // お気に入り優先、次に最終使用日時降順
                return prompts.sort((a, b) => {
                    if (a.isFavorite !== b.isFavorite) {
                        return b.isFavorite ? 1 : -1;
                    }
                    return (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
                });

            case 'recent':
            default:
                // お気に入り優先、次に更新日時降順
                return prompts.sort((a, b) => {
                    if (a.isFavorite !== b.isFavorite) {
                        return b.isFavorite ? 1 : -1;
                    }
                    return (b.updatedAt || 0) - (a.updatedAt || 0);
                });
        }
    }

    /**
     * お気に入りプロンプトのみを取得する
     * @public
     * @returns {Array} お気に入りプロンプト配列
     */
    getFavoritePrompts() {
        return this.loadPromptLibrary().filter(p => p.isFavorite);
    }

    /**
     * プロンプトを取得する（使用時に使用回数を更新）
     * @public
     * @param {string} promptId - プロンプトID
     * @returns {string|null} プロンプト内容（見つからない場合はnull）
     */
    getPromptContent(promptId) {
        const library = this.loadPromptLibrary();
        const prompt = library.find(p => p.id === promptId);

        if (!prompt) {
            return null;
        }

        // 使用回数を更新
        this.incrementUseCount(promptId);

        return prompt.content;
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
     * 一意のIDを生成する
     * @returns {string} 生成されたID
     */
    #generateUniqueId() {
        return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    }
}
