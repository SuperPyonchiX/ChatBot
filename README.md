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
- ブラウザ: 最新のChrome / Edge / Firefox / Brave のいずれか
- PowerShell 5.1 以降（同梱ランチャー・ローカルプロキシで使用）
- インターネット接続（各種API利用、Pyodide/外部ライブラリのCDN読込に必要）

## クイックスタート（推奨）

1) ルートにある `CreateLauncher.bat` を実行してショートカットを作成
2) 生成された `ChatBot.lnk` をダブルクリック

初回起動時にAPI設定モーダルが開きます。利用するプロバイダを選び、APIキー等を入力してください。

補足:
- ランチャーはバックグラウンドでローカルプロキシ（PowerShell HttpListener）を起動しつつ、`app/index.html` をローカルファイルとしてブラウザで開きます（コンソールは非表示）。
- 既定ポートは 50000 です。変更したい場合は `launcher/StartChatBot.bat 50001` のように引数で指定できます。

## 停止方法

- 自動停止: すべてのブラウザプロセスを閉じると、約10秒後にサーバーを自動停止します。
- 手動停止（いずれか）:
	- PowerShell: `launcher/server/stop-server.ps1`
	- バッチ: `launcher/server/StopServer.bat`
	- 強制停止: `launcher/server/kill-server-simple.ps1`

ログ/診断:
- 起動ログ: `launcher/server/launch.log`
- サーバーPID: `launcher/server/server.pid`

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
│     ├─ launch.ps1           # サーバー起動・ブラウザ監視・自動停止
│     ├─ ps_server.ps1        # 逆プロキシ/静的配信（PowerShell HttpListener）
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
- マークダウン: Marked.js + Prism.js（構文ハイライト）
- 図表: Mermaid（CDNロード, プレビュー/エクスポート対応）
- コード実行: JSCPP（C++）/ Pyodide（Python）/ ブラウザJS / HTML
- エディタ: Monaco Editor コントローラ
- 通信: fetch + SSE（ストリーミング）
- ローカルプロキシ: PowerShell HttpListener（Anthropicリバースプロキシ/静的配信）

## アーキテクチャ概略

- ブラウザは `file://` で `app/index.html` を開き、各APIへ直接/プロキシ経由で通信します。
- Claude（Anthropic）は同一オリジン制約回避のため、ローカルPowerShellサーバーが `/anthropic/v1/messages` をプロキシします。
- ランチャーはブラウザプロセスを監視し、すべて閉じられた場合にサーバーを自動停止します。

## プライバシー

- 会話や設定はブラウザのローカルストレージに保存され、APIキーは暗号化して保存されます。
- 入力した内容は選択したAPIプロバイダにのみ送信されます（添付ファイル含む）。
- クリアしたい場合は設定画面からキー/履歴を削除できます。

## トラブルシューティング

- ポート競合: `launcher/StartChatBot.bat <port>` で別ポートを指定してください（既定は 50000）。
- 起動ログの確認: `launcher/server/launch.log` を参照してください。
- スクリプト実行ポリシー: ランチャーは `-ExecutionPolicy Bypass` で起動します。セキュリティ製品によりブロックされる場合は許可設定をご検討ください。
- 停止できない/プロセスが残る: 手動停止スクリプト（上記）を実行してください。

---

最終更新: 2025年8月