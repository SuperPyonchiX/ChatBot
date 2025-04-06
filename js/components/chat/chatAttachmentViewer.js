/**
 * chatAttachmentViewer.js
 * 添付ファイルの表示機能を提供します
 */
class ChatAttachmentViewer {
    /**
     * 添付ファイル表示要素を作成
     */
    static createAttachmentsElement(attachments, timestamp = null) {
        if (!attachments || !Array.isArray(attachments)) {
            return document.createElement('div');
        }
        
        const attachmentsDiv = ChatUI.instance.createElement('div', { 
            classList: 'message-attachments'
        });
        
        if (timestamp || (attachments.length > 0 && attachments[0].timestamp)) {
            const effectiveTimestamp = timestamp || attachments[0].timestamp;
            attachmentsDiv.dataset.timestamp = effectiveTimestamp;
        }
        
        attachments.forEach((attachment) => {
            if (!attachment || !attachment.type) return;
            
            if (attachment.type === 'image' && attachment.data) {
                const imgContainer = this._createImagePreview(attachment);
                attachmentsDiv.appendChild(imgContainer);
            } else if (attachment.type === 'pdf' && attachment.data) {
                const pdfContainer = this._createPdfPreview(attachment);
                attachmentsDiv.appendChild(pdfContainer);
            } else if (attachment.type === 'office' && attachment.data) {
                const officeContainer = this._createOfficePreview(attachment);
                attachmentsDiv.appendChild(officeContainer);
            } else if (attachment.type === 'file' && attachment.name) {
                const fileContainer = this._createFilePreview(attachment);
                attachmentsDiv.appendChild(fileContainer);
            }
        });
        
        if (attachmentsDiv.children.length === 0) {
            return document.createElement('div');
        }
        
        return attachmentsDiv;
    }

    /**
     * 画像プレビューを作成
     * @private
     */
    static _createImagePreview(attachment) {
        const imgContainer = ChatUI.instance.createElement('div', {
            classList: 'attachment-image-container'
        });
        
        const img = ChatUI.instance.createElement('img', {
            classList: 'attachment-image',
            attributes: {
                src: attachment.data,
                alt: attachment.name || '添付画像'
            }
        });
        
        img.addEventListener('click', () => {
            this._showFullSizeImage(attachment.data, attachment.name);
        });
        
        imgContainer.appendChild(img);
        return imgContainer;
    }

    /**
     * PDFプレビューを作成
     * @private
     */
    static _createPdfPreview(attachment) {
        const pdfContainer = ChatUI.instance.createElement('div', {
            classList: 'attachment-pdf-container'
        });
        
        const pdfPreview = ChatUI.instance.createElement('div', {
            classList: 'pdf-preview'
        });
        
        const pdfIcon = ChatUI.instance.createElement('i', {
            classList: ['fas', 'fa-file-pdf']
        });
        
        const pdfName = ChatUI.instance.createElement('span', {
            classList: 'attachment-file-name',
            textContent: attachment.name || 'PDF文書'
        });
        
        const previewButton = ChatUI.instance.createElement('button', {
            classList: 'pdf-preview-button',
            textContent: 'プレビュー'
        });
        
        previewButton.addEventListener('click', () => {
            this._showPDFPreview(attachment.data, attachment.name);
        });
        
        pdfPreview.appendChild(pdfIcon);
        pdfPreview.appendChild(pdfName);
        pdfPreview.appendChild(previewButton);
        pdfContainer.appendChild(pdfPreview);
        
        return pdfContainer;
    }

    /**
     * Officeファイルプレビューを作成
     * @private
     */
    static _createOfficePreview(attachment) {
        const officeContainer = ChatUI.instance.createElement('div', {
            classList: 'attachment-office-container'
        });
        
        const officePreview = ChatUI.instance.createElement('div', {
            classList: 'office-preview'
        });
        
        const officeIcon = ChatUI.instance.createElement('i');
        if (attachment.mimeType) {
            if (attachment.mimeType.includes('word')) {
                officeIcon.className = 'fas fa-file-word';
            } else if (attachment.mimeType.includes('excel') || attachment.mimeType.includes('sheet')) {
                officeIcon.className = 'fas fa-file-excel';
            } else if (attachment.mimeType.includes('powerpoint') || attachment.mimeType.includes('presentation')) {
                officeIcon.className = 'fas fa-file-powerpoint';
            } else {
                officeIcon.className = 'fas fa-file';
            }
        } else {
            officeIcon.className = 'fas fa-file';
        }
        
        const officeName = ChatUI.instance.createElement('span', {
            classList: 'attachment-file-name',
            textContent: attachment.name || 'Officeファイル'
        });
        
        const contentButton = ChatUI.instance.createElement('button', {
            classList: 'office-content-button',
            textContent: 'プレビュー'
        });
        
        contentButton.addEventListener('click', () => {
            this._showOfficeContent(attachment.content, attachment.name);
        });
        
        officePreview.appendChild(officeIcon);
        officePreview.appendChild(officeName);
        officePreview.appendChild(contentButton);
        officeContainer.appendChild(officePreview);
        
        return officeContainer;
    }

    /**
     * ファイルプレビューを作成
     * @private
     */
    static _createFilePreview(attachment) {
        const fileContainer = ChatUI.instance.createElement('div', {
            classList: 'attachment-file-container'
        });
        
        const fileIcon = ChatUI.instance.createElement('i', {
            classList: ['fas', 'fa-file']
        });
        
        const fileName = ChatUI.instance.createElement('span', {
            classList: 'attachment-file-name',
            textContent: attachment.name || '添付ファイル'
        });
        
        const previewButton = ChatUI.instance.createElement('button', {
            classList: 'file-preview-button',
            textContent: 'プレビュー'
        });
        
        previewButton.addEventListener('click', () => {
            this._showTextFileContent(attachment.content, attachment.name);
        });
        
        fileContainer.appendChild(fileIcon);
        fileContainer.appendChild(fileName);
        fileContainer.appendChild(previewButton);
        
        return fileContainer;
    }

    /**
     * テキストファイルの内容を表示
     * @private
     */
    static _showTextFileContent(content, name) {
        if (!content) {
            alert('ファイルの内容を表示できません。');
            return;
        }
        
        const existingOverlay = document.querySelector('.text-file-overlay');
        if (existingOverlay) {
            document.body.removeChild(existingOverlay);
            return;
        }
        
        const overlay = ChatUI.instance.createElement('div', {
            classList: 'text-file-overlay'
        });
        
        const contentViewer = ChatUI.instance.createElement('div', {
            classList: 'text-file-viewer'
        });
        
        const textContent = ChatUI.instance.createElement('pre', {
            classList: 'text-file-content',
            innerHTML: this._formatTextContent(content, name)
        });
        
        const titleBar = ChatUI.instance.createElement('div', {
            classList: 'text-file-title-bar'
        });
        
        const titleText = ChatUI.instance.createElement('span', {
            textContent: name || 'テキストファイル'
        });
        
        const closeBtn = ChatUI.instance.createElement('button', {
            classList: 'overlay-close-btn',
            innerHTML: '<i class="fas fa-times"></i>'
        });
        
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
        
        titleBar.appendChild(titleText);
        titleBar.appendChild(closeBtn);
        contentViewer.appendChild(textContent);
        overlay.appendChild(titleBar);
        overlay.appendChild(contentViewer);
        document.body.appendChild(overlay);
        
        if (typeof Prism !== 'undefined') {
            Prism.highlightElement(textContent);
        }
    }

    /**
     * テキストファイルの内容をフォーマット
     * @private
     */
    static _formatTextContent(content, fileName) {
        if (!content) return '';
        
        const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
        let langClass = '';
        
        switch (ext) {
            case 'js': langClass = 'language-javascript'; break;
            case 'json': langClass = 'language-json'; break;
            case 'html': langClass = 'language-html'; break;
            case 'css': langClass = 'language-css'; break;
            case 'md': langClass = 'language-markdown'; break;
            case 'xml': langClass = 'language-xml'; break;
            case 'yaml':
            case 'yml': langClass = 'language-yaml'; break;
            default: langClass = 'language-plaintext';
        }
        
        return `<code class="${langClass}">${this._escapeHtml(content)}</code>`;
    }

    /**
     * HTMLの特殊文字をエスケープ
     * @private
     */
    static _escapeHtml(text) {
        if (!text) return '';
        
        const escape = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        
        return text.replace(/[&<>"']/g, char => escape[char]);
    }

    /**
     * PDFプレビューを表示
     * @private
     */
    static _showPDFPreview(src, name) {
        if (!src) return;
        
        const existingOverlay = document.querySelector('.pdf-overlay');
        if (existingOverlay) {
            document.body.removeChild(existingOverlay);
            return;
        }
        
        const overlay = ChatUI.instance.createElement('div', {
            classList: 'pdf-overlay'
        });
        
        const pdfViewer = ChatUI.instance.createElement('div', {
            classList: 'pdf-viewer'
        });
        
        const pdfObject = ChatUI.instance.createElement('object', {
            attributes: {
                type: 'application/pdf',
                data: src,
                width: '100%',
                height: '100%'
            }
        });
        
        const fallback = ChatUI.instance.createElement('p', {
            innerHTML: `<a href="${src}" target="_blank">PDFを表示できません。こちらをクリックして開いてください。</a>`
        });
        
        const titleBar = ChatUI.instance.createElement('div', {
            classList: 'pdf-title-bar'
        });
        
        const titleText = ChatUI.instance.createElement('span', {
            textContent: name || 'PDF文書'
        });
        
        const closeBtn = ChatUI.instance.createElement('button', {
            classList: 'overlay-close-btn',
            innerHTML: '<i class="fas fa-times"></i>'
        });
        
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
        
        pdfObject.appendChild(fallback);
        titleBar.appendChild(titleText);
        titleBar.appendChild(closeBtn);
        pdfViewer.appendChild(pdfObject);
        overlay.appendChild(titleBar);
        overlay.appendChild(pdfViewer);
        document.body.appendChild(overlay);
    }

    /**
     * Officeファイルの内容を表示
     * @private
     */
    static _showOfficeContent(content, name) {
        if (!content) {
            alert('ファイルの内容を表示できません。');
            return;
        }
        
        const existingOverlay = document.querySelector('.office-overlay');
        if (existingOverlay) {
            document.body.removeChild(existingOverlay);
            return;
        }
        
        const overlay = ChatUI.instance.createElement('div', {
            classList: 'office-overlay'
        });
        
        const contentViewer = ChatUI.instance.createElement('div', {
            classList: 'office-content-viewer'
        });
        
        const textContent = ChatUI.instance.createElement('pre', {
            classList: 'office-text-content',
            textContent: content
        });
        
        const titleBar = ChatUI.instance.createElement('div', {
            classList: 'office-title-bar'
        });
        
        const titleText = ChatUI.instance.createElement('span', {
            textContent: name || 'ファイル内容'
        });
        
        const closeBtn = ChatUI.instance.createElement('button', {
            classList: 'overlay-close-btn',
            innerHTML: '<i class="fas fa-times"></i>'
        });
        
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
        
        titleBar.appendChild(titleText);
        titleBar.appendChild(closeBtn);
        contentViewer.appendChild(textContent);
        overlay.appendChild(titleBar);
        overlay.appendChild(contentViewer);
        document.body.appendChild(overlay);
    }

    /**
     * 画像をフルサイズで表示
     * @private
     */
    static _showFullSizeImage(src, name) {
        if (!src) return;
        
        const existingOverlay = document.querySelector('.image-overlay');
        if (existingOverlay) {
            document.body.removeChild(existingOverlay);
            return;
        }
        
        const overlay = ChatUI.instance.createElement('div', {
            classList: 'image-overlay'
        });
        
        const imageViewer = ChatUI.instance.createElement('div', {
            classList: 'image-viewer'
        });
        
        const image = ChatUI.instance.createElement('img', {
            attributes: {
                src: src,
                alt: name || '画像'
            }
        });
        
        const titleBar = ChatUI.instance.createElement('div', {
            classList: 'image-title-bar'
        });
        
        const titleText = ChatUI.instance.createElement('span', {
            textContent: name || '画像'
        });
        
        const closeBtn = ChatUI.instance.createElement('button', {
            classList: 'overlay-close-btn',
            innerHTML: '<i class="fas fa-times"></i>'
        });
        
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
        
        titleBar.appendChild(titleText);
        titleBar.appendChild(closeBtn);
        imageViewer.appendChild(image);
        overlay.appendChild(titleBar);
        overlay.appendChild(imageViewer);
        document.body.appendChild(overlay);
    }
}
