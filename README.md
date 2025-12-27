# ChatBot

ローカルで手軽に使える、複数AIプロバイダ対応のWebベース・チャットボットです。Node.js + Expressサーバーで動作し、面倒なセットアップなしで開始できます。

## 主な特徴

- 複数プロバイダ/モデル対応（OpenAI, Azure OpenAI, Claude, Gemini）
	- OpenAI: gpt-4o-mini, gpt-4o, gpt-5-mini, gpt-5
	- Claude: claude-opus-4-1, claude-sonnet-4-0, claude-3-5-haiku-latest
	- Gemini: gemini-2.5-pro, gemini-2.5-flash
- ストリーミング表示（SSE）と入力中アニメーション
- Web検索連携
	- OpenAI Responses API: gpt-5-mini / gpt-5 で対応
	- Claude: 全対応モデルでツール呼び出しにより対応
- マークダウン表示＋コードハイライト＋Mermaid図プレビュー（SVG保存/全画面表示）
- 添付ファイル（画像ほか）とプレビュー
- コード実行（JavaScript / Python[Pyodide] / C++[サーバーサイドg++] / HTML）
- チャット履歴の保存・管理、システムプロンプトのテンプレート化
- モバイル対応レスポンシブUI、MonacoベースのエディタUI

## 動作要件

- OS: Windows 10/11
- Node.js: v18.0.0 以降
- ブラウザ: 最新のChrome / Edge / Firefox / Brave のいずれか
- インターネット接続（各種API利用、Pyodide/外部ライブラリのCDN読込に必要）
- g++ (C++コード実行機能を使用する場合)

## クイックスタート

### 初回セットアップ

1. **Node.jsのインストール**
   - [Node.js公式サイト](https://nodejs.org/)から v18.0.0 以降をインストール
   - インストール後、`node -v` でバージョン確認

2. **アプリケーションの起動**
   ```bash
   # 方法1: バッチファイルから起動（推奨）
   scripts\StartChatBot.bat

   # 方法2: 手動起動
   cd app
   npm install  # 初回のみ
   npm start
   ```

3. **ブラウザで開く**
   - 自動的にブラウザが開きます（`http://localhost:50000`）
   - 手動で開く場合: `http://localhost:50000` にアクセス

初回起動時にAPI設定モーダルが開きます。利用するプロバイダを選び、APIキー等を入力してください。

### 補足事項

- **ポート番号**: デフォルトは 50000 です
- **依存パッケージ**: 初回起動時に自動インストールされます（Express, http-proxy-middleware, cors）
- **プロキシサーバー**: Node.jsサーバーがAPIリクエストをプロキシし、CORS問題を解決します

### g++ のインストール（C++コード実行機能を使用する場合）

C++コードの実行機能を使用するには、g++コンパイラのインストールが必要です。

1. **MSYS2のインストール**
   ```powershell
   winget install -e --id MSYS2.MSYS2
   ```

2. **g++のインストール**

   MSYS2ターミナル（C:\msys64\msys2.exe）を開いて以下を実行：
   ```bash
   pacman -S mingw-w64-x86_64-gcc
   ```

3. **環境変数PATHに追加**

   以下のパスをシステムの環境変数PATHに追加：
   ```
   C:\msys64\mingw64\bin
   ```

4. **インストール確認**

   新しいコマンドプロンプトまたはPowerShellを開いて確認：
   ```powershell
   g++ --version
   ```

**注意**: g++がインストールされていない場合、C++コードは軽量版インタープリタ（JSCPP）で実行されます。JSCPPは一部のC++機能（STLなど）に制限があります。

## 停止方法

**サーバーを停止するには**:
1. サーバーコンソールウィンドウで `Ctrl+C` を押す
2. ブラウザを閉じるだけではサーバーは停止しません

## ディレクトリ構成

```
ChatBot/
├── app/                          # アプリケーション本体
│   ├── server/                   # Node.js/Expressサーバー
│   │   └── index.js              # サーバーエントリーポイント
│   ├── public/                   # フロントエンド（静的ファイル）
│   │   ├── index.html            # メインHTML
│   │   ├── main.js               # エントリーポイント
│   │   ├── css/                  # スタイルシート
│   │   ├── js/                   # JavaScriptモジュール
│   │   └── icon/                 # アイコン
│   ├── node_modules/             # 依存パッケージ（初回起動時に作成）
│   └── package.json              # Node.js依存関係定義
├── scripts/                      # 起動・設定スクリプト
│   ├── StartChatBot.bat          # サーバー起動バッチ
│   └── CreateLauncher.bat        # ショートカット作成
├── ChatBot.lnk                   # メインショートカット
├── .gitignore
└── README.md                     # このファイル
```

## API設定ガイド

起動後、右上の設定アイコンからいつでも再設定できます（初回は自動表示）。

- OpenAI（公式）
	- APIキーを入力
	- モデル: gpt-4o-mini, gpt-4o, gpt-5-mini, gpt-5
- Azure OpenAI
	- APIキーを入力
	- 各モデルのデプロイメントエンドポイントURLを入力（モデルごとにフィールドあり）
- Claude（Anthropic）
	- APIキーを入力（通信はローカルプロキシ経由で `http://localhost:50000/anthropic/v1/messages` へ）
- Gemini（Google）
	- APIキーを入力

Web検索:
- OpenAI: Responses APIでWeb検索を利用可能（gpt-5-mini / gpt-5）
- Claude: 全対応モデルでWeb検索ツールを利用可能

## 使い方のヒント

- メッセージ中のコードブロックには「実行」ボタンが付き、ブラウザ内で実行できます（JS/HTML/Python/C++）。
- Mermaidコードブロック（```mermaid）はプレビュー/コード表示を切替でき、SVG保存や全画面表示が可能です。
- 画像などの添付に対応。対応タイプや最大サイズは `app/public/js/core/config.js` を参照。
- システムプロンプトはテンプレート化して保存/切替ができます。

## 技術スタック

- フロントエンド: HTML5 / CSS3 / JavaScript (ES6+)
- バックエンド: Node.js + Express（HTTPサーバー、リバースプロキシ）
- マークダウン: Marked.js + Prism.js（構文ハイライト）
- 図表: Mermaid（CDNロード, プレビュー/エクスポート対応）
- コード実行: g++（C++、サーバーサイド）/ Pyodide（Python）/ ブラウザJS / HTML
- エディタ: Monaco Editor コントローラ
- 通信: fetch + SSE（ストリーミング）
- プロキシ: http-proxy-middleware

## アーキテクチャ概略

### システム構成

```
ブラウザ (http://localhost:50000)
    ↓
Node.js/Expressプロキシサーバー (port 50000)
    ├─ 静的ファイル配信 (/public)
    ├─ APIプロキシ
    │   ├─ /openai/* → https://api.openai.com/*
    │   ├─ /responses/* → https://api.openai.com/*
    │   ├─ /anthropic/* → https://api.anthropic.com/*
    │   └─ /gemini/* → https://generativelanguage.googleapis.com/*
    └─ C++コンパイル・実行 API
        └─ /api/compile/cpp → ローカルg++でコンパイル・実行
```

### 主要な設計

1. **CORS問題の解決**
   - ブラウザから直接各AI APIを呼び出すとCORSエラーが発生
   - Node.jsプロキシサーバーを経由することで回避
   - すべてのAPIリクエストは `http://localhost:50000/*` 経由で送信

2. **プロキシエンドポイント**
   - OpenAI API: `/openai/v1/chat/completions`
   - Responses API: `/responses/v1/responses`
   - Claude API: `/anthropic/v1/messages`
   - Gemini API: `/gemini/v1beta/models/*`

3. **セキュリティ**
   - APIキーはクライアント側（ブラウザ）で暗号化して保存
   - プロキシサーバーはAPIキーを保存せず、透過的に転送
   - ローカルホストのみでアクセス可能

4. **静的ファイル配信**
   - Node.jsサーバーが `app/public/` ディレクトリを静的ファイルとして配信
   - `http://localhost:50000` → `app/public/index.html`

### サーバーの特徴

- **CORSサポート**: すべてのオリジンからのリクエストを許可（ローカル開発用）
- **エラーハンドリング**: 詳細なログ出力と適切なエラーレスポンス
- **拡張性**: モジュール化された設計により、新しいAPIプロバイダの追加が容易
- **軽量**: 必要最小限の依存パッケージ（Express, http-proxy-middleware, cors）

## トラブルシューティング

**「ERR_CONNECTION_REFUSED」または「Failed to fetch」エラーが発生する**
- **原因**: ローカルプロキシサーバーが起動していません
- **解決策**:
  1. `scripts\StartChatBot.bat` を実行してサーバーを起動
  2. ブラウザで直接 `app/public/index.html` を開かないでください（必ずサーバー経由でアクセス）
  3. サーバーの起動を確認: コンソールに「ChatBot Node.js Server」が表示されているか確認

**API呼び出しエラー「APIキーが設定されていません」**
- 右上の設定アイコンからAPI設定を開き、使用するプロバイダのAPIキーを入力してください
- APIキーは暗号化されてブラウザのローカルストレージに保存されます

**依存パッケージのインストールエラー**
- `app/` ディレクトリで `npm install` を手動実行してください
- Node.jsのバージョンが v18.0.0 以降であることを確認してください

**Node.jsが見つからない**
- [Node.js公式サイト](https://nodejs.org/)からインストールしてください（v18.0.0以降）

**ポート競合**
- 環境変数 `PORT` で別ポートを指定できます
- または、使用中のポート50000を使用しているプロセスを終了してください

---

最終更新: 2025年12月
