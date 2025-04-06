/**
 * ファイル添付関連の機能を管理するクラス
 */
class FileAttachment {
    static #instance = null;
    
    constructor() {
        if (FileAttachment.#instance) {
            return FileAttachment.#instance;
        }
        FileAttachment.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!FileAttachment.#instance) {
            FileAttachment.#instance = new FileAttachment();
        }
        return FileAttachment.#instance;
    }

    /**
     * ファイル添付ボタンと添付ファイル表示エリアを作成します
     * チャット入力エリアにファイル添付機能を追加します
     * 
     * @param {HTMLElement} chatInputContainer - チャット入力コンテナ要素
     * @param {Function} onFileAttached - ファイル添付時のコールバック関数
     * @returns {Object} 作成した要素のオブジェクト
     */
    createFileAttachmentUI(chatInputContainer, onFileAttached) {
        if (!chatInputContainer) return {};
        
        // ファイル入力要素（非表示）
        const fileInput = UIUtils.getInstance.createElement('input', {
            type: 'file',
            id: 'fileAttachment',
            accept: 'image/*',
            style: { display: 'none' },
            multiple: false
        });
        
        // ファイル添付ボタン
        const attachButton = UIUtils.getInstance.createElement('button', {
            classList: ['attachment-button'],
            innerHTML: '<i class="fas fa-paperclip"></i>',
            title: '画像を添付',
            events: {
                click: () => fileInput.click()
            }
        });
        
        // 添付ファイル表示エリア
        const attachmentPreviewArea = UIUtils.getInstance.createElement('div', {
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
    }

    /**
     * 添付ファイルのプレビューを表示します
     * 添付されたファイルのプレビューと削除ボタンを表示します
     * 
     * @param {HTMLElement} previewArea - プレビュー表示エリア
     * @param {File} file - 添付ファイル
     * @param {string} base64Data - Base64エンコードされたファイルデータ
     */
    showAttachmentPreview(previewArea, file, base64Data) {
        if (!previewArea || !file) return;
        
        previewArea.innerHTML = '';
        previewArea.style.display = 'flex';
        
        // プレビュー要素の構築
        const children = [];
        
        // 画像プレビュー（画像ファイルの場合）
        if (file.type.startsWith('image/')) {
            children.push(UIUtils.getInstance.createElement('img', {
                src: base64Data,
                alt: file.name,
                classList: ['attachment-preview-image']
            }));
        }
        
        // ファイル情報
        children.push(UIUtils.getInstance.createElement('div', {
            classList: ['attachment-file-info'],
            textContent: file.name
        }));
        
        // 削除ボタン
        children.push(UIUtils.getInstance.createElement('button', {
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
        const previewItem = UIUtils.getInstance.createElement('div', {
            classList: ['attachment-preview-item'],
            children
        });
        
        previewArea.appendChild(previewItem);
    }

    /**
     * 添付ファイルをクリアします
     * 添付ファイルのプレビュー表示を削除します
     * 
     * @param {HTMLElement} previewArea - プレビュー表示エリア
     */
    clearAttachments(previewArea) {
        if (previewArea) {
            previewArea.innerHTML = '';
            previewArea.style.display = 'none';
        }
    }

    /**
     * Azure OpenAI API用の添付ファイル形式に変換
     * @returns {Promise<Array>} API用に変換された添付ファイル配列
     */
    async getAttachmentsForAPI() {
        if (!FileHandler.getInstance.selectedFiles || FileHandler.getInstance.selectedFiles.length === 0) {
            return [];
        }
        
        try {
            const attachments = await FileConverter.getInstance.convertFilesToAttachments(FileHandler.getInstance.selectedFiles);
            // エラーがあった添付ファイルを除外
            return attachments.filter(attachment => attachment.type !== 'error');
        } catch (error) {
            console.error('API用添付ファイル変換エラー:', error);
            return [];
        }
    }

    /**
     * 会話用の添付ファイルを保存する
     * @param {string} conversationId - 会話ID
     * @param {Array<Object>} attachments - 添付ファイルの配列
     */
    saveAttachmentsForConversation(conversationId, attachments) {
        if (!conversationId || !attachments || !Array.isArray(attachments)) return;
        
        try {
            // 添付ファイルの保存前に個別のタイムスタンプを設定
            const baseTimestamp = Date.now();
            const processedAttachments = attachments.map((att, index) => ({
                ...att,
                // 各ファイルに少しずつ異なるタイムスタンプを設定
                timestamp: att.timestamp || (baseTimestamp + index)
            }));

            // 現在保存されている添付ファイルを読み込む
            const currentAttachments = this.loadAttachmentsForConversation(conversationId);
            
            // 現在の添付ファイルをコピー
            let allAttachments = currentAttachments.files ? [...currentAttachments.files] : [];
            
            // 新しい添付ファイルを追加
            processedAttachments.forEach(newAtt => {
                // 完全一致するファイルが存在するかチェック
                const isDuplicate = allAttachments.some(existing => 
                    existing.name === newAtt.name && 
                    existing.type === newAtt.type &&
                    existing.timestamp === newAtt.timestamp &&
                    (existing.data === newAtt.data || (!existing.data && !newAtt.data)) &&
                    (existing.content === newAtt.content || (!existing.content && !newAtt.content))
                );
                
                if (!isDuplicate) {
                    allAttachments.push(newAtt);
                }
            });
            
            // 添付ファイルをローカルストレージに保存
            Storage.getInstance.saveAttachments(conversationId, {
                files: allAttachments
            });
            
            // このインスタンスの savedAttachments を更新
            FileHandler.getInstance.savedAttachments = allAttachments;
            
            // タイムスタンプをリセット
            FileHandler.getInstance.attachmentTimestamp = null;
        } catch (error) {
            console.error('[ERROR] 添付ファイルの保存中にエラーが発生しました:', error);
        }
    }

    /**
     * 会話の添付ファイルを読み込む
     * @param {string} conversationId - 会話ID
     * @returns {Object} タイムスタンプと添付ファイルの配列を含むオブジェクト
     */
    loadAttachmentsForConversation(conversationId) {
        if (!conversationId) return { files: [] };
        
        try {
            // ローカルストレージから添付ファイルを読み込む
            const attachmentData = Storage.getInstance.loadAttachments(conversationId);
            
            // 添付ファイルデータをチェック
            if (!attachmentData || !attachmentData.files || !Array.isArray(attachmentData.files)) {
                return { files: [] };
            }

            // このインスタンスの savedAttachments を更新
            FileHandler.getInstance.savedAttachments = attachmentData.files;
            return attachmentData;
        } catch (error) {
            console.error('[ERROR] 添付ファイルの読み込み中にエラーが発生しました:', error);
            return { files: [] };
        }
    }

    /**
     * メッセージごとに添付ファイルを表示
     * @param {string} conversationId - 会話ID
     * @param {HTMLElement} chatMessages - チャットメッセージ表示エリア
     */
    displaySavedAttachments(conversationId, chatMessages) {
        if (!conversationId || !chatMessages) return;
        
        try {
            const attachmentData = this.loadAttachmentsForConversation(conversationId);
            
            if (!attachmentData.files || attachmentData.files.length === 0) return;

            // メッセージを取得
            const userMessages = Array.from(chatMessages.querySelectorAll('.message.user'));
            if (userMessages.length === 0) return;
            
            // メッセージをタイムスタンプでソート
            const sortedMessages = userMessages.map(msg => ({
                element: msg,
                timestamp: parseInt(msg.dataset.timestamp || '0')
            })).sort((a, b) => a.timestamp - b.timestamp);
            
            // メッセージと添付ファイルのマッピング
            const messageAttachments = {};
            
            // 添付ファイルの処理
            for (const file of attachmentData.files) {
                if (!file || !file.timestamp) continue;
                
                // バイナリ検索的アプローチでタイムスタンプが最も近いメッセージを効率的に見つける
                let bestMatchIndex = this.#findClosestMessageIndex(sortedMessages, file.timestamp);
                
                if (bestMatchIndex >= 0 && bestMatchIndex < sortedMessages.length) {
                    const messageId = sortedMessages[bestMatchIndex].element.dataset.timestamp;
                    
                    // マッピングが存在しなければ初期化
                    if (!messageAttachments[messageId]) {
                        messageAttachments[messageId] = {
                            message: sortedMessages[bestMatchIndex],
                            files: []
                        };
                    }
                    
                    // ファイルを追加
                    messageAttachments[messageId].files.push(file);
                }
            }
                        
            // 各メッセージに添付ファイルを表示
            Object.entries(messageAttachments).forEach(([messageId, { message, files }]) => {
                const messageContent = message.element.querySelector('.message-content');
                
                if (messageContent) {
                    // 既存の添付ファイル要素があれば削除
                    const existingAttachments = messageContent.querySelector('.message-attachments');
                    if (existingAttachments) {
                        messageContent.removeChild(existingAttachments);
                    }
                    
                    // 新しい添付ファイル要素を作成して追加
                    const attachmentsElement = ChatAttachmentViewer.getInstance.createAttachmentsElement(files, parseInt(messageId));
                    messageContent.appendChild(attachmentsElement);
                }
            });
            
        } catch (error) {
            console.error('[ERROR] 保存された添付ファイルの表示中にエラーが発生しました:', error);
        }
    }

    /**
     * タイムスタンプに最も近いメッセージのインデックスを効率的に検索
     * @private
     * @param {Array} messages - ソート済みのメッセージ配列
     * @param {number} timestamp - 検索するタイムスタンプ
     * @returns {number} 最も近いメッセージのインデックス
     */
    #findClosestMessageIndex(messages, timestamp) {
        if (!messages || messages.length === 0) return -1;
        
        // 配列が小さい場合は線形探索
        if (messages.length <= 10) {
            let bestIndex = 0;
            let minDiff = Math.abs(messages[0].timestamp - timestamp);
            
            for (let i = 1; i < messages.length; i++) {
                const diff = Math.abs(messages[i].timestamp - timestamp);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestIndex = i;
                }
            }
            
            return bestIndex;
        }
        
        // 大きな配列の場合はバイナリサーチに近いアプローチで効率化
        let left = 0;
        let right = messages.length - 1;
        
        // タイムスタンプが範囲外の場合
        if (timestamp <= messages[left].timestamp) return left;
        if (timestamp >= messages[right].timestamp) return right;
        
        // バイナリサーチで最も近い位置を見つける
        while (right - left > 1) {
            const mid = Math.floor((left + right) / 2);
            if (messages[mid].timestamp === timestamp) {
                return mid;
            }
            
            if (messages[mid].timestamp < timestamp) {
                left = mid;
            } else {
                right = mid;
            }
        }
        
        // 最終的に2つに絞られた場合、より近い方を選択
        const leftDiff = Math.abs(messages[left].timestamp - timestamp);
        const rightDiff = Math.abs(messages[right].timestamp - timestamp);
        
        return leftDiff <= rightDiff ? left : right;
    }
}
