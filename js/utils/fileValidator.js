/**
 * fileValidator.js
 * ファイルのバリデーション機能を提供します
 * @class FileValidator
 */
class FileValidator {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {FileValidator} FileValidatorのインスタンス
     */
    static get getInstance() {
        if (!FileValidator.#instance) {
            FileValidator.#instance = new FileValidator();
        }
        return FileValidator.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (FileValidator.#instance) {
            throw new Error('FileValidatorクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
    }

    /**
     * ファイルの配列を検証します
     * @param {File[]} files - 検証するファイルの配列
     * @returns {File[]} 有効なファイルの配列
     */
    validateFiles(files) {
        if (!files || !Array.isArray(files)) return [];
        
        const validFiles = [];
        const errors = [];
                
        files.forEach(file => {
            // ファイルサイズを確認
            if (file.size > window.CONFIG.FILE.MAX_FILE_SIZE) {
                const maxSizeMB = window.CONFIG.FILE.MAX_FILE_SIZE / (1024 * 1024);
                errors.push(`"${file.name}"は大きすぎます（最大${maxSizeMB}MB）`);
                return;
            }
            
            // MIMEタイプを確認
            if (!this.#isFileTypeAllowed(file)) {
                errors.push(`"${file.name}"は対応していないファイル形式です`);
                return;
            }
            
            validFiles.push(file);
        });
        
        // エラーメッセージがある場合は表示
        if (errors.length > 0) {
            alert(`以下のファイルは添付できません:\n\n${errors.join('\n')}`);
        }
        
        return validFiles;
    }

    /**
     * ファイルの種類が許可されているかを確認します
     * @private
     * @param {File} file - 確認するファイル
     * @returns {boolean} 許可されている場合はtrue
     */
    #isFileTypeAllowed(file) {
        if (!file) return false;
        
        const fileName = file.name;
        const mimeType = file.type;
        
        // すべての許可されたMIMEタイプのリスト
        const allowedMimeTypes = Object.values(window.CONFIG.FILE.ALLOWED_FILE_TYPES).flat();
        
        // MIMEタイプの完全一致を確認
        if (allowedMimeTypes.includes(mimeType)) {
            return true;
        }

        // 拡張子でチェック
        const extension = '.' + fileName.split('.').pop().toLowerCase();
        for (const mimeExtensions of Object.values(window.CONFIG.FILE.MIME_TO_EXTENSION_MAP)) {
            if (mimeExtensions.includes(extension)) {
                return true;
            }
        }
        
        // 一般的なタイプに対して前方一致を確認
        for (const allowed of allowedMimeTypes) {
            const genericType = allowed.split('/')[0];
            if (mimeType.startsWith(`${genericType}/`)) {
                return true;
            }
        }
                
        return false;
    }
}
