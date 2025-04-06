window.UI = window.UI || {};
window.UI.Core = window.UI.Core || {};
window.UI.Core.Modal = window.UI.Core.Modal || {};

/**
 * チャット名変更モーダル
 */
Object.assign(window.UI.Core.Modal, {
    /**
     * チャットの名前変更モーダルを表示します
     * 会話のタイトルを変更するためのモーダルを表示します
     * 
     * @param {Object} conversation - 会話オブジェクト
     * @param {string} conversation.id - 会話ID
     * @param {string} conversation.title - 会話タイトル
     */
    showRenameChatModal: function(conversation) {
        const modalEl = UICache.getInstance.get('renameChatModal');
        const titleInput = UICache.getInstance.get('chatTitleInput');
        
        // 現在のタイトルをセット
        titleInput.value = conversation.title || '新しいチャット';
        
        // 会話IDをモーダルに保存
        modalEl.dataset.conversationId = conversation.id;
        
        // モーダルを表示
        window.UI.Utils.toggleModal('renameChatModal', true);
        
        // フォーカスを設定
        setTimeout(() => {
            titleInput.focus();
            titleInput.select();
        }, 10);
    },
    
    /**
     * チャット名変更モーダルを非表示にします
     */
    hideRenameChatModal: function() {
        window.UI.Utils.toggleModal('renameChatModal', false);
    }
});