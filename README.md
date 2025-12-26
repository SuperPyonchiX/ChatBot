# ChatBot

ローカルで手軽に使える、複数AIプロバイダ対応のWebベース・チャットボットです。Windows向けのサイレント・ランチャーを同梱し、面倒なセットアップなしで開始できます。

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
- コード実行（JavaScript / Python[Pyodide] / C++[JSCPP] / HTML）
- チャット履歴の保存・管理、システムプロンプトのテンプレート化
- モバイル対応レスポンシブUI、MonacoベースのエディタUI

## 動作要件

- OS: Windows 10/11（サイレント起動ランチャーはWindows専用）
- Node.js: v14.0.0 以降（ローカルサーバー実行に必要）
- ブラウザ: 最新のChrome / Edge / Firefox / Brave のいずれか
- インターネット接続（各種API利用、Pyodide/外部ライブラリのCDN読込に必要）

## クイックスタート（推奨）

### 初回セットアップ

1. **Node.jsのインストール**
   - [Node.js公式サイト](https://nodejs.org/)から v14.0.0 以降をインストール
   - インストール後、`node -v` でバージョン確認

2. **アプリケーションの起動**
   ```bash
   # 方法1: バッチファイルから起動（推奨）
   launcher\StartChatBot.bat
   
   # 方法2: 手動起動
   cd launcher\server
   npm install  # 初回のみ
   node server.js --port=50000
   ```

3. **ブラウザで開く**
   - 自動的にブラウザが開きます（`http://localhost:50000`）
   - 手動で開く場合: `http://localhost:50000` にアクセス

初回起動時にAPI設定モーダルが開きます。利用するプロバイダを選び、APIキー等を入力してください。

### 補足事項

- **ポート番号**: デフォルトは 50000 です
- **依存パッケージ**: 初回起動時に自動インストールされます（Express, http-proxy-middleware, cors）
- **プロキシサーバー**: Node.jsサーバーがAPIリクエストをプロキシし、CORS問題を解決します

## 停止方法

**サーバーを停止するには**:
1. サーバーコンソールウィンドウで `Ctrl+C` を押す
2. ブラウザを閉じるだけではサーバーは停止しません


## ディレクトリ構成

```
ChatBot/
├─ launcher/                  # 起動・サーバー関連
│  ├─ StartChatBot.bat        # サーバー起動バッチ
│  └─ server/
│     ├─ server.js            # Node.jsプロキシサーバー
│     ├─ package.json         # Node.js依存関係定義
│     └─ node_modules/        # 依存パッケージ（初回起動時に作成）
├─ app/                       # アプリ本体（静的ファイル）
│  ├─ index.html
│  ├─ main.js
│  ├─ css/
│  └─ js/
├─ icon/                      # アイコン等
└─ README.md                  # このファイル
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
	- APIキーを入力（通信はローカルプロキシ経由で `http://localhost:<port>/anthropic/v1/messages` へ）
- Gemini（Google）
	- APIキーを入力

Web検索:
- OpenAI: Responses APIでWeb検索を利用可能（gpt-5-mini / gpt-5）
- Claude: 全対応モデルでWeb検索ツールを利用可能

## 使い方のヒント

- メッセージ中のコードブロックには「実行」ボタンが付き、ブラウザ内で実行できます（JS/HTML/Python/C++）。
- Mermaidコードブロック（```mermaid）はプレビュー/コード表示を切替でき、SVG保存や全画面表示が可能です。
- 画像などの添付に対応。対応タイプや最大サイズは `app/js/core/config.js` を参照。
- システムプロンプトはテンプレート化して保存/切替ができます。

## 技術スタック

- フロントエンド: HTML5 / CSS3 / JavaScript (ES6+)
- バックエンド: Node.js（HTTPサーバー、リバースプロキシ）
- マークダウン: Marked.js + Prism.js（構文ハイライト）
- 図表: Mermaid（CDNロード, プレビュー/エクスポート対応）
- コード実行: JSCPP（C++）/ Pyodide（Python）/ ブラウザJS / HTML
- エディタ: Monaco Editor コントローラ
- 通信: fetch + SSE（ストリーミング）
- ローカルサーバー: Node.js http/https モジュール（Anthropicリバースプロキシ/静的配信）

## アーキテクチャ概略

### システム構成

```
ブラウザ (http://localhost:50000)
    ↓
Node.jsローカルプロキシサーバー (port 50000)
    ↓ プロキシ
    ├─ /openai/* → https://api.openai.com/*
    ├─ /responses/* → https://api.openai.com/*
    ├─ /anthropic/* → https://api.anthropic.com/*
    └─ /gemini/* → https://generativelanguage.googleapis.com/*
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
   - Node.jsサーバーが `app/` ディレクトリを静的ファイルとして配信
   - `http://localhost:50000` → `app/index.html`

### サーバーの特徴

- **CORSサポート**: すべてのオリジンからのリクエストを許可（ローカル開発用）
- **エラーハンドリング**: 詳細なログ出力と適切なエラーレスポンス
- **拡張性**: モジュール化された設計により、新しいAPIプロバイダの追加が容易
- **軽量**: 必要最小限の依存パッケージ（Express, http-proxy-middleware, cors）

### 開発者向けオプション
または「Failed to fetch」エラーが発生する**
- **原因**: ローカルプロキシサーバーが起動していません
- **解決策**: 
  1. `launcher\StartChatBot.bat` を実行してサーバーを起動
  2. ブラウザで直接 `app/index.html` を開かないでください（必ずサーバー経由でアクセス）
  3. サーバーの起動を確認: コンソールに「ChatBot ローカルプロキシサーバー起動」が表示されているか確認
# 依存パッケージのインストール（初回のみ）
npm install

# サーバー起動（デフォルトポート: 50000）
npm start
デフォルトポート（50000）が使用中の場合、`node server.js --port=別のポート番号` で変更可能
- または、使用中のポート50000を使用しているプロセスを終了してください

**API呼び出しエラー「APIキーが設定されていません」**
- 右上の設定アイコンからAPI設定を開き、使用するプロバイダのAPIキーを入力してください
- APIキーは暗号化されてブラウザのローカルストレージに保存されます

**依存パッケージのインストールエラー**
- `launcher\server\` ディレクトリで `npm install` を手動実行してください
- Node.jsのバージョンが v14.0.0 以降であることを確認してください

**「ERR_CONNECTION_REFUSED」エラーが発生する**
- **原因**: ローカルサーバーが起動していません
- **解決策**: 
  1. `ChatBot.lnk` または `launcher\StartChatBot.bat` を使用して起動
  2. ブラウザで直接 `app/index.html` を開かないでください
  3. サーバー状態確認: `http://localhost:50000/health`

**Node.jsが見つからない**
- [Node.js公式サイト](https://nodejs.org/)からインストールしてください（v14.0.0以降）

**ポート競合**
- `launcher/StartChatBot.bat <port>` で別ポートを指定してください（既定は 50000）
- サーバーは自動的に次の利用可能なポートを検出します

**サーバーがすぐに停止する**
- ブラウザを開いていない状態が25秒続くと自動停止します
- 開発時は `node server.js --port=50000 --no-monitor` で監視を無効化できます

**起動ログの確認**
- `launcher/server/launch.log` および Node.jsサーバーのコンソール出力を参照してください

**スクリプト実行ポリシー**
- ランチャーは `-ExecutionPolicy Bypass` で起動します
- セキュリティ製品によりブロックされる場合は許可設定をご検討ください
- 停止できない/プロセスが残る: 手動停止スクリプト（上記）を実行してください。Node.jsプロセスも自動的に終了されます。

---

最終更新: 2025年12月