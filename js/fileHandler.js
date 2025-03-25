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
            fileItem.innerHTML = `
                ${file.name}
                <span class="remove-file" data-index="${index}">
                    <i class="fas fa-times"></i>
                </span>
            `;

            // ファイル削除イベント
            fileItem.querySelector('.remove-file').addEventListener('click', () => {
                self.selectedFiles = self.selectedFiles.filter((_, i) => i !== index);
                fileItem.remove();
                if (self.selectedFiles.length === 0 && previewArea.parentNode) {
                    previewArea.remove();
                }
            });

            previewArea.appendChild(fileItem);
        });

        if (files.length > 0) {
            inputWrapper.insertBefore(previewArea, document.getElementById('userInput'));
        }
    },

    // ファイルをBase64として読み込む
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
    }
};