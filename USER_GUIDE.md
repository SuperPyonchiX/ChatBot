# ChatBot Application

AI搭載のチャットボットアプリケーション

## 使用方法

### 初回セットアップ
1. `CreateLauncher.bat` を実行してショートカットを作成
2. 作成された `ChatBot.lnk` をダブルクリックでアプリケーション起動

### 通常の使用
- **ChatBot.lnk** - メインランチャー（推奨）
- `launcher\StartChatBot.bat` - 直接実行（上級者向け）

## ディレクトリ構成

```
ChatBot/
├── ChatBot.lnk              # メインランチャー（ここをクリック！）
├── CreateLauncher.bat       # ショートカット作成用
├── app/                     # アプリケーションファイル
│   ├── index.html          # メインHTML
│   ├── main.js             # メインJavaScript
│   ├── css/                # スタイルシート
│   └── js/                 # JavaScriptモジュール
├── launcher/               # 起動関連ファイル
│   ├── StartChatBot.bat    # 起動スクリプト
│   └── server/             # ローカルサーバー
│       ├── server.js       # Node.jsサーバー
│       ├── package.json    # Node.js設定
│       ├── launch.ps1      # サーバー起動・監視スクリプト
│       └── stop-server.ps1 # サーバー停止スクリプト
├── icon/                   # アイコンファイル
└── doc/                    # ドキュメント
```

## サーバー停止方法

### 自動停止（推奨）
- ブラウザを閉じると10秒後に自動停止（Node.jsサーバーがブラウザプロセスを監視）

### 手動停止（緊急時）
- `launcher\server\stop-server.ps1` - 強制停止スクリプト

## 特徴

- VBScriptを使用しない安全な設計
- Node.jsベースの拡張性の高いサーバー
- コマンドプロンプト非表示でのサイレント起動
- 自動ブラウザ監視機能
- グレースフルシャットダウン対応
- 自動ポート検出機能
- 複数のAPI対応（OpenAI, Claude, Gemini）

## システム要件

- Windows 10/11
- Node.js v14.0.0以降
- PowerShell 5.1以降
- モダンブラウザ（Chrome, Edge, Firefox推奨）
