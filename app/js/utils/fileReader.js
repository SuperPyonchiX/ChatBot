/**
 * fileReader.js
 * ファイル読み込み機能を提供します
 * @class FileReaderUtil
 */
class FileReaderUtil {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {FileReaderUtil} FileReaderUtilのインスタンス
     */
    static get getInstance() {
        if (!FileReaderUtil.#instance) {
            FileReaderUtil.#instance = new FileReaderUtil();
        }
        return FileReaderUtil.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (FileReaderUtil.#instance) {
            throw new Error('FileReaderUtilクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
    }

    /**
     * ファイルをDataURL形式で読み込みます
     * @param {File} file - 読み込むファイル
     * @returns {Promise<string>} DataURL形式の文字列
     */
    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('有効なファイルが指定されていません'));
                return;
            }
            
            const reader = new FileReader();
            
            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                reader.abort();
                reject(new Error('ファイル読み込みがタイムアウトしました'));
            }, window.CONFIG.FILE.FILE_READ_TIMEOUT);
            
            reader.onload = function(e) {
                clearTimeout(timeoutId);
                resolve(e.target.result);
            };
            
            reader.onerror = function(e) {
                clearTimeout(timeoutId);
                console.error('ファイルの読み込みに失敗しました:', e);
                reject(new Error('ファイルの読み込みに失敗しました'));
            };
            
            reader.readAsDataURL(file);
        });
    }

    /**
     * ファイルをBase64形式で読み込みます
     * @param {File} file - 読み込むファイル
     * @returns {Promise<string>} Base64エンコードされた文字列
     */
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('有効なファイルが指定されていません'));
                return;
            }
            
            const reader = new FileReader();
            
            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                reader.abort();
                reject(new Error('ファイル読み込みがタイムアウトしました'));
            }, window.CONFIG.FILE.FILE_READ_TIMEOUT);
            
            reader.onload = function(e) {
                clearTimeout(timeoutId);
                try {
                    const base64 = e.target.result.split(',')[1];
                    resolve(base64);
                } catch (e) {
                    console.error('Base64エンコードに失敗しました:', e);
                    reject(new Error('Base64エンコードに失敗しました'));
                }
            };
            
            reader.onerror = function(e) {
                clearTimeout(timeoutId);
                console.error('ファイルの読み込みに失敗しました:', e);
                reject(new Error('ファイルの読み込みに失敗しました'));
            };
            
            reader.readAsDataURL(file);
        });
    }

    /**
     * ファイルをArrayBuffer形式で読み込みます
     * @param {File} file - 読み込むファイル
     * @returns {Promise<ArrayBuffer>} ArrayBuffer形式のデータ
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('有効なファイルが指定されていません'));
                return;
            }
            
            const reader = new FileReader();
            
            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                reader.abort();
                reject(new Error('ファイル読み込みがタイムアウトしました'));
            }, window.CONFIG.FILE.FILE_READ_TIMEOUT);
            
            reader.onload = function(e) {
                clearTimeout(timeoutId);
                resolve(e.target.result);
            };
            
            reader.onerror = function(e) {
                clearTimeout(timeoutId);
                console.error('ファイルの読み込みに失敗しました:', e);
                reject(new Error('ファイルの読み込みに失敗しました'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
}
