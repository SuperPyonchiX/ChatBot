window.UI = window.UI || {};
window.UI.Cache = window.UI.Cache || {};
/**
 * DOM要素をキャッシュするためのヘルパーオブジェクト
 * 同じ要素への参照を複数回取得する際のパフォーマンスを向上させます
 * 
 * @namespace UI.Cache
 */
Object.assign(window.UI.Cache, {
    elements: {},
    
    /**
     * 要素を取得またはキャッシュから返します
     * @param {string} selector - CSS セレクタ
     * @param {boolean} useQuerySelector - true: querySelector, false: getElementById
     * @returns {HTMLElement} 取得した要素
     */
    get: function(selector, useQuerySelector = false) {
        if (!selector) return null;
        
        // キャッシュに要素が存在するか確認
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
    },
    
    /**
     * 要素をキャッシュに追加します
     * @param {string} key - キャッシュのキー
     * @param {HTMLElement} element - キャッシュする要素
     */
    set: function(key, element) {
        if (!key || !element) return;
        this.elements[key] = element;
    },
    
    /**
     * キャッシュから要素を削除します
     * @param {string} key - 削除する要素のキー
     */
    remove: function(key) {
        if (!key) return;
        delete this.elements[key];
    },
    
    /**
     * キャッシュをクリアします
     */
    clear: function() {
        this.elements = {};
    }
});
