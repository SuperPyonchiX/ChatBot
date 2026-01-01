/**
 * KeyboardShortcuts.js
 * キーボードショートカットを管理するクラス
 */
class KeyboardShortcuts {
    static #instance = null;

    /** @type {boolean} */
    #enabled = true;

    /** @type {Map<string, Function>} */
    #shortcuts = new Map();

    /** @type {HTMLElement|null} */
    #helpModal = null;

    constructor() {
        if (KeyboardShortcuts.#instance) {
            return KeyboardShortcuts.#instance;
        }
        KeyboardShortcuts.#instance = this;
        this.#initialize();
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!KeyboardShortcuts.#instance) {
            KeyboardShortcuts.#instance = new KeyboardShortcuts();
        }
        return KeyboardShortcuts.#instance;
    }

    /**
     * 初期化処理
     */
    #initialize() {
        // デフォルトのショートカットを登録
        this.#registerDefaultShortcuts();

        // キーボードイベントをリッスン
        document.addEventListener('keydown', (e) => this.#handleKeyDown(e));

        console.log('KeyboardShortcuts: 初期化完了');
    }

    /**
     * デフォルトのショートカットを登録
     */
    #registerDefaultShortcuts() {
        // Ctrl/Cmd + Enter: メッセージ送信
        this.register('ctrl+enter', () => {
            const sendButton = document.getElementById('sendButton');
            if (sendButton && !sendButton.disabled) {
                sendButton.click();
            }
        }, 'メッセージを送信');

        // Ctrl/Cmd + N: 新しいチャット
        this.register('ctrl+n', () => {
            const newChatButton = document.getElementById('newChatButton');
            if (newChatButton) {
                newChatButton.click();
            }
        }, '新しいチャットを作成');

        // Escape: モーダルを閉じる
        this.register('escape', () => {
            // ヘルプモーダルが開いていれば閉じる
            if (this.#helpModal && this.#helpModal.style.display !== 'none') {
                this.#closeHelpModal();
                return;
            }

            // 他のモーダルを閉じる
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(modal => {
                if (modal.style.display !== 'none') {
                    modal.style.display = 'none';
                }
            });

            // 設定メニューを閉じる
            const settingsMenu = document.getElementById('settingsMenu');
            if (settingsMenu) {
                settingsMenu.style.display = 'none';
            }
        }, 'モーダル/メニューを閉じる');

        // Ctrl/Cmd + /: ショートカット一覧を表示
        this.register('ctrl+/', () => {
            this.#showHelpModal();
        }, 'ショートカット一覧を表示');

        // Ctrl/Cmd + B: サイドバー切替
        this.register('ctrl+b', () => {
            const toggleSidebar = document.getElementById('toggleSidebar');
            if (toggleSidebar) {
                toggleSidebar.click();
            }
        }, 'サイドバーを切り替え');
    }

    /**
     * キーダウンイベントを処理
     * @param {KeyboardEvent} e
     */
    #handleKeyDown(e) {
        if (!this.#enabled) return;

        // 入力フィールドにフォーカスがある場合は一部のショートカットのみ有効
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );

        // ショートカットキーを生成
        const key = this.#getShortcutKey(e);

        // 登録されたショートカットを確認
        const shortcut = this.#shortcuts.get(key);
        if (shortcut) {
            // 入力フィールドでも動作するショートカット
            const alwaysActiveShortcuts = ['escape', 'ctrl+enter'];

            if (!isInputFocused || alwaysActiveShortcuts.includes(key)) {
                e.preventDefault();
                shortcut.callback();
            }
        }
    }

    /**
     * KeyboardEventからショートカットキー文字列を生成
     * @param {KeyboardEvent} e
     * @returns {string}
     */
    #getShortcutKey(e) {
        const parts = [];

        // Ctrl/Cmd (macOSではMetaキー)
        if (e.ctrlKey || e.metaKey) {
            parts.push('ctrl');
        }

        // Shift
        if (e.shiftKey) {
            parts.push('shift');
        }

        // Alt
        if (e.altKey) {
            parts.push('alt');
        }

        // キー名を正規化
        let keyName = e.key.toLowerCase();

        // 特殊キーの正規化
        if (keyName === ' ') keyName = 'space';
        if (keyName === 'arrowup') keyName = 'up';
        if (keyName === 'arrowdown') keyName = 'down';
        if (keyName === 'arrowleft') keyName = 'left';
        if (keyName === 'arrowright') keyName = 'right';

        // 修飾キー自体は除外
        if (!['control', 'meta', 'shift', 'alt'].includes(keyName)) {
            parts.push(keyName);
        }

        return parts.join('+');
    }

    /**
     * ショートカットを登録
     * @param {string} key - ショートカットキー（例: 'ctrl+s', 'ctrl+shift+n'）
     * @param {Function} callback - 実行する関数
     * @param {string} [description] - ショートカットの説明
     */
    register(key, callback, description = '') {
        const normalizedKey = key.toLowerCase();
        this.#shortcuts.set(normalizedKey, {
            callback,
            description
        });
    }

    /**
     * ショートカットを解除
     * @param {string} key
     */
    unregister(key) {
        this.#shortcuts.delete(key.toLowerCase());
    }

    /**
     * ショートカットを有効化
     */
    enable() {
        this.#enabled = true;
    }

    /**
     * ショートカットを無効化
     */
    disable() {
        this.#enabled = false;
    }

    /**
     * ショートカット一覧を取得
     * @returns {Array<{key: string, description: string}>}
     */
    getShortcutList() {
        const list = [];
        this.#shortcuts.forEach((value, key) => {
            if (value.description) {
                list.push({
                    key: this.#formatShortcutKey(key),
                    description: value.description
                });
            }
        });
        return list;
    }

    /**
     * ショートカットキーを表示用にフォーマット
     * @param {string} key
     * @returns {string}
     */
    #formatShortcutKey(key) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        return key
            .split('+')
            .map(part => {
                switch (part) {
                    case 'ctrl':
                        return isMac ? 'Cmd' : 'Ctrl';
                    case 'shift':
                        return 'Shift';
                    case 'alt':
                        return isMac ? 'Option' : 'Alt';
                    case 'enter':
                        return 'Enter';
                    case 'escape':
                        return 'Esc';
                    case '/':
                        return '/';
                    default:
                        return part.toUpperCase();
                }
            })
            .join(' + ');
    }

    /**
     * ヘルプモーダルを表示
     */
    #showHelpModal() {
        if (!this.#helpModal) {
            this.#createHelpModal();
        }

        // ショートカット一覧を更新
        const listContainer = this.#helpModal.querySelector('.shortcuts-list');
        if (listContainer) {
            listContainer.innerHTML = '';
            this.getShortcutList().forEach(({ key, description }) => {
                const item = document.createElement('div');
                item.className = 'shortcut-item';
                item.innerHTML = `
                    <span class="shortcut-key">${key}</span>
                    <span class="shortcut-desc">${description}</span>
                `;
                listContainer.appendChild(item);
            });
        }

        this.#helpModal.style.display = 'flex';
    }

    /**
     * ヘルプモーダルを閉じる
     */
    #closeHelpModal() {
        if (this.#helpModal) {
            this.#helpModal.style.display = 'none';
        }
    }

    /**
     * ヘルプモーダルを作成
     */
    #createHelpModal() {
        this.#helpModal = document.createElement('div');
        this.#helpModal.className = 'modal-overlay keyboard-shortcuts-modal';
        this.#helpModal.style.display = 'none';
        this.#helpModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>キーボードショートカット</h2>
                    <button class="modal-close-btn" title="閉じる">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="shortcuts-list"></div>
                </div>
            </div>
        `;

        // 閉じるボタン
        const closeBtn = this.#helpModal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.#closeHelpModal());
        }

        // オーバーレイクリックで閉じる
        this.#helpModal.addEventListener('click', (e) => {
            if (e.target === this.#helpModal) {
                this.#closeHelpModal();
            }
        });

        // スタイルを追加
        this.#addHelpModalStyles();

        document.body.appendChild(this.#helpModal);
    }

    /**
     * ヘルプモーダルのスタイルを追加
     */
    #addHelpModalStyles() {
        if (document.getElementById('keyboard-shortcuts-styles')) return;

        const style = document.createElement('style');
        style.id = 'keyboard-shortcuts-styles';
        style.textContent = `
            .keyboard-shortcuts-modal .shortcuts-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .keyboard-shortcuts-modal .shortcut-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: var(--background-tertiary);
                border-radius: var(--border-radius-md);
            }

            .keyboard-shortcuts-modal .shortcut-key {
                font-family: var(--font-family-code);
                background: var(--background-quaternary);
                padding: 4px 8px;
                border-radius: var(--border-radius-sm);
                font-size: var(--font-size-sm);
                color: var(--accent-color);
                white-space: nowrap;
            }

            .keyboard-shortcuts-modal .shortcut-desc {
                color: var(--text-secondary);
                font-size: var(--font-size-sm);
            }
        `;
        document.head.appendChild(style);
    }
}

// DOMContentLoadedでKeyboardShortcutsを初期化
document.addEventListener('DOMContentLoaded', () => {
    KeyboardShortcuts.getInstance;
});
