window.UI = window.UI || {};

/**
 * チャット名変更モーダル関連の機能
 */
Object.assign(window.UI, {
    /**
     * チャットの名前変更モーダルを表示します
     * 会話のタイトルを変更するためのモーダルを表示します
     * 
     * @param {Object} conversation - 会話オブジェクト
     * @param {string} conversation.id - 会話ID
     * @param {string} conversation.title - 会話タイトル
     */
    showRenameChatModal: function(conversation) {
        const modalEl = UICache.get('renameChatModal');
        const titleInput = UICache.get('chatTitleInput');
        
        // 現在のタイトルをセット
        titleInput.value = conversation.title || '新しいチャット';
        
        // 会話IDをモーダルに保存
        modalEl.dataset.conversationId = conversation.id;
        
        // モーダルを表示
        UIUtils.toggleModal('renameChatModal', true);
        
        // フォーカスを設定
        setTimeout(() => {
            titleInput.focus();
            titleInput.select();
        }, 10);
    },

    /**
     * チャットの名前変更モーダルを非表示にします
     */
    hideRenameChatModal: function() {
        UIUtils.toggleModal('renameChatModal', false);
    }
});