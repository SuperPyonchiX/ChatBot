# ChatBot

AIを活用したインタラクティブなWebベースチャットボットアプリケーションです。OpenAIのAPIを利用して、自然な会話体験を提供します。

## 機能

- 複数のAIモデル対応（gpt-4o-mini、gpt-4o、o1-mini、o1）
- OpenAIとAzure OpenAI APIの両方をサポート
- マークダウン形式のメッセージ表示（コードハイライト機能付き）
- チャット履歴の保存と管理
- システムプロンプトのカスタマイズとテンプレート機能
- ファイル添付機能
- コード実行機能（JavaScript、Python、C++、HTML）
- ストリーミングレスポンス表示
- モバイル対応レスポンシブデザイン

## インストール方法

1. このリポジトリをクローンするか、ZIPファイルとしてダウンロードします。
```
git clone https://github.com/yourusername/ChatBot.git
```

2. Webサーバー上にファイルを配置するか、ローカル環境で実行します。
- ローカルでの実行には、VS Codeの「Live Server」拡張機能などが便利です。

## 使用方法

1. `index.html` をブラウザで開きます。
2. 初回起動時にOpenAI APIキーまたはAzure OpenAI API設定を入力します。
3. 希望するAIモデルを選択します。
4. メッセージを入力して送信すると、AIからの応答が表示されます。
5. 必要に応じてファイルを添付することもできます。
6. AIが返信したコードブロックには「実行」ボタンがあり、サポートされている言語（JavaScript、Python、C++、HTML）のコードをブラウザ上で直接実行できます。
7. 「新しいチャット」ボタンで新しい会話を開始できます。

## API設定

### OpenAI API

1. [OpenAIのウェブサイト](https://platform.openai.com/)からアカウントを作成します。
2. APIキーを取得します。
3. アプリ起動時またはAPI設定から、OpenAIを選択してAPIキーを入力します。

### Azure OpenAI API

1. Azureポータルで[Azure OpenAI Service](https://azure.microsoft.com/ja-jp/services/cognitive-services/openai-service/)のリソースを作成します。
2. APIキーとエンドポイントを取得します。
3. アプリ起動時またはAPI設定から、Azureを選択してAPIキーと各モデルのエンドポイントを入力します。

## 技術スタック

- HTML5, CSS3, JavaScript (ES6+)
- [Marked.js](https://marked.js.org/) - マークダウンパーサー
- [Prism.js](https://prismjs.com/) - コードハイライト
- [Font Awesome](https://fontawesome.com/) - アイコン
- [JSCPP](https://github.com/felixhao28/JSCPP) - C++コード実行
- [Pyodide](https://pyodide.org/) - Pythonコード実行
- OpenAI API / Azure OpenAI API

## カスタマイズ

### システムプロンプト

設定メニューから「システムプロンプト設定」を選択して、AIの応答スタイルや性格をカスタマイズできます。テンプレートとして保存して再利用することも可能です。

### プロンプトテンプレート管理

プロンプト管理機能を使って、よく使うシステムプロンプトをカテゴリごとに整理して保存できます。カテゴリごとにプロンプトを分類し、効率的に管理できます。

### スタイル変更

`css`フォルダ内のCSSファイルを編集することで、アプリケーションの外観をカスタマイズできます。ダークモードとライトモードの切り替えにも対応しています。

## プライバシーについて

このアプリケーションはローカルでデータを保存し、入力されたメッセージはOpenAIまたはAzure OpenAIにのみ送信されます。APIキーやチャット履歴はご使用のブラウザのローカルストレージに保存されます。APIキーは暗号化して保存されます。

---

作成：2025年4月