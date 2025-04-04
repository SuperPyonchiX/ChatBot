/**
 * chatUI.js
 * チャットUIの基本機能を提供します
 */

window.ChatUI = (function() {
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
        createElement: _createElement,

        /**
         * 「Thinking...」インジケーターを作成
         * @returns {HTMLElement} 作成されたインジケーター要素
         */
        createTypingIndicator: function() {
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('message', 'bot', 'typing-indicator');
            typingIndicator.innerHTML = `
                <div class="message-content">
                    <p>Thinking<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
                </div>
            `;
            return typingIndicator;
        },

        /**
         * エラーメッセージを表示
         * @param {string} errorMessage - エラーメッセージ
         * @param {HTMLElement} chatMessages - メッセージ表示要素
         */
        showErrorMessage: function(errorMessage, chatMessages) {
            if (!chatMessages) return;
            
            const errorMessageDiv = document.createElement('div');
            errorMessageDiv.classList.add('message', 'bot', 'error');
            errorMessageDiv.innerHTML = `
                <div class="message-content">
                    <p>エラーが発生しました: ${errorMessage || '不明なエラー'}</p>
                    <button id="showApiSettings" class="error-action">API設定を確認する</button>
                </div>
            `;
            chatMessages.appendChild(errorMessageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        },

        /**
         * 安全に子要素を削除する
         * @param {HTMLElement} parent - 親要素
         * @param {HTMLElement} child - 削除する子要素
         */
        safeRemoveChild: function(parent, child) {
            if (!parent || !child) return;
            
            try {
                if (parent.contains(child)) {
                    parent.removeChild(child);
                }
            } catch (error) {
                console.error('子要素の削除中にエラーが発生しました:', error);
            }
        }
    };
})();