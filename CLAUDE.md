# ChatBot プロジェクト

マルチAIプロバイダ対応Webチャットボットアプリケーション

## 概要

ブラウザベースのAIチャットアプリケーションで、複数のAIプロバイダ（OpenAI, Claude, Gemini, Azure OpenAI）に対応。RAG（検索拡張生成）、コード実行、ファイル添付などの高度な機能を備えています。

## 主な機能

| 機能 | 説明 |
|------|------|
| **マルチAI対応** | OpenAI (GPT-4o, GPT-5, o1), Claude (4.5), Gemini (2.5, 3) |
| **RAG** | ナレッジベース検索（ローカル埋め込み or OpenAI/Azure） |
| **Web検索** | GPT-5シリーズ（Responses API）、Claude（ツール）で対応 |
| **コード実行** | JavaScript, Python (Pyodide), C++ (g++/JSCPP), TypeScript, HTML |
| **アーティファクト** | HTML/SVG/Mermaid/Markdownのプレビューパネル |
| **ファイル添付** | 画像, PDF, Office (Excel/Word/PowerPoint), テキスト, コード |
| **プロンプト管理** | システムプロンプト・ユーザープロンプトのテンプレート |

## クイックスタート

```bash
cd app && npm install && npm start
# http://localhost:50000
```

## アーキテクチャ

### 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript (ES2022+)
- **バックエンド**: Node.js 18+, Express 4.x
- **埋め込み**: Transformers.js (ローカル) / OpenAI API / Azure OpenAI
- **ストレージ**: LocalStorage (設定), IndexedDB (RAG)
- **外部ライブラリ**:
  - PDF.js (PDF解析)
  - SheetJS (Excel解析)
  - JSZip (Office解析)
  - Mammoth.js (Word解析)
  - Monaco Editor (コード編集)
  - Prism.js (シンタックスハイライト)
  - Pyodide (Python実行)
  - JSCPP (C++実行)

### プロジェクト構造

```
ChatBot/
├── app/
│   ├── package.json              # Node.js依存関係
│   ├── server/
│   │   └── index.js              # Express + APIプロキシサーバー
│   └── public/
│       ├── index.html            # メインHTML
│       ├── main.js               # エントリーポイント
│       ├── js/
│       │   ├── core/             # コアモジュール
│       │   │   ├── api.js        # AI API統合ルーター
│       │   │   ├── openaiApi.js  # OpenAI API実装
│       │   │   ├── claudeApi.js  # Claude API実装
│       │   │   ├── geminiApi.js  # Gemini API実装
│       │   │   ├── responsesApi.js # OpenAI Responses API（Web検索）
│       │   │   ├── config.js     # 設定値・型定義（window.CONFIG）
│       │   │   ├── storage.js    # LocalStorage管理（暗号化対応）
│       │   │   ├── appState.js   # グローバル状態管理
│       │   │   ├── ui.js         # UI管理
│       │   │   ├── eventHandlers.js # イベントハンドラ
│       │   │   ├── rag/          # RAG（知識ベース）
│       │   │   │   ├── ragManager.js     # RAG統合マネージャー
│       │   │   │   ├── vectorStore.js    # IndexedDBベクトルストア
│       │   │   │   ├── embeddingApi.js   # 埋め込みAPI
│       │   │   │   ├── documentChunker.js # ドキュメント分割
│       │   │   │   └── similaritySearch.js # 類似度検索
│       │   │   ├── executors/    # コード実行
│       │   │   │   ├── codeExecutor.js   # 実行管理
│       │   │   │   └── languages/        # 言語別エグゼキュータ
│       │   │   ├── monaco/       # Monaco Editor
│       │   │   └── userprompts/  # プロンプト管理
│       │   ├── components/       # UIコンポーネント
│       │   │   ├── chat/         # チャット関連
│       │   │   │   ├── chatRenderer.js   # メッセージ表示
│       │   │   │   ├── chatActions.js    # チャットアクション
│       │   │   │   ├── chatHistory.js    # 履歴管理
│       │   │   │   └── chatUI.js         # チャットUI
│       │   │   ├── artifact/     # アーティファクト
│       │   │   │   ├── artifactManager.js
│       │   │   │   ├── artifactDetector.js
│       │   │   │   ├── artifactRenderer.js
│       │   │   │   └── artifactPanel.js
│       │   │   ├── sidebar/      # サイドバー
│       │   │   └── fileAttachment/ # ファイル添付
│       │   ├── modals/           # モーダルダイアログ
│       │   │   ├── apiSettings/  # API設定
│       │   │   ├── systemPrompt/ # システムプロンプト
│       │   │   ├── promptManager/ # プロンプト管理
│       │   │   ├── knowledgeBase/ # ナレッジベース
│       │   │   └── renameChat/   # チャット名変更
│       │   ├── utils/            # ユーティリティ
│       │   └── lib/              # 外部ライブラリ
│       └── css/                  # スタイルシート
│           ├── base/             # 基本スタイル・変数
│           ├── layouts/          # レイアウト
│           └── components/       # コンポーネント別CSS
└── .claude/
    └── skills/                   # Claude Codeスキル
```

## サーバーアーキテクチャ

Express サーバー（`app/server/index.js`）がAPIプロキシとして動作し、CORS問題を回避します。

### プロキシエンドポイント

| エンドポイント | 転送先 | 用途 |
|---------------|--------|------|
| `/openai/*` | `api.openai.com` | OpenAI Chat API |
| `/responses/*` | `api.openai.com` | OpenAI Responses API（Web検索） |
| `/anthropic/*` | `api.anthropic.com` | Claude API |
| `/gemini/*` | `generativelanguage.googleapis.com` | Gemini API |
| `/azure-openai` | 動的URL | Azure OpenAI Chat（POST） |
| `/openai-embeddings` | `api.openai.com` | OpenAI Embeddings |
| `/azure-openai-embeddings` | 動的URL | Azure Embeddings |
| `/api/compile/cpp` | ローカル | C++コンパイル・実行 |

## 必須コーディング規約

### シングルトンパターン（全クラスで必須）

```javascript
class ClassName {
    static #instance = null;

    constructor() {
        if (ClassName.#instance) {
            return ClassName.#instance;
        }
        ClassName.#instance = this;
    }

    static get getInstance() {
        if (!ClassName.#instance) {
            ClassName.#instance = new ClassName();
        }
        return ClassName.#instance;
    }

    // プライベートメソッド（ES2022）
    #privateMethod() { /* ... */ }
}
```

### 命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| クラス | PascalCase | `ChatRenderer`, `OpenAIAPI` |
| メソッド | camelCase | `addUserMessage`, `callOpenAIAPI` |
| プライベート | `#`プレフィックス | `#validateInput`, `#instance` |
| 定数 | SCREAMING_SNAKE | `MAX_RETRIES`, `DEFAULT_PARAMS` |
| CSS変数 | `--kebab-case` | `--background-primary` |
| CSSクラス | kebab-case | `.chat-message`, `.user-input` |

### 設定値アクセス

設定値は必ず `window.CONFIG` から取得（ハードコード禁止）：

```javascript
// 正しい
const timeout = window.CONFIG.AIAPI.REQUEST_TIMEOUT;
const apiEndpoint = window.CONFIG.AIAPI.ENDPOINTS.OPENAI;

// 誤り
const timeout = 60000;
```

### JSDocコメント

パブリックメソッドには必ずJSDocを記載：

```javascript
/**
 * AI APIを呼び出して応答を得る
 * @async
 * @param {Message[]} messages - 会話メッセージの配列
 * @param {string} model - 使用するモデル名
 * @param {Attachment[]} [attachments=[]] - 添付ファイルの配列
 * @param {ApiCallOptions} [options={}] - 追加オプション
 * @returns {Promise<string>} APIからの応答テキスト
 * @throws {Error} API設定やリクエストに問題があった場合
 */
async callAIAPI(messages, model, attachments = [], options = {}) { ... }
```

### エラーハンドリング

```javascript
try {
    // 処理
} catch (error) {
    console.error('[モジュール名] 処理名エラー:', error);
    throw error; // 必要に応じて再スロー
}
```

### ログ出力

モジュール名をプレフィックスに付ける：

```javascript
console.log('[ChatUI] エディタをリサイズします');
console.error('[C++] コンパイルエラー:', error);
console.log('✅ 処理が完了しました');  // 絵文字は成功/警告/エラーの区別に使用可
```

## 主要モジュール

### コアモジュール

| ファイル | クラス | 役割 |
|----------|--------|------|
| `api.js` | `AIAPI` | API統合ルーター（モデルに応じて適切なAPIにルーティング） |
| `openaiApi.js` | `OpenAIAPI` | OpenAI Chat Completions API |
| `claudeApi.js` | `ClaudeAPI` | Claude Messages API（Web検索ツール対応） |
| `geminiApi.js` | `GeminiAPI` | Gemini GenerateContent API |
| `responsesApi.js` | `ResponsesAPI` | OpenAI Responses API（Web検索対応） |
| `config.js` | - | 設定値・型定義（`window.CONFIG`） |
| `storage.js` | `Storage` | LocalStorage管理（APIキー暗号化） |
| `appState.js` | `AppState` | グローバル状態管理（`window.AppState`） |

### RAGモジュール

| ファイル | クラス | 役割 |
|----------|--------|------|
| `ragManager.js` | `RAGManager` | RAG統合マネージャー |
| `vectorStore.js` | `VectorStore` | IndexedDBベクトルストア |
| `embeddingApi.js` | `EmbeddingAPI` | 埋め込みAPI（ローカル/OpenAI/Azure） |
| `documentChunker.js` | `DocumentChunker` | ドキュメント分割 |
| `similaritySearch.js` | `SimilaritySearch` | コサイン類似度検索 |

### 埋め込みモード

| モード | モデル | 次元数 | 特徴 |
|--------|--------|--------|------|
| ローカル | `Xenova/all-MiniLM-L6-v2` | 384 | オフライン動作、約20MB |
| OpenAI | `text-embedding-3-large` | 3072 | 高精度、API課金 |
| Azure | `text-embedding-3-large` | 3072 | エンタープライズ向け |

### UIコンポーネント

| ファイル | クラス | 役割 |
|----------|--------|------|
| `chatRenderer.js` | `ChatRenderer` | メッセージ表示・コードブロック処理 |
| `chatActions.js` | `ChatActions` | メッセージ送信・会話管理 |
| `chatHistory.js` | `ChatHistory` | 会話履歴表示・切り替え |
| `artifactManager.js` | `ArtifactManager` | アーティファクト管理 |
| `artifactDetector.js` | `ArtifactDetector` | コードブロックからアーティファクト検出 |

## グローバルオブジェクト

| オブジェクト | 説明 |
|-------------|------|
| `window.CONFIG` | 設定値（`config.js`で定義） |
| `window.AppState` | アプリケーション状態 |
| `window.Elements` | DOM要素参照 |
| `window.apiSettings` | API設定（実行時） |
| `window.TransformersJS` | Transformers.jsインスタンス |

## 設定構造（window.CONFIG）

```javascript
window.CONFIG = {
    EXECUTABLE_LANGUAGES: [...],  // 実行可能言語
    ARTIFACT: { ... },            // アーティファクト設定
    AIAPI: {
        ENDPOINTS: { ... },       // APIエンドポイント
        DEFAULT_PARAMS: { ... },  // デフォルトパラメータ
        ...
    },
    FILE: { ... },                // ファイル設定
    STORAGE: {
        KEYS: { ... },            // ストレージキー
        ...
    },
    MODELS: {
        OPENAI: [...],            // OpenAIモデル
        CLAUDE: [...],            // Claudeモデル
        GEMINI: [...],            // Geminiモデル
        ...
    },
    RAG: {
        EMBEDDING: { ... },       // 埋め込み設定
        STORAGE: { ... },         // IndexedDB設定
        AUGMENTATION: { ... },    // プロンプト拡張設定
    },
    ...
};
```

## 開発ワークフロー

### 新機能追加の手順

1. 関連するコアファイルを確認
2. シングルトンパターンでクラスを実装
3. `window.CONFIG`で設定値を管理
4. 適切なエラーハンドリングを追加
5. JSDocコメントで型情報を記載
6. 必要に応じてCSSを追加
7. `index.html`でスクリプトを読み込み順に追加

### API追加の手順

1. `js/core/`に新しいAPIクラスを作成（例: `newApi.js`）
2. `api.js`のルーティングロジックに追加
3. `config.js`にモデル・エンドポイント設定を追加
4. `server/index.js`にプロキシエンドポイントを追加
5. 必要に応じてモーダルにUI追加

### コンポーネント追加の手順

1. `js/components/`に新しいコンポーネントを作成
2. シングルトンパターンで実装
3. `css/components/`にCSSを追加
4. `index.html`でスクリプト・CSSを読み込み

## ドキュメント更新ルール

実装変更後は以下を確認・更新：

| 変更内容 | 更新対象 |
|----------|----------|
| 新機能追加 | `README.md`, `CLAUDE.md`, `references/project-structure.md` |
| ディレクトリ追加 | `CLAUDE.md`（構造）, `references/project-structure.md` |
| 設定値追加 | `CLAUDE.md`, `config.js`コメント |
| API変更 | `README.md`, `CLAUDE.md`, 該当Skillファイル |

## 開発スキル

詳細ガイドは `.claude/skills/` を参照：

| スキル | 説明 |
|--------|------|
| **chatbot-dev** | 開発全般（プロジェクト構造、コーディング規約、ワークフロー） |
| **chatbot-component** | UI コンポーネント追加（CSS構成、イベントハンドリング） |
| **chatbot-api** | AI API統合（APIクラス実装、プロキシ設定、ストリーミング） |

## よく使うコマンド

```bash
# 開発サーバー起動
cd app && npm start

# 依存関係インストール
cd app && npm install

# サーバーログ確認
# コンソールに [OpenAI], [Claude], [Gemini] などのプレフィックス付きでログ出力
```

## 注意事項

- APIキーはLocalStorageに暗号化して保存される
- IndexedDBはRAGのベクトルデータ保存に使用
- C++実行にはサーバー側にg++が必要
- Python実行はPyodide（WebAssembly）を使用
- 大きなファイルの添付は10MBまで対応
