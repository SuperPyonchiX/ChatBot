/**
 * fileReader.js
 * ファイル読み込み機能を提供します
 */

window.FileReaderUtil = {
    readFileAsDataURL: function(file) {
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
    },

    readFileAsBase64: function(file) {
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
    },

    readFileAsArrayBuffer: function(file) {
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
};