window.UI = window.UI || {};
window.UI.Components = window.UI.Components || {};
window.UI.Components.Chat = window.UI.Components.Chat || {};
/**
 * ChatUI.js
 * チャットUIの基本機能を提供します
 * @namespace UI.Components.Chat
 */
Object.assign(window.UI.Components.Chat, (function() {
    // プライベート変数とキャッシングメカニズム
    const _cache = {
        elements: new Map(),
        templates: new Map()
    };

    // DOM要素を作成するヘルパー関数
    const _createElement = function(tag, options = {}) {
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
    };

    return {
        /**
         * DOM要素を作成します
         */
        createElement: _createElement,
        
        /**
         * キャッシュされた要素を取得または作成します
         */
        getCachedElement: function(key, creator) {
            if (!_cache.elements.has(key)) {
                _cache.elements.set(key, creator());
            }
            return _cache.elements.get(key);
        },
        
        /**
         * テンプレートをキャッシュから取得または作成します
         */
        getCachedTemplate: function(key, template) {
            if (!_cache.templates.has(key)) {
                _cache.templates.set(key, template);
            }
            return _cache.templates.get(key);
        },
        
        /**
         * キャッシュをクリアします
         */
        clearCache: function() {
            _cache.elements.clear();
            _cache.templates.clear();
        }
    };
})());