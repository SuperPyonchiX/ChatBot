# ChatBot アプリケーション設計仕様書

**作成日**: 2025年3月29日  
**バージョン**: 1.0  
**作成者**: ChatBot開発チーム

## 目次

1. [概要](#概要)
2. [システムアーキテクチャ](#システムアーキテクチャ)
3. [ファイル構造](#ファイル構造)
4. [モジュール詳細](#モジュール詳細)
5. [データモデル](#データモデル)
6. [UI設計](#ui設計)
7. [フローチャート](#フローチャート)
8. [シーケンス図](#シーケンス図)
9. [APIインターフェース](#apiインターフェース)
10. [セキュリティ考慮事項](#セキュリティ考慮事項)
11. [パフォーマンス最適化](#パフォーマンス最適化)
12. [テスト計画](#テスト計画)
13. [拡張計画](#拡張計画)

## 概要

ChatBotはAI搭載のWebベースチャットアプリケーションです。OpenAIのAPIとAzure OpenAI APIを活用して、ユーザーに高度な対話体験を提供します。マークダウン形式のメッセージ表示、コードハイライト、ファイル添付機能などを備えた多機能アプリケーションです。

### 主な機能

- 複数のAIモデル対応（gpt-4o-mini、gpt-4o、o1-mini、o1）
- OpenAI/Azure OpenAI API対応
- マークダウン・コードシンタックスハイライト対応
- チャット履歴管理（保存・復元・削除・名前変更）
- システムプロンプトのカスタマイズとテンプレート機能
- ファイル添付機能
- レスポンシブデザイン

## システムアーキテクチャ

ChatBotはクライアントサイドのみで動作するSPA（Single Page Application）として設計されています。すべてのデータ処理と状態管理はブラウザ内で行われ、外部との通信はOpenAI/Azure OpenAI APIのみです。

### アーキテクチャ概略図

```mermaid
graph TD
    Client[クライアント ブラウザ]
    LocalStorage[ローカルストレージ]
    OpenAI[OpenAI API]
    Azure[Azure OpenAI API]
    
    Client -- 設定/チャット履歴保存 --> LocalStorage
    Client -- 設定/チャット履歴読込 --> LocalStorage
    Client -- API呼び出し --> OpenAI
    Client -- API呼び出し --> Azure
    OpenAI -- レスポンス --> Client
    Azure -- レスポンス --> Client
```

## ファイル構造

ChatBotアプリケーションは以下のファイル構造で構成されています:

```
ChatBot/
│
├── index.html               # メインのHTMLファイル
├── main.js                  # アプリケーションのエントリーポイント
├── ChatBot_設計仕様書.md    # 本設計仕様書
├── README.md                # プロジェクト概要説明
│
├── css/                     # スタイルシート関連ファイル
│   ├── base.css             # 基本スタイル
│   ├── chat.css             # チャットUI用スタイル
│   ├── components.css       # コンポーネント用スタイル
│   ├── layout.css           # レイアウト用スタイル
│   └── markdown.css         # マークダウン表示用スタイル
│
├── icon/                    # アプリケーションで使用するアイコン類
│   └── ChatBot.png          # アプリケーションアイコン
│
└── js/                      # JavaScriptモジュール
    ├── api.js               # API通信用モジュール
    ├── chat.js              # チャット機能コア実装
    ├── config.js            # 設定管理
    ├── cryptoHelper.js      # 暗号化/復号化ユーティリティ
    ├── fileHandler.js       # ファイル添付機能実装
    ├── markdown.js          # マークダウン処理
    ├── storage.js           # ローカルストレージ操作
    └── ui.js                # UI操作関連
```

## モジュール詳細

各モジュールの詳細な役割と責任範囲を説明します。

### main.js

アプリケーションのエントリーポイントであり、初期化処理およびコアロジックを実装しています。

**主な責任**:
- アプリケーションの初期化処理
- イベントリスナーのセットアップ
- 会話管理（作成・切替・削除・名前変更）
- 他のモジュールの連携・調整

### js/api.js

APIとの通信を担当するモジュールです。

**主な責任**:
- OpenAI APIとの通信
- Azure OpenAI APIとの通信
- エラーハンドリング
- リクエスト/レスポンスの整形

### js/chat.js

チャット機能のコア実装を担当します。

**主な責任**:
- メッセージの送受信制御
- ユーザー/ボットメッセージの表示
- チャット履歴の表示管理
- チャットUI操作

### js/config.js

アプリケーション設定の管理を担当します。

**主な責任**:
- デフォルト設定値の定義
- 設定情報の構造定義

### js/fileHandler.js

ファイル添付機能の実装を担当します。

**主な責任**:
- ファイル選択UI操作
- ファイル処理（読込・変換）
- API送信用ファイルデータの生成

### js/markdown.js

マークダウンのレンダリングとコードハイライトを担当します。

**主な責任**:
- マークダウンテキストのHTML変換
- コードブロックの言語検出と適切なハイライト
- Prism.jsのダイナミックロード制御

### js/storage.js

ローカルストレージを使ったデータ永続化を担当します。

**主な責任**:
- API設定の保存/読込
- 会話履歴の保存/読込
- システムプロンプトの保存/読込
- プロンプトテンプレートの管理

### js/ui.js

UI操作およびモーダル管理を担当します。

**主な責任**:
- モーダルの表示/非表示制御
- UI要素の動的生成
- イベントハンドラ登録
- アニメーション・視覚効果

### js/cryptoHelper.js

機密情報の暗号化と復号化を担当するユーティリティモジュールです。

**主な責任**:
- APIキーなどのセンシティブ情報の暗号化
- 暗号化されたデータの復号化
- 暗号化状態の検出と管理

## データモデル

アプリケーションで使用される主要なデータ構造を定義します。

### 会話（Conversation）オブジェクト

```javascript
{
  id: "unique-id-string",               // 会話を一意に識別するID
  title: "会話のタイトル",              // 会話のタイトル
  systemPrompt: "AIへの指示プロンプト", // システムプロンプト
  messages: [                          // メッセージ配列
    {
      role: "user" | "assistant" | "system", // メッセージの送信者
      content: "メッセージ内容",            // テキスト内容
      timestamp: 1616161616161,             // タイムスタンプ
      attachments: [                        // 添付ファイル（ある場合）
        {
          type: "image/png",                // MIMEタイプ
          data: "base64エンコードデータ",   // ファイルデータ
          name: "ファイル名.png"            // ファイル名
        }
      ]
    }
  ],
  createdAt: 1616161616161,            // 会話作成タイムスタンプ
  updatedAt: 1616161616161             // 最終更新タイムスタンプ
}
```

### API設定オブジェクト

```javascript
{
  type: "openai" | "azure",           // API種類
  openaiApiKey: "sk-...",             // OpenAI APIキー
  azureApiKey: "...",                 // Azure APIキー
  azureEndpoints: {                   // Azureモデル別エンドポイント
    "gpt-4o-mini": "エンドポイントURL",
    "gpt-4o": "エンドポイントURL",
    "o1-mini": "エンドポイントURL",
    "o1": "エンドポイントURL"
  }
}
```

### プロンプトテンプレートオブジェクト

```javascript
{
  id: "unique-id-string",        // テンプレートID
  name: "テンプレート名",        // 表示名
  content: "プロンプト内容",     // プロンプト本文
  createdAt: 1616161616161      // 作成タイムスタンプ
}
```

## UI設計

ChatBotアプリケーションのUI構成をセクション別に解説します。

### メインレイアウト

```
+---------------------+--------------------------------+
|                     |                                |
|    サイドバー        |       メインチャットエリア      |
|  (チャット履歴)      |                                |
|                     |                                |
|                     |                                |
|                     |                                |
|                     |                                |
|                     |                                |
|                     |                                |
|                     |                                |
|                     |                                |
+---------------------+--------------------------------+
```

### UI構成要素

1. **サイドバー**
   - 新規チャットボタン
   - チャット履歴リスト
   - 設定ボタン
   - 履歴クリアボタン

2. **メインチャットエリア**
   - ヘッダー（タイトルとモデル選択）
   - メッセージ表示領域
   - 入力フォーム（テキスト入力、ファイル添付、送信ボタン）

3. **モーダルダイアログ**
   - API設定モーダル
   - システムプロンプト設定モーダル
   - チャット名変更モーダル

## フローチャート

### アプリケーション初期化フロー

```mermaid
flowchart TD
    A[DOMContentLoaded イベント発火] --> B[初期化関数 init 実行]
    B --> C{API設定が存在するか?}
    C -->|No| D[API設定モーダルを表示]
    C -->|Yes| E[会話履歴を読み込む]
    D --> E
    E --> F{会話履歴が存在するか?}
    F -->|Yes| G[会話履歴を表示]
    F -->|No| H[新しい会話を作成]
    G --> I[現在の会話をロード]
    H --> J[イベントリスナーのセットアップ]
    I --> J
    J --> K[モデル選択リストの初期化]
    K --> L[Markdownライブラリの初期化]
    M[Prism.jsコンポーネントの動的読み込み] --> N[UI要素の初期化]
    N --> O[アプリケーションの準備完了]
```

### メッセージ送信フロー

```mermaid
flowchart TD
    A[送信ボタンクリック/Enterキー] --> B[sendMessage関数呼び出し]
    B --> C[選択モデルの取得]
    C --> D[添付ファイルの取得]
    D --> E[添付ファイルのクリア]
    E --> F[Chat.sendMessage実行]
    F --> G[ユーザーメッセージを表示]
    G --> H[会話にユーザーメッセージを追加]
    H --> I{初めてのメッセージか?}
    I -->|Yes| J[チャットタイトルを更新]
    I -->|No| K[Thinking... 表示]
    J --> K
    K --> L[API種類に応じたAPI呼び出し]
    L --> M[Thinking... 表示を削除]
    M --> N[ボットの応答を表示]
    N --> O[応答をメッセージ履歴に追加]
    O --> P[会話を保存]
```

### チャット履歴管理フロー

```mermaid
flowchart TD
    A[チャット履歴の表示] --> B[会話をシステムプロンプトでグループ化]
    B --> C[各グループごとにカテゴリーセクションを作成]
    C --> D[カテゴリーごとに会話リストを表示]
    D --> E[各チャット項目にイベントリスナーを追加]
    E --> F[アクティブなチャットをハイライト表示]
    E --> G[各チャット項目に編集/削除ボタンを追加]
    
    H[新しいチャット作成] --> I[新しい会話オブジェクトを生成]
    I --> J[会話リストの先頭に追加]
    J --> K[会話を保存]
    K --> L[現在の会話IDを更新]
    L --> M[チャット履歴表示を更新]
    
    N[チャット削除] --> O{確認ダイアログ}
    O -->|Yes| P[チャットを削除]
    O -->|No| Q[キャンセル]
    P --> R{現在表示中のチャットか?}
    R -->|Yes| S{残りのチャットがあるか?}
    S -->|Yes| T[最初のチャットに切り替え]
    S -->|No| U[新しいチャットを作成]
    R -->|No| V[チャット履歴表示を更新]
    T --> V
    
    W[チャット名変更] --> X[チャット名変更モーダル表示]
    X --> Y[新しいチャット名を入力]
    Y --> Z[チャット名を更新]
    Z --> AA[会話を保存]
    AA --> AB[チャット履歴表示を更新]
```

### 設定管理フロー

```mermaid
flowchart TD
    A[設定ボタンクリック] --> B[設定メニュー表示]
    B --> C{選択されたメニュー}
    C -->|システムプロンプト設定| D[システムプロンプトモーダル表示]
    C -->|API設定| E[API設定モーダル表示]
    
    D --> F[プロンプトテンプレート一覧表示]
    F --> G{アクション選択}
    G -->|テンプレート選択| H[選択テンプレートを表示]
    G -->|テンプレート削除| I[テンプレート削除]
    G -->|保存| J[システムプロンプトを保存]
    G -->|新規テンプレート保存| K[新しいテンプレートを保存]
    G -->|キャンセル| L[モーダルを閉じる]
    
    E --> M{API種類選択}
    M -->|OpenAI| N[OpenAI設定フォーム表示]
    M -->|Azure| O[Azure設定フォーム表示]
    N --> P{アクション選択}
    O --> P
    P -->|保存| Q[API設定を保存]
    P -->|キャンセル| R[モーダルを閉じる]
    
    O --> S[モデルごとのエンドポイント設定]
    S --> T[gpt-4o-miniエンドポイント]
    S --> U[gpt-4oエンドポイント]
    S --> V[o1-miniエンドポイント]
    S --> W[o1エンドポイント]
```

## シーケンス図

### アプリケーション初期化シーケンス

```mermaid
sequenceDiagram
    participant Browser as ブラウザ
    participant Main as main.js
    participant Storage as storage.js
    participant UI as ui.js
    participant Chat as chat.js
    participant Markdown as markdown.js
    
    Browser->>Main: DOMContentLoaded
    activate Main
    Main->>Storage: loadApiSettings()
    Storage-->>Main: apiSettings
    Main->>Storage: loadSystemPrompt()
    Storage-->>Main: systemPrompt
    Main->>Storage: loadPromptTemplates()
    Storage-->>Main: promptTemplates
    
    Main->>UI: createSidebarToggle()
    Main->>UI: initializeModelSelect()
    
    Main->>Storage: loadConversations()
    Storage-->>Main: conversations
    Main->>Storage: loadCurrentConversationId()
    Storage-->>Main: currentConversationId
    
    alt 会話履歴が空の場合
        Main->>Main: createNewConversation()
    else 会話履歴がある場合
        Main->>Chat: displayConversation()
    end
    
    Main->>Markdown: loadPrismComponents()
    Markdown-->>Main: Prism.js読み込み完了
    Main->>Markdown: initializeMarkdown()
    
    Main->>Main: setupEventListeners()
    deactivate Main
```

### メッセージ送信シーケンス

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Main as main.js
    participant FileHandler as fileHandler.js
    participant Chat as chat.js
    participant API as api.js
    participant Storage as storage.js
    
    User->>Main: メッセージ送信ボタンクリック
    activate Main
    Main->>Main: 選択中のモデルを取得
    Main->>FileHandler: getAttachmentsForAPI()
    FileHandler-->>Main: attachments
    Main->>FileHandler: clearSelectedFiles()
    
    Main->>Chat: sendMessage(message, selectedModel, attachments)
    activate Chat
    Chat->>Chat: addUserMessage(message, attachments)
    Chat->>Chat: 会話にメッセージを追加
    
    alt OpenAI API使用時
        Chat->>API: callOpenAIAPI(messages, selectedModel)
    else Azure OpenAI API使用時
        Chat->>API: callAzureOpenAIAPI(messages, selectedModel, endpoint)
    end
    
    activate API
    API-->>Chat: botResponse
    deactivate API
    
    Chat->>Chat: addBotMessage()
    Chat-->>Main: {titleUpdated, response}
    deactivate Chat
    
    Main->>Storage: saveConversations()
    deactivate Main
```

### チャット履歴管理シーケンス

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Main as main.js
    participant Chat as chat.js
    participant UI as ui.js
    participant Storage as storage.js
    
    User->>Main: 新しいチャットボタンクリック
    activate Main
    Main->>Main: createNewConversation()
    Main->>Storage: saveConversations()
    Main->>Storage: saveCurrentConversationId()
    Main->>Chat: renderChatHistory()
    Main->>Chat: displayConversation()
    deactivate Main
    
    User->>Main: チャット履歴項目クリック
    activate Main
    Main->>Main: switchConversation()
    Main->>Storage: saveCurrentConversationId()
    Main->>Chat: updateActiveChatInHistory()
    Main->>Chat: displayConversation()
    deactivate Main
    
    User->>Main: チャット削除ボタンクリック
    activate Main
    Main->>Main: deleteConversation()
    Main->>Storage: saveConversations()
    alt 現在表示中のチャットを削除した場合
        Main->>Storage: saveCurrentConversationId()
        Main->>Chat: displayConversation()
    end
    Main->>Chat: renderChatHistory()
    deactivate Main
    
    User->>Main: チャット名変更アイコンクリック
    activate Main
    Main->>UI: showRenameChatModal()
    User->>Main: 新しいチャット名を入力して保存
    Main->>Main: renameChat()
    Main->>Storage: saveConversations()
    Main->>Chat: renderChatHistory()
    Main->>UI: hideRenameChatModal()
    deactivate Main
```

### 設定管理シーケンス

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Main as main.js
    participant UI as ui.js
    participant Storage as storage.js
    
    User->>Main: 設定ボタンクリック
    Main->>UI: 設定メニュー表示
    
    alt システムプロンプト設定
        User->>Main: システムプロンプト設定クリック
        Main->>UI: showSystemPromptModal()
        Main->>Main: loadPromptTemplates()
        User->>Main: プロンプト編集
        User->>Main: 保存ボタンクリック
        Main->>Storage: saveSystemPrompt()
        Main->>UI: hideSystemPromptModal()
    else API設定
        User->>Main: API設定クリック
        Main->>UI: showApiKeyModal()
        
        alt OpenAI選択時
            User->>Main: OpenAIラジオボタン選択
            Main->>UI: showOpenAiSettings()
            Main->>UI: hideAzureSettings()
            User->>Main: APIキー入力
        else Azure選択時
            User->>Main: Azureラジオボタン選択
            Main->>UI: hideOpenAiSettings()
            Main->>UI: showAzureSettings()
            User->>Main: APIキーと各モデルのエンドポイント入力
        end
        
        User->>Main: 保存ボタンクリック
        Main->>Storage: saveApiSettings()
        Main->>UI: hideApiKeyModal()
    end
```

## APIインターフェース

### OpenAI API

**エンドポイント**: `https://api.openai.com/v1/chat/completions`

**リクエスト形式**:
```javascript
{
  model: "gpt-4o-mini" | "gpt-4o" | "o1-mini" | "o1",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." },
    { role: "assistant", content: "..." },
    ...
  ],
  temperature: 0.7,
  max_tokens: 1000
}
```

### Azure OpenAI API

**エンドポイント**: 各モデルごとに異なる設定が必要

**リクエスト形式**:
```javascript
{
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." },
    { role: "assistant", content: "..." },
    ...
  ],
  temperature: 0.7,
  max_tokens: 1000
}
```

## セキュリティ考慮事項

1. **APIキーの保護**
   - APIキーおよびAzureエンドポイントURLはローカルストレージに暗号化して保存されます
   - 暗号化にはXORベースの暗号化とBase64エンコーディングを使用
   - 暗号化データは「ENC:」プレフィックスで識別され、自動的に復号化されます
   - 暗号化キーはデバイス固有情報とアプリケーション固有のソルトから生成

2. **データプライバシー**
   - すべての会話データはクライアント端末内のローカルストレージに保存
   - サーバーサイドにデータが送信されることはありません（OpenAI/Azure API以外）
   - 会話内容自体は暗号化されませんが、必要に応じて将来的に実装可能

3. **入力検証**
   - ユーザー入力は適切に検証・サニタイズする必要があります
   - 悪意あるスクリプトの挿入を防止するメカニズムを実装

## パフォーマンス最適化

1. **マークダウンレンダリング**
   - 長文レンダリング時のパフォーマンス対策
   - コードハイライト言語のオンデマンドロード

2. **会話履歴管理**
   - 会話履歴が肥大化した場合のページングや仮想スクロール

3. **ファイル添付**
   - 画像サイズの適切な圧縮・リサイズ
   - 大型ファイル処理時の非同期処理とプログレス表示

## 拡張計画

将来の拡張候補として以下の機能が検討されています：

1. **ローカルLLMサポート**
   - ローカルで実行可能なLLMモデルのサポート
   - オフライン動作モード

2. **ストリーミングレスポンス**
   - 回答をリアルタイムで表示するストリーミングモード
   - タイピングアニメーション

3. **プラグイン機能**
   - ウェブ検索、計算機能など拡張プラグインのサポート
   - カスタムプラグイン開発フレームワーク

4. **音声入出力**
   - 音声入力による会話
   - テキスト読み上げ機能
