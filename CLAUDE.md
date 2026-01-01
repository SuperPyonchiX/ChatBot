# ChatBot プロジェクト

マルチAIプロバイダ対応Webチャットボット（OpenAI, Claude, Gemini, Azure）

## 主な機能

- **マルチAI対応**: OpenAI, Claude, Gemini, Azure OpenAI
- **RAG（知識ベース）**: Transformers.jsによるローカル埋め込み（外部API不要）
- **コード実行**: JavaScript, Python, C++, HTML
- **ファイル添付**: PDF, Office, 画像対応

## クイックスタート

```bash
cd app && npm start
# http://localhost:50000
```

## 構造

```
app/
├── server/index.js       # Express + APIプロキシ
└── public/
    ├── js/core/          # API通信、config、storage
    │   └── rag/          # RAG（知識ベース）
    ├── js/components/    # UIコンポーネント
    ├── js/modals/        # モーダル
    └── css/              # スタイル
```

## 必須ルール

### シングルトンパターン

```javascript
class ClassName {
    static #instance = null;
    static get getInstance() {
        if (!ClassName.#instance) ClassName.#instance = new ClassName();
        return ClassName.#instance;
    }
}
```

### 設定値

`window.CONFIG` から取得（ハードコード禁止）

### プライベート

ES2022 `#` を使用

### 命名

- クラス: PascalCase
- メソッド: camelCase
- 定数: SCREAMING_SNAKE
- CSS変数: --kebab-case

## 主要ファイル

| ファイル | 役割 |
|----------|------|
| api.js | API統合ルーター |
| claudeApi.js / openaiApi.js / geminiApi.js | 各API実装 |
| storage.js | ローカルストレージ（暗号化） |
| config.js | 設定値・型定義 |
| chatRenderer.js | メッセージ表示 |
| rag/ragManager.js | RAG統合マネージャー |
| rag/vectorStore.js | IndexedDBベクトルストア |
| rag/embeddingApi.js | ローカル埋め込み（Transformers.js） |

## RAG機能

- **埋め込みモデル**: `Xenova/all-MiniLM-L6-v2`（384次元、約20MB）
- **実行環境**: ブラウザ内WebAssembly/WebGPU
- **ストレージ**: IndexedDB
- **特徴**: 外部API不要、完全ローカル動作、オフライン対応

## 開発スキル

詳細ガイドは `.claude/skills/` を参照：

- **chatbot-dev** - 開発全般
- **chatbot-component** - UI追加
- **chatbot-api** - API統合
