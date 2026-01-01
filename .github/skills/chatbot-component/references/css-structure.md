# CSS構成ルール

## ファイル配置

```
app/public/css/
├── base/
│   ├── variables.css    # CSS変数定義
│   └── base.css         # 基本スタイル
├── layouts/
│   └── layout.css       # レイアウト
└── components/
    ├── buttons/         # ボタン
    ├── forms/           # フォーム
    ├── modals/          # モーダル
    ├── chat/            # チャット関連
    ├── code/            # コード表示/実行
    ├── prompt/          # プロンプト関連
    ├── settings/        # 設定
    ├── animations/      # アニメーション
    ├── file-preview/    # ファイルプレビュー
    └── notifications/   # 通知
```

## CSS変数一覧

### カラーパレット

```css
/* 背景色 */
--background-primary: #0a0e14;
--background-secondary: #0d1117;
--background-tertiary: #151b23;
--background-quaternary: #1c2430;
--background-sidebar: #070a0f;

/* テキスト色 */
--text-primary: #c9d1d9;
--text-secondary: #8b949e;
--text-tertiary: #6e7681;

/* アクセント色 */
--accent-color: #00d4aa;
--accent-hover-color: #00b894;
--error-color: #ff6b6b;
--success-color: #00ff88;

/* ボーダー */
--border-color: #21262d;
--border-color-hover: #30363d;
```

### スペーシング

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;
```

### 角丸

```css
--border-radius-sm: 4px;
--border-radius-md: 6px;
--border-radius-lg: 8px;
--border-radius-xl: 12px;
```

### アニメーション

```css
--transition-fast: 0.2s;
--transition-normal: 0.3s;
--transition-slow: 0.5s;
```

### フォントサイズ

```css
--font-size-xs: 0.75rem;
--font-size-sm: 0.85rem;
--font-size-md: 0.95rem;
--font-size-lg: 1.1rem;
--font-size-xl: 1.25rem;
```

## 命名規則（BEM）

```css
/* ブロック */
.component-name { }

/* エレメント */
.component-name__element { }

/* モディファイア */
.component-name--modifier { }
.component-name__element--modifier { }
```

## サイバー/テック風スタイル

```css
/* ネオングロー効果 */
--neon-glow-cyan: 0 0 5px #00ffff, 0 0 10px #00ffff, 0 0 20px #00ffff;
--neon-glow-magenta: 0 0 5px #ff00ff, 0 0 10px #ff00ff, 0 0 20px #ff00ff;

/* サイバーボーダー */
--cyber-border-color: rgba(0, 255, 255, 0.3);
--cyber-border-glow: 0 0 10px rgba(0, 255, 255, 0.5);
```

## モーダルスタイル

```css
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--modal-overlay-bg);
    z-index: 1000;
    align-items: center;
    justify-content: center;
}

.modal.active {
    display: flex;
}

.modal-content {
    background: var(--background-secondary);
    border-radius: var(--border-radius-lg);
    padding: var(--modal-content-padding);
    max-width: var(--modal-max-width-default);
    width: var(--modal-width);
    max-height: 90vh;
    overflow-y: auto;
}
```

## ボタンスタイル

```css
.button {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-md);
    background: var(--background-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.button:hover {
    background: var(--background-quaternary);
    border-color: var(--border-color-hover);
}

.button--primary {
    background: var(--accent-color);
    color: #000;
}
```
