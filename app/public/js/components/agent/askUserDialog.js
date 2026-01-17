/**
 * AskUserDialog - エージェントがユーザー入力を求める際のダイアログUI
 * @description エージェントの ask_user ツール用のモーダルダイアログ
 */
class AskUserDialog {
    static #instance = null;

    #dialog = null;
    #resolvePromise = null;
    #rejectPromise = null;

    constructor() {
        if (AskUserDialog.#instance) {
            return AskUserDialog.#instance;
        }
        AskUserDialog.#instance = this;
        this.#createDialog();
    }

    static get getInstance() {
        if (!AskUserDialog.#instance) {
            AskUserDialog.#instance = new AskUserDialog();
        }
        return AskUserDialog.#instance;
    }

    /**
     * ダイアログDOMを作成
     */
    #createDialog() {
        this.#dialog = document.createElement('div');
        this.#dialog.className = 'ask-user-dialog-overlay hidden';
        this.#dialog.innerHTML = `
            <div class="ask-user-dialog">
                <div class="ask-user-dialog-header">
                    <span class="ask-user-dialog-icon">🤖</span>
                    <span class="ask-user-dialog-title">エージェントからの質問</span>
                </div>
                <div class="ask-user-dialog-content">
                    <p class="ask-user-dialog-question"></p>
                    <div class="ask-user-dialog-options"></div>
                    <div class="ask-user-dialog-input-container">
                        <textarea class="ask-user-dialog-input" placeholder="回答を入力してください..." rows="3"></textarea>
                    </div>
                </div>
                <div class="ask-user-dialog-actions">
                    <button class="ask-user-dialog-cancel">キャンセル</button>
                    <button class="ask-user-dialog-submit">送信</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.#dialog);
        this.#setupEventListeners();
    }

    /**
     * イベントリスナーをセットアップ
     */
    #setupEventListeners() {
        // 送信ボタン
        this.#dialog.querySelector('.ask-user-dialog-submit').addEventListener('click', () => {
            this.#submitResponse();
        });

        // キャンセルボタン
        this.#dialog.querySelector('.ask-user-dialog-cancel').addEventListener('click', () => {
            this.#cancel();
        });

        // Enterキーで送信（Shift+Enterは改行）
        this.#dialog.querySelector('.ask-user-dialog-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.#submitResponse();
            }
        });

        // オーバーレイクリックでキャンセル
        this.#dialog.addEventListener('click', (e) => {
            if (e.target === this.#dialog) {
                this.#cancel();
            }
        });

        // Escキーでキャンセル
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.#dialog.classList.contains('hidden')) {
                this.#cancel();
            }
        });
    }

    /**
     * ユーザーに質問を表示し、回答を待つ
     * @param {Object} params - パラメータ
     * @param {string} params.question - 質問テキスト
     * @param {string[]} [params.options] - 選択肢（任意）
     * @returns {Promise<string>} ユーザーの回答
     */
    async ask(params) {
        const { question, options = [] } = params;

        return new Promise((resolve, reject) => {
            this.#resolvePromise = resolve;
            this.#rejectPromise = reject;

            // 質問を表示
            this.#dialog.querySelector('.ask-user-dialog-question').textContent = question;

            // 選択肢がある場合は表示
            const optionsContainer = this.#dialog.querySelector('.ask-user-dialog-options');
            const inputContainer = this.#dialog.querySelector('.ask-user-dialog-input-container');

            optionsContainer.innerHTML = '';

            if (options && options.length > 0) {
                // 選択肢ボタンを表示
                options.forEach(option => {
                    const btn = document.createElement('button');
                    btn.className = 'ask-user-dialog-option-btn';
                    btn.textContent = option;
                    btn.addEventListener('click', () => {
                        this.#resolveAndClose(option);
                    });
                    optionsContainer.appendChild(btn);
                });
                optionsContainer.classList.remove('hidden');
                inputContainer.classList.add('hidden');
            } else {
                // テキスト入力を表示
                optionsContainer.classList.add('hidden');
                inputContainer.classList.remove('hidden');
                this.#dialog.querySelector('.ask-user-dialog-input').value = '';
            }

            // ダイアログを表示
            this.#dialog.classList.remove('hidden');

            // フォーカス
            if (options.length === 0) {
                setTimeout(() => {
                    this.#dialog.querySelector('.ask-user-dialog-input').focus();
                }, 100);
            }
        });
    }

    /**
     * 回答を送信
     */
    #submitResponse() {
        const input = this.#dialog.querySelector('.ask-user-dialog-input');
        const response = input.value.trim();

        if (response) {
            this.#resolveAndClose(response);
        }
    }

    /**
     * キャンセル
     */
    #cancel() {
        this.#dialog.classList.add('hidden');
        if (this.#rejectPromise) {
            this.#rejectPromise(new Error('ユーザーがキャンセルしました'));
            this.#rejectPromise = null;
            this.#resolvePromise = null;
        }
    }

    /**
     * 回答を返してダイアログを閉じる
     * @param {string} response - ユーザーの回答
     */
    #resolveAndClose(response) {
        this.#dialog.classList.add('hidden');
        if (this.#resolvePromise) {
            this.#resolvePromise(response);
            this.#resolvePromise = null;
            this.#rejectPromise = null;
        }
    }
}

// グローバルに公開
window.AskUserDialog = AskUserDialog;
