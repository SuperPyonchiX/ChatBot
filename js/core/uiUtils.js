window.UI = window.UI || {};
window.UI.Utils = window.UI.Utils || {};
/**
 * 共通ユーティリティ関数
 * UI操作に関する汎用メソッドを提供します
 * 
 * @namespace UI.Utils
 */
Object.assign(window.UI.Utils, {
    /**
     * 要素の表示/非表示を切り替えます
     * @param {HTMLElement} element - 対象要素
     * @param {boolean} show - 表示するかどうか
     */
    toggleVisibility: function(element, show) {
        if (!element) return;
        if (show) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    },
    
    /**
     * モーダルの表示/非表示を切り替えます
     * @param {string} modalId - モーダル要素のID
     * @param {boolean} show - 表示するかどうか
     */
    toggleModal: function(modalId, show) {
        const modal = UICache.getInstance.get(modalId);
        if (!modal) return;
        
        if (show) {
            modal.classList.add('show');
            document.addEventListener('keydown', this._escapeKeyHandler);
            document.body.style.overflow = 'hidden';
        } else {
            modal.classList.remove('show');
            document.removeEventListener('keydown', this._escapeKeyHandler);
            document.body.style.overflow = '';
        }
    },
    
    /**
     * ESCキーが押されたときのハンドラー
     * @private
     */
    _escapeKeyHandler: function(e) {
        if (e.key === 'Escape') {
            const visibleModal = document.querySelector('.modal.show');
            if (visibleModal) {
                this.toggleModal(visibleModal.id, false);
            }
        }
    },
    
    /**
     * 要素を作成して属性を設定します
     * @param {string} tag - HTML要素タグ名
     * @param {Object} props - 属性オブジェクト
     */
    createElement: (tag, props = {}) => {
        if (!tag) return null;
        
        const element = document.createElement(tag);
        
        Object.entries(props).forEach(([key, value]) => {
            if (!value) return;
            
            if (key === 'classList' && Array.isArray(value)) {
                value.forEach(cls => element.classList.add(cls));
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key === 'events' && typeof value === 'object') {
                Object.entries(value).forEach(([event, handler]) => {
                    if (typeof handler === 'function') {
                        element.addEventListener(event, handler);
                    }
                });
            } else if (key === 'children' && Array.isArray(value)) {
                value.forEach(child => {
                    if (child) element.appendChild(child);
                });
            } else if (key === 'attributes' && typeof value === 'object') {
                Object.entries(value).forEach(([attrName, attrValue]) => {
                    element.setAttribute(attrName, attrValue);
                });
            } else {
                element[key] = value;
            }
        });
        
        return element;
    },
        
    /**
     * 要素のサイズを滑らかに変更します
     * @param {HTMLElement} element - 対象要素
     * @param {number} targetHeight - 目標の高さ（px）
     * @param {number} duration - アニメーション時間（ms）
     * @returns {Promise} - アニメーション完了時に解決するPromise
     */
    animateHeight: function(element, targetHeight, duration = 300) {
        if (!element) return;
        
        const startHeight = element.clientHeight;
        const heightDiff = targetHeight - startHeight;
        const startTime = performance.now();
        
        return new Promise(resolve => {
            function updateHeight(currentTime) {
                const elapsedTime = currentTime - startTime;
                if (elapsedTime >= duration) {
                    element.style.height = `${targetHeight}px`;
                    resolve();
                    return;
                }
                
                const progress = elapsedTime / duration;
                const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
                const currentHeight = startHeight + heightDiff * easedProgress;
                element.style.height = `${currentHeight}px`;
                requestAnimationFrame(updateHeight);
            }
            
            requestAnimationFrame(updateHeight);
        });
    },

    /**
     * テキストエリアの高さを自動調整します
     * 入力内容に応じてテキストエリアの高さを動的に変更します
     * 
     * @param {HTMLTextAreaElement} textarea - 対象のテキストエリア要素
     * @returns {void}
     */
    autoResizeTextarea: (textarea) => {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }
});
