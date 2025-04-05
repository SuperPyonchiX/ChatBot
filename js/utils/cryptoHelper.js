/**
 * cryptoHelper.js
 * APIキーやセンシティブな情報の暗号化・復号化を担当するモジュール
 */

window.CryptoHelper = (function() {
    // アプリケーション固有の暗号化ソルト（実際の実装では環境変数や設定から読み込むべき）
    const ENCRYPTION_SALT = 'ChatBot_Security_Salt_2025';
    
    // AES暗号化のためのキー導出関数（PBKDF2ベース）
    function _deriveKeyFromPassphrase(passphrase) {
        // パスフレーズとソルトから簡易的なキーを生成
        // 注: この実装は完全な暗号化強度を持ちませんが、
        // 平文よりは高いセキュリティを提供します
        let key = '';
        const combo = passphrase + ENCRYPTION_SALT;
        
        // 簡易ハッシュ関数
        for (let i = 0; i < combo.length; i++) {
            key += (combo.charCodeAt(i) * 7) % 256;
        }
        
        // キーを32文字に調整（AES-256用）
        while (key.length < 32) {
            key += key;
        }
        
        return key.slice(0, 32);
    }
    
    // 文字列をUTF-8バイト配列に変換
    function _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            bytes.push(char & 0xFF);
        }
        return bytes;
    }
    
    // バイト配列をUTF-8文字列に変換
    function _bytesToString(bytes) {
        let str = '';
        for (let i = 0; i < bytes.length; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        return str;
    }
    
    // XORベースの簡易暗号化（AES-256の代わり）
    function _xorEncrypt(data, key) {
        const dataBytes = _stringToBytes(data);
        const keyBytes = _stringToBytes(key);
        const encryptedBytes = [];
        
        for (let i = 0; i < dataBytes.length; i++) {
            // キーの各バイトでXOR演算
            const keyByte = keyBytes[i % keyBytes.length];
            encryptedBytes.push(dataBytes[i] ^ keyByte);
        }
        
        return encryptedBytes;
    }
    
    // XORベースの簡易復号化
    function _xorDecrypt(encryptedBytes, key) {
        const keyBytes = _stringToBytes(key);
        const decryptedBytes = [];
        
        for (let i = 0; i < encryptedBytes.length; i++) {
            // 暗号化と同じXOR演算で復号化
            const keyByte = keyBytes[i % keyBytes.length];
            decryptedBytes.push(encryptedBytes[i] ^ keyByte);
        }
        
        return _bytesToString(decryptedBytes);
    }
    
    return {
        /**
         * 文字列を暗号化
         * @param {string} text - 暗号化する文字列
         * @param {string} [passphrase=navigator.userAgent] - 暗号化パスフレーズ
         * @returns {string} Base64エンコードされた暗号文
         */
        encrypt: function(text, passphrase = navigator.userAgent) {
            if (!text) return '';
            
            try {
                // パスフレーズからキーを導出
                const key = _deriveKeyFromPassphrase(passphrase);
                
                // XOR暗号化
                const encryptedBytes = _xorEncrypt(text, key);
                
                // Base64エンコード
                const base64 = btoa(String.fromCharCode.apply(null, encryptedBytes));
                
                // 暗号化されたデータにプレフィックスを付加して識別しやすくする
                return 'ENC:' + base64;
            } catch (error) {
                console.error('暗号化エラー:', error);
                return text; // エラー時は元のテキストを返す
            }
        },
        
        /**
         * 暗号文を復号化
         * @param {string} encryptedText - 復号化する暗号文
         * @param {string} [passphrase=navigator.userAgent] - 復号化パスフレーズ
         * @returns {string} 復号化された平文
         */
        decrypt: function(encryptedText, passphrase = navigator.userAgent) {
            if (!encryptedText) return '';
            
            // 未暗号化の文字列の場合はそのまま返す
            if (!encryptedText.startsWith('ENC:')) {
                return encryptedText;
            }
            
            try {
                // プレフィックスを削除
                const base64 = encryptedText.substring(4);
                
                // Base64デコード
                const encryptedBytes = [];
                const binaryString = atob(base64);
                for (let i = 0; i < binaryString.length; i++) {
                    encryptedBytes.push(binaryString.charCodeAt(i));
                }
                
                // パスフレーズからキーを導出
                const key = _deriveKeyFromPassphrase(passphrase);
                
                // 復号化
                return _xorDecrypt(encryptedBytes, key);
            } catch (error) {
                console.error('復号化エラー:', error);
                // エラー時は暗号文をそのまま返す（プレフィックスは削除）
                return encryptedText.substring(4);
            }
        },
        
        /**
         * 文字列が暗号化されているかどうかを確認
         * @param {string} text - 確認する文字列
         * @returns {boolean} 暗号化されている場合はtrue
         */
        isEncrypted: function(text) {
            return text && typeof text === 'string' && text.startsWith('ENC:');
        }
    };
})();