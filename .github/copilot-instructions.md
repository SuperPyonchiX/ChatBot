# ChatBot 開発ガイドライン

## プロジェクト概要

マルチAIプロバイダ対応のWebチャットボットアプリケーション。

- **対応API**: OpenAI, Azure OpenAI, Claude, Gemini
- **技術スタック**: HTML5, CSS3, JavaScript (ES6+), Node.js, Express
- **ポート**: 50000

## ディレクトリ構造

```
ChatBot/
├── app/
│   ├── server/index.js          # Expressサーバー・APIプロキシ
│   └── public/
│       ├── index.html           # メインHTML
│       ├── main.js              # エントリーポイント
│       ├── js/
│       │   ├── core/            # API通信、config、storage
│       │   ├── components/      # UIコンポーネント
│       │   ├── modals/          # モーダルダイアログ
│       │   └── utils/           # ユーティリティ
│       └── css/                 # スタイルシート
├── scripts/                     # 起動スクリプト
└── .claude/skills/              # 開発スキル（詳細ガイド）
```

## 必須パターン

### シングルトン

```javascript
class ClassName {
    static #instance = null;

    static get getInstance() {
        if (!ClassName.#instance) {
            ClassName.#instance = new ClassName();
        }
        return ClassName.#instance;
    }

    constructor() {
        if (ClassName.#instance) {
            throw new Error('Use getInstance');
        }
    }
}
```

### プライベートメソッド

```javascript
#privateMethod() { }
```

### 設定値アクセス

```javascript
window.CONFIG.AIAPI.ENDPOINTS.OPENAI
window.CONFIG.STORAGE.KEYS.API_TYPE
```

## 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| クラス | PascalCase | `ChatRenderer` |
| メソッド | camelCase | `sendMessage` |
| プライベート | #prefix | `#validateSettings` |
| 定数 | SCREAMING_SNAKE | `MAX_RETRIES` |
| CSS変数 | --kebab-case | `--background-primary` |
| DOM ID | kebab-case | `chat-messages` |

## 主要クラス

| クラス | ファイル | 役割 |
|--------|----------|------|
| AIAPI | api.js | API統合ルーター |
| OpenAIAPI | openaiApi.js | OpenAI通信 |
| ClaudeAPI | claudeApi.js | Claude通信 |
| GeminiAPI | geminiApi.js | Gemini通信 |
| Storage | storage.js | ローカルストレージ |
| ChatRenderer | chatRenderer.js | メッセージ表示 |

## 開発コマンド

```bash
cd app && npm start
# http://localhost:50000
```

## 詳細ガイド

詳細な実装パターンは `.claude/skills/` を参照：

- **chatbot-dev**: プロジェクト構造、コーディング規約
- **chatbot-component**: UIコンポーネント作成、CSS構成
- **chatbot-api**: API統合、ストリーミング実装
