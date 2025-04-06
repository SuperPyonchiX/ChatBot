/**
 * fileAttachmentUI.js
 * ファイル添付のUI管理機能を提供します
 */

window.FileAttachmentUI = {
    updatePreview: function(files) {
        const previewArea = this._getOrCreatePreviewArea();
        if (!previewArea) {
            console.error('プレビューエリアを作成できませんでした');
            return;
        }
        
        this._createFilePreviewItems(files, previewArea);
    },

    clearPreview: function() {
        // FileHandler側のプレビュー
        const inputWrapper = document.querySelector('.input-wrapper');
        if (inputWrapper) {
            const filePreview = inputWrapper.querySelector('.file-preview');
            if (filePreview) {
                filePreview.remove();
            }
        }
        
        // UI側のプレビュー
        const attachmentPreviewArea = document.querySelector('.attachment-preview-area');
        if (attachmentPreviewArea) {
            attachmentPreviewArea.innerHTML = '';
            attachmentPreviewArea.style.display = 'none';
        }
    },

    _getOrCreatePreviewArea: function() {
        try {
            const inputWrapper = document.querySelector('.input-wrapper');
            if (!inputWrapper) {
                console.error('入力ラッパー要素が見つかりません');
                return null;
            }
            
            // 既存のプレビューエリアを検索
            let previewArea = inputWrapper.querySelector('.file-preview');
            
            // プレビューエリアがなければ新規作成
            if (!previewArea) {
                previewArea = document.createElement('div');
                previewArea.classList.add('file-preview');
                const userInput = window.UI.Cache.get('userInput');
                if (userInput) {
                    inputWrapper.insertBefore(previewArea, userInput);
                } else {
                    inputWrapper.appendChild(previewArea);
                }
            }
            
            return previewArea;
        } catch (error) {
            console.error('プレビューエリア作成エラー:', error);
            return null;
        }
    },

    _createFilePreviewItems: function(files, previewArea) {
        if (!previewArea || !files || !Array.isArray(files)) return;
        
        files.forEach((file, currentIndex) => {
            const fileIndex = window.FileHandler.selectedFiles.indexOf(file);
            if (fileIndex === -1) return;
            
            // すでにプレビュー表示されているかチェック
            const existingPreview = previewArea.querySelector(`[data-file-index="${fileIndex}"]`);
            if (existingPreview) return; // すでに表示されている場合はスキップ

            const fileItem = document.createElement('div');
            fileItem.classList.add('file-preview-item');
            fileItem.dataset.fileIndex = fileIndex.toString();
            
            // ファイルタイプに応じたプレビュー内容を設定
            this._createFilePreview(file, fileItem);
            
            // ファイル情報とクローズボタンを追加
            this._createFileInfo(file, fileItem, previewArea, fileIndex);
            
            previewArea.appendChild(fileItem);
        });
    },

    _createFilePreview: function(file, fileItem) {
        if (!file || !fileItem) return;
        
        // ファイルアイコンを表示するデフォルト要素
        const fileTypeIcon = document.createElement('div');
        fileTypeIcon.classList.add('file-type-icon');
        
        try {
            // 画像ファイルの場合
            if (file.type.startsWith('image/')) {
                this._createImagePreview(file, fileItem);
            } 
            // PDFの場合
            else if (file.type === 'application/pdf') {
                fileTypeIcon.innerHTML = '<i class="fas fa-file-pdf fa-2x"></i>';
                fileItem.appendChild(fileTypeIcon);
            }
            // Wordファイルの場合
            else if (file.type.includes('word') || file.type.includes('msword')) {
                fileTypeIcon.innerHTML = '<i class="fas fa-file-word fa-2x"></i>';
                fileItem.appendChild(fileTypeIcon);
            }
            // Excelファイルの場合
            else if (file.type.includes('excel') || file.type.includes('sheet')) {
                fileTypeIcon.innerHTML = '<i class="fas fa-file-excel fa-2x"></i>';
                fileItem.appendChild(fileTypeIcon);
            }
            // PowerPointファイルの場合
            else if (file.type.includes('powerpoint') || file.type.includes('presentation')) {
                fileTypeIcon.innerHTML = '<i class="fas fa-file-powerpoint fa-2x"></i>';
                fileItem.appendChild(fileTypeIcon);
            }
            // テキストファイルの場合
            else if (file.type.startsWith('text/')) {
                fileTypeIcon.innerHTML = '<i class="fas fa-file-alt fa-2x"></i>';
                fileItem.appendChild(fileTypeIcon);
            }
            // コードファイルの場合
            else if (file.type.includes('javascript') || file.type.includes('json') || 
                    file.type.includes('html') || file.type.includes('css')) {
                fileTypeIcon.innerHTML = '<i class="fas fa-file-code fa-2x"></i>';
                fileItem.appendChild(fileTypeIcon);
            }
            // その他のファイルの場合
            else {
                fileTypeIcon.innerHTML = '<i class="fas fa-file fa-2x"></i>';
                fileItem.appendChild(fileTypeIcon);
            }
        } catch (error) {
            console.error('ファイルプレビュー作成エラー:', error);
            fileTypeIcon.innerHTML = '<i class="fas fa-file fa-2x"></i>';
            fileItem.appendChild(fileTypeIcon);
        }
    },

    _createImagePreview: function(file, fileItem) {
        if (!file || !fileItem) return;
        
        const reader = new FileReader();
        
        // 読み込み中の表示
        const loadingIndicator = document.createElement('div');
        loadingIndicator.classList.add('loading-indicator');
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        fileItem.appendChild(loadingIndicator);
        
        reader.onload = function(e) {
            try {
                if (loadingIndicator) {
                    fileItem.removeChild(loadingIndicator);
                }
                
                const img = document.createElement('img');
                img.src = e.target.result;
                img.classList.add('image-preview');
                img.style.maxWidth = '150px';
                img.style.maxHeight = '100px';
                img.style.objectFit = 'contain';
                
                // 画像クリックで拡大表示
                img.addEventListener('click', () => {
                    ChatAttachmentViewer._showFullSizeImage?.(e.target.result, file.name);
                });

                fileItem.appendChild(img);
            } catch (error) {
                console.error('画像プレビュー表示エラー:', error);
                
                const errorIcon = document.createElement('div');
                errorIcon.classList.add('file-type-icon');
                errorIcon.innerHTML = '<i class="fas fa-image fa-2x"></i>';
                fileItem.appendChild(errorIcon);
            }
        };
        
        reader.onerror = function(error) {
            console.error('画像プレビューの作成に失敗しました:', error);
            
            if (loadingIndicator) {
                fileItem.removeChild(loadingIndicator);
            }
            
            const errorIcon = document.createElement('div');
            errorIcon.classList.add('file-type-icon');
            errorIcon.innerHTML = '<i class="fas fa-exclamation-triangle fa-2x"></i>';
            fileItem.appendChild(errorIcon);
        };
        
        reader.readAsDataURL(file);
    },

    _createFileInfo: function(file, fileItem) {
        if (!file || !fileItem) return;
        
        const fileInfo = document.createElement('div');
        fileInfo.classList.add('file-info');
        
        fileInfo.innerHTML = `
            <span class="file-name" title="${file.name}">${this._truncateFileName(file.name)}</span>
            <span class="file-size">${this._formatFileSize(file.size)}</span>
            <span class="remove-file" data-index="${fileItem.dataset.fileIndex}" title="削除">
                <i class="fas fa-times"></i>
            </span>
        `;
        fileItem.appendChild(fileInfo);

        // ファイル削除イベントを登録
        const removeButton = fileInfo.querySelector('.remove-file');
        if (removeButton) {
            this._setupRemoveButtonHandler(removeButton, fileItem);
        }
    },

    _truncateFileName: function(fileName, maxLength = 20) {
        if (!fileName) return '';
        
        if (fileName.length <= maxLength) {
            return fileName;
        }
        
        const extension = fileName.split('.').pop();
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 3);
        
        return `${truncatedName}...${extension}`;
    },

    _formatFileSize: function(sizeInBytes) {
        if (sizeInBytes < 1024) {
            return sizeInBytes + 'B';
        } else if (sizeInBytes < 1024 * 1024) {
            return Math.round(sizeInBytes / 1024) + 'KB';
        } else {
            return (sizeInBytes / (1024 * 1024)).toFixed(1) + 'MB';
        }
    },

    _setupRemoveButtonHandler: function(removeButton, fileItem) {
        if (!removeButton || !fileItem) return;
        
        removeButton.addEventListener('click', e => {
            try {
                e.stopPropagation();
                
                const indexToRemove = parseInt(e.currentTarget.dataset.index);
                if (isNaN(indexToRemove)) return;
                
                window.FileHandler.selectedFiles = window.FileHandler.selectedFiles.filter((_, i) => i !== indexToRemove);
                
                fileItem.remove();
                this._updateFileIndices();
                
                if (window.FileHandler.selectedFiles.length === 0) {
                    const previewArea = document.querySelector('.file-preview');
                    if (previewArea?.parentNode) {
                        previewArea.remove();
                    }
                    document.dispatchEvent(new CustomEvent('attachment-removed'));
                    return;
                }
                
                if (window.FileHandler.selectedFiles.length > 0) {
                    window.FileHandler.notifyAttachmentComplete(window.FileHandler.selectedFiles);
                }
            } catch (error) {
                console.error('ファイル削除処理エラー:', error);
            }
        });
    },

    _updateFileIndices: function() {
        const fileItems = document.querySelectorAll('.file-preview-item');
        
        fileItems.forEach((item, index) => {
            const removeButton = item.querySelector('.remove-file');
            if (removeButton) {
                removeButton.dataset.index = index.toString();
            }
            item.dataset.fileIndex = index.toString();
        });
    }
};