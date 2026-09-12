# ChatBot

ローカルで手軽に使える、複数AIプロバイダ対応のWebベース・チャットボットです。Node.js + Expressサーバーで動作し、面倒なセットアップなしで開始できます。

## 主な特徴

- 複数プロバイダ/モデル対応（OpenAI, Azure OpenAI, Claude, Gemini）
	- OpenAI: gpt-4o-mini, gpt-4o, gpt-5-mini, gpt-5, gpt-5.2
	- Claude: claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5
	- Gemini: gemini-3-pro-preview, gemini-2.5-pro, gemini-2.5-flash
- ストリーミング表示（SSE）。応答待ちは細いリングと光が流れる「応答を準備中」を表示し、検索・ツール実行時には処理内容へ切り替わります。本文への切り替えと新着テキストは短いフェードでつなぎ、OSの「視差効果を減らす」設定にも対応します。
- Web検索連携
	- OpenAI Responses API: gpt-5-mini / gpt-5 / gpt-5.2 で対応
	- Claude: 全対応モデルでツール呼び出しにより対応
	- ローカル埋め込み（Transformers.js）で外部API不要
	- 対応形式: PDF, Word, Excel, PowerPoint, テキスト
- マークダウン表示＋コードハイライト＋Mermaid図プレビュー（SVG保存/全画面表示）
- 添付ファイル（画像ほか）とプレビュー
- コード実行（JavaScript / TypeScript / Python[Pyodide] / C++[サーバーサイドg++] / HTML）
- **ツール呼び出し（Function Calling）**: 対応モデルなら、Web検索・URL取得・コード実行・PowerPoint / Excel / 画像生成などを AI が必要に応じて自分で呼び出す。設定 → 高度な機能 → ツール設定で個別に ON/OFF、カスタムツールも追加できる
- **Codex 連携**: 入力欄の「＋」内の Codex トグルを ON にすると、OpenAI Codex CLI がサーバー側ワークスペースで実ファイルの作成・編集やコマンド実行を行う
- **アーティファクト**: 応答中の HTML / SVG / Mermaid / Markdown / Draw.io を右側パネルでプレビュー
- 各機能の操作は「[使い方ガイド](#使い方ガイド)」を参照
- チャット履歴の保存・検索、任意の回答カスタマイズ
	- サイドバーの会話一覧は更新日時でグループ化（今日 / 昨日 / 過去7日間 / 過去30日間 / それ以前）
- モバイル対応レスポンシブUI、MonacoベースのエディタUI
	- 本文は 768px 幅でセンタリング。ユーザーの発言は右寄せバブル、AIの返答は全幅表示
	- 768px 以下はサイドバーがドロワーになる（`UI.MOBILE_BREAKPOINT` と
	  `css/layouts/layout.css` の値を揃えること）

## 動作要件

- OS: Windows 10/11
- Node.js: v18.0.0 以降
- ブラウザ: 最新のChrome / Edge / Firefox / Brave のいずれか
- インターネット接続（各種API利用、Pyodide/外部ライブラリのCDN読込に必要）
- g++ (C++コード実行機能を使用する場合)
- Codex 連携を使う場合: `@openai/codex` は `npm install` で自動導入。認証は次のどちらか
	- ChatGPT アカウント: `cd app && npx codex login` を一度実行（ブラウザが開く）
	- OpenAI API キー: API設定に入力した OpenAI キーがそのまま Codex に渡る（従量課金）

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

初回はサイドバー下部の「設定」→「接続」→「AIのAPI設定」を開き、利用するプロバイダとAPIキーを設定してください。

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
│   │   ├── index.js              # サーバーエントリーポイント
│   │   └── codexRoutes.js        # Codex CLI 起動・ワークスペース API
│   ├── workspace/                # Codex / ツールの作業ディレクトリ（自動作成、git 管理外）
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

サイドバー下部の「設定」→「接続」→「AIのAPI設定」から変更できます。

- OpenAI（公式）
	- APIキーを入力
	- モデル: gpt-4o-mini, gpt-4o, gpt-5-mini, gpt-5, gpt-5.2
- Azure OpenAI
	- APIキーを入力
	- 「Responses API エンドポイントURL（共通）」に `/openai/responses?api-version=2025-04-01-preview` まで含む完全なURLを入力。APIM経由のパス・クエリもそのまま使用する
	- 利用するモデルの「デプロイ名」を入力。本文の `model` にこの名前を送る（URLには追加しない）
	- 共通URLを設定すると、Web検索OFFでもResponses APIを利用する。認証は `api-key` ヘッダー
	- 共通URLが空なら「従来の Chat Completions 設定」のモデル別URLを使用する
	- URL内の改行は除去するが、文字は置換しない。コピー元に `ı` などがある場合は実際のURLと照合する
- Claude（Anthropic）
	- APIキーを入力（通信はローカルプロキシ経由で `http://localhost:50000/anthropic/v1/messages` へ）
- Gemini（Google）
	- APIキーを入力

Web検索:
- OpenAI: Responses APIでWeb検索を利用可能（gpt-5-mini / gpt-5 / gpt-5.2）
- Claude: 全対応モデルでWeb検索ツールを利用可能

Codex 連携:
- 認証は「動作要件」の通り。API設定に OpenAI キーがあればそれを優先し、無ければ
  `codex login` で保存された認証を使う。トークン失効時（`refresh token was already used` 等）は
  `npx codex login` をやり直す
- サーバー側の環境変数で調整できる
	- `CODEX_WORKSPACE`: 作業ディレクトリ（既定 `app/workspace`）
	- `CODEX_MAX_PARALLEL`: 同時実行数（既定 3）
	- `CODEX_TIMEOUT_MS`: 1 実行のタイムアウト（既定 600000）
	- `WORKSPACE_EXEC_ENABLED=0`: `shell_execute` / `/api/workspace/exec` を無効化
- クライアント側は `app/public/js/core/config.js` の `CODEX`（サンドボックス、モデル、
  `EXTRA_CONFIG` で `-c key=value` の追加設定）
- 注意: `shell_execute` と Codex の `danger-full-access` はホスト OS 上でコマンドを実行する。
  ローカルの個人利用を前提にしている。Windows で `workspace-write` サンドボックスが動かない場合は
  `CODEX.EXTRA_CONFIG` に `windows.sandbox=unelevated` などを試す

## 使い方ガイド

### 画面の見方

| 場所 | 部品 | 役割 |
| --- | --- | --- |
| サイドバー | 新しいチャット | 会話を新規作成 |
| サイドバー | 検索欄 | 会話履歴を絞り込む |
| サイドバー | 会話一覧 | クリックで切替。各行から名前変更・削除 |
| サイドバー下 | 設定 | 設定画面を開く（下表） |
| ヘッダー | モデル選択 | 応答に使うモデル。ツールや Web 検索の可否はモデルで決まる |
| 入力欄左 | ＋ | ファイル添付、Web検索、Codexを選択 |

サイドバー下部の「設定」から開くカテゴリ:

| カテゴリ | 内容 |
| --- | --- |
| 回答のカスタマイズ | 口調や回答方針を任意で入力。保存後の次の通常チャット送信から反映。空欄なら既定の指示を使用 |
| 接続 | AIのAPI設定、Jira / Confluenceの社内情報連携 |
| 高度な機能 | ツールの有効・無効、往復回数、カスタムツール、Codexワークスペース |
| データ管理 | 確認ダイアログを伴う会話履歴の一括削除 |

詳細画面を閉じると設定へ戻る。Escと背景クリックでも閉じられる。回答指示の「既定に戻す」は入力欄を空にし、「保存」で反映する。「キャンセル」は未保存の編集を破棄する。

### 基本の使い方

入力欄に書いて送るだけ。ChatGPT と同じで、AI が必要だと判断すれば自分でツール（Web 検索、コード実行、ファイル生成など）を呼び、その結果を踏まえて答える。ツールを使ったときは応答の上に「実行した処理を見る」が出て、何を呼んだか確認できる。

| やりたいこと | 操作 |
| --- | --- |
| 最新情報を踏まえて答えてほしい | 「＋」→「Web検索」を ON（GPT-5 系 / Claude のみ）。OFF でも AI が必要と判断すれば `web_search` ツールで検索する |
| 手元の資料を根拠に答えてほしい | 入力欄の「＋」→「ファイルを添付」で資料を追加して質問する |
| PowerPoint / Excel / 画像を作ってほしい | 対応モデルを選んで普通に頼む（「5 枚のスライドで PowerPoint にして」） |
| 実ファイルを作らせたい、コマンドを実行させたい | 「＋」→「Codex」を ON にして頼む |
| AI に使わせたくないツールがある | ツール設定で OFF にする |

### 通常チャットの機能

- **ツール呼び出し**: 対応モデル（GPT-5 系、Claude 5 系 / haiku-4-5、Gemini 2.5 以降）では、AI がツールを呼ぶ → ここで実行 → 結果を AI に返す → 続きを生成、を必要なだけ繰り返す（上限はツール設定の「実行回数」、既定 8）。対応外のモデルではツールは渡されず普通のチャットになる
- **コード実行**: 応答内のコードブロック右上に、実行できる言語のときだけ「実行」ボタンが出る。JavaScript / TypeScript / HTML / Python（Pyodide）はブラウザ内、C++ はサーバーの g++ でコンパイルして実行する。「編集」で Monaco エディタが開き、そこからも実行できる
- **Mermaid**: ` ```mermaid ` のブロックはプレビュー / コード表示を切替でき、SVG 保存と全画面表示ができる
- **アーティファクト**: 応答に HTML / SVG / Mermaid / Markdown / Draw.io のコードブロックが含まれると右側にプレビューパネルが自動で開く（`config.js` の `ARTIFACT.AUTO_PREVIEW` で無効化可）。手動で開くにはコードブロックの「アーティファクトとして開く」ボタン。パネルではプレビュー / コードの切替、実行、編集、ダウンロードができる
- **ファイル生成**: 生成物はメッセージ内のダウンロードカードから取得でき、履歴を開き直しても 7 日間はカードが残る
	- 「新入社員研修の資料を 5 枚のスライドで PowerPoint にして」
	- 「この売上データを Excel にまとめて」「この表を分析して」
	- 「青いグラデーション背景に円と見出しを描いた PNG を作って」
- **添付ファイル**: 画像はそのままモデルに渡る。PDF / Office 文書はテキスト抽出してプロンプトに連結する。対応形式と上限は `config.js` の `FILE`

### ツール設定

設定 → 高度な機能 → ツール設定で、AI が呼び出せるツールを分類ごとに ON/OFF する。

| 分類 | ツール | 既定 |
| --- | --- | --- |
| ファイル生成 | `generate_powerpoint` `process_excel` `render_canvas` | ON |
| 情報取得 | `web_search` `url_fetch` `jira_search` `jira_get_issue` `confluence_search` `confluence_get_page` | ON |
| 計算・実行 | `calculator` `code_execute` | ON |
| ワークスペース操作 | `codex_task`（Codex をサブエージェントとして起動）`file_write` `shell_execute` | **OFF**（ホスト OS に触るため、使うときだけ ON にする） |
| カスタムツール | ユーザーが作った JavaScript ツール | 作成時 ON |

「実行回数」は 1 回の送信でツールを往復させる上限。無限ループ防止用で、通常は変えなくてよい。

**カスタムツール**は「カスタムツールを作成」から作る。ツール名（`snake_case`）、説明（AI がいつ使うか判断する文）、パラメータ（JSON Schema）、実行コード（`params` を受け取る JavaScript）を入力し、テスト実行で確かめてから保存する。保存先はブラウザの IndexedDB。

### Jira・Confluenceの検索と参照

設定 → 接続 → 社内情報連携に、Jira／ConfluenceのベースURLと認証情報を登録する。それぞれ1接続先に対応する。URLにコンテキストパスがある場合は、そのパスまで入力する（例: `https://your-server.example/confluence`）。課題・ページ個別のURLは接続設定に入力しない。

1. ID・パスワード、またはPersonal Access Tokenを入力する。
2. 「接続テスト」で確認し、「保存」を押す。接続に失敗した場合、以前の保存設定は変更しない。
3. ツール呼び出し対応モデルを選び、通常チャットで依頼する。CodexトグルはOFFにする。
4. 「このJira課題の状況を教えて」とURLを貼る、または「Confluenceで○○の設計資料を検索して」と入力する。

`/browse/TEST-123` と `/pages/viewpage.action?pageId=123` 形式のURLに対応する。Jiraの状態・説明・コメント・親子／関連課題、Confluenceの本文・表・コメント・Jiraマクロの参照情報を読み、AIが出典リンク付きで回答する。Jiraマクロの検索式は `jira_search` の `jql` 引数で検索できる。リンク先本文や検索の続きはAIが必要に応じて追加取得する。

取得した情報は**チャットで選択したAI**へ送られる。Azure限定の制約はなく、接続先とAIの組み合わせはユーザーが管理する。認証情報はツール定義・ツール結果には含めず、既存の暗号化保存処理を使用する。既存Confluenceの認証設定も共用する。

公開Web検索の設定は維持される。社内参照ツールの失敗時に公開検索へ自動フォールバックする処理は設けていないが、公開検索自体を強制的に禁止する機能ではない。社内情報だけで回答させる場合は、Web検索トグルと `web_search` ツールをOFFにする。

取得範囲は検索10件、本文2万文字、コメント最大20件。Confluenceコメントは最大500件を走査して新しい順に選ぶため、500件を超える場合は全体の最新20件とは限らない。結果には省略・未取得を表示する。1ツールの結果が4万文字を超える場合も省略する。制限値は `CONFIG.ENTERPRISE` で管理する。編集・投稿・添付ファイルの本文解析・ナレッジベースへの自動登録は行わない。

接続方式はJira REST API v2／Confluence REST API v1（Server／Data Center系）。API仕様は [Jiraの課題API](https://developer.atlassian.com/server/jira/platform/rest/v10005/api-group-issue/) と [Confluenceの子コンテンツAPI](https://developer.atlassian.com/server/confluence/rest/v9219/api-group-child-content/) を参照。実サーバーの互換性、SSO環境でのAPI認証可否は接続テストで確認する。ChatBotサーバー側に社内ネットワーク／VPNへの接続が必要。証明書エラーは社内CAの信頼設定を確認し、証明書検証は無効化しない。

開発時は `node Tools/Preview-Enterprise.cjs` で合成データだけを使う検証サーバーを起動できる。表示されたURLで設定画面を、`/enterprise-check` で検索・本文抽出を確認する。会社環境でJira課題とConfluenceページを各1件以上参照し、実画面と回答を照合して実接続を検証する。

### Codex（ファイル作成・コマンド実行）

入力欄の「＋」→「Codex」を ON にすると、送ったメッセージは AI のチャットではなく OpenAI Codex CLI に渡る。Codex はサーバー側の作業ディレクトリ `app/workspace/` で実ファイルの作成・編集やコマンド実行を自律的に行う。事前準備は「動作要件」の Codex の項を参照。

1. 入力欄の「＋」→「Codex」を ON にする（入力欄にCodexチップが表示される）
2. 依頼を送る。例: 「fizzbuzz.py を作って 1〜30 を出力するようにし、実行結果も確認して」
3. チャット内に Codex カードが出て、思考 💭・実行コマンド ⌨️・変更ファイル 📝・最終メッセージ 🤖 が逐次流れる。停止ボタンで中断できる
4. 完了するとカードの下部に「ワークスペースを開く」が出る。設定 → 高度な機能 → Codexワークスペースからも開け、ファイルの内容表示とダウンロードができる
5. 同じ会話で続けて送ると前回のスレッドを引き継ぐ（Codex が文脈を覚えている）。新しいチャットにすると新規スレッド
6. 普通のチャットに戻すにはアイコンを OFF にする

トグル OFF のままでも、ツール設定で `codex_task` を ON にしておけば、AI が「これは Codex に任せるべき」と判断したときにサブエージェントとして Codex を呼ぶ。`file_write` / `shell_execute` は AI 自身がワークスペースに書き込み・コマンド実行する軽量な手段。

注意:
- `shell_execute` と Codex の `danger-full-access` はホスト OS 上でコマンドを実行する。ローカルの個人利用が前提。サーバー起動時に `WORKSPACE_EXEC_ENABLED=0` で `shell_execute` を止められる
- Codex の利用には ChatGPT アカウント（`npx codex login`）か OpenAI API キーが要る。API キー方式は従量課金

### 資料と回答のカスタマイズ

資料は会話に添付して使う。登録済み資料を会話をまたいで横断検索する機能はない。ファイルの対応形式・容量制限は添付機能の設定に従う。

旧版のRAG、ユーザープロンプト管理、システムプロンプトのテンプレート管理は廃止。保存済みの資料と旧プロンプト集はブラウザ内に残すが、読み込み・検索・送信には使わない。現在有効な回答指示は「回答のカスタマイズ」へ引き継ぐ。既存会話のメッセージとRAG参照表示は保持する。Codexへの指示の適用範囲は従来どおり。

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
- 「設定」→「接続」→「AIのAPI設定」を開き、使用するプロバイダのAPIキーを入力してください
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

最終更新: 2026年9月

## 開発・エージェント共通運用

Claude / Codex の共通指示は [AGENTS.md](AGENTS.md) に記載しています。Claude は [CLAUDE.md](CLAUDE.md) から参照します。
プロジェクトスキルは `.agents/skills/` を編集し、次のコマンドで `.claude/skills/` に同期してください。両方を同じコミットに含めます。

```powershell
powershell -NoProfile -File Tools/Sync-AgentSkills.ps1
```

検証はリポジトリ直下で実行します。PowerShell 7 では `powershell` を `pwsh` に置き換えます。

```powershell
# 共通ハーネスと既存の Node.js テストをまとめて実行（Node.js 18 以上）
powershell -NoProfile -File Tools/Test-Repository.ps1

# 指示の入口・スキル構造・同期状態だけを検査
powershell -NoProfile -File Tools/Test-AgentHarness.ps1
```

アプリのテストは `tests/` にあります。UI や API の変更時はブラウザでも対象機能とコンソールエラーを確認してください。
`.claude/settings.local.json`、`.playwright-mcp/`、`ChatBot.lnk` は各環境のローカルファイルとして扱い、Git 管理から除外します。
