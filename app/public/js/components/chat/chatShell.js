/** 会話の空状態と入力欄の機能メニューを管理する。 */
class ChatShell {
    static #instance = null;
    #initialized = false;

    constructor() {
        if (ChatShell.#instance) return ChatShell.#instance;
        ChatShell.#instance = this;
    }

    /** @returns {ChatShell} */
    static get getInstance() {
        if (!ChatShell.#instance) new ChatShell();
        return ChatShell.#instance;
    }

    /** @returns {void} @throws {Error} 必須のDOM要素がない場合。 */
    initialize() {
        if (this.#initialized) return;
        this.#initialized = true;
        const messages = document.getElementById('chatMessages');
        const container = document.querySelector('.chat-container');
        const updateEmpty = () => {
            const empty = !messages.querySelector('.message');
            container.classList.toggle('is-empty', empty);
            document.getElementById('chatWelcome').hidden = !empty;
        };
        new MutationObserver(updateEmpty).observe(messages, { childList: true });
        updateEmpty();

        const menu = document.getElementById('composerMenu');
        const trigger = document.getElementById('composerMenuButton');
        const close = (restoreFocus = false) => {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            if (restoreFocus) trigger.focus();
        };
        trigger.addEventListener('click', () => {
            menu.hidden = !menu.hidden;
            trigger.setAttribute('aria-expanded', String(!menu.hidden));
            if (!menu.hidden) menu.querySelector('button').focus();
        });
        document.addEventListener('click', event => {
            if (!menu.contains(event.target) && !trigger.contains(event.target)) close();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); close(true); }
        });
        menu.addEventListener('focusout', event => {
            if (!menu.contains(event.relatedTarget) && event.relatedTarget !== trigger) close();
        });
        document.getElementById('attachFileButton').addEventListener('click', () => {
            close(true);
            document.getElementById('fileInput').click();
        });

        const features = document.getElementById('composerActiveFeatures');
        const toggles = ['webSearchToggle', 'codexToggle'].map(id => document.getElementById(id));
        const updateFeatures = () => {
            features.replaceChildren();
            toggles.forEach(toggle => {
                const active = toggle.classList.contains('active') && !toggle.hidden;
                toggle.setAttribute('aria-pressed', String(active));
                if (!active) return;
                const label = toggle.id === 'codexToggle' ? 'Codex' : 'Web検索';
                const chip = document.createElement('button');
                chip.className = 'feature-chip';
                chip.textContent = `${label} ×`;
                chip.setAttribute('aria-label', `${label}を解除`);
                chip.addEventListener('click', () => { toggle.click(); trigger.focus(); });
                features.appendChild(chip);
            });
        };
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => { close(true); updateFeatures(); });
            new MutationObserver(updateFeatures).observe(toggle, { attributes: true, attributeFilter: ['class', 'hidden'] });
        });
        updateFeatures();
        const send = document.getElementById('sendButton');
        const labelSend = () => send.setAttribute('aria-label', ChatUI.getInstance.isStopMode() ? '生成を停止' : '送信');
        new MutationObserver(labelSend).observe(send, { childList: true, attributes: true, attributeFilter: ['class'] });
        labelSend();
    }
}
window.ChatShell = ChatShell;
