/**
 * DOM要素をキャッシュするためのヘルパーオブジェクト
 * 同じ要素への参照を複数回取得する際のパフォーマンスを向上させます
 * 
 * @namespace UICache
 */
window.UICache = {
    elements: {},
    
    /**
     * 要素を取得またはキャッシュから返します
     * @param {string} selector - CSS セレクタ
     * @param {boolean} useQuerySelector - true: querySelector, false: getElementById
     * @returns {HTMLElement} 取得した要素
     */
    get: (selector, useQuerySelector = false) => {
        if (!selector) return null;
        
        // キャッシュに要素が存在するか確認
        if (!UICache.elements[selector]) {
            try {
                UICache.elements[selector] = useQuerySelector 
                    ? document.querySelector(selector) 
                    : document.getElementById(selector);
                    
                // 要素が見つからない場合はnullを返す（エラー防止）
                if (!UICache.elements[selector]) {
                    console.warn(`要素が見つかりません: ${selector}`);
                    return null;
                }
            } catch (error) {
                console.error(`要素の取得エラー: ${selector}`, error);
                return null;
            }
        }
        return UICache.elements[selector];
    },
    
    /**
     * 指定されたセレクタに一致する複数の要素を取得します
     * @param {string} selector - CSS セレクタ
     * @returns {Array<HTMLElement>} 取得した要素の配列
     */
    getAll: (selector) => {
        if (!selector) return [];
        
        try {
            return Array.from(document.querySelectorAll(selector));
        } catch (error) {
            console.error(`要素の複数取得エラー: ${selector}`, error);
            return [];
        }
    },
    
    /**
     * キャッシュをクリアします
     */
    clear: () => {
        UICache.elements = {};
    }
};
