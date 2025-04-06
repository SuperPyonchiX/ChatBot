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
    static get getInstance() {
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
}
