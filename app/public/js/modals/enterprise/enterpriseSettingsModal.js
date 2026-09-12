/** Connection editor: credentials remain in the application, never in tool arguments. */
class EnterpriseSettingsModal {
    static #instance = null;
    #element = null;
    #overlay = null;
    #escape = event => { if (event.key === 'Escape') this.hide(); };
    constructor() { if (EnterpriseSettingsModal.#instance) return EnterpriseSettingsModal.#instance; EnterpriseSettingsModal.#instance = this; }
    static get getInstance() { return EnterpriseSettingsModal.#instance || new EnterpriseSettingsModal(); }

    /** @returns {void} @throws {Error} None. */
    show() {
        if (this.#element) return;
        this.#overlay = document.createElement('div');
        this.#overlay.className = 'tool-settings-overlay visible';
        this.#overlay.addEventListener('click', () => this.hide());
        this.#element = document.createElement('div');
        this.#element.className = 'tool-settings-modal visible';
        this.#element.setAttribute('role', 'dialog');
        this.#element.setAttribute('aria-modal', 'true');
        this.#element.setAttribute('aria-label', '社内情報連携');
        this.#element.innerHTML = `<div class="tool-settings-header"><h2 class="tool-settings-title">社内情報連携</h2><button type="button" class="tool-settings-close" aria-label="閉じる">×</button></div>
            <div class="tool-settings-content"><p>取得した情報はチャットで選択したAIへ送信されます。接続先とAIの組み合わせはユーザーが管理してください。</p>
            <p>ツール呼び出し対応モデルで利用できます。URL参照または「Jira／Confluenceで○○を検索して」と依頼してください。</p>
            <div data-connections></div></div>`;
        const body = this.#element.querySelector('[data-connections]');
        for (const service of ['jira', 'confluence']) {
            const connection = EnterpriseClient.getInstance.getConnection(service);
            const form = document.createElement('form');
            form.className = 'enterprise-connection';
            form.innerHTML = `<h3>${service === 'jira' ? 'Jira' : 'Confluence'}</h3>
                <label>ベースURL<input name="baseUrl" type="url" required autocomplete="off" placeholder="https://your-server.example/context"></label>
                <label>認証方式<select name="authType"><option value="basic">ID・パスワード</option><option value="pat">Personal Access Token</option></select></label>
                <label data-basic>ID<input name="username" autocomplete="off"></label>
                <label data-basic>パスワード<input name="password" type="password" autocomplete="new-password"></label>
                <label data-pat>トークン<input name="token" type="password" autocomplete="new-password"></label>
                <p>同じ接続先の保存済み認証情報を使う場合は、認証欄を空欄にしてください。</p>
                <div class="enterprise-actions"><button type="button" data-test class="tool-settings-btn tool-settings-btn-secondary">接続テスト</button>
                <button type="submit" class="tool-settings-btn tool-settings-btn-primary">保存</button>
                <button type="button" data-clear class="tool-settings-btn tool-settings-btn-secondary">設定を削除</button></div>
                <p role="status" aria-live="polite"></p>`;
            form.elements.namedItem('baseUrl').value = connection.baseUrl;
            form.elements.namedItem('authType').value = connection.authType;
            const refresh = () => {
                const basic = form.elements.namedItem('authType').value === 'basic';
                form.querySelectorAll('[data-basic]').forEach(el => { el.hidden = !basic; });
                form.querySelector('[data-pat]').hidden = basic;
            };
            form.elements.namedItem('authType').addEventListener('change', refresh);
            refresh();
            const run = async save => {
                if (!form.reportValidity()) return;
                const status = form.querySelector('[role="status"]');
                const controls = form.querySelectorAll('button,input,select');
                try {
                    const draft = Object.fromEntries(new FormData(form).entries());
                    if (draft.authType === 'basic') draft.token = ''; else { draft.username = ''; draft.password = ''; }
                    const prepared = EnterpriseClient.getInstance.prepareConnection(service, draft);
                    controls.forEach(el => { el.disabled = true; });
                    status.textContent = '接続を確認しています…';
                    await EnterpriseClient.getInstance.request(service, 'test', {}, prepared);
                    if (save) {
                        EnterpriseClient.getInstance.saveConnection(service, prepared);
                        for (const name of ['username', 'password', 'token']) form.elements.namedItem(name).value = '';
                    }
                    status.textContent = save ? '接続成功。設定を保存しました。' : '接続成功。設定はまだ保存していません。';
                } catch (error) { status.textContent = error.message || '接続に失敗しました'; }
                finally { controls.forEach(el => { el.disabled = false; }); }
            };
            form.addEventListener('submit', event => { event.preventDefault(); void run(true); });
            form.querySelector('[data-test]').addEventListener('click', () => void run(false));
            form.querySelector('[data-clear]').addEventListener('click', () => {
                EnterpriseClient.getInstance.clearConnection(service);
                form.reset(); refresh(); form.querySelector('[role="status"]').textContent = '設定を削除しました。';
            });
            body.append(form);
        }
        this.#element.querySelector('.tool-settings-close').addEventListener('click', () => this.hide());
        document.body.append(this.#overlay, this.#element);
        document.addEventListener('keydown', this.#escape);
        this.#element.querySelector('input').focus();
    }

    /** @returns {void} @throws {Error} None. */
    hide() {
        document.removeEventListener('keydown', this.#escape);
        this.#element?.remove(); this.#overlay?.remove();
        this.#element = null; this.#overlay = null;
    }
}
window.EnterpriseSettingsModal = EnterpriseSettingsModal;
