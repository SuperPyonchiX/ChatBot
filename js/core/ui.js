/**
 * UI操作のための機能を提供するグローバルオブジェクト
 * メインのUI機能を管理します
 * 
 * @namespace UI
 */
window.UI = {
    /**
     * テーマの切り替えを行います
     * @param {boolean} [isDark] - 指定時：true=ダークモード、false=ライトモード
     */
    toggleTheme: function(isDark) {
        const bodyEl = document.body;
        const currentIsDark = bodyEl.classList.contains('dark-theme');
        const newIsDark = isDark !== undefined ? isDark : !currentIsDark;
        
        if (newIsDark) {
            bodyEl.classList.add('dark-theme');
            bodyEl.classList.remove('light-theme');
        } else {
            bodyEl.classList.add('light-theme');
            bodyEl.classList.remove('dark-theme');
        }
        
        try {
            localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
        } catch (e) {
            console.warn('テーマ設定の保存に失敗しました:', e);
        }
        
        return newIsDark;
    },
    
    /**
     * 保存されたテーマ設定を適用します
     */
    applyTheme: function() {
        try {
            const savedTheme = localStorage.getItem('theme');
            
            if (savedTheme) {
                this.toggleTheme(savedTheme === 'dark');
            } else {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.toggleTheme(prefersDark);
                
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    if (!localStorage.getItem('theme')) {
                        this.toggleTheme(e.matches);
                    }
                });
            }
        } catch (e) {
            console.warn('テーマ設定の適用に失敗しました:', e);
        }
    },
    
    /**
     * 通知を表示します
     * @param {string} message - 表示するメッセージ
     * @param {string} [type='info'] - 通知の種類
     * @param {number} [duration=3000] - 表示時間（ミリ秒）
     */
    notify: function(message, type = 'info', duration = 3000) {
        if (!message) return null;
        
        let notificationContainer = document.querySelector('.notification-container');
        if (!notificationContainer) {
            notificationContainer = UIUtils.createElement('div', {
                classList: ['notification-container']
            });
            document.body.appendChild(notificationContainer);
        }
        
        const icons = {
            info: '<i class="fas fa-info-circle"></i>',
            success: '<i class="fas fa-check-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            error: '<i class="fas fa-times-circle"></i>'
        };
        
        const notification = UIUtils.createElement('div', {
            classList: ['notification', `notification-${type}`],
            innerHTML: `${icons[type] || icons.info} <span>${message}</span>`
        });
        
        const closeButton = UIUtils.createElement('button', {
            classList: ['notification-close'],
            innerHTML: '<i class="fas fa-times"></i>',
            events: {
                click: () => this._removeNotification(notification)
            }
        });
        
        notification.appendChild(closeButton);
        notificationContainer.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        
        if (duration > 0) {
            setTimeout(() => this._removeNotification(notification), duration);
        }
        
        return notification;
    },
    
    /**
     * 通知を削除します
     * @private
     */
    _removeNotification: function(notification) {
        if (!notification) return;
        
        notification.classList.remove('show');
        notification.classList.add('hide');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    },
    
    /**
     * 確認ダイアログを表示します
     * @param {string} message - メッセージ
     * @param {Object} [options] - オプション
     */
    confirm: function(message, options = {}) {
        return new Promise(resolve => {
            const title = options.title || '確認';
            const confirmText = options.confirmText || 'OK';
            const cancelText = options.cancelText || 'キャンセル';
            
            const existingDialog = document.querySelector('.custom-confirm-dialog');
            if (existingDialog) {
                document.body.removeChild(existingDialog);
            }
            
            const dialog = UIUtils.createElement('div', {
                classList: ['modal', 'custom-confirm-dialog']
            });
            
            const dialogContent = UIUtils.createElement('div', {
                classList: ['modal-content']
            });
            
            const header = UIUtils.createElement('div', {
                classList: ['modal-header'],
                innerHTML: `<h2>${title}</h2>`
            });
            
            const body = UIUtils.createElement('div', {
                classList: ['modal-body'],
                innerHTML: `<p>${message}</p>`
            });
            
            const footer = UIUtils.createElement('div', {
                classList: ['modal-footer']
            });
            
            const cancelButton = UIUtils.createElement('button', {
                classList: ['modal-button', 'cancel-button'],
                textContent: cancelText,
                events: {
                    click: () => {
                        dialog.classList.remove('show');
                        setTimeout(() => {
                            document.body.removeChild(dialog);
                            resolve(false);
                        }, 300);
                    }
                }
            });
            
            const confirmButton = UIUtils.createElement('button', {
                classList: ['modal-button', 'confirm-button'],
                textContent: confirmText,
                events: {
                    click: () => {
                        dialog.classList.remove('show');
                        setTimeout(() => {
                            document.body.removeChild(dialog);
                            resolve(true);
                        }, 300);
                    }
                }
            });
            
            footer.appendChild(cancelButton);
            footer.appendChild(confirmButton);
            
            dialogContent.appendChild(header);
            dialogContent.appendChild(body);
            dialogContent.appendChild(footer);
            
            dialog.appendChild(dialogContent);
            document.body.appendChild(dialog);
            
            setTimeout(() => dialog.classList.add('show'), 10);
            confirmButton.focus();
            
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeyDown);
                    cancelButton.click();
                } else if (e.key === 'Enter') {
                    document.removeEventListener('keydown', handleKeyDown);
                    confirmButton.click();
                }
            };
            
            document.addEventListener('keydown', handleKeyDown);
        });
    },
    
    /**
     * アプリケーションの初期化処理を行います
     */
    initialize: function() {
        this.applyTheme();
        this.setupAccessibility();
        this.optimizeForTouchDevices();
        this.Sidebar.createSidebarToggle();
        this._optimizeUI();
    },
    
    /**
     * UIのパフォーマンスを最適化します
     * @private
     */
    _optimizeUI: function() {
        const resizeHandler = (() => {
            let resizeTimeout;
            return () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar && window.innerWidth > 576) {
                        sidebar.classList.remove('show');
                    }
                }, 100);
            };
        })();
        
        window.addEventListener('resize', resizeHandler, { passive: true });
        
        let scrollTicking = false;
        document.addEventListener('scroll', () => {
            if (!scrollTicking) {
                window.requestAnimationFrame(() => {
                    scrollTicking = false;
                });
                scrollTicking = true;
            }
        }, { passive: true });
        
        this._lazyLoadResources();
    },
    
    /**
     * リソースを非同期に読み込みます
     * @private
     */
    _lazyLoadResources: function() {
        setTimeout(() => {
            const fontAwesome = document.createElement('link');
            fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
            fontAwesome.rel = 'stylesheet';
            document.head.appendChild(fontAwesome);
        }, 500);
    },
    
    /**
     * アクセシビリティを向上させる機能を設定します
     */
    setupAccessibility: function() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const sendButton = document.getElementById('sendButton');
                if (sendButton) {
                    sendButton.click();
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                const newChatButton = document.getElementById('newChatButton');
                if (newChatButton) {
                    newChatButton.click();
                }
            }
        });
        
        document.querySelectorAll('.message.bot').forEach(message => {
            message.setAttribute('role', 'region');
            message.setAttribute('aria-label', 'AIからの返答');
        });
        
        document.querySelectorAll('.message.user').forEach(message => {
            message.setAttribute('role', 'region');
            message.setAttribute('aria-label', 'あなたのメッセージ');
        });
    },
    
    /**
     * タッチデバイス向けの最適化を行います
     */
    optimizeForTouchDevices: function() {
        const isTouchDevice = 'ontouchstart' in window || 
            navigator.maxTouchPoints > 0 || 
            navigator.msMaxTouchPoints > 0;
            
        if (isTouchDevice) {
            document.body.classList.add('touch-device');
            
            document.querySelectorAll('.history-item-actions button').forEach(button => {
                button.style.padding = '8px 12px';
            });
            
            this._setupSwipeGestures();
        }
    },
    
    /**
     * スワイプジェスチャーのサポートを設定します
     * @private
     */
    _setupSwipeGestures: function() {
        let startX, startY, distX, distY;
        const threshold = 100;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            distX = e.changedTouches[0].clientX - startX;
            distY = e.changedTouches[0].clientY - startY;
            
            if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > threshold) {
                const chatContainer = document.querySelector('.chat-container');
                const sidebar = document.querySelector('.sidebar');
                
                if (!chatContainer || !sidebar) return;
                
                if (e.target.closest('.chat-container')) {
                    if (distX > 0) {
                        sidebar.classList.add('show');
                    }
                } else if (e.target.closest('.sidebar')) {
                    if (distX < 0) {
                        if (window.innerWidth <= window.CONFIG.UI.MOBILE_BREAKPOINT) {
                            sidebar.classList.remove('show');
                        }
                    }
                }
            }
            
            startX = startY = null;
        }, { passive: true });
    }
};