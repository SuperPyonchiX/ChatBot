/**
 * チャット名変更モーダルを管理するクラス
 * @class RenameChatModal
 */
class RenameChatModal {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {RenameChatModal} RenameChatModalのインスタンス
     */
    static get getInstance() {
        if (!RenameChatModal.#instance) {
            RenameChatModal.#instance = new RenameChatModal();
        }
        return RenameChatModal.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (RenameChatModal.#instance) {
            throw new Error('RenameChatModalクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
    }

    /**
     * チャットの名前変更モーダルを表示します
     * 会話のタイトルを変更するためのモーダルを表示します
     * 
     * @param {Object} conversation - 会話オブジェクト
     * @param {string} conversation.id - 会話ID
     * @param {string} conversation.title - 会話タイトル
     */
    showRenameChatModal(conversation) {
        const modalEl = UICache.getInstance.get('renameChatModal');
        const titleInput = UICache.getInstance.get('chatTitleInput');
        
        // 現在のタイトルをセット
        titleInput.value = conversation.title || '新しいチャット';
        
        // 会話IDをモーダルに保存
        modalEl.dataset.conversationId = conversation.id;
        
        // モーダルを表示
        UIUtils.getInstance.toggleModal('renameChatModal', true);
        
        // フォーカスを設定
        setTimeout(() => {
            titleInput.focus();
            titleInput.select();
        }, 10);
    }
    
    /**
     * チャット名変更モーダルを非表示にします
     */
    hideRenameChatModal() {
        UIUtils.getInstance.toggleModal('renameChatModal', false);
    }
}
