/**
 * Monaco Editor Worker Loader Proxy
 * このスクリプトは、Monaco Editorが使用するWeb Workerをロードするためのプロキシです。
 * CDNからMonacoを使用する際に、CORS制約を回避するために使用します。
 * 
 * 注意: このスクリプトは現在使用されていません。シンプルモードへのフォールバック時に
 * Web Workerは使用しません。
 */

// Monaco EditorをスタンドアロンモードでロードするようになったためWorkerは不要
// シンプルエディタモード用のスタブファイル
console.log('Monaco Editor Workerはスタンドアロンモードでは使用しません');

// エラー通知を防ぐためのダミー関数
self.onmessage = function(e) {
    self.postMessage({
        type: 'error',
        message: 'Workerは現在使用されていません'
    });
};
