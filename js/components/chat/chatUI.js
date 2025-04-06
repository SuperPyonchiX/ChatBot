/**
 * ChatUI.js
 * チャットUIの基本機能を提供します
 */
class ChatUI {
    // シングルトンインスタンス
    static #instance = null;

    // プライベートフィールド
    #cache = {
        elements: new Map(),
        templates: new Map()
    };

    /**
     * プライベートコンストラクタ
     * @private
     */
    constructor() {
        if (ChatUI.#instance) {
            throw new Error('ChatUIクラスは直接インスタンス化できません。ChatUI.instanceを使用してください。');
        }
    }

    /**
     * シングルトンインスタンスを取得します
     * @returns {ChatUI} ChatUIのシングルトンインスタンス
     */
    static get instance() {
        if (!ChatUI.#instance) {
            ChatUI.#instance = new ChatUI();
        }
        return ChatUI.#instance;
    }

    /**
     * DOM要素を作成します
     * @param {string} tag - 作成する要素のタグ名
     * @param {Object} options - 要素のオプション
     * @param {string|string[]} [options.classList] - 追加するクラス名
     * @param {Object} [options.attributes] - 設定する属性
     * @param {string} [options.innerHTML] - 設定するHTML
     * @param {string} [options.textContent] - 設定するテキスト
     * @param {HTMLElement[]} [options.children] - 追加する子要素
     * @returns {HTMLElement} 作成されたDOM要素
     */
    createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.classList) {
            if (Array.isArray(options.classList)) {
                element.classList.add(...options.classList);
            } else {
                element.classList.add(options.classList);
            }
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                if (value !== undefined) {
                    element.setAttribute(key, value);
                }
            });
        }
        
        if (options.innerHTML !== undefined) {
            element.innerHTML = options.innerHTML;
        }
        
        if (options.textContent !== undefined) {
            element.textContent = options.textContent;
        }
        
        if (options.children && Array.isArray(options.children)) {
            options.children.forEach(child => {
                if (child) {
                    element.appendChild(child);
                }
            });
        }
        
        return element;
    }

    /**
     * キャッシュされた要素を取得または作成します
     * @param {string} key - キャッシュのキー
     * @param {Function} creator - 要素を作成する関数
     * @returns {HTMLElement} キャッシュされた要素または新しく作成された要素
     */
    getCachedElement(key, creator) {
        if (!this.#cache.elements.has(key)) {
            this.#cache.elements.set(key, creator());
        }
        return this.#cache.elements.get(key);
    }

    /**
     * テンプレートをキャッシュから取得または作成します
     * @param {string} key - キャッシュのキー
     * @param {string} template - テンプレート文字列
     * @returns {string} キャッシュされたテンプレートまたは新しいテンプレート
     */
    getCachedTemplate(key, template) {
        if (!this.#cache.templates.has(key)) {
            this.#cache.templates.set(key, template);
        }
        return this.#cache.templates.get(key);
    }

    /**
     * キャッシュをクリアします
     */
    clearCache() {
        this.#cache.elements.clear();
        this.#cache.templates.clear();
    }
}
