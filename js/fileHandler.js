/**
 * fileHandler.js
 * ファイルアップロード関連の機能を提供します
 */

// グローバルスコープに関数を公開
window.FileHandler = {
    // 選択したファイルを保持する変数
    selectedFiles: [],

    // ファイル選択処理
    handleFileSelect: function(event) {
        const files = Array.from(event.target.files);
        this.selectedFiles = files;

        // 入力エリアにプレビューを追加
        const inputWrapper = document.querySelector('.input-wrapper');
        const existingPreview = inputWrapper.querySelector('.file-preview');
        if (existingPreview) {
            existingPreview.remove();
        }

        const previewArea = document.createElement('div');
        previewArea.classList.add('file-preview');

        const self = this;
        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.classList.add('file-preview-item');
            
            // 画像ファイルの場合はプレビュー表示
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.classList.add('image-preview');
                    fileItem.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
            
            const fileInfo = document.createElement('div');
            fileInfo.classList.add('file-info');
            fileInfo.innerHTML = `
                ${file.name}
                <span class="remove-file" data-index="${index}">
                    <i class="fas fa-times"></i>
                </span>
            `;
            fileItem.appendChild(fileInfo);

            // ファイル削除イベント
            fileItem.querySelector('.remove-file').addEventListener('click', () => {
                self.selectedFiles = self.selectedFiles.filter((_, i) => i !== index);
                fileItem.remove();
                if (self.selectedFiles.length === 0 && previewArea.parentNode) {
                    previewArea.remove();
                }
                
                // 添付ファイル削除イベントを発火
                const removeEvent = new CustomEvent('attachment-removed');
                document.dispatchEvent(removeEvent);
            });

            previewArea.appendChild(fileItem);
        });

        if (files.length > 0) {
            inputWrapper.insertBefore(previewArea, document.getElementById('userInput'));
            
            // 添付完了イベントを発火
            this.notifyAttachmentComplete(files);
        }
    },

    // 添付完了を通知する
    notifyAttachmentComplete: function(files) {
        // 画像ファイルをAzure OpenAI API用のフォーマットに変換
        const convertFilesPromises = files.map(async (file) => {
            if (file.type.startsWith('image/')) {
                const base64Data = await this.readFileAsDataURL(file);
                return {
                    type: 'image',
                    name: file.name,
                    data: base64Data
                };
            } else {
                // 非画像ファイルの場合
                const base64 = await this.readFileAsBase64(file);
                return {
                    type: 'file',
                    name: file.name,
                    mimeType: file.type,
                    data: `data:${file.type};base64,${base64}`
                };
            }
        });
        
        Promise.all(convertFilesPromises)
            .then(attachments => {
                // ファイル添付完了イベントを発火
                const attachEvent = new CustomEvent('file-attached', {
                    detail: { attachments }
                });
                document.dispatchEvent(attachEvent);
            })
            .catch(error => {
                console.error('ファイル処理中にエラーが発生しました:', error);
            });
    },

    // ファイルをDataURL (base64エンコード含む) として読み込む
    readFileAsDataURL: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // ファイルをBase64として読み込む (DataURLからbase64部分のみ抽出)
    readFileAsBase64: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // 選択されたファイルを取得
    getSelectedFiles: function() {
        return this.selectedFiles;
    },

    // 選択されたファイルをクリア
    clearSelectedFiles: function() {
        this.selectedFiles = [];
        
        // プレビューをクリア
        const previewArea = document.querySelector('.file-preview');
        if (previewArea) {
            previewArea.remove();
        }
    },
    
    // Azure OpenAI API用の添付ファイル形式に変換
    getAttachmentsForAPI: async function() {
        if (this.selectedFiles.length === 0) {
            return [];
        }
        
        return Promise.all(this.selectedFiles.map(async (file) => {
            if (file.type.startsWith('image/')) {
                const dataUrl = await this.readFileAsDataURL(file);
                return {
                    type: 'image',
                    name: file.name,
                    data: dataUrl
                };
            }
            return null;
        })).then(results => results.filter(Boolean));
    }
};