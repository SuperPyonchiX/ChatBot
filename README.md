# ChatBot

ローカルで手軽に使える、複数AIプロバイダ対応のWebベース・チャットボットです。Node.js + Expressサーバーで動作し、面倒なセットアップなしで開始できます。

## 主な特徴

- 複数プロバイダ/モデル対応（OpenAI, Azure OpenAI, Claude, Gemini）
	- OpenAI: gpt-4o-mini, gpt-4o, gpt-5-mini, gpt-5, gpt-5.2
	- Claude: claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5
	- Gemini: gemini-3-pro-preview, gemini-2.5-pro, gemini-2.5-flash
- ストリーミング表示（SSE）と入力中アニメーション
- Web検索連携
	- OpenAI Responses API: gpt-5-mini / gpt-5 / gpt-5.2 で対応
	- Claude: 全対応モデルでツール呼び出しにより対応
- **RAG（知識ベース）**: ドキュメントをアップロードしてAIの回答に活用
	- ローカル埋め込み（Transformers.js）で外部API不要
	- 対応形式: PDF, Word, Excel, PowerPoint, テキスト
- マークダウン表示＋コードハイライト＋Mermaid図プレビュー（SVG保存/全画面表示）
- 添付ファイル（画像ほか）とプレビュー
- コード実行（JavaScript / TypeScript / Python[Pyodide] / C++[サーバーサイドg++] / HTML）
- **ツール呼び出し（Function Calling）**: 対応モデルなら、Web検索・URL取得・ナレッジ検索・コード実行・PowerPoint / Excel / 画像生成などを AI が必要に応じて自分で呼び出す。設定メニュー「ツール設定」で個別に ON/OFF、カスタムツールも追加できる
- **Codex 連携**: 入力欄の Codex トグルを ON にすると、OpenAI Codex CLI がサーバー側ワークスペースで実ファイルの作成・編集やコマンド実行を行う
- **アーティファクト**: 応答中の HTML / SVG / Mermaid / Markdown / Draw.io を右側パネルでプレビュー
- 各機能の操作は「[使い方ガイド](#使い方ガイド)」を参照
- チャット履歴の保存・管理、システムプロンプトのテンプレート化
	- サイドバーの会話一覧は更新日時でグループ化（今日 / 昨日 / 過去7日間 / 過去30日間 / それ以前）
	- `app/public/js/core/config.js` の `UI.SIDEBAR.GROUPING` を `'prompt'` にすると、
	  システムプロンプト単位のグループ表示に切り替わる
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

起動後、右上の設定アイコンからいつでも再設定できます（初回は自動表示）。

- OpenAI（公式）
	- APIキーを入力
	- モデル: gpt-4o-mini, gpt-4o, gpt-5-mini, gpt-5, gpt-5.2
- Azure OpenAI
	- APIキーを入力
	- 「Responses API エンドポイントURL（共通）」に `/openai/responses?api-version=2025-04-01-preview` まで含む完全なURLを入力。APIM経由のパス・クエリもそのまま使用する
	- 利用するモデルの「デプロイ名」を入力。本文の `model` にこの名前を送る（URLには追加しない）
	- 共通URLを設定すると、Web検索OFFでもResponses APIを利用する。認証は `api-key` ヘッダー
	- 共通URLが空なら「従来の Chat Completions 設定」のモデル別URLを使用する。RAG用エンドポイントは別設定
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
| サイドバー下 | ゴミ箱 | 履歴を一括削除 |
| サイドバー下 | 歯車 | 設定メニューを開く（下表） |
| 右上 | モデル選択 | 応答に使うモデル。ツールや Web 検索の可否はモデルで決まる |
| 入力欄左 | クリップ | 画像・テキスト・PDF などを添付 |
| 入力欄左 | 地球 | Web 検索の ON/OFF |
| 入力欄左 | ターミナル | Codex（ファイル作成・コマンド実行）の ON/OFF |

設定メニュー（歯車）の項目:

| 項目 | 内容 |
| --- | --- |
| システムプロンプト設定 | システムプロンプトをカテゴリ付きテンプレートとして保存・切替 |
| ユーザープロンプト管理 | 定型プロンプトの登録・タグ・お気に入り。入力欄で候補として出る |
| ナレッジベース (RAG) | 文書や Confluence を取り込み、回答に根拠として使う |
| ツール設定 | AI が呼び出せるツールの ON/OFF、往復回数、カスタムツールの作成 |
| ワークスペース (Codex) | Codex や AI が作った実ファイルの一覧・閲覧・ダウンロード |
| API設定 | 各プロバイダの API キー、Azure のエンドポイント、埋め込み用エンドポイント |

### 基本の使い方

入力欄に書いて送るだけ。ChatGPT と同じで、AI が必要だと判断すれば自分でツール（Web 検索、ナレッジ検索、コード実行、ファイル生成など）を呼び、その結果を踏まえて答える。ツールを使ったときは応答の上に「実行した処理を見る」が出て、何を呼んだか確認できる。

| やりたいこと | 操作 |
| --- | --- |
| 最新情報を踏まえて答えてほしい | 地球アイコンを ON（GPT-5 系 / Claude のみ）。OFF でも AI が必要と判断すれば `web_search` ツールで検索する |
| 手元の資料を根拠に答えてほしい | ナレッジベースに取り込み、RAG トグルを ON |
| PowerPoint / Excel / 画像を作ってほしい | 対応モデルを選んで普通に頼む（「5 枚のスライドで PowerPoint にして」） |
| 実ファイルを作らせたい、コマンドを実行させたい | ターミナルアイコン（Codex）を ON にして頼む |
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

設定メニューの「ツール設定」で、AI が呼び出せるツールを分類ごとに ON/OFF する。

| 分類 | ツール | 既定 |
| --- | --- | --- |
| ファイル生成 | `generate_powerpoint` `process_excel` `render_canvas` | ON |
| 情報取得 | `web_search` `url_fetch` `rag_search` | ON |
| 計算・実行 | `calculator` `code_execute` | ON |
| ワークスペース操作 | `codex_task`（Codex をサブエージェントとして起動）`file_write` `shell_execute` | **OFF**（ホスト OS に触るため、使うときだけ ON にする） |
| カスタムツール | ユーザーが作った JavaScript ツール | 作成時 ON |

「実行回数」は 1 回の送信でツールを往復させる上限。無限ループ防止用で、通常は変えなくてよい。

**カスタムツール**は「カスタムツールを作成」から作る。ツール名（`snake_case`）、説明（AI がいつ使うか判断する文）、パラメータ（JSON Schema）、実行コード（`params` を受け取る JavaScript）を入力し、テスト実行で確かめてから保存する。保存先はブラウザの IndexedDB。

### Codex（ファイル作成・コマンド実行）

入力欄のターミナルアイコンを ON にすると、送ったメッセージは AI のチャットではなく OpenAI Codex CLI に渡る。Codex はサーバー側の作業ディレクトリ `app/workspace/` で実ファイルの作成・編集やコマンド実行を自律的に行う。事前準備は「動作要件」の Codex の項を参照。

1. ターミナルアイコンを ON にする（点灯）
2. 依頼を送る。例: 「fizzbuzz.py を作って 1〜30 を出力するようにし、実行結果も確認して」
3. チャット内に Codex カードが出て、思考 💭・実行コマンド ⌨️・変更ファイル 📝・最終メッセージ 🤖 が逐次流れる。停止ボタンで中断できる
4. 完了するとカードの下部に「ワークスペースを開く」が出る。設定メニューの「ワークスペース (Codex)」からも開け、ファイルの内容表示とダウンロードができる
5. 同じ会話で続けて送ると前回のスレッドを引き継ぐ（Codex が文脈を覚えている）。新しいチャットにすると新規スレッド
6. 普通のチャットに戻すにはアイコンを OFF にする

トグル OFF のままでも、ツール設定で `codex_task` を ON にしておけば、AI が「これは Codex に任せるべき」と判断したときにサブエージェントとして Codex を呼ぶ。`file_write` / `shell_execute` は AI 自身がワークスペースに書き込み・コマンド実行する軽量な手段。

注意:
- `shell_execute` と Codex の `danger-full-access` はホスト OS 上でコマンドを実行する。ローカルの個人利用が前提。サーバー起動時に `WORKSPACE_EXEC_ENABLED=0` で `shell_execute` を止められる
- Codex の利用には ChatGPT アカウント（`npx codex login`）か OpenAI API キーが要る。API キー方式は従量課金

### ナレッジベース（RAG）

1. 設定メニューの「ナレッジベース (RAG)」を開く
2. 「RAG設定」で埋め込みモードを選ぶ。**ローカル**（Transformers.js、外部 API 不要。初回はモデルのダウンロードで待つ）、**OpenAI**、**Azure OpenAI**（API 設定に埋め込み用エンドポイントが必要）。チャンクサイズ・オーバーラップ・類似度閾値・取得件数もここ
3. 「ファイル」タブにドラッグ＆ドロップ、または「ファイルを選択」「フォルダを選択」で取り込む。PDF / Word / Excel / PowerPoint / テキスト / Markdown / CSV / JSON / 主要なソースコードに対応
4. Confluence から取り込むなら「Confluence」タブで URL と認証（Basic または PAT）→ 接続テスト → スペースを選び、ページツリーでチェックして「選択したページをインポート」
5. 上部の「RAG を有効にする」を ON にすると、以後の質問で関連チャンクが検索され、回答の根拠として使われる。取り込み済み文書は下部の一覧から個別に削除できる。RAG が OFF でも、AI が必要と判断すれば `rag_search` ツールでナレッジを引く

## 技術スタック

- フロントエンド: HTML5 / CSS3 / JavaScript (ES6+)
- バックエンド: Node.js + Express（HTTPサーバー、リバースプロキシ）
- マークダウン: Marked.js + Prism.js（構文ハイライト）
- 図表: Mermaid（CDNロード, プレビュー/エクスポート対応）
- コード実行: g++（C++、サーバーサイド）/ Pyodide（Python）/ ブラウザJS / HTML
- RAG: Transformers.js（ローカル埋め込み）+ IndexedDB（ベクトルストア）
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

最終更新: 2026年9月
