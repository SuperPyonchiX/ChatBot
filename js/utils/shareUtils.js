window.UI = window.UI || {};

/**
 * チャット会話の共有機能
 */
Object.assign(window.UI, {
    /**
     * 共有機能を実装します
     * チャット会話の内容をコピーまたは共有するための機能です
     * 
     * @param {Object} conversation - 共有する会話オブジェクト
     * @returns {Promise<boolean>} 共有操作の結果
     */
    shareConversation: async function(conversation) {
        if (!conversation || !conversation.messages) {
            this.notify('共有する会話がありません', 'error');
            return false;
        }
        
        try {
            // 会話内容をテキスト形式に変換
            let text = `# ${conversation.title || '会話'}\n\n`;
            
            conversation.messages.forEach(msg => {
                if (msg.role === 'system') return;
                
                const roleLabel = msg.role === 'user' ? '👤 ユーザー' : '🤖 AI';
                text += `## ${roleLabel}\n\n${msg.content}\n\n`;
            });
            
            // Web Share APIが利用可能な場合
            if (navigator.share) {
                await navigator.share({
                    title: conversation.title || 'AI会話',
                    text: text
                });
                this.notify('会話を共有しました', 'success');
                return true;
            }
            
            // Web Share APIが利用できない場合はクリップボードにコピー
            await navigator.clipboard.writeText(text);
            this.notify('会話をクリップボードにコピーしました', 'success');
            return true;
        } catch (error) {
            console.error('共有処理中にエラーが発生しました:', error);
            this.notify('共有できませんでした', 'error');
            return false;
        }
    }
});