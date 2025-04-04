window.UI = window.UI || {};
window.UI.Sidebar = window.UI.Sidebar || {};


/**
 * サイドバー関連の機能
 */
Object.assign(window.UI.Sidebar, {
    /**
     * モバイル用のサイドバートグルボタンを作成します
     * 画面サイズに応じてサイドバーの表示/非表示を切り替えるボタンを配置します
     */
    createSidebarToggle: function() {
        const sidebarEl = UICache.get('.sidebar', true);
        const appContainer = UICache.get('.app-container', true);
        
        // トグルボタンの表示エリアと、トグルボタンを作成
        const toggleArea = UIUtils.createElement('div', { classList: ['sidebar-toggle-area'] });
        const toggleButton = UIUtils.createElement('button', { 
            classList: ['sidebar-toggle'],
            innerHTML: '<i class="fas fa-bars"></i>'
        });

        // 保存された状態を復元
        const isCollapsed = window.Storage.loadSidebarState();
        if (isCollapsed) {
            sidebarEl.classList.add('collapsed');
        } else {
            toggleButton.classList.add('sidebar-visible');
        }
        
        // イベントリスナーをまとめて設定
        toggleButton.addEventListener('click', () => this._toggleSidebarState(sidebarEl, toggleButton));
        
        UICache.get('.chat-container', true).addEventListener('click', () => {
            if (window.innerWidth <= 576 && sidebarEl.classList.contains('show')) {
                sidebarEl.classList.remove('show');
            }
        });
        
        window.addEventListener('resize', () => {
            if (window.innerWidth > 576) {
                sidebarEl.classList.remove('show');
            }
        });
        
        // 要素を追加
        toggleArea.appendChild(toggleButton);
        appContainer.appendChild(toggleArea);
    },

    /**
     * サイドバーの状態をトグルします
     * @private
     */
    _toggleSidebarState: function(sidebar, toggleButton) {
        const isNowCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        toggleButton.classList.toggle('sidebar-visible');
        window.Storage.saveSidebarState(!isNowCollapsed);
    }
});