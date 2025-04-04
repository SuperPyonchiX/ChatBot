/**
 * attachmentViewer.js
 * 添付ファイルの表示機能を提供します
 */

window.Chat = window.Chat || {};
window.Chat.AttachmentViewer = {
    createAttachmentsElement: function(files, timestamp) {
        if (!files?.length) return null;

        const attachmentsDiv = document.createElement('div');
        attachmentsDiv.classList.add('message-attachments');
        attachmentsDiv.dataset.timestamp = timestamp;

        files.forEach(file => {
            const attachmentItem = this._createAttachmentItem(file);
            if (attachmentItem) {
                attachmentsDiv.appendChild(attachmentItem);
            }
        });

        return attachmentsDiv;
    },

    _createAttachmentItem: function(file) {
        if (!file) return null;

        const attachmentItem = document.createElement('div');
        attachmentItem.classList.add('attachment-item');

        // ファイルタイプに応じた表示内容を設定
        if (file.type === 'image') {
            const img = document.createElement('img');
            img.src = file.data;
            img.alt = file.name;
            img.classList.add('attachment-preview');
            img.style.maxWidth = '200px';
            img.style.maxHeight = '150px';
            img.style.cursor = 'pointer';
            
            // クリックで拡大表示
            img.addEventListener('click', () => {
                this._showFullSizeImage(file.data, file.name);
            });

            attachmentItem.appendChild(img);
        } else {
            // 各ファイルタイプに応じたアイコンを表示
            const icon = document.createElement('i');
            icon.classList.add('fas', this._getFileIcon(file.type));
            attachmentItem.appendChild(icon);
        }

        // ファイル名と情報を表示
        const fileInfo = document.createElement('div');
        fileInfo.classList.add('attachment-info');
        fileInfo.innerHTML = `
            <span class="attachment-name" title="${file.name}">${this._truncateFileName(file.name)}</span>
            <span class="attachment-size">${this._formatFileSize(file.size)}</span>
        `;
        attachmentItem.appendChild(fileInfo);

        return attachmentItem;
    },

    _showFullSizeImage: function(src, title) {
        const modal = document.createElement('div');
        modal.classList.add('image-modal');
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-title">${title || '画像プレビュー'}</span>
                    <button class="close-button">&times;</button>
                </div>
                <div class="modal-body">
                    <img src="${src}" alt="${title || '画像プレビュー'}" style="max-width: 100%; max-height: 80vh;">
                </div>
            </div>
        `;

        const closeModal = () => {
            modal.classList.add('closing');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        };

        modal.querySelector('.close-button').addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },

    _getFileIcon: function(type) {
        switch (type) {
            case 'pdf':
                return 'fa-file-pdf';
            case 'word':
                return 'fa-file-word';
            case 'excel':
                return 'fa-file-excel';
            case 'powerpoint':
                return 'fa-file-powerpoint';
            case 'text':
                return 'fa-file-alt';
            case 'code':
                return 'fa-file-code';
            default:
                return 'fa-file';
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
    }
};