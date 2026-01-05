/**
 * confluenceDataSource.js
 * Confluence Data Center REST API v1との通信クラス
 *
 * Confluence Data Centerのページをナレッジベースに取り込むためのデータソース
 */

class ConfluenceDataSource {
    static #instance = null;

    /** @type {string} ベースURL */
    #baseUrl = '';

    /** @type {'basic' | 'pat'} 認証タイプ */
    #authType = 'basic';

    /** @type {string} 認証ヘッダー値（Basic認証の場合はBase64エンコード済み、PATの場合はトークン） */
    #authHeader = '';

    /**
     * シングルトンインスタンスを取得
     * @returns {ConfluenceDataSource}
     */
    static get getInstance() {
        if (!ConfluenceDataSource.#instance) {
            ConfluenceDataSource.#instance = new ConfluenceDataSource();
        }
        return ConfluenceDataSource.#instance;
    }

    constructor() {
        if (ConfluenceDataSource.#instance) {
            throw new Error('ConfluenceDataSource is a singleton. Use ConfluenceDataSource.getInstance');
        }
        this.#loadSettings();
    }

    /**
     * 設定をStorageからロード
     */
    #loadSettings() {
        const storage = Storage.getInstance;
        const keys = window.CONFIG.STORAGE.KEYS;

        this.#baseUrl = storage.getItem(keys.CONFLUENCE_BASE_URL, '');
        this.#authType = storage.getItem(keys.CONFLUENCE_AUTH_TYPE, 'basic');
        this.#authHeader = storage.getItem(keys.CONFLUENCE_AUTH_DATA, '');
    }

    /**
     * 設定を保存
     * @param {Object} settings
     * @param {string} settings.baseUrl - Confluence URL
     * @param {'basic' | 'pat'} settings.authType - 認証タイプ
     * @param {string} [settings.username] - ユーザー名（Basic認証の場合）
     * @param {string} [settings.password] - パスワード（Basic認証の場合）
     * @param {string} [settings.token] - Personal Access Token（PAT認証の場合）
     */
    saveSettings(settings) {
        const storage = Storage.getInstance;
        const keys = window.CONFIG.STORAGE.KEYS;

        // 末尾スラッシュを除去
        this.#baseUrl = settings.baseUrl.replace(/\/$/, '');
        this.#authType = settings.authType;

        // 認証データを生成
        if (settings.authType === 'basic') {
            // Base64エンコード (username:password)
            this.#authHeader = btoa(`${settings.username}:${settings.password}`);
        } else {
            // Personal Access Token
            this.#authHeader = settings.token;
        }

        // Storageに保存（暗号化はStorageクラスが行う）
        storage.setItem(keys.CONFLUENCE_BASE_URL, this.#baseUrl);
        storage.setItem(keys.CONFLUENCE_AUTH_TYPE, this.#authType);
        storage.setItem(keys.CONFLUENCE_AUTH_DATA, this.#authHeader);

        console.log('✅ Confluence設定を保存しました');
    }

    /**
     * 設定をクリア
     */
    clearSettings() {
        const storage = Storage.getInstance;
        const keys = window.CONFIG.STORAGE.KEYS;

        this.#baseUrl = '';
        this.#authType = 'basic';
        this.#authHeader = '';

        storage.removeItem(keys.CONFLUENCE_BASE_URL);
        storage.removeItem(keys.CONFLUENCE_AUTH_TYPE);
        storage.removeItem(keys.CONFLUENCE_AUTH_DATA);

        console.log('🗑️ Confluence設定をクリアしました');
    }

    /**
     * 接続テスト
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async testConnection() {
        if (!this.isConfigured()) {
            return { success: false, message: '設定が完了していません' };
        }

        try {
            const response = await this.#fetchFromProxy('/rest/api/space?limit=1');

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    message: `接続成功（${data.size || 0}個のスペースを検出）`
                };
            } else if (response.status === 401) {
                return { success: false, message: '認証に失敗しました。認証情報を確認してください。' };
            } else if (response.status === 403) {
                return { success: false, message: 'アクセス権限がありません。' };
            } else {
                return { success: false, message: `エラー: HTTP ${response.status}` };
            }
        } catch (error) {
            console.error('Confluence connection test failed:', error);
            return { success: false, message: `接続エラー: ${error.message}` };
        }
    }

    /**
     * スペース一覧を取得
     * @returns {Promise<Array<{key: string, name: string}>>}
     */
    async getSpaces() {
        const spaces = [];
        let start = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await this.#fetchFromProxy(
                `/rest/api/space?start=${start}&limit=${limit}`
            );

            if (!response.ok) {
                throw new Error(`スペース一覧の取得に失敗しました: HTTP ${response.status}`);
            }

            const data = await response.json();

            for (const space of (data.results || [])) {
                spaces.push({
                    key: space.key,
                    name: space.name
                });
            }

            hasMore = data._links?.next !== undefined;
            start += limit;

            // 無限ループ防止
            if (spaces.length >= 1000) {
                break;
            }
        }

        return spaces;
    }

    /**
     * スペース内のページ一覧を取得（コンテンツ含む）
     * @param {string} spaceKey - スペースキー
     * @param {function} [onProgress] - 進捗コールバック (current, total)
     * @returns {Promise<Array<{id: string, title: string, content: string, url: string, lastModified: string}>>}
     */
    async getSpacePages(spaceKey, onProgress) {
        const pages = [];
        const config = window.CONFIG.RAG.CONFLUENCE;
        let start = 0;
        const limit = config.PAGE_FETCH_LIMIT;
        let hasMore = true;
        let totalEstimate = 0;

        // まずページ総数を推定（初回リクエスト）
        const countUrl = `/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&type=page&limit=0`;
        const countResponse = await this.#fetchFromProxy(countUrl);
        if (countResponse.ok) {
            const countData = await countResponse.json();
            totalEstimate = countData.size || 0;
        }

        while (hasMore && pages.length < config.MAX_PAGES_PER_SPACE) {
            const url = `/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&type=page&expand=body.storage,version&start=${start}&limit=${limit}`;
            const response = await this.#fetchFromProxy(url);

            if (!response.ok) {
                throw new Error(`ページ一覧の取得に失敗しました: HTTP ${response.status}`);
            }

            const data = await response.json();

            for (const page of (data.results || [])) {
                // HTMLからテキストを抽出
                const htmlContent = page.body?.storage?.value || '';
                const textContent = this.#extractTextFromHtml(htmlContent);

                // 最大コンテンツ長でカット
                const truncatedContent = textContent.length > config.MAX_CONTENT_LENGTH
                    ? textContent.substring(0, config.MAX_CONTENT_LENGTH)
                    : textContent;

                pages.push({
                    id: page.id,
                    title: page.title,
                    content: truncatedContent,
                    url: `${this.#baseUrl}/pages/viewpage.action?pageId=${page.id}`,
                    lastModified: page.version?.when || null
                });

                if (onProgress) {
                    onProgress(pages.length, totalEstimate || pages.length);
                }
            }

            hasMore = data._links?.next !== undefined;
            start += limit;
        }

        console.log(`📄 ${spaceKey}: ${pages.length}ページを取得`);
        return pages;
    }

    /**
     * サーバープロキシ経由でConfluence APIにリクエスト
     * @param {string} path - APIパス
     * @returns {Promise<Response>}
     */
    async #fetchFromProxy(path) {
        const authHeaderValue = this.#authType === 'basic'
            ? `Basic ${this.#authHeader}`
            : `Bearer ${this.#authHeader}`;

        const response = await fetch('/confluence-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                targetUrl: `${this.#baseUrl}${path}`,
                authorization: authHeaderValue
            })
        });

        return response;
    }

    /**
     * Confluence StorageフォーマットHTMLからテキストを抽出
     * @param {string} html - Confluence Storage Format HTML
     * @returns {string} プレーンテキスト
     */
    #extractTextFromHtml(html) {
        if (!html) return '';

        // DOMParserを使用してHTMLを解析
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 不要な要素を削除
        const removeSelectors = [
            'script',
            'style',
            'ac\\:macro',
            'ac\\:parameter',
            'ri\\:attachment',
            'ri\\:page'
        ];
        removeSelectors.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => el.remove());
        });

        // テキストコンテンツを取得
        let text = doc.body.textContent || '';

        // 連続する空白を単一スペースに変換
        text = text.replace(/\s+/g, ' ').trim();

        return text;
    }

    /**
     * スペースのルートページ一覧を取得
     * @param {string} spaceKey - スペースキー
     * @returns {Promise<Array<{id: string, title: string, hasChildren: boolean}>>}
     */
    async getRootPages(spaceKey) {
        const pages = [];
        let start = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
            // depth=root でルートレベルのページのみ取得
            // children.page を expand して子ページの有無を確認
            const url = `/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&type=page&depth=root&expand=children.page&start=${start}&limit=${limit}`;
            const response = await this.#fetchFromProxy(url);

            if (!response.ok) {
                throw new Error(`ルートページの取得に失敗しました: HTTP ${response.status}`);
            }

            const data = await response.json();

            for (const page of (data.results || [])) {
                pages.push({
                    id: page.id,
                    title: page.title,
                    hasChildren: (page.children?.page?.size || 0) > 0
                });
            }

            hasMore = data._links?.next !== undefined;
            start += limit;

            // 無限ループ防止
            if (pages.length >= 1000) {
                break;
            }
        }

        console.log(`📁 ${spaceKey}: ${pages.length}個のルートページを取得`);
        return pages;
    }

    /**
     * 指定ページの子ページ一覧を取得
     * @param {string} pageId - 親ページID
     * @returns {Promise<Array<{id: string, title: string, hasChildren: boolean}>>}
     */
    async getChildPages(pageId) {
        const pages = [];
        let start = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
            // 子ページを取得し、さらにその子の有無を確認
            const url = `/rest/api/content/${pageId}/child/page?expand=children.page&start=${start}&limit=${limit}`;
            const response = await this.#fetchFromProxy(url);

            if (!response.ok) {
                throw new Error(`子ページの取得に失敗しました: HTTP ${response.status}`);
            }

            const data = await response.json();

            for (const page of (data.results || [])) {
                pages.push({
                    id: page.id,
                    title: page.title,
                    hasChildren: (page.children?.page?.size || 0) > 0
                });
            }

            hasMore = data._links?.next !== undefined;
            start += limit;

            // 無限ループ防止
            if (pages.length >= 500) {
                break;
            }
        }

        return pages;
    }

    /**
     * 指定ページとその全子孫ページを取得（コンテンツ含む）
     * @param {string} pageId - 起点ページID
     * @param {function} [onProgress] - 進捗コールバック (current, total, pageTitle)
     * @returns {Promise<Array<{id: string, title: string, content: string, url: string, lastModified: string}>>}
     */
    async getPageWithDescendants(pageId, onProgress) {
        const config = window.CONFIG.RAG.CONFLUENCE;
        const pages = [];
        const pageQueue = [pageId];
        const processedIds = new Set();

        while (pageQueue.length > 0 && pages.length < config.MAX_PAGES_PER_SPACE) {
            const currentId = pageQueue.shift();

            // 重複チェック
            if (processedIds.has(currentId)) {
                continue;
            }
            processedIds.add(currentId);

            // ページ詳細を取得
            const pageUrl = `/rest/api/content/${currentId}?expand=body.storage,version,children.page`;
            const response = await this.#fetchFromProxy(pageUrl);

            if (!response.ok) {
                console.warn(`ページ ${currentId} の取得に失敗: HTTP ${response.status}`);
                continue;
            }

            const page = await response.json();

            // コンテンツを抽出
            const htmlContent = page.body?.storage?.value || '';
            const textContent = this.#extractTextFromHtml(htmlContent);
            const truncatedContent = textContent.length > config.MAX_CONTENT_LENGTH
                ? textContent.substring(0, config.MAX_CONTENT_LENGTH)
                : textContent;

            pages.push({
                id: page.id,
                title: page.title,
                content: truncatedContent,
                url: `${this.#baseUrl}/pages/viewpage.action?pageId=${page.id}`,
                lastModified: page.version?.when || null
            });

            if (onProgress) {
                onProgress(pages.length, null, page.title);
            }

            // 子ページをキューに追加
            if (page.children?.page?.size > 0) {
                const childPages = await this.getChildPages(currentId);
                for (const child of childPages) {
                    if (!processedIds.has(child.id)) {
                        pageQueue.push(child.id);
                    }
                }
            }
        }

        console.log(`📄 ページID ${pageId} から ${pages.length} ページを取得`);
        return pages;
    }

    /**
     * 複数のページIDからコンテンツを取得
     * @param {string[]} pageIds - ページIDの配列
     * @param {function} [onProgress] - 進捗コールバック (current, total, pageTitle)
     * @returns {Promise<Array<{id: string, title: string, content: string, url: string, lastModified: string}>>}
     */
    async getPagesContent(pageIds, onProgress) {
        const config = window.CONFIG.RAG.CONFLUENCE;
        const pages = [];
        const total = pageIds.length;

        for (let i = 0; i < pageIds.length; i++) {
            const pageId = pageIds[i];
            const pageUrl = `/rest/api/content/${pageId}?expand=body.storage,version`;
            const response = await this.#fetchFromProxy(pageUrl);

            if (!response.ok) {
                console.warn(`ページ ${pageId} の取得に失敗: HTTP ${response.status}`);
                continue;
            }

            const page = await response.json();

            // コンテンツを抽出
            const htmlContent = page.body?.storage?.value || '';
            const textContent = this.#extractTextFromHtml(htmlContent);
            const truncatedContent = textContent.length > config.MAX_CONTENT_LENGTH
                ? textContent.substring(0, config.MAX_CONTENT_LENGTH)
                : textContent;

            pages.push({
                id: page.id,
                title: page.title,
                content: truncatedContent,
                url: `${this.#baseUrl}/pages/viewpage.action?pageId=${page.id}`,
                lastModified: page.version?.when || null
            });

            if (onProgress) {
                onProgress(i + 1, total, page.title);
            }
        }

        return pages;
    }

    /**
     * 設定が完了しているかチェック
     * @returns {boolean}
     */
    isConfigured() {
        return !!(this.#baseUrl && this.#authHeader);
    }

    /**
     * 現在のベースURLを取得
     * @returns {string}
     */
    getBaseUrl() {
        return this.#baseUrl;
    }

    /**
     * 現在の認証タイプを取得
     * @returns {'basic' | 'pat'}
     */
    getAuthType() {
        return this.#authType;
    }
}

// グローバルに公開
window.ConfluenceDataSource = ConfluenceDataSource;
