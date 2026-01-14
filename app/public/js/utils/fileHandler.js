/**
 * fileHandler.js
 * ファイルアップロード関連の基本機能を提供します
 * @class FileHandler
 */
class FileHandler {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {FileHandler} FileHandlerのインスタンス
     */
    static get getInstance() {
        if (!FileHandler.#instance) {
            FileHandler.#instance = new FileHandler();
        }
        return FileHandler.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (FileHandler.#instance) {
            throw new Error('FileHandlerクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
        this.selectedFiles = [];
        this.savedAttachments = [];
        this.attachmentTimestamp = null;
    }

    /**
     * 初期化処理を行います
     */
    init() {
        this.updateAcceptedFileTypes();
    }
    
    /**
     * 許可されたファイル拡張子を更新します
     */
    updateAcceptedFileTypes() {
        try {
            const fileInput = UICache.getInstance.get('fileInput');
            if (!fileInput) return;
            
            const acceptedExtensions = this.#getAllowedFileExtensions();
            if (acceptedExtensions && acceptedExtensions.length > 0) {
                fileInput.setAttribute('accept', acceptedExtensions.join(','));
            }
        } catch (error) {
            console.error('ファイル拡張子設定エラー:', error);
        }
    }

    /**
     * ファイル選択時の処理を行います
     * @param {Event} event - ファイル選択イベント
     */
    handleFileSelect(event) {
        if (!event?.target?.files) {
            console.error('不正なファイル選択イベント');
            return;
        }
        
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        // 検証はFileValidatorに委譲
        const validFiles = FileValidator.getInstance.validateFiles(files);
        
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
    }

    /**
     * 添付完了イベントを発火します
     * @param {File[]} files - 添付されたファイルの配列
     */
    notifyAttachmentComplete(files) {
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
    }

    /**
     * 選択されたファイルをクリアします
     */
    clearSelectedFiles() {
        this.selectedFiles = [];
        FileAttachmentUI.getInstance.clearPreview();
        this.savedAttachments = [];
        document.dispatchEvent(new CustomEvent('attachment-removed'));
    }

    /**
     * クリップボードからペーストされたファイルを処理します
     * @param {File[]} files - ペーストされたファイルの配列
     */
    handlePastedFiles(files) {
        if (!files || files.length === 0) return;

        // 検証はFileValidatorに委譲
        const validFiles = FileValidator.getInstance.validateFiles(files);
        if (validFiles.length === 0) return;

        // 選択済みファイルに追加
        this.selectedFiles = [...this.selectedFiles, ...validFiles];

        // UI更新はFileAttachmentUIに委譲
        FileAttachmentUI.getInstance.updatePreview(this.selectedFiles);

        // 添付完了イベントを発火
        this.notifyAttachmentComplete(this.selectedFiles);

        console.log('[FileHandler] クリップボードから画像を追加:', validFiles.length, '件');
    }

    /**
     * 許可されたファイル拡張子のリストを取得します
     * @returns {string[]} 許可された拡張子の配列
     */
    #getAllowedFileExtensions() {
        try {
            const extensions = [];
            const fileTypeMap = window.CONFIG.FILE.FILE_TYPE_MAP;
            
            for (const [, fileType] of Object.entries(fileTypeMap)) {
                if (fileType.extensions && Array.isArray(fileType.extensions)) {
                    extensions.push(...fileType.extensions);
                }
            }
            
            return [...new Set(extensions)];
        } catch (error) {
            console.error('拡張子リスト生成エラー:', error);
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.txt', '.md', '.csv', '.pdf', '.js', '.html', '.css', '.json'];
        }
    }
}
