# プロジェクト構造

## ファイル構成

```
ChatBot/
├── app/
│   ├── server/
│   │   └── index.js              # Expressサーバー・APIプロキシ
│   ├── public/
│   │   ├── index.html            # メインHTML
│   │   ├── main.js               # エントリーポイント
│   │   ├── js/
│   │   │   ├── core/             # コアモジュール
│   │   │   │   ├── api.js        # AI API統合インターフェース
│   │   │   │   ├── openaiApi.js  # OpenAI API専用クラス
│   │   │   │   ├── claudeApi.js  # Claude API専用クラス
│   │   │   │   ├── geminiApi.js  # Gemini API専用クラス
│   │   │   │   ├── responsesApi.js # OpenAI Responses API
│   │   │   │   ├── config.js     # 設定値（window.CONFIG）
│   │   │   │   ├── storage.js    # ローカルストレージ管理
│   │   │   │   ├── appState.js   # アプリケーション状態管理
│   │   │   │   ├── ui.js         # UI操作
│   │   │   │   ├── uiCache.js    # DOM要素キャッシュ
│   │   │   │   ├── uiUtils.js    # UIユーティリティ
│   │   │   │   ├── domElements.js # DOM要素参照
│   │   │   │   ├── eventHandlers.js # イベントハンドラ
│   │   │   │   ├── rag/            # RAG（知識ベース）
│   │   │   │   │   ├── vectorStore.js      # IndexedDBラッパー
│   │   │   │   │   ├── embeddingApi.js     # 埋め込みAPI
│   │   │   │   │   ├── documentChunker.js  # ドキュメント分割
│   │   │   │   │   ├── similaritySearch.js # 類似度検索
│   │   │   │   │   └── ragManager.js       # 統合マネージャー
│   │   │   │   ├── executors/    # コード実行モジュール
│   │   │   │   │   ├── codeExecutor.js # 実行管理
│   │   │   │   │   └── languages/      # 言語別実行エンジン
│   │   │   │   │       ├── ExecutorBase.js
│   │   │   │   │       ├── JavaScriptExecutor.js
│   │   │   │   │       ├── PythonExecutor.js
│   │   │   │   │       ├── CPPExecutor.js
│   │   │   │   │       └── HTMLExecutor.js
│   │   │   │   ├── monaco/       # Monaco Editor関連
│   │   │   │   └── userprompts/  # プロンプト管理
│   │   │   ├── components/       # UIコンポーネント
│   │   │   │   ├── chat/         # チャット関連
│   │   │   │   ├── sidebar/      # サイドバー
│   │   │   │   └── fileAttachment/ # ファイル添付
│   │   │   ├── modals/           # モーダルダイアログ
│   │   │   │   ├── apiSettings/  # API設定
│   │   │   │   ├── systemPrompt/ # システムプロンプト
│   │   │   │   ├── promptManager/ # プロンプト管理
│   │   │   │   ├── renameChat/   # チャット名変更
│   │   │   │   └── knowledgeBase/ # ナレッジベース(RAG)
│   │   │   ├── utils/            # ユーティリティ
│   │   │   │   ├── cryptoHelper.js
│   │   │   │   ├── fileHandler.js
│   │   │   │   ├── markdown.js
│   │   │   │   └── webContentExtractor.js
│   │   │   └── lib/              # 外部ライブラリ
│   │   └── css/                  # スタイルシート
│   │       ├── base/             # 基本スタイル
│   │       ├── layouts/          # レイアウト
│   │       └── components/       # コンポーネント別CSS
│   ├── node_modules/
│   └── package.json
├── scripts/
│   └── StartChatBot.bat
└── README.md
```

## モジュール依存関係

```
api.js (AIAPI)
├── openaiApi.js (OpenAIAPI)
├── claudeApi.js (ClaudeAPI)
├── geminiApi.js (GeminiAPI)
└── responsesApi.js (ResponsesAPI)

storage.js (Storage)
└── cryptoHelper.js (CryptoHelper)

chatRenderer.js (ChatRenderer)
├── markdown.js (Markdown)
└── chatUI.js (ChatUI)

ragManager.js (RAGManager)
├── vectorStore.js (VectorStore) → IndexedDB
├── embeddingApi.js (EmbeddingApi)
├── documentChunker.js (DocumentChunker)
└── similaritySearch.js (SimilaritySearch)
```

## グローバルオブジェクト

| オブジェクト | 説明 |
|-------------|------|
| `window.CONFIG` | 設定値 |
| `window.AppState` | アプリケーション状態 |
| `window.Elements` | DOM要素参照 |
| `window.apiSettings` | API設定（実行時） |

## コアモジュール

| ファイル | 説明 |
|----------|------|
| config.js | グローバル設定・型定義 |
| api.js | API統合ルーター |
| storage.js | LocalStorage管理・暗号化 |
| appState.js | グローバル状態管理 |
| ui.js | UI管理・レンダリング |
| eventHandlers.js | イベントハンドリング |
| rag/ragManager.js | RAG統合マネージャー |
| rag/vectorStore.js | IndexedDBベクトルストア |
