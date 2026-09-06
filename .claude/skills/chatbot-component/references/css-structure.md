# CSS構成ルール

## ファイル配置

```
app/public/css/
├── base/
│   ├── variables.css        # CSS変数定義（正本）
│   └── base.css             # リセット・基本スタイル
├── layouts/
│   └── layout.css           # 全体レイアウト
├── components/
│   ├── agent/               # エージェントUI・設定モーダル
│   ├── animations/          # typing, system-messages
│   ├── artifact/            # アーティファクトパネル
│   ├── buttons/
│   ├── chat/                # chat, markdown, chat-category
│   ├── chatflow/            # チャットフロービルダー
│   ├── code/                # コード実行, Monaco
│   ├── file-preview/        # pdf, office, text
│   ├── forms/               # forms, claude-websearch
│   ├── modals/              # モーダル共通
│   ├── notifications/
│   ├── prompt/              # prompt-manager, prompt-suggestions
│   ├── rag/                 # knowledge-base, confluence-settings
│   ├── settings/            # settings-menu
│   └── workflow/            # ワークフロービルダー
└── tools.css                # チャットツールUI（例外的に css 直下）
```

新規ファイルは `components/{カテゴリ}/` に置く。`tools.css` は歴史的な例外なので真似しない。

## index.html への追加

`<head>` の `<!-- Components CSS -->` の並びに `<link>` を足す。順序は依存があるときだけ気にすればよい（後勝ち）。

```html
<link rel="stylesheet" href="css/components/chatflow/chatflow.css">
<link rel="stylesheet" href="css/components/{カテゴリ}/{名前}.css">   <!-- 追加 -->
<link rel="stylesheet" href="css/tools.css">
```

## CSS変数

値は `css/base/variables.css` が正本。ここに載せる値は代表例で、変更されていたら variables.css を優先する。

### 色

```css
--background-primary / --background-secondary / --background-tertiary / --background-quaternary / --background-sidebar
--text-primary / --text-secondary / --text-tertiary
--accent-color / --accent-hover-color
--error-color / --success-color
--border-color / --border-color-hover
--user-message-bg / --bot-message-bg
```

### 余白・角丸・影・フォント

```css
--spacing-xs ~ --spacing-xl
--border-radius-sm ~ --border-radius-xl
--shadow-sm / --shadow-md / --shadow-lg
--font-size-xs ~ --font-size-xl
--font-family-code
--transition-fast / --transition-normal / --transition-slow
```

### 部品固有

`--modal-*` `--artifact-*` `--form-*` `--button-*` `--code-*` `--pdf-*` `--office-*` `--prompt-*` `--spinner-*` などが variables.css に定義済み。新しい部品の固有値は同じ接頭辞方式で variables.css に追加してから使う。

### 注意

`tools.css` は `--bg-secondary` のような variables.css に無い別名を使っている箇所がある。新規コードでは variables.css にある名前だけを使う。

## 命名規則（BEM）

```css
.component-name { }                       /* ブロック */
.component-name__element { }              /* エレメント */
.component-name--modifier { }             /* モディファイア */
.component-name__element--modifier { }
```

## モーダルの骨格

`components/modals/modals.css` が共通を持つ。機能固有は別ファイルに分ける。

```css
.modal { display: none; position: fixed; inset: 0; background: var(--modal-overlay-bg); z-index: 1000; align-items: center; justify-content: center; }
.modal.active { display: flex; }
.modal-content { background: var(--background-secondary); border-radius: var(--border-radius-lg); padding: var(--modal-content-padding); max-width: var(--modal-max-width-default); width: var(--modal-width); max-height: 90vh; overflow-y: auto; }
```

## ボタンの骨格

```css
.button { padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--border-radius-md); background: var(--background-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); cursor: pointer; transition: all var(--transition-fast); }
.button:hover { background: var(--background-quaternary); border-color: var(--border-color-hover); }
.button--primary { background: var(--accent-color); color: #000; }
```
