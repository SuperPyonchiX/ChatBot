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

1) ルートにある `CreateLauncher.bat` を実行してショートカットを作成
2) 生成された `ChatBot.lnk` をダブルクリック

初回起動時にAPI設定モーダルが開きます。利用するプロバイダを選び、APIキー等を入力してください。

補足:
- ランチャーはバックグラウンドでNode.jsベースのローカルサーバーを起動し、`app/index.html` をブラウザで開きます（コンソールは非表示）。
- 既定ポートは 50000 です。変更したい場合は `launcher/StartChatBot.bat 50001` のように引数で指定できます。
- サーバーは自動ポート検出機能を備えており、指定ポートが使用中の場合は自動的に次の利用可能なポートを使用します。

## 停止方法

- **自動停止**（推奨）: すべてのブラウザを閉じると、25秒後にサーバーが自動停止します
- **手動停止**: 緊急時のみ `launcher/server/stop-server.ps1` を実行

⚠️ **重要**: ブラウザで直接 `app/index.html` を開いた場合、サーバーが起動していないためClaude APIが使用できません。必ず `ChatBot.lnk` または `StartChatBot.bat` 経由で起動してください。

ログ/診断:
- 起動ログ: `launcher/server/launch.log`
- サーバーPID: `launcher/server/server.pid`
- サーバー状態確認: `http://localhost:50000/health`

## ディレクトリ構成

```
ChatBot/
├─ ChatBot.lnk                # メインランチャー（クリックで起動）
├─ CreateLauncher.bat         # ランチャーショートカット作成
├─ app/                       # アプリ本体（静的ファイル）
│  ├─ index.html
│  ├─ main.js
│  ├─ css/
│  └─ js/
├─ launcher/                  # 起動・サーバー関連
│  ├─ StartChatBot.bat        # サイレント起動バッチ（引数でポート指定可）
│  └─ server/
│     ├─ server.js            # Node.jsサーバー（逆プロキシ/静的配信）
│     ├─ package.json         # Node.jsプロジェクト設定
│     ├─ launch.ps1           # サーバー起動・ブラウザ監視・自動停止
│     ├─ stop-server.ps1      # 停止スクリプト（PS）
│     ├─ StopServer.bat       # 停止スクリプト（BAT）
│     ├─ launch.log           # 起動ログ
│     └─ server.pid           # サーバーPID
├─ icon/                      # アイコン等
└─ doc/                       # ドキュメント
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

- ブラウザは Node.jsサーバー経由で `app/index.html` を開き、各APIへ直接/プロキシ経由で通信します。
- Claude（Anthropic）は同一オリジン制約回避のため、Node.jsサーバーが `/anthropic/v1/messages` をプロキシします。
- Node.jsサーバーがブラウザプロセスを監視し、すべて閉じられると自動停止します（PowerShellスクリプト不要）。

### サーバーの特徴

- **ブラウザ監視**: Windows環境でブラウザプロセスを5秒ごとに監視し、25秒間検出されなければ自動停止
- **自動ポート検出**: 指定ポートが使用中の場合、自動的に次の利用可能なポートを検出
- **グレースフルシャットダウン**: SIGINT/SIGTERMシグナルでの安全な停止
- **セキュリティ**: ディレクトリトラバーサル攻撃対策
- **エラーハンドリング**: 詳細なログ出力と適切なエラーレスポンス
- **拡張性**: モジュール化された設計により、機能追加が容易
- **ヘルスチェック**: `/health` エンドポイントでサーバー状態を確認可能

### 開発者向けオプション

手動でサーバーを起動する場合、以下のオプションが使用できます：

```bash
cd launcher\server

# 通常起動（ブラウザ監視あり）
node server.js --port=50000 --monitor-browser

# 開発モード（ブラウザ監視なし、サーバーは停止しません）
node server.js --port=50000 --no-monitor

# サーバー状態確認
curl http://localhost:50000/health
```

開発中は `--no-monitor` オプションを使用することで、ブラウザの開閉に関係なくサーバーを継続実行できます。

## プライバシー

- 会話や設定はブラウザのローカルストレージに保存され、APIキーは暗号化して保存されます。
- 入力した内容は選択したAPIプロバイダにのみ送信されます（添付ファイル含む）。
- クリアしたい場合は設定画面からキー/履歴を削除できます。

## トラブルシューティング

### よくある問題と解決方法

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