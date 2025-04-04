window.UI = window.UI || {};
window.UI.Components = window.UI.Components || {};
window.UI.Components.FileAttachment = window.UI.Components.FileAttachment || {};
/**
 * ファイル添付関連の機能
 */
Object.assign(window.UI.Components.FileAttachment, {
    /**
     * ファイル添付ボタンと添付ファイル表示エリアを作成します
     * チャット入力エリアにファイル添付機能を追加します
     * 
     * @param {HTMLElement} chatInputContainer - チャット入力コンテナ要素
     * @param {Function} onFileAttached - ファイル添付時のコールバック関数
     * @returns {Object} 作成した要素のオブジェクト
     */
    createFileAttachmentUI: function(chatInputContainer, onFileAttached) {
        if (!chatInputContainer) return {};
        
        // ファイル入力要素（非表示）
        const fileInput = window.UI.Utils.createElement('input', {
            type: 'file',
            id: 'fileAttachment',
            accept: 'image/*',
            style: { display: 'none' },
            multiple: false
        });
        
        // ファイル添付ボタン
        const attachButton = window.UI.Utils.createElement('button', {
            classList: ['attachment-button'],
            innerHTML: '<i class="fas fa-paperclip"></i>',
            title: '画像を添付',
            events: {
                click: () => fileInput.click()
            }
        });
        
        // 添付ファイル表示エリア
        const attachmentPreviewArea = window.UI.Utils.createElement('div', {
            classList: ['attachment-preview-area'],
            style: { display: 'none' }
        });
        
        // 要素を追加
        chatInputContainer.appendChild(fileInput);
        
        // 入力ボタングループに添付ボタンを追加
        const inputButtonGroup = chatInputContainer.querySelector('.input-button-group');
        if (inputButtonGroup) {
            const sendButton = inputButtonGroup.querySelector('.send-button');
            if (sendButton) {
                inputButtonGroup.insertBefore(attachButton, sendButton);
            } else {
                inputButtonGroup.appendChild(attachButton);
            }
        } else {
            chatInputContainer.appendChild(attachButton);
        }
        
        // 添付ファイル表示エリアを追加
        chatInputContainer.insertBefore(
            attachmentPreviewArea, 
            inputButtonGroup || chatInputContainer.firstChild
        );
        
        return { fileInput, attachButton, attachmentPreviewArea };
    },

    /**
     * 添付ファイルのプレビューを表示します
     * 添付されたファイルのプレビューと削除ボタンを表示します
     * 
     * @param {HTMLElement} previewArea - プレビュー表示エリア
     * @param {File} file - 添付ファイル
     * @param {string} base64Data - Base64エンコードされたファイルデータ
     */
    showAttachmentPreview: function(previewArea, file, base64Data) {
        if (!previewArea || !file) return;
        
        previewArea.innerHTML = '';
        previewArea.style.display = 'flex';
        
        // プレビュー要素の構築
        const children = [];
        
        // 画像プレビュー（画像ファイルの場合）
        if (file.type.startsWith('image/')) {
            children.push(window.UI.Utils.createElement('img', {
                src: base64Data,
                alt: file.name,
                classList: ['attachment-preview-image']
            }));
        }
        
        // ファイル情報
        children.push(window.UI.Utils.createElement('div', {
            classList: ['attachment-file-info'],
            textContent: file.name
        }));
        
        // 削除ボタン
        children.push(window.UI.Utils.createElement('button', {
            classList: ['attachment-remove-button'],
            innerHTML: '<i class="fas fa-times"></i>',
            title: '添付を削除',
            events: {
                click: () => {
                    previewArea.innerHTML = '';
                    previewArea.style.display = 'none';
                    
                    // 添付ファイル削除イベントを発火
                    previewArea.dispatchEvent(new CustomEvent('attachment-removed'));
                }
            }
        }));
        
        // プレビュー項目を追加
        const previewItem = window.UI.Utils.createElement('div', {
            classList: ['attachment-preview-item'],
            children
        });
        
        previewArea.appendChild(previewItem);
    },

    /**
     * 添付ファイルをクリアします
     * 添付ファイルのプレビュー表示を削除します
     * 
     * @param {HTMLElement} previewArea - プレビュー表示エリア
     */
    clearAttachments: function(previewArea) {
        if (previewArea) {
            previewArea.innerHTML = '';
            previewArea.style.display = 'none';
        }
    }
});