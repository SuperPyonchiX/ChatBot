/**
 * DOM要素をキャッシュするためのクラス
 * 同じ要素への参照を複数回取得する際のパフォーマンスを向上させます
 */
class UICache {
    constructor() {
        if (UICache._instance) {
            return UICache._instance;
        }
        this.elements = {};
        UICache._instance = this;
    }

    /**
     * シングルトンインスタンスを取得します
     * @returns {UICache} UICacheのインスタンス
     */
    static get getInstance() {
        if (!UICache._instance) {
            UICache._instance = new UICache();
        }
        return UICache._instance;
    }

    /**
     * 要素を取得またはキャッシュから返します
     * @param {string} selector - CSS セレクタ
     * @param {boolean} useQuerySelector - true: querySelector, false: getElementById
     * @returns {HTMLElement} 取得した要素
     */
    get(selector, useQuerySelector = false) {
        if (!selector) return null;
        
        if (!this.elements[selector]) {
            try {
                this.elements[selector] = useQuerySelector 
                    ? document.querySelector(selector)
                    : document.getElementById(selector);
            } catch (e) {
                console.warn('要素の取得に失敗しました:', e);
                return null;
            }
        }
        
        return this.elements[selector];
    }

    /**
     * 要素をキャッシュに追加します
     * @param {string} key - キャッシュのキー
     * @param {HTMLElement} element - キャッシュする要素
     */
    set(key, element) {
        if (!key || !element) return;
        this.elements[key] = element;
    }

    /**
     * キャッシュから要素を削除します
     * @param {string} key - 削除する要素のキー
     */
    remove(key) {
        if (!key) return;
        delete this.elements[key];
    }

    /**
     * キャッシュをクリアします
     */
    clear() {
        this.elements = {};
    }
}
