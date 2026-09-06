/**
 * urlFetchTool.js
 * URL内容取得ツール
 * Webページの内容を取得してテキストとして返す
 */

/**
 * @typedef {Object} UrlFetchResult
 * @property {boolean} success - 成功したかどうか
 * @property {string} url - 取得したURL
 * @property {string} [title] - ページタイトル
 * @property {string} [content] - ページ内容（テキスト）
 * @property {number} [contentLength] - コンテンツ長
 * @property {string} [error] - エラーメッセージ
 */

class UrlFetchTool {
    static #instance = null;

    /** @type {string} */
    name = 'url_fetch';

    /** @type {string} */
    description = 'URLからWebページの内容を取得します。HTMLをテキストに変換して返します。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: '取得するWebページのURL'
            },
            maxLength: {
                type: 'number',
                description: '取得する最大文字数（デフォルト: 10000）'
            }
        },
        required: ['url']
    };

    /** @type {string[]} */
    keywords = ['url', 'fetch', 'web', 'ページ', 'サイト', '取得', 'アクセス', 'http', 'https', 'ウェブ'];

    /** @type {number} */
    #defaultMaxLength = 10000;

    /** @type {number} */
    #timeout = 30000;

    /**
     * @constructor
     */
    constructor() {
        if (UrlFetchTool.#instance) {
            return UrlFetchTool.#instance;
        }
        UrlFetchTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {UrlFetchTool}
     */
    static get getInstance() {
        if (!UrlFetchTool.#instance) {
            UrlFetchTool.#instance = new UrlFetchTool();
        }
        return UrlFetchTool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params - パラメータ
     * @param {string} params.url - 取得するURL
     * @param {number} [params.maxLength] - 最大文字数
     * @returns {Promise<UrlFetchResult>}
     */
    async execute(params) {
        const { url, maxLength = this.#defaultMaxLength } = params;

        if (!url || typeof url !== 'string') {
            return {
                success: false,
                url: url || '',
                error: 'URLが指定されていません'
            };
        }

        // URL検証
        if (!this.#isValidUrl(url)) {
            return {
                success: false,
                url: url,
                error: '無効なURLです'
            };
        }

        try {
            // サーバー経由でフェッチ（CORS回避）
            const content = await this.#fetchViaProxy(url);

            // HTMLをテキストに変換
            const { title, text } = this.#parseHtml(content);

            // 長さ制限
            const truncatedText = text.length > maxLength
                ? text.substring(0, maxLength) + '... (以下省略)'
                : text;

            return {
                success: true,
                url: url,
                title: title,
                content: truncatedText,
                contentLength: text.length
            };
        } catch (error) {
            console.error('[UrlFetchTool] 取得エラー:', error);
            return {
                success: false,
                url: url,
                error: `取得エラー: ${error.message}`
            };
        }
    }

    /**
     * URL検証
     * @param {string} url
     * @returns {boolean}
     */
    #isValidUrl(url) {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    }

    /**
     * プロキシ経由でフェッチ
     * @param {string} url
     * @returns {Promise<string>}
     */
    async #fetchViaProxy(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.#timeout);

        try {
            // サーバーのプロキシエンドポイントを使用
            const proxyUrl = `/api/fetch-url?url=${encodeURIComponent(url)}`;

            const response = await fetch(proxyUrl, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            if (!response.ok) {
                // プロキシがない場合は直接フェッチを試みる
                if (response.status === 404) {
                    return await this.#fetchDirect(url, controller.signal);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.text();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * 直接フェッチ（CORSが許可されている場合）
     * @param {string} url
     * @param {AbortSignal} signal
     * @returns {Promise<string>}
     */
    async #fetchDirect(url, signal) {
        const response = await fetch(url, {
            method: 'GET',
            signal: signal,
            mode: 'cors',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
    }

    /**
     * HTMLをパースしてテキストとタイトルを抽出
     * @param {string} html
     * @returns {{title: string, text: string}}
     */
    #parseHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // タイトルを取得
        const title = doc.querySelector('title')?.textContent?.trim() || '';

        // 不要な要素を削除
        const removeSelectors = [
            'script', 'style', 'noscript', 'iframe', 'object', 'embed',
            'nav', 'footer', 'header', 'aside', '.ad', '.advertisement',
            '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
        ];

        removeSelectors.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => el.remove());
        });

        // メインコンテンツを優先的に取得
        const mainContent = doc.querySelector('main, article, [role="main"], .content, #content, .main');
        const targetElement = mainContent || doc.body;

        // テキストを抽出
        let text = this.#extractText(targetElement);

        // 連続する空白・改行を整理
        text = text
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();

        return { title, text };
    }

    /**
     * 要素からテキストを抽出
     * @param {Element} element
     * @returns {string}
     */
    #extractText(element) {
        const texts = [];

        const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                    texts.push(text);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();

                // ブロック要素の前後に改行を追加
                const blockElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                       'li', 'tr', 'br', 'hr', 'section', 'article'];
                if (blockElements.includes(tagName)) {
                    texts.push('\n');
                }

                // 子要素を再帰処理
                for (const child of node.childNodes) {
                    walk(child);
                }

                if (blockElements.includes(tagName)) {
                    texts.push('\n');
                }
            }
        };

        walk(element);
        return texts.join(' ');
    }

    /**
     * ツール定義を取得（Function Calling用）
     * @returns {Object}
     */
    getToolDefinition() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
}

// グローバルに公開
window.UrlFetchTool = UrlFetchTool;
