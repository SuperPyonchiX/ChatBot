/**
 * confluenceSettingsModal.js
 * Confluence連携のための設定モーダル
 * @class ConfluenceSettingsModal
 */

class ConfluenceSettingsModal {
    // シングルトンインスタンス
    static #instance = null;
    
    // プライベートフィールド
    #modal;
    #form;
    #overlay;
    #confluenceService;
    #modalId = 'confluenceSettingsModal';
    
    /**
     * コンストラクタ - privateなので直接newはできません
     * @private
     */
    constructor() {
        if (ConfluenceSettingsModal.#instance) {
            throw new Error('ConfluenceSettingsModalクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
        
        this.#confluenceService = ConfluenceService.getInstance;
        this.#createModal();
        
        // シングルトンインスタンスとして保存
        ConfluenceSettingsModal.#instance = this;
    }
    
    /**
     * シングルトンインスタンスを取得
     * @returns {ConfluenceSettingsModal} ConfluenceSettingsModalのインスタンス
     */
    static get getInstance() {
        if (!ConfluenceSettingsModal.#instance) {
            ConfluenceSettingsModal.#instance = new ConfluenceSettingsModal();
        }
        return ConfluenceSettingsModal.#instance;
    }    /**
     * Confluence設定モーダルを表示する
     */
    show() {
        // モーダルを表示
        UIUtils.getInstance.toggleModal(this.#modalId, true);
        
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
     * Confluence設定モーダルを隠す
     */
    hide() {
        UIUtils.getInstance.toggleModal(this.#modalId, false);
    }
      /**
     * モーダルを初期化する
     * @private
     */
    #createModal() {
        // イベントリスナーを設定
        document.getElementById('saveConfluenceSettings').addEventListener('click', (e) => this.#handleFormSubmit(e));
        document.getElementById('cancelConfluenceSettings').addEventListener('click', () => this.hide());
    }
      /**
     * フォーム送信処理
     * 
     * @param {Event} event - フォームサブミットイベント
     * @private
     */
    #handleFormSubmit(event) {
        if (event) event.preventDefault();
        
        const baseUrl = document.getElementById('confluence-baseurl').value.trim();
        const username = document.getElementById('confluence-username').value.trim();
        const password = document.getElementById('confluence-password').value.trim();
        const space = document.getElementById('confluence-space').value.trim();
        
        // バリデーション
        if (!baseUrl || !username || !password) {
            UI.getInstance.Core.Notification.show('必須項目を入力してください', 'error');
            return;
        }
        
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
                // パスワードはセキュリティ上保存しない
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
