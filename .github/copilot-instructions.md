# ChatBot アプリケーション開発ガイドライン

## プロジェクト概要

マルチAIプロバイダ対応のWebベースチャットボットアプリケーションです。OpenAI、Azure OpenAI、Claude (Anthropic)、Geminiの各APIをサポートし、ローカル環境で動作するクライアントサイドSPA (Single Page Application) として設計されています。

- **対応プロバイダ**: OpenAI, Azure OpenAI, Claude (Anthropic), Gemini
- **対応モデル**: GPT-4o, GPT-4o-mini, GPT-5, Claude Opus/Sonnet/Haiku, Gemini 2.5 Pro/Flash
- **主要機能**: ストリーミング表示、Web検索連携、ファイル添付、コード実行、Markdown/Mermaid表示、チャット履歴管理
- **技術スタック**: HTML5, CSS3, JavaScript (ES6+), PowerShell (ローカルプロキシ)

## 一般的な指示事項

### プロジェクト構成

```
ChatBot/
├── app/                           # アプリケーション本体
│   ├── index.html                # メインHTML
│   ├── main.js                   # エントリーポイント
│   ├── css/                      # スタイルシート
│   │   ├── base/                 # 基本スタイル・変数
│   │   ├── components/           # コンポーネント別CSS
│   │   └── layouts/              # レイアウトCSS
│   └── js/                       # JavaScriptモジュール
│       ├── components/           # UIコンポーネント
│       │   ├── chat/             # チャット機能
│       │   ├── fileAttachment/   # ファイル添付
│       │   └── sidebar/          # サイドバー
│       ├── core/                 # コア機能
│       │   ├── api.js            # API通信
│       │   ├── config.js         # 設定管理
│       │   ├── storage.js        # ローカルストレージ
│       │   ├── executors/        # コード実行機能
│       │   └── monaco/           # Monaco Editor
│       ├── modals/               # モーダルダイアログ
│       │   ├── apiSettings/      # API設定
│       │   ├── promptManager/    # プロンプト管理
│       │   └── systemPrompt/     # システムプロンプト
│       └── utils/                # ユーティリティ
│           ├── markdown.js       # Markdown処理
│           ├── cryptoHelper.js   # 暗号化
│           └── file*.js          # ファイル処理
├── launcher/                      # 起動スクリプト
│   ├── StartChatBot.bat          # メインランチャー
│   └── server/                   # ローカルサーバー
│       ├── server.js             # Node.jsサーバー
│       ├── package.json          # Node.js設定
│       ├── launch.ps1            # 起動・監視スクリプト
│       └── stop-server.ps1       # 停止スクリプト
├── icon/                          # アイコン
├── doc/                           # ドキュメント
│   ├── ChatBot_設計仕様書.md     # 詳細設計書
│   └── ChatBot_system_architecture.xml
├── ChatBot.lnk                    # メインショートカット
├── CreateLauncher.bat             # ランチャー作成
├── README.md                      # プロジェクト概要
└── USER_GUIDE.md                  # ユーザーガイド
```

### 主要な依存関係

**CDNライブラリ**:
- `marked.js`: Markdown処理
- `prism.js`: コードハイライト
- `mermaid.js`: 図表レンダリング
- `pyodide`: Python実行環境
- `monaco-editor`: コードエディタ

**ブラウザAPI**:
- `LocalStorage`: データ永続化
- `Crypto API`: APIキー暗号化
- `Fetch API / SSE`: API通信・ストリーミング

## ベストプラクティス

### アーキテクチャパターン

#### 1. シングルトンパターン

すべての主要クラスはシングルトンパターンを採用しています:

```javascript
class MyComponent {
    static #instance = null;

    static get getInstance() {
        if (!MyComponent.#instance) {
            MyComponent.#instance = new MyComponent();
        }
        return MyComponent.#instance;
    }

    constructor() {
        if (MyComponent.#instance) {
            throw new Error('Use MyComponent.getInstance instead of new');
        }
        // 初期化処理
    }

    // メソッド定義
    myMethod() {
        // 実装
    }
}

// 使用例
const component = MyComponent.getInstance;
component.myMethod();
```

#### 2. API通信パターン

API通信は `AIAPI` クラスで一元管理されています:

```javascript
class AIAPI {
    async sendMessageStream(messages, model, onChunk, onComplete, onError) {
        try {
            const apiSettings = Storage.getInstance.loadApiSettings();
            const apiType = apiSettings.apiType || 'openai';
            
            if (apiType === 'openai') {
                return await this.#performOpenAIRequest(messages, model, onChunk, onComplete);
            } else if (apiType === 'azure') {
                return await this.#performAzureRequest(messages, model, onChunk, onComplete);
            } else if (apiType === 'claude') {
                return await this.#performClaudeRequest(messages, model, onChunk, onComplete);
            } else if (apiType === 'gemini') {
                return await this.#performGeminiRequest(messages, model, onChunk, onComplete);
            }
        } catch (error) {
            onError(error);
            throw error;
        }
    }
}
```

#### 3. エラーハンドリング

エラーハンドリングは一貫したパターンで実装します:

```javascript
async function sendMessage() {
    try {
        // 入力検証
        if (!messageText.trim() && !hasAttachments) {
            UI.getInstance.Core.Notification.show('メッセージを入力してください', 'warning');
            return;
        }

        // 処理実行
        const result = await AIAPI.getInstance.sendMessageStream(
            messages,
            selectedModel,
            onChunk,
            onComplete,
            onError
        );

    } catch (error) {
        console.error('Send message error:', error);
        
        // ユーザーフレンドリーなエラーメッセージ
        let errorMessage = 'メッセージの送信中にエラーが発生しました';
        if (error.message.includes('API key')) {
            errorMessage = 'APIキーが設定されていません';
        } else if (error.message.includes('network')) {
            errorMessage = 'ネットワークエラーが発生しました';
        }
        
        UI.getInstance.Core.Notification.show(errorMessage, 'error');
    } finally {
        // クリーンアップ処理
        enableSendButton();
    }
}
```

### 入力検証

#### ファイル検証

`FileValidator` クラスでファイル検証を行います:

```javascript
class FileValidator {
    static validateFiles(files) {
        const errors = [];
        
        for (const file of files) {
            // ファイルタイプ検証
            if (!this.#checkFileType(file)) {
                errors.push(`${file.name}: サポートされていないファイル形式`);
                continue;
            }
            
            // ファイルサイズ検証
            if (!this.#checkFileSize(file)) {
                errors.push(`${file.name}: ファイルサイズが大きすぎます (最大: 10MB)`);
                continue;
            }
            
            // 拡張子検証
            if (!this.#checkFileExtension(file)) {
                errors.push(`${file.name}: サポートされていない拡張子`);
            }
        }
        
        return { valid: errors.length === 0, errors };
    }
    
    static #checkFileType(file) {
        const allowedTypes = Object.keys(CONFIG.FILE.FILE_TYPE_MAP);
        return allowedTypes.includes(file.type);
    }
    
    static #checkFileSize(file) {
        return file.size <= CONFIG.FILE.MAX_FILE_SIZE;
    }
    
    static #checkFileExtension(file) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        const typeMap = CONFIG.FILE.FILE_TYPE_MAP;
        
        for (const mimeType in typeMap) {
            if (typeMap[mimeType].extensions.includes(ext)) {
                return true;
            }
        }
        return false;
    }
}
```

#### メッセージ検証

```javascript
function validateMessage(messageText, attachments) {
    // 空メッセージチェック
    if (!messageText.trim() && (!attachments || attachments.length === 0)) {
        throw new Error('メッセージまたは添付ファイルが必要です');
    }
    
    // 最大長チェック
    const maxLength = 32000;
    if (messageText.length > maxLength) {
        throw new Error(`メッセージが長すぎます (最大: ${maxLength}文字)`);
    }
    
    return true;
}
```

## コード標準

### ファイル組織

- **HTML**: `app/index.html` – メインHTMLファイル
- **エントリーポイント**: `app/main.js` – アプリ初期化
- **コアモジュール**: `app/js/core/` – API通信、状態管理、ストレージ
- **コンポーネント**: `app/js/components/` – UIコンポーネント
- **ユーティリティ**: `app/js/utils/` – 共通ユーティリティ
- **モーダル**: `app/js/modals/` – モーダルダイアログ
- **スタイル**: `app/css/` – コンポーネント別CSS

### 命名規則

#### JavaScriptクラス

```javascript
// パスカルケースを使用
class ChatRenderer { }
class FileHandler { }
class ApiSettingsModal { }
```

#### メソッドと関数

```javascript
// パブリックメソッド: キャメルケース
renderUserMessage() { }
sendMessage() { }

// プライベートメソッド: #プレフィックス
#performOpenAIRequest() { }
#processAttachments() { }

// プライベート関数: _プレフィックス
function _init() { }
function _loadConversations() { }
```

#### 定数と設定

```javascript
// 大文字のスネークケース
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const API_TIMEOUT = 60000;

// 設定オブジェクトはwindowに公開
window.CONFIG = {
    AIAPI: {
        MAX_RETRIES: 3,
        TIMEOUT_MS: 60000
    }
};
```

#### DOM要素ID

```javascript
// ケバブケースを使用
<div id="chat-messages"></div>
<button id="send-button"></button>
<input id="message-input" />
```

### ドキュメントコメント

```javascript
/**
 * メッセージを送信します
 * 
 * @async
 * @param {string} messageText - 送信するメッセージテキスト
 * @param {Array} attachments - 添付ファイルの配列
 * @returns {Promise<void>}
 * @throws {Error} API通信に失敗した場合
 */
async sendMessage(messageText, attachments) {
    // 実装
}
```
```

## 一般的なパターン

### データモデル

#### 会話データ

```javascript
{
    conversations: [
        {
            id: "1680123456789",              // タイムスタンプベースのID
            title: "新しいチャット",              // 会話タイトル
            model: "gpt-4o",                   // 使用モデル
            timestamp: 1680123456789,          // 作成/更新日時
            messages: [
                {
                    role: "system",
                    content: "あなたは優秀なAIアシスタントです"
                },
                {
                    role: "user",
                    content: "こんにちは",
                    timestamp: 1680123456790
                },
                {
                    role: "assistant",
                    content: "こんにちは！",
                    timestamp: 1680123456900
                }
            ]
        }
    ],
    currentConversationId: "1680123456789"
}
```

#### API設定データ

```javascript
{
    apiType: "openai",                      // "openai", "azure", "claude", "gemini"
    openaiApiKey: "encrypted_key_data",     // 暗号化されたAPIキー
    azureApiKey: "encrypted_key_data",
    claudeApiKey: "encrypted_key_data",
    geminiApiKey: "encrypted_key_data",
    azureEndpoints: {
        "gpt-4o-mini": "https://...",
        "gpt-4o": "https://..."
    }
}
```

#### 添付ファイルデータ

```javascript
{
    files: [
        {
            id: "file-1680123456789",
            name: "example.js",
            type: "file",                    // "file" or "image"
            size: 1024,
            mimeType: "application/javascript",
            content: "function hello() {...}", // テキストコンテンツ
            data: "data:image/jpeg;base64,...", // Base64データ
            timestamp: 1680123456789
        }
    ]
}
```

### ストレージ操作

```javascript
class Storage {
    // 会話を保存
    saveConversations() {
        const data = JSON.stringify(window.AppState.conversations);
        localStorage.setItem('conversations', data);
    }
    
    // 会話を読み込み
    loadConversations() {
        const data = localStorage.getItem('conversations');
        return data ? JSON.parse(data) : [];
    }
    
    // API設定を保存（暗号化）
    saveApiSettings(settings) {
        const encrypted = CryptoHelper.getInstance.encrypt(settings);
        localStorage.setItem('apiSettings', encrypted);
    }
    
    // API設定を読み込み（復号化）
    loadApiSettings() {
        const encrypted = localStorage.getItem('apiSettings');
        return encrypted ? CryptoHelper.getInstance.decrypt(encrypted) : null;
    }
}
```

### ストリーミング処理

```javascript
// Server-Sent Events (SSE) を使用したストリーミング
async function handleStreamingResponse(response, onChunk, onComplete) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 最後の不完全な行を保持
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                            onChunk(content);
                        }
                    } catch (e) {
                        console.error('Parse error:', e);
                    }
                }
            }
        }
        onComplete();
    } catch (error) {
        throw error;
    }
}
```
```

## セキュリティ考慮事項

### APIキーの保護

- **クライアントサイド暗号化**: APIキーはローカルストレージに保存前に暗号化
- **暗号化キー生成**: ユーザー固有の情報と組み合わせて生成
- **メモリ上の保護**: APIキーは必要な間だけメモリに保持

### 入力データ検証

- **入力サニタイズ**: ユーザー入力はHTMLエスケープ処理を施してからレンダリング
- **コンテンツセキュリティポリシー**: インラインスクリプトの実行制限
- **ファイル検証**: アップロードファイルは種類とサイズを検証

### データ保護

- **ローカルデータのみ**: チャットデータはブラウザのローカルストレージのみに保存
- **転送時の暗号化**: API通信はHTTPS経由で実行
- **コード実行の隔離**: サンドボックス化されたiframe内で実行

## パフォーマンス最適化

### DOM操作の最適化

- **DOMキャッシング**: `UICache`クラスで頻繁にアクセスする要素を管理
- **バッチ処理**: DocumentFragmentを使用して複数DOM要素を効率的に追加
- **仮想化リスト**: 大量のチャット履歴は表示範囲のみレンダリング

### リソース読み込みの最適化

- **遅延読み込み**: Prism.js言語コンポーネントなどは必要に応じて動的に読み込み
- **リソースプリフェッチ**: 必要なリソースを予め読み込んで表示を高速化
- **キャッシュ制御**: 静的リソースのキャッシュヘッダーを最適化

### レンダリングパフォーマンス

- **スロットリング**: スクロール・入力イベントハンドラにスロットリングを適用
- **メモ化**: 頻繁に呼び出される処理結果をキャッシュ
- **CSS最適化**: レンダリングを阻害しないCSSの読み込み方法を採用

## トラブルシューティング

### よくある問題

| 問題 | 原因 | 解決策 |
|------|------|--------|
| APIキーエラー | APIキーが未設定または無効 | API設定モーダルから正しいキーを設定 |
| ストリーミングが表示されない | ネットワークエラー | ブラウザコンソールでエラーを確認 |
| ファイル添付エラー | サポートされていない形式 | `config.js`で許可された形式を確認 |
| コード実行エラー | ランタイムの読み込み失敗 | インターネット接続を確認（CDN） |
| 履歴が消えた | ブラウザキャッシュクリア | ローカルストレージの確認 |

### デバッグ方法

```javascript
// ブラウザ開発者ツールでデバッグ
console.log('AppState:', window.AppState);
console.log('Conversations:', window.AppState.conversations);

// ローカルストレージの確認
console.log('Saved settings:', localStorage.getItem('apiSettings'));
console.log('Conversations:', localStorage.getItem('conversations'));

// エラー詳細の確認
try {
    await AIAPI.getInstance.sendMessageStream(...);
} catch (error) {
    console.error('詳細エラー:', error);
}
```

## 開発とテスト

### ローカル開発環境

```bash
# ランチャーでアプリケーションを起動
.\launcher\StartChatBot.bat

# またはショートカット経由
# ChatBot.lnk をダブルクリック

# サーバー停止
.\launcher\server\stop-server.ps1
```

### ブラウザ開発者ツール

- **コンソール**: エラーログとデバッグ情報を確認
- **ネットワーク**: API通信を監視
- **Application > Local Storage**: 保存されたデータを確認
- **Performance**: レンダリングパフォーマンスを分析

## メンテナンス

### 更新時のチェックリスト

- [ ] CDNライブラリのバージョン確認（marked.js, prism.js, mermaid.js）
- [ ] APIプロバイダーの仕様変更を確認
- [ ] ブラウザ互換性テスト（Chrome, Firefox, Edge, Safari）
- [ ] セキュリティ脆弱性のチェック
- [ ] パフォーマンス測定とボトルネック特定
- [ ] ドキュメントの更新

### バージョン管理

- **パッチ版**: バグ修正（1.0.1）
- **マイナー版**: 新機能追加（1.1.0）
- **メジャー版**: 互換性破壊的な変更（2.0.0）

## 追加リソース

- [Marked.js ドキュメント](https://marked.js.org/)
- [Prism.js ドキュメント](https://prismjs.com/)
- [Mermaid ドキュメント](https://mermaid.js.org/)
- [Monaco Editor ドキュメント](https://microsoft.github.io/monaco-editor/)
- [OpenAI API リファレンス](https://platform.openai.com/docs/api-reference)
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference)
- [Google Gemini API](https://ai.google.dev/docs)
