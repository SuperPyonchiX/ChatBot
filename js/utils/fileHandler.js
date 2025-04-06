/**
 * fileHandler.js
 * ファイルアップロード関連の基本機能を提供します
 */

window.FileHandler = {
    selectedFiles: [],
    savedAttachments: [],
    attachmentTimestamp: null,

    init: function() {
        this.updateAcceptedFileTypes();
    },
    
    updateAcceptedFileTypes: function() {
        try {
            const fileInput = UICache.getInstance.get('fileInput');
            if (!fileInput) return;
            
            const acceptedExtensions = this.getAllowedFileExtensions();
            if (acceptedExtensions && acceptedExtensions.length > 0) {
                fileInput.setAttribute('accept', acceptedExtensions.join(','));
            }
        } catch (error) {
            console.error('ファイル拡張子設定エラー:', error);
        }
    },

    getAllowedFileExtensions: function() {
        try {
            const extensions = [];
            const allowedTypes = window.CONFIG.FILE.ALLOWED_FILE_TYPES;
            const mimeToExtMap = window.CONFIG.FILE.MIME_TO_EXTENSION_MAP;
            
            for (const category in allowedTypes) {
                if (!Object.prototype.hasOwnProperty.call(allowedTypes, category)) continue;
                
                for (const mimeType of allowedTypes[category]) {
                    if (mimeToExtMap[mimeType]) {
                        extensions.push(...mimeToExtMap[mimeType]);
                    }
                }
            }
            
            return [...new Set(extensions)];
        } catch (error) {
            console.error('拡張子リスト生成エラー:', error);
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.txt', '.md', '.csv', '.pdf', '.js', '.html', '.css', '.json'];
        }
    },

    handleFileSelect: function(event) {
        if (!event?.target?.files) {
            console.error('不正なファイル選択イベント');
            return;
        }
        
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        // 検証はFileValidatorに委譲
        const validFiles = window.FileValidator.validateFiles(files);
        
        if (validFiles.length === 0) {
            event.target.value = '';
            return;
        }
        this.selectedFiles = [...this.selectedFiles, ...validFiles];

        // UI更新はFileAttachmentUIに委譲
        FileAttachmentUI.getInstance.updatePreview(this.selectedFiles);

        // 添付完了イベントを発火
        this.notifyAttachmentComplete(this.selectedFiles);
        
        event.target.value = '';
    },

    notifyAttachmentComplete: function(files) {
        if (!files || files.length === 0) return;
        
        this.attachmentTimestamp = Date.now();
        
        // ファイル変換はFileConverterに委譲
        FileConverter.getInstance.convertFilesToAttachments(files)
            .then(attachments => {
                document.dispatchEvent(new CustomEvent('file-attached', {
                    detail: { attachments }
                }));
            })
            .catch(error => {
                console.error('ファイル処理中にエラーが発生しました:', error);
            });
    },

    clearSelectedFiles: function() {
        this.selectedFiles = [];
        FileAttachmentUI.getInstance.clearPreview();
        this.savedAttachments = [];
        document.dispatchEvent(new CustomEvent('attachment-removed'));
    }
};