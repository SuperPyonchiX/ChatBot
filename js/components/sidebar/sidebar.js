/**
 * サイドバーの機能を管理するクラス
 */
class Sidebar {
    static #instance = null;
    
    constructor() {
        if (Sidebar.#instance) {
            return Sidebar.#instance;
        }
        Sidebar.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!Sidebar.#instance) {
            Sidebar.#instance = new Sidebar();
        }
        return Sidebar.#instance;
    }

    /**
     * モバイル用のサイドバートグルボタンを作成します
     * 画面サイズに応じてサイドバーの表示/非表示を切り替えるボタンを配置します
     */
    createSidebarToggle() {
        const sidebarEl = window.UI.Cache.get('.sidebar', true);
        const appContainer = window.UI.Cache.get('.app-container', true);
        
        // トグルボタンの表示エリアと、トグルボタンを作成
        const toggleArea = window.UI.Utils.createElement('div', { classList: ['sidebar-toggle-area'] });
        const toggleButton = window.UI.Utils.createElement('button', { 
            classList: ['sidebar-toggle'],
            innerHTML: '<i class="fas fa-bars"></i>'
        });
        
        // 保存された状態を復元
        const isCollapsed = Storage.getInstance.loadSidebarState();
        if (isCollapsed) {
            sidebarEl.classList.add('collapsed');
        } else {
            toggleButton.classList.add('sidebar-visible');
        }
        
        // イベントリスナーをまとめて設定
        toggleButton.addEventListener('click', () => this._toggleSidebarState(sidebarEl, toggleButton));
        
        window.UI.Cache.get('.chat-container', true).addEventListener('click', () => {
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
    }

    /**
     * サイドバーの状態をトグルします
     * @private
     */
    _toggleSidebarState(sidebar, toggleButton) {
        const isNowCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        toggleButton.classList.toggle('sidebar-visible');
        Storage.getInstance.saveSidebarState(!isNowCollapsed);
    }
}
