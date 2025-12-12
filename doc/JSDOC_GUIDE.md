# JSDoc 型定義ガイド

このプロジェクトでは、TypeScript移行なしに型の恩恵を受けるため、JSDocによる型アノテーションを採用しています。

## 📚 JSDocとは？

JSDocは、JavaScriptコードに**型情報とドキュメント**を付与するための標準的な記法です。

### メリット

- ✅ **型チェック**: VSCodeで型の間違いを検出
- ✅ **オートコンプリート**: 関数やメソッドの補完が効く
- ✅ **ドキュメント生成**: 自動的にAPIドキュメントを生成可能
- ✅ **ビルド不要**: コメントなので既存コードがそのまま動作
- ✅ **TypeScript準備**: 将来的な移行が容易に

## 🎯 基本的な使い方

### 関数のドキュメント化

```javascript
/**
 * ユーザー情報を取得
 * @param {string} userId - ユーザーID
 * @returns {Promise<User>} ユーザー情報
 * @throws {Error} ユーザーが見つからない場合
 */
async function getUser(userId) {
    // 実装
}
```

### 型定義（typedef）

```javascript
/**
 * ユーザーを表すオブジェクト
 * @typedef {Object} User
 * @property {string} id - ユーザーID
 * @property {string} name - ユーザー名
 * @property {number} [age] - 年齢（オプション）
 */
```

### クラスメソッド

```javascript
class Storage {
    /**
     * API設定を読み込む
     * 暗号化されたAPIキーを自動的に復号化します
     * @returns {ApiSettings} API設定オブジェクト
     */
    loadApiSettings() {
        // 実装
    }
}
```

## 📖 プロジェクトで定義されている主要な型

### Message（メッセージ）

```javascript
/**
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role - メッセージの役割
 * @property {string} content - メッセージの内容
 * @property {number} [timestamp] - タイムスタンプ (ミリ秒)
 * @property {Attachment[]} [attachments] - 添付ファイルの配列
 */
```

### Attachment（添付ファイル）

```javascript
/**
 * @typedef {Object} Attachment
 * @property {string} id - 一意識別子
 * @property {string} name - ファイル名
 * @property {'file'|'image'} type - ファイルタイプ
 * @property {number} size - ファイルサイズ (バイト)
 * @property {string} mimeType - MIMEタイプ
 * @property {string} [content] - テキストコンテンツ
 * @property {string} [data] - Base64データ (画像)
 */
```

### Conversation（会話）

```javascript
/**
 * @typedef {Object} Conversation
 * @property {string} id - 会話の一意識別子
 * @property {string} title - 会話のタイトル
 * @property {string} model - 使用するAIモデル名
 * @property {number} timestamp - 作成/更新日時
 * @property {Message[]} messages - メッセージの配列
 */
```

### ApiSettings（API設定）

```javascript
/**
 * @typedef {Object} ApiSettings
 * @property {'openai'|'azure'|'claude'|'gemini'} apiType - APIタイプ
 * @property {string} [openaiApiKey] - OpenAI APIキー (暗号化済み)
 * @property {string} [azureApiKey] - Azure APIキー (暗号化済み)
 * @property {string} [claudeApiKey] - Claude APIキー (暗号化済み)
 * @property {string} [geminiApiKey] - Gemini APIキー (暗号化済み)
 * @property {Object.<string, string>} [azureEndpoints] - Azureエンドポイント
 */
```

## 🛠️ VSCodeでの型チェック有効化

プロジェクトには既に以下の設定ファイルが用意されています:

- `jsconfig.json` - JavaScript型チェック設定
- `.vscode/settings.json` - VSCode設定

これにより、自動的に以下が有効化されます:

1. **型チェック**: 型の不一致を警告
2. **オートコンプリート**: 関数シグネチャの表示
3. **ホバー情報**: マウスオーバーで型情報を表示
4. **パラメータヒント**: 関数呼び出し時のパラメータ情報

## 📝 JSDocを書く際のベストプラクティス

### ✅ 推奨

```javascript
/**
 * メッセージを送信します
 * @async
 * @param {Message[]} messages - 送信するメッセージの配列
 * @param {string} model - 使用するモデル名 (例: 'gpt-4o')
 * @param {Attachment[]} [attachments=[]] - 添付ファイル（オプション）
 * @returns {Promise<string>} APIからの応答
 * @throws {Error} APIキー未設定またはネットワークエラー
 */
async function sendMessage(messages, model, attachments = []) {
    // 実装
}
```

### ❌ 避けるべき

```javascript
// 型情報なし
function sendMessage(messages, model, attachments) {
    // 実装
}
```

## 🔍 型チェックの確認方法

### 1. VSCodeのプロブレムパネル

`表示` → `問題` でパネルを開き、型エラーを確認できます。

### 2. エディタ内のインラインエラー

型の不一致がある箇所に波線が表示されます。

### 3. ホバー情報

関数やメソッドにマウスオーバーすると、型情報が表示されます。

## 📚 さらなる学習リソース

- [JSDoc公式ドキュメント](https://jsdoc.app/)
- [TypeScript JSDocリファレンス](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [VSCode JavaScript型チェック](https://code.visualstudio.com/docs/languages/javascript#_type-checking)

## 🎓 よくある質問

### Q: JSDocを書かないとエラーになりますか？

A: いいえ、JSDocはオプションです。ただし、書くことで開発効率が大幅に向上します。

### Q: すべての関数にJSDocが必要ですか？

A: 推奨されますが、特に以下の場合は必須です：
- 公開API（他のファイルから使用される関数）
- 複雑なパラメータを持つ関数
- 型が明確でない関数

### Q: TypeScriptに移行する予定は？

A: 現時点では予定していませんが、JSDocを書いておけば将来的な移行が容易になります。

---

**作成日**: 2025年12月12日  
**更新日**: 2025年12月12日
