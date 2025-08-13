# ChatBot Application

AI搭載のチャットボットアプリケーション

## 使用方法

### 初回セットアップ
1. `CreateSilentLauncher.bat` を実行してショートカットを作成
2. 作成された `ChatBot.lnk` をダブルクリックでアプリケーション起動

### 通常の使用
- **ChatBot.lnk** - メインランチャー（推奨）
- `launcher\StartChatBot.bat` - 直接実行（上級者向け）

## ディレクトリ構成

```
ChatBot/
├── ChatBot.lnk              # メインランチャー（ここをクリック！）
├── CreateSilentLauncher.bat # ショートカット作成用
├── app/                     # アプリケーションファイル
│   ├── index.html          # メインHTML
│   ├── main.js             # メインJavaScript
│   ├── css/                # スタイルシート
│   └── js/                 # JavaScriptモジュール
├── launcher/               # 起動関連ファイル
│   ├── StartChatBot.bat    # 起動スクリプト
│   └── server/             # ローカルサーバー
├── icon/                   # アイコンファイル
└── doc/                    # ドキュメント
```

## サーバー停止方法

### 自動停止
- ブラウザを閉じると10秒後に自動停止

### 手動停止
- `launcher\server\stop-server.ps1` - PowerShell版（推奨）
- `launcher\server\StopServer.bat` - バッチ版
- `launcher\server\kill-server-simple.ps1` - 強制停止版

## 特徴

- VBScriptを使用しない安全な設計
- コマンドプロンプト非表示でのサイレント起動
- 自動ブラウザ監視機能
- 複数のAPI対応（OpenAI, Claude, Gemini）

## システム要件

- Windows 10/11
- PowerShell 5.1以降
- モダンブラウザ（Chrome, Edge, Firefox推奨）
