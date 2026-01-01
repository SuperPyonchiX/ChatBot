# 開発ワークフロー

## サーバー起動

```bash
cd app
npm start
# または
scripts\StartChatBot.bat
```

デフォルトURL: `http://localhost:50000`

## 新機能開発フロー

### 1. 事前調査

1. 関連する既存ファイルを確認
2. 使用するパターンを特定
3. 影響範囲を把握

### 2. 実装

1. 既存パターンに従ってクラス/メソッドを作成
2. 適切なディレクトリに配置
3. 必要に応じてHTML/CSSを更新

### 3. 統合

1. `index.html`にscriptタグを追加（必要な場合）
2. 依存関係の順序を確認
3. 動作確認

## ファイル配置ルール

| 種別 | 配置先 |
|------|--------|
| コア機能 | `app/public/js/core/` |
| UIコンポーネント | `app/public/js/components/{機能名}/` |
| モーダル | `app/public/js/modals/{機能名}/` |
| ユーティリティ | `app/public/js/utils/` |
| スタイル | `app/public/css/components/{カテゴリ}/` |

## デバッグ

ブラウザの開発者ツールを使用。コンソールログにはプレフィックスを付ける：

```javascript
console.log('[ChatUI] エディタをリサイズします');
console.error('[C++] コンパイルエラー:', error);
```

## APIプロキシ

ブラウザからの直接API呼び出しはCORSエラーになるため、Node.jsサーバー経由：

| API | プロキシパス |
|-----|-------------|
| OpenAI | `/openai/v1/chat/completions` |
| Claude | `/anthropic/v1/messages` |
| Gemini | `/gemini/v1beta/models` |
| Responses | `/responses/v1/responses` |

## 依存パッケージ（最小構成）

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6",
    "cors": "^2.8.5"
  }
}
```

## シングルトンパターン

すべてのクラスはシングルトンで実装：

```javascript
// インスタンス取得
const instance = ClassName.getInstance;

// メソッド呼び出し
ClassName.getInstance.someMethod();
```

## 新規クラス作成時のチェックリスト

1. [ ] シングルトンパターンで実装
2. [ ] JSDocコメントを記載
3. [ ] エラーハンドリングを追加
4. [ ] 設定値はwindow.CONFIGから取得
5. [ ] プライベートメソッドは`#`を使用
6. [ ] index.htmlにscriptタグを追加
