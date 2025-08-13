/**
 * fileAttachmentUI.js
 * ファイル添付のUI管理機能を提供します
 */

class FileAttachmentUI {
    static #instance = null;
    
    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!FileAttachmentUI.#instance) {
            FileAttachmentUI.#instance = new FileAttachmentUI();
        }
        return FileAttachmentUI.#instance;
    }

    constructor() {
        if (FileAttachmentUI.#instance) {
            return FileAttachmentUI.#instance;
        }
        FileAttachmentUI.#instance = this;
    }

    updatePreview(files) {
        const previewArea = this.#getOrCreatePreviewArea();
        if (!previewArea) {
            console.error('プレビューエリアを作成できませんでした');
            return;
        }
        
        this.#createFilePreviewItems(files, previewArea);
        previewArea.style.display = 'flex'; // プレビューエリアを表示
    }

    clearPreview() {
        const previewArea = this.#getOrCreatePreviewArea();
        if (previewArea) {
            previewArea.innerHTML = '';
            previewArea.style.display = 'none'; // プレビューエリアを非表示
        }
    }

    #getOrCreatePreviewArea() {
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
                previewArea.style.display = 'none'; // 初期状態は非表示
                inputWrapper.appendChild(previewArea);
            }
            
            return previewArea;
        } catch (error) {
            console.error('プレビューエリア作成エラー:', error);
            return null;
        }
    }

    #createFilePreviewItems(files, previewArea) {
        if (!previewArea || !files || !Array.isArray(files)) return;
        
        files.forEach((file, currentIndex) => {
            const fileIndex = FileHandler.getInstance.selectedFiles.indexOf(file);
            if (fileIndex === -1) return;
            
            // すでにプレビュー表示されているかチェック
            const existingPreview = previewArea.querySelector(`[data-file-index="${fileIndex}"]`);
            if (existingPreview) return; // すでに表示されている場合はスキップ

            const fileItem = document.createElement('div');
            fileItem.classList.add('file-preview-item');
            fileItem.dataset.fileIndex = fileIndex.toString();
            
            // ファイルタイプに応じたプレビュー内容を設定
            this.#createFilePreview(file, fileItem);
            
            // ファイル情報とクローズボタンを追加
            this.#createFileInfo(file, fileItem, previewArea, fileIndex);
            
            previewArea.appendChild(fileItem);
        });
    }

    #createFilePreview(file, fileItem) {
        if (!file || !fileItem) return;
        
        // ファイルアイコンを表示するデフォルト要素
        const fileTypeIcon = document.createElement('div');
        fileTypeIcon.classList.add('file-type-icon');
        
        try {
            // 画像ファイルの場合
            if (file.type.startsWith('image/')) {
                this.#createImagePreview(file, fileItem);
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
    }

    #createImagePreview(file, fileItem) {
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
                    ChatAttachmentViewer.getInstance.showFullSizeImage?.(e.target.result, file.name);
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
    }

    #createFileInfo(file, fileItem) {
        if (!file || !fileItem) return;
        
        const fileInfo = document.createElement('div');
        fileInfo.classList.add('file-info');
        
        fileInfo.innerHTML = `
            <span class="file-name" title="${file.name}">${this.#truncateFileName(file.name)}</span>
            <span class="file-size">${this.#formatFileSize(file.size)}</span>
            <span class="remove-file" data-index="${fileItem.dataset.fileIndex}" title="削除">
                <i class="fas fa-times"></i>
            </span>
        `;
        fileItem.appendChild(fileInfo);

        // ファイル削除イベントを登録
        const removeButton = fileInfo.querySelector('.remove-file');
        if (removeButton) {
            this.#setupRemoveButtonHandler(removeButton, fileItem);
        }
    }

    #truncateFileName(fileName, maxLength = 20) {
        if (!fileName) return '';
        
        if (fileName.length <= maxLength) {
            return fileName;
        }
        
        const extension = fileName.split('.').pop();
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 3);
        
        return `${truncatedName}...${extension}`;
    }

    #formatFileSize(sizeInBytes) {
        if (sizeInBytes < 1024) {
            return sizeInBytes + 'B';
        } else if (sizeInBytes < 1024 * 1024) {
            return Math.round(sizeInBytes / 1024) + 'KB';
        } else {
            return (sizeInBytes / (1024 * 1024)).toFixed(1) + 'MB';
        }
    }

    #setupRemoveButtonHandler(removeButton, fileItem) {
        if (!removeButton || !fileItem) return;
        
        removeButton.addEventListener('click', e => {
            try {
                e.stopPropagation();
                
                const indexToRemove = parseInt(e.currentTarget.dataset.index);
                if (isNaN(indexToRemove)) return;
                
                FileHandler.getInstance.selectedFiles = FileHandler.getInstance.selectedFiles.filter((_, i) => i !== indexToRemove);
                
                fileItem.remove();
                this.#updateFileIndices();
                
                if (FileHandler.getInstance.selectedFiles.length === 0) {
                    const previewArea = document.querySelector('.file-preview');
                    if (previewArea) {
                        previewArea.style.display = 'none'; // 要素は削除せずに非表示にする
                    }
                    document.dispatchEvent(new CustomEvent('attachment-removed'));
                    return;
                }
                
                if (FileHandler.getInstance.selectedFiles.length > 0) {
                    FileHandler.getInstance.notifyAttachmentComplete(FileHandler.getInstance.selectedFiles);
                }
            } catch (error) {
                console.error('ファイル削除処理エラー:', error);
            }
        });
    }

    #updateFileIndices() {
        const fileItems = document.querySelectorAll('.file-preview-item');
        
        fileItems.forEach((item, index) => {
            const removeButton = item.querySelector('.remove-file');
            if (removeButton) {
                removeButton.dataset.index = index.toString();
            }
            item.dataset.fileIndex = index.toString();
        });
    }
}
