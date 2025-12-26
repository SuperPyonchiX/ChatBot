# セットアップガイド

ChatBotアプリケーションのセットアップ手順を説明します。

## 前提条件

- **Node.js**: v14.0.0 以降
  - [公式サイト](https://nodejs.org/)からダウンロード・インストール
  - インストール確認: `node -v` でバージョンが表示されること

- **OS**: Windows 10/11（推奨）
  - 他のOSでも動作可能ですが、起動スクリプトはWindows専用

- **ブラウザ**: Chrome, Edge, Firefox, Brave のいずれか（最新版推奨）

## インストール手順

### 1. リポジトリのクローンまたはダウンロード

```bash
# Git を使用する場合
git clone <repository-url>
cd ChatBot

# ZIPでダウンロードした場合
# ダウンロードしたZIPを解凍してフォルダに移動
```

### 2. 依存パッケージのインストール

```bash
# launcher/server ディレクトリに移動
cd launcher\server

# 依存パッケージをインストール
npm install
```

これにより、以下のパッケージがインストールされます：
- `express` (^4.18.2): Webサーバーフレームワーク
- `http-proxy-middleware` (^2.0.6): プロキシミドルウェア
- `cors` (^2.8.5): CORS設定

### 3. サーバーの起動

#### 方法A: バッチファイルを使用（推奨）

```bash
# プロジェクトルートから
launcher\StartChatBot.bat
```

これにより、以下が自動的に実行されます：
1. Node.jsのインストール確認
2. 依存パッケージの確認（未インストールの場合は自動インストール）
3. サーバーの起動（ポート50000）
4. ブラウザで `http://localhost:50000` を開く

#### 方法B: 手動起動

```bash
# launcher/server ディレクトリから
cd launcher\server
node server.js --port=50000
```

その後、ブラウザで `http://localhost:50000` を開く

### 4. API設定

初回起動時、API設定モーダルが自動的に表示されます。

使用したいプロバイダのAPIキーを入力してください：

#### OpenAI API
1. [OpenAI API Keys](https://platform.openai.com/api-keys) にアクセス
2. 新しいAPIキーを作成
3. コピーしたキーを設定画面に入力

#### Claude API (Anthropic)
1. [Anthropic Console](https://console.anthropic.com/) にアクセス
2. APIキーを取得
3. コピーしたキーを設定画面に入力

#### Gemini API (Google)
1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. APIキーを作成
3. コピーしたキーを設定画面に入力

#### Azure OpenAI
1. Azureポータルから OpenAI リソースを作成
2. APIキーとエンドポイントを取得
3. 各モデルのデプロイメントエンドポイントURLを設定

## 初回起動後の確認

### サーバーが正常に起動していることを確認

コンソールに以下のような表示が出れば成功：

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           ChatBot ローカルプロキシサーバー起動             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

🌐 サーバーURL: http://localhost:50000
📁 アプリケーションパス: D:\...\ChatBot\app

🔄 プロキシエンドポイント:
   - OpenAI:    http://localhost:50000/openai/*
   - Responses: http://localhost:50000/responses/*
   - Claude:    http://localhost:50000/anthropic/*
   - Gemini:    http://localhost:50000/gemini/*
```

### ブラウザで正常に表示されることを確認

`http://localhost:50000` にアクセスして、ChatBotアプリケーションが表示されることを確認

### API通信の確認

1. 任意のメッセージを入力して送信
2. AI からの応答が表示されることを確認
3. エラーが発生した場合：
   - APIキーが正しく設定されているか確認
   - サーバーログを確認（コンソール出力）
   - ブラウザの開発者ツールでネットワークエラーを確認

## トラブルシューティング

### Node.jsがインストールされていない

**症状**: `'node' は、内部コマンドまたは外部コマンド...として認識されていません`

**解決策**:
1. [Node.js公式サイト](https://nodejs.org/)からインストーラーをダウンロード
2. インストーラーを実行してインストール
3. コマンドプロンプトを再起動
4. `node -v` でバージョンが表示されることを確認

### 依存パッケージのインストールエラー

**症状**: `npm install` でエラーが発生

**解決策**:
```bash
# npm のキャッシュをクリア
npm cache clean --force

# 再度インストール
npm install

# それでもダメな場合は、node_modules を削除して再インストール
rm -rf node_modules
npm install
```

### ポート競合エラー

**症状**: `Error: listen EADDRINUSE: address already in use :::50000`

**解決策**:

#### 方法1: 別のポートを使用
```bash
node server.js --port=50001
```

#### 方法2: 使用中のプロセスを終了
```bash
# Windowsの場合
netstat -ano | findstr :50000
taskkill /PID <PID番号> /F
```

### CORS エラー

**症状**: `Access to fetch at 'http://...' from origin 'file://' has been blocked by CORS policy`

**原因**: `file://` プロトコルで直接 `index.html` を開いている

**解決策**:
1. サーバー経由でアクセス: `http://localhost:50000`
2. `launcher\StartChatBot.bat` を使用して起動

### APIキーエラー

**症状**: `APIキーが設定されていません`

**解決策**:
1. 右上の設定アイコンをクリック
2. 使用するプロバイダのAPIキーを入力
3. 保存して再試行

## アンインストール

```bash
# 依存パッケージの削除
cd launcher\server
rm -rf node_modules

# アプリケーション全体の削除
cd ../..
# フォルダごと削除
```

## 次のステップ

- [README.md](../../README.md): アプリケーションの概要と使い方
- [DEVELOPMENT.md](./DEVELOPMENT.md): 開発者向けガイド（プロキシサーバーの仕組みなど）
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md): 開発ガイドライン

---

更新日: 2025年12月26日
