/**
 * サイドバーの機能を管理するクラス
 */
class Sidebar {
    static #instance = null;
    
    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!Sidebar.#instance) {
            Sidebar.#instance = new Sidebar();
        }
        return Sidebar.#instance;
    }

    constructor() {
        if (Sidebar.#instance) {
            return Sidebar.#instance;
        }
        Sidebar.#instance = this;
    }

    /**
     * モバイル判定のブレークポイント（px）
     * @returns {number} CONFIG.UI.MOBILE_BREAKPOINT の値
     */
    get #mobileBreakpoint() {
        return window.CONFIG?.UI?.MOBILE_BREAKPOINT ?? 768;
    }

    /**
     * モバイル用のサイドバートグルボタンを作成します
     * 画面サイズに応じてサイドバーの表示/非表示を切り替えるボタンを配置します
     */
    createSidebarToggle() {
        const sidebarEl = UICache.getInstance.get('.sidebar', true);
        if (document.querySelector('.sidebar-toggle')) return;
        sidebarEl.id = 'chatSidebar';
        
        // トグルボタンの表示エリアと、トグルボタンを作成
        const toggleButton = UIUtils.getInstance.createElement('button', { 
            classList: ['sidebar-toggle'],
            innerHTML: '<i class="fas fa-bars"></i>'
        });
        
        toggleButton.setAttribute('aria-label', 'サイドバーを開閉');
        toggleButton.setAttribute('aria-controls', 'chatSidebar');

        // 保存された状態を復元
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        const isCollapsed = Storage.getInstance.loadSidebarState();
        if (isCollapsed) {
            sidebarEl.classList.add('collapsed');
        } else {
            toggleButton.classList.add('sidebar-visible');
        }
        
        const syncAccessibility = () => {
            const open = window.innerWidth <= this.#mobileBreakpoint ? sidebarEl.classList.contains('show') : !sidebarEl.classList.contains('collapsed');
            toggleButton.setAttribute('aria-expanded', String(open));
            sidebarEl.inert = !open;
        };
        new MutationObserver(syncAccessibility).observe(sidebarEl, { attributes: true, attributeFilter: ['class'] });
        window.addEventListener('resize', () => {
            sidebarEl.classList.remove('show');
            this.#toggleOverlay(false, sidebarEl);
            syncAccessibility();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && sidebarEl.classList.contains('show')) {
                sidebarEl.classList.remove('show');
                this.#toggleOverlay(false, sidebarEl);
                toggleButton.focus();
            }
        });
        syncAccessibility();
        // イベントリスナーをまとめて設定
        toggleButton.addEventListener('click', () => this.#toggleSidebarState(sidebarEl, toggleButton));
        
        UICache.getInstance.get('.chat-container', true).addEventListener('click', event => {
            if (toggleButton.contains(event.target)) return;
            if (window.innerWidth <= this.#mobileBreakpoint && sidebarEl.classList.contains('show')) {
                sidebarEl.classList.remove('show');
                this.#toggleOverlay(false, sidebarEl);
            }
        });
        
        window.addEventListener('resize', () => {
            if (window.innerWidth > this.#mobileBreakpoint) {
                sidebarEl.classList.remove('show');
                this.#toggleOverlay(false, sidebarEl);
            }
        });
        
        // 要素を追加
        document.querySelector('.chat-header').prepend(toggleButton);
    }

    /**
     * サイドバーの状態をトグルします
     * 画面幅がブレークポイント以下のときはドロワーの開閉（.show）、
     * それより広いときは折りたたみ（.collapsed）を切り替えます
     * @param {HTMLElement} sidebar - サイドバー要素
     * @param {HTMLElement} toggleButton - トグルボタン要素
     * @returns {void}
     */
    #toggleSidebarState(sidebar, toggleButton) {
        if (window.innerWidth <= this.#mobileBreakpoint) {
            const willShow = !sidebar.classList.contains('show');
            sidebar.classList.toggle('show', willShow);
            this.#toggleOverlay(willShow, sidebar);
            return;
        }

        const isNowCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        toggleButton.classList.toggle('sidebar-visible');
        // @ts-ignore - Storageはカスタムクラス（型定義あり）
        Storage.getInstance.saveSidebarState(!isNowCollapsed);
    }

    /**
     * ドロワー表示時の背面オーバーレイを切り替えます
     * @param {boolean} show - 表示するかどうか
     * @param {HTMLElement} sidebar - サイドバー要素
     * @returns {void}
     */
    #toggleOverlay(show, sidebar) {
        let overlay = document.querySelector('.sidebar-overlay');

        if (!overlay) {
            overlay = UIUtils.getInstance.createElement('div', { classList: ['sidebar-overlay'] });
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('show');
                this.#toggleOverlay(false, sidebar);
            });
            document.querySelector('.app-container').appendChild(overlay);
        }

        overlay.classList.toggle('show', show);
    }
}
