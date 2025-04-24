/**
 * confluenceSettingsModal.js
 * Confluence連携のための設定モーダル
 */

class ConfluenceSettingsModal {
    #modal;
    #form;
    #overlay;
    #confluenceService;
    
    constructor() {
        this.#confluenceService = ConfluenceService.getInstance;
        this.#createModal();
    }
      /**
     * モーダルを表示する
     */
    show() {
        // すでにDOMに追加されている場合は一度削除する
        this.hide();
        
        // DOMに追加
        document.body.appendChild(this.#overlay);
        document.body.appendChild(this.#modal);
        
        // モーダルを表示状態にする
        setTimeout(() => {
            this.#modal.classList.add('show');
        }, 10);
        
        // すでに設定がある場合は入力欄に値をセット
        const existingConfig = this.#getStoredConfig();
        if (existingConfig) {
            const baseUrlInput = document.getElementById('confluence-baseurl');
            const usernameInput = document.getElementById('confluence-username');
            const spaceInput = document.getElementById('confluence-space');
            
            if (baseUrlInput) baseUrlInput.value = existingConfig.baseUrl || '';
            if (usernameInput) usernameInput.value = existingConfig.username || '';
            if (spaceInput) spaceInput.value = existingConfig.space || '';
            // APIトークンはセキュリティ上の理由から再入力必須
        }
    }
    
    /**
     * モーダルを隠す
     */
    hide() {
        if (this.#modal && this.#modal.parentNode) {
            document.body.removeChild(this.#modal);
        }
        if (this.#overlay && this.#overlay.parentNode) {
            document.body.removeChild(this.#overlay);
        }
    }
    
    /**
     * モーダルを作成する
     * @private
     */
    #createModal() {
        // オーバーレイ作成
        this.#overlay = document.createElement('div');
        this.#overlay.className = 'modal-overlay';
        this.#overlay.addEventListener('click', () => this.hide());
        
        // モーダルコンテナ作成
        this.#modal = document.createElement('div');
        this.#modal.className = 'modal confluence-settings-modal';
        
        // モーダルタイトル
        const modalTitle = document.createElement('h3');
        modalTitle.textContent = 'Confluence連携設定';
        this.#modal.appendChild(modalTitle);
          // 説明文
        const description = document.createElement('p');
        description.textContent = 'Confluenceの情報を検索するための設定を入力してください。通常のユーザー名とパスワードでログインできます。';
        this.#modal.appendChild(description);
        
        // フォーム作成
        this.#form = document.createElement('form');
        this.#form.addEventListener('submit', (e) => this.#handleFormSubmit(e));
        
        // ベースURL入力
        this.#addFormField('confluence-baseurl', 'ベースURL', 'url', 'https://yourcompany.atlassian.net/wiki', true);
        
        // ユーザー名/メールアドレス入力
        this.#addFormField('confluence-username', 'メールアドレス', 'email', 'example@yourcompany.com', true);
          // パスワード入力
        this.#addFormField('confluence-password', 'パスワード', 'password', '', true);
        
        // Confluenceスペース識別子入力 (オプション)
        this.#addFormField('confluence-space', 'Confluenceスペース識別子 (オプション)', 'text', 'TEAMSPACE', false);
        
        // ボタンコンテナ
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-button-container';
        
        // キャンセルボタン
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'キャンセル';
        cancelButton.type = 'button';
        cancelButton.className = 'button secondary';
        cancelButton.addEventListener('click', () => this.hide());
        buttonContainer.appendChild(cancelButton);
        
        // 保存ボタン
        const saveButton = document.createElement('button');
        saveButton.textContent = '保存';
        saveButton.type = 'submit';
        saveButton.className = 'button primary';
        buttonContainer.appendChild(saveButton);
        
        this.#form.appendChild(buttonContainer);
        this.#modal.appendChild(this.#form);
    }
    
    /**
     * フォームフィールドを追加する
     * 
     * @param {string} id - 入力フィールドのID
     * @param {string} label - ラベルテキスト
     * @param {string} type - 入力タイプ
     * @param {string} placeholder - プレースホルダーテキスト
     * @param {boolean} required - 必須かどうか
     * @private
     */
    #addFormField(id, label, type, placeholder, required) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const labelElement = document.createElement('label');
        labelElement.setAttribute('for', id);
        labelElement.textContent = label;
        
        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.placeholder = placeholder;
        input.required = required;
        
        formGroup.appendChild(labelElement);
        formGroup.appendChild(input);
        this.#form.appendChild(formGroup);
    }
    
    /**
     * フォーム送信処理
     * 
     * @param {Event} event - フォームサブミットイベント
     * @private
     */
    #handleFormSubmit(event) {        event.preventDefault();
        
        const baseUrl = document.getElementById('confluence-baseurl').value.trim();
        const username = document.getElementById('confluence-username').value.trim();
        const password = document.getElementById('confluence-password').value.trim();
        const space = document.getElementById('confluence-space').value.trim();
        
        // Confluenceサービスに設定を適用
        const configSuccess = this.#confluenceService.configure({
            baseUrl,
            username,
            password,
            space
        });
        
        if (configSuccess) {
            // ローカルストレージに保存（APIトークン以外）
            this.#saveConfig({
                baseUrl,
                username,
                space
                // APIトークンはセキュリティ上保存しない
            });
              // 設定成功通知
            UI.getInstance.Core.Notification.show('Confluenceの設定が保存されました', 'success');
            this.hide();
        } else {
            UI.getInstance.Core.Notification.show('設定の保存に失敗しました', 'error');
        }
    }
    
    /**
     * 設定をローカルストレージに保存
     * 
     * @param {Object} config - 保存する設定オブジェクト
     * @private
     */
    #saveConfig(config) {
        localStorage.setItem('confluenceConfig', JSON.stringify(config));
    }
    
    /**
     * 設定をローカルストレージから取得
     * 
     * @returns {Object|null} - 保存されている設定またはnull
     * @private
     */
    #getStoredConfig() {
        const storedConfig = localStorage.getItem('confluenceConfig');
        return storedConfig ? JSON.parse(storedConfig) : null;
    }
}
