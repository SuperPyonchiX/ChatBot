/** 設定の入口と詳細画面への往復を管理する。 */
class SettingsModal {
    static #instance = null;
    #initialized = false;
    /** @type {HTMLDialogElement} */
    #dialog;
    /** @type {{id: string, selector: string, hide: () => void}|null} */
    #detail = null;

    constructor() {
        if (SettingsModal.#instance) return SettingsModal.#instance;
        SettingsModal.#instance = this;
    }

    /** @returns {SettingsModal} */
    static get getInstance() {
        if (!SettingsModal.#instance) new SettingsModal();
        return SettingsModal.#instance;
    }

    /** @returns {void} @throws {Error} 必須のDOM要素がない場合。 */
    initialize() {
        if (this.#initialized) return;
        this.#initialized = true;
        this.#dialog = /** @type {HTMLDialogElement} */ (document.getElementById('settingsDialog'));
        document.getElementById('settingsButton').addEventListener('click', () => this.show());
        document.getElementById('closeSettings').addEventListener('click', () => this.#dialog.close());
        this.#dialog.addEventListener('click', event => {
            if (event.target !== this.#dialog) return;
            const bounds = this.#dialog.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right ||
                event.clientY < bounds.top || event.clientY > bounds.bottom) this.#dialog.close();
        });
        this.#dialog.addEventListener('close', () => {
            if (!this.#detail) document.getElementById('settingsButton').focus();
        });
        this.#dialog.querySelectorAll('[data-settings-tab]').forEach(button => {
            button.addEventListener('click', () => {
                this.#dialog.querySelectorAll('[data-settings-tab]').forEach(tab => {
                    if (tab === button) tab.setAttribute('aria-current', 'page');
                    else tab.removeAttribute('aria-current');
                });
                this.#dialog.querySelectorAll('[data-settings-panel]').forEach(panel => {
                    const section = /** @type {HTMLElement} */ (panel);
                    section.hidden = section.dataset.settingsPanel !== button.getAttribute('data-settings-tab');
                });
            });
        });
        const input = /** @type {HTMLTextAreaElement} */ (document.getElementById('customInstructions'));
        document.getElementById('resetCustomization').addEventListener('click', () => {
            input.value = '';
            document.getElementById('customizationStatus').textContent = '保存すると既定の回答に戻ります。';
            input.focus();
        });
        document.getElementById('cancelCustomization').addEventListener('click', () => this.#dialog.close());
        document.getElementById('saveCustomization').addEventListener('click', () => this.#save());
        /** @type {Array<[string, string, () => void, () => void]>} */
        const details = [
            ['openApiSettings', '#apiKeyModal', () => ApiSettingsModal.getInstance.showApiKeyModal(window.AppState.apiSettings), () => ApiSettingsModal.getInstance.hideApiKeyModal()],
            ['openEnterpriseSettings', '.enterprise-settings-modal', () => EnterpriseSettingsModal.getInstance.show(), () => EnterpriseSettingsModal.getInstance.hide()],
            ['openToolSettings', '.tool-settings-modal', () => ToolSettingsModal.getInstance.show(), () => ToolSettingsModal.getInstance.hide()],
            ['openWorkspace', '#workspaceModal', () => WorkspaceModal.getInstance.show(), () => WorkspaceModal.getInstance.hide()]
        ];
        details.forEach(([id, selector, show, hide]) => {
            document.getElementById(id).addEventListener('click', () => {
                this.#detail = { id, selector, hide };
                this.#dialog.close();
                show();
                requestAnimationFrame(() => this.#focusDetail());
            });
        });
        document.addEventListener('settings-detail-closed', () => {
            if (!this.#detail) return;
            const id = this.#detail.id;
            this.#detail = null;
            this.#dialog.showModal();
            document.getElementById(id).focus();
        });
        // 詳細画面は既存モーダルを使い、フォーカスとEscだけを共通化する。
        document.addEventListener('keydown', event => {
            if (this.#dialog.open && event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.#dialog.close();
                return;
            }
            if (!this.#detail) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.#detail.hide();
            } else if (event.key === 'Tab') {
                const controls = this.#detailControls();
                if (!controls.length) return;
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
                    event.preventDefault(); last.focus();
                } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
                    event.preventDefault(); first.focus();
                }
            }
        }, true);
        ['apiKeyModal', 'workspaceModal'].forEach(id => {
            document.getElementById(id).addEventListener('click', event => {
                if (this.#detail && event.target === document.getElementById(id)) this.#detail.hide();
            });
        });
    }

    /** @returns {void} @throws {Error} ダイアログを開けない場合。 */
    show() {
        const input = /** @type {HTMLTextAreaElement} */ (document.getElementById('customInstructions'));
        input.value = window.AppState.systemPrompt || '';
        document.getElementById('customizationStatus').textContent = '';
        this.#dialog.showModal();
    }

    #save() {
        const input = /** @type {HTMLTextAreaElement} */ (document.getElementById('customInstructions'));
        const value = input.value.trim();
        const status = document.getElementById('customizationStatus');
        try {
            // 指示は非機密データ。失敗を握りつぶさず、履歴の自動整理も起こさない。
            localStorage.setItem(window.CONFIG.STORAGE.KEYS.SYSTEM_PROMPT, value);
            window.AppState.systemPrompt = value;
            status.textContent = '保存しました。';
        } catch (error) {
            console.error('[SettingsModal] 回答カスタマイズ保存エラー:', error);
            status.textContent = '保存できませんでした。ブラウザの保存容量と設定を確認してください。';
        }
    }

    #detailControls() {
        if (!this.#detail) return [];
        const element = document.querySelector(this.#detail.selector);
        const controls = element ? Array.from(element.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')) : [];
        return /** @type {HTMLElement[]} */ (controls.filter(control => !control.matches(':disabled') && control.getClientRects().length));
    }

    #focusDetail() {
        this.#detailControls()[0]?.focus();
    }
}
window.SettingsModal = SettingsModal;
