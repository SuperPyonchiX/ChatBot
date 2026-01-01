# コーディング規約

## 命名規則

- **クラス名**: PascalCase（例: `ChatRenderer`, `OpenAIAPI`）
- **メソッド名**: camelCase（例: `addUserMessage`, `callOpenAIAPI`）
- **プライベートメソッド**: `#`プレフィックス（例: `#validateAPISettings`）
- **定数**: SCREAMING_SNAKE_CASE（例: `MAX_RETRIES`, `DEFAULT_PARAMS`）
- **CSS変数**: kebab-case with `--`プレフィックス（例: `--background-primary`）
- **CSSクラス**: kebab-case（例: `.chat-message`, `.user-input`）

## JSDocコメント

すべてのパブリックメソッドにJSDocを記載：

```javascript
/**
 * AI APIを呼び出して応答を得る
 * @async
 * @param {Message[]} messages - 会話メッセージの配列
 * @param {string} model - 使用するモデル名
 * @param {Attachment[]} [attachments=[]] - 添付ファイルの配列（任意）
 * @param {ApiCallOptions} [options={}] - 追加オプション
 * @returns {Promise<string>} APIからの応答テキスト
 * @throws {Error} API設定やリクエストに問題があった場合
 */
async callAIAPI(messages, model, attachments = [], options = {}) {
```

## エラーハンドリング

```javascript
try {
    // 処理
} catch (error) {
    console.error('[モジュール名] 処理名エラー:', error);
    throw error; // または適切なエラー処理
}
```

## DOM操作

ChatUI.instanceのcreateElementメソッドを使用：

```javascript
const element = ChatUI.getInstance.createElement('div', {
    classList: ['message', 'bot'],
    attributes: { 'data-timestamp': timestamp },
    innerHTML: content
});
```

## 非同期処理

async/awaitを使用：

```javascript
async someMethod() {
    const result = await this.#executeRequest();
    return result;
}
```

## 設定値アクセス

ハードコードせずwindow.CONFIGから取得：

```javascript
// 良い例
const timeout = window.CONFIG.AIAPI.REQUEST_TIMEOUT;

// 悪い例
const timeout = 60000;
```

## ログ出力

プレフィックスを付ける：

```javascript
console.log('[ChatUI] エディタをリサイズします');
console.error('[C++] コンパイルエラー:', error);
console.warn('[API] レスポンスが遅延しています');
```

## 型定義（JSDoc）

config.jsで定義された型を使用：

```javascript
/**
 * @typedef {'user'|'assistant'|'system'} MessageRole
 * @typedef {Object} Attachment
 * @typedef {Object} ApiSettings
 * @typedef {Object} ApiCallOptions
 */
```
