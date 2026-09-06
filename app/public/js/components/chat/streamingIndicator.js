/**
 * streamingIndicator.js
 * AI応答の待機中インジケーターを管理します
 *
 * 表示は3状態を行き来します。
 *   waiting … 脈打つ丸だけ（何をしているか語れないとき）
 *   busy    … 丸 + シマーテキスト（ツール実行・Web検索など語れるとき）
 *   hidden  … 非表示（本文のストリーミングが始まったあと）
 *
 * インジケーターは .markdown-content の「外」に置きます。中に置くと
 * updateStreamingBotMessage の innerHTML 全置換と競合するためです。
 */
class StreamingIndicator {
    static #instance = null;

    /** 現在ストリーミング中のメッセージ要素（単一ストリーム前提） */
    #activeMessage = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {StreamingIndicator} StreamingIndicatorのシングルトンインスタンス
     */
    static get getInstance() {
        if (!StreamingIndicator.#instance) {
            StreamingIndicator.#instance = new StreamingIndicator();
        }
        return StreamingIndicator.#instance;
    }

    constructor() {
        if (StreamingIndicator.#instance) {
            return StreamingIndicator.#instance;
        }
        StreamingIndicator.#instance = this;
    }

    /**
     * メッセージにインジケーターを取り付けます
     * 同時に開始時刻を dataset へ刻みます（経過時間表示が参照します）
     * @param {HTMLElement} messageDiv - 対象のメッセージ要素
     * @param {HTMLElement} contentDiv - インジケーターを差し込む .message-content
     * @returns {HTMLElement|null} 生成したインジケーター要素
     */
    attach(messageDiv, contentDiv) {
        if (!messageDiv || !contentDiv) return null;

        const existing = this.#find(messageDiv);
        if (existing) return existing;

        const indicator = document.createElement('div');
        indicator.className = 'stream-indicator';
        indicator.dataset.state = 'waiting';
        indicator.setAttribute('role', 'status');
        indicator.setAttribute('aria-live', 'polite');

        const dot = document.createElement('span');
        dot.className = 'stream-dot';

        const label = document.createElement('span');
        label.className = 'stream-label';

        indicator.appendChild(dot);
        indicator.appendChild(label);
        contentDiv.appendChild(indicator);

        messageDiv.dataset.streamStartedAt = String(Date.now());
        this.#activeMessage = messageDiv;

        return indicator;
    }

    /**
     * 何をしているかを示すラベルを表示します
     * textContent で入れるため、渡された文字列が HTML として解釈されることはありません
     * @param {HTMLElement} messageDiv - 対象のメッセージ要素
     * @param {string} text - 表示する文言
     * @returns {void}
     */
    setLabel(messageDiv, text) {
        const indicator = this.#find(messageDiv);
        if (!indicator || !text) return;

        const label = indicator.querySelector('.stream-label');
        if (label) label.textContent = text;
        indicator.dataset.state = 'busy';
    }

    /**
     * ラベルを消して待機状態（丸だけ）に戻します
     * @param {HTMLElement} messageDiv - 対象のメッセージ要素
     * @returns {void}
     */
    clearLabel(messageDiv) {
        const indicator = this.#find(messageDiv);
        if (!indicator) return;

        const label = indicator.querySelector('.stream-label');
        if (label) label.textContent = '';
        indicator.dataset.state = 'waiting';
    }

    /**
     * 本文の最初のチャンクが届いたときにインジケーターを隠します
     * チャンクごとに呼ばれるため、2回目以降は何もせず即座に戻ります
     * @param {HTMLElement} messageDiv - 対象のメッセージ要素
     * @returns {void}
     */
    onBodyChunk(messageDiv) {
        const indicator = this.#find(messageDiv);
        if (!indicator || indicator.dataset.state === 'hidden') return;

        indicator.dataset.state = 'hidden';
    }

    /**
     * インジケーターを取り除きます
     * @param {HTMLElement} messageDiv - 対象のメッセージ要素
     * @returns {void}
     */
    finish(messageDiv) {
        const indicator = this.#find(messageDiv);
        if (indicator) indicator.remove();

        if (this.#activeMessage === messageDiv) {
            this.#activeMessage = null;
        }
    }

    /**
     * 現在ストリーミング中のメッセージにラベルを表示します
     * API 層が対象の DOM を自力で探さずに済むようにするための入口です
     * @param {string} text - 表示する文言
     * @returns {void}
     */
    setActiveLabel(text) {
        if (!this.#activeMessage) return;
        this.setLabel(this.#activeMessage, text);
    }

    /**
     * 現在ストリーミング中のメッセージのラベルを消します
     * @returns {void}
     */
    clearActiveLabel() {
        if (!this.#activeMessage) return;
        this.clearLabel(this.#activeMessage);
    }

    /**
     * 現在ストリーミング中のメッセージ要素を返します
     * @returns {HTMLElement|null} メッセージ要素。ストリーミング中でなければ null
     */
    get activeMessage() {
        return this.#activeMessage;
    }

    /**
     * メッセージ要素からインジケーターを取得します
     * @param {HTMLElement} messageDiv - 対象のメッセージ要素
     * @returns {HTMLElement|null} インジケーター要素
     */
    #find(messageDiv) {
        return messageDiv?.querySelector?.(':scope > .message-body > .message-content > .stream-indicator') ?? null;
    }
}

window.StreamingIndicator = StreamingIndicator;
