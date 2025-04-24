/**
 * confluenceService.js
 * Confluenceとの連携を担当するサービスクラス
 */

class ConfluenceService {
    static #instance = null;
    #pythonExecutor;
    #baseUrl;
    #username;
    #apiToken;
    #space;
    
    constructor() {
        if (ConfluenceService.#instance) {
            return ConfluenceService.#instance;
        }
        
        this.#pythonExecutor = PythonExecutor.getInstance;
        this.#baseUrl = '';
        this.#username = '';
        this.#apiToken = '';
        this.#space = '';
        
        ConfluenceService.#instance = this;
    }
    
    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ConfluenceService.#instance) {
            ConfluenceService.#instance = new ConfluenceService();
        }
        return ConfluenceService.#instance;
    }
    
    /**
     * Confluence APIの設定を行う
     * 
     * @param {Object} config - 設定オブジェクト
     * @param {string} config.baseUrl - ConfluenceのベースURL (例: https://yourcompany.atlassian.net/wiki)
     * @param {string} config.username - ユーザー名/メールアドレス
     * @param {string} config.apiToken - APIトークン
     * @param {string} config.space - スペースキー
     * @returns {boolean} - 設定が成功したかどうか
     */
    configure({ baseUrl, username, apiToken, space }) {
        if (!baseUrl || !username || !apiToken || !space) {
            console.error('Confluenceの設定に必要なパラメータが不足しています');
            return false;
        }
        
        this.#baseUrl = baseUrl;
        this.#username = username;
        this.#apiToken = apiToken;
        this.#space = space;
        
        return true;
    }
    
    /**
     * Confluenceの設定が完了しているか確認
     * @returns {boolean} - 設定が完了しているかどうか
     */
    isConfigured() {
        return Boolean(this.#baseUrl && this.#username && this.#apiToken && this.#space);
    }
    
    /**
     * Confluence内で検索を実行
     * 
     * @param {string} query - 検索クエリ
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} - 検索結果
     */
    async searchInConfluence(query, outputCallback) {
        if (!this.isConfigured()) {
            const error = {
                error: 'Confluenceが設定されていません。先に設定を完了してください。'
            };
            
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'error',
                    content: error.error
                });
            }
            
            return error;
        }
        
        const pythonCode = this.#generateConfluenceSearchCode(query);
        return await this.#pythonExecutor.execute(pythonCode, outputCallback);
    }
    
    /**
     * Confluenceページの内容を取得
     * 
     * @param {string} pageId - ページID
     * @param {Function} [outputCallback] - リアルタイム出力用コールバック関数
     * @returns {Promise<Object>} - ページ内容
     */
    async getPageContent(pageId, outputCallback) {
        if (!this.isConfigured()) {
            const error = {
                error: 'Confluenceが設定されていません。先に設定を完了してください。'
            };
            
            if (typeof outputCallback === 'function') {
                outputCallback({
                    type: 'error',
                    content: error.error
                });
            }
            
            return error;
        }
        
        const pythonCode = this.#generateGetPageContentCode(pageId);
        return await this.#pythonExecutor.execute(pythonCode, outputCallback);
    }
    
    /**
     * Confluence検索のためのPythonコードを生成
     * 
     * @param {string} query - 検索クエリ
     * @returns {string} - 実行用Pythonコード
     * @private
     */
    #generateConfluenceSearchCode(query) {
        return `
import requests
import json
import base64
import html
from bs4 import BeautifulSoup

# Confluence API設定
base_url = "${this.#baseUrl}"
username = "${this.#username}"
api_token = "${this.#apiToken}"
space_key = "${this.#space}"

# Basic認証ヘッダーの作成
auth_str = f"{username}:{api_token}"
auth_bytes = auth_str.encode('ascii')
auth_b64 = base64.b64encode(auth_bytes).decode('ascii')

headers = {
    'Authorization': f'Basic {auth_b64}',
    'Content-Type': 'application/json'
}

def search_confluence(query):
    """Confluenceで検索を実行する"""
    search_url = f"{base_url}/rest/api/content/search"
    
    # CQLクエリを構築 (Confluence Query Language)
    cql = f'space="{space_key}" AND text ~ "{query}"'
    
    params = {
        'cql': cql,
        'expand': 'body.view,space',
        'limit': 5  # 最大5件の検索結果を取得
    }
    
    try:
        response = requests.get(search_url, headers=headers, params=params)
        response.raise_for_status()
        
        result_data = response.json()
        
        if result_data['size'] == 0:
            print(f"「{query}」に関する情報は見つかりませんでした。")
            return None
        
        results = []
        for item in result_data['results']:
            title = item['title']
            page_id = item['id']
            url = f"{base_url}{item['_links']['webui']}"
            
            # HTML本文からテキストを抽出
            html_content = item['body']['view']['value']
            soup = BeautifulSoup(html_content, 'html.parser')
            text_content = soup.get_text()
            
            # 長い本文を要約（最初の300文字）
            summary = text_content[:300] + '...' if len(text_content) > 300 else text_content
            
            results.append({
                'title': title,
                'id': page_id,
                'url': url,
                'summary': summary
            })
        
        print(f"「{query}」に関する{len(results)}件の検索結果:")
        
        for i, item in enumerate(results):
            print(f"\\n--- 結果 {i+1} ---")
            print(f"タイトル: {item['title']}")
            print(f"URL: {item['url']}")
            print(f"要約: {item['summary']}")
        
        return {
            'query': query,
            'results': results
        }
    
    except requests.exceptions.RequestException as e:
        print(f"APIリクエストエラー: {str(e)}")
        return None
    except Exception as e:
        print(f"エラーが発生しました: {str(e)}")
        return None

# 検索実行
result = search_confluence("${query}")
print(json.dumps(result, ensure_ascii=False, indent=2))
`;
    }
    
    /**
     * ConfluenceページのHTMLコンテンツ取得のためのPythonコードを生成
     * 
     * @param {string} pageId - ページID
     * @returns {string} - 実行用Pythonコード
     * @private
     */
    #generateGetPageContentCode(pageId) {
        return `
import requests
import json
import base64
from bs4 import BeautifulSoup

# Confluence API設定
base_url = "${this.#baseUrl}"
username = "${this.#username}"
api_token = "${this.#apiToken}"

# Basic認証ヘッダーの作成
auth_str = f"{username}:{api_token}"
auth_bytes = auth_str.encode('ascii')
auth_b64 = base64.b64encode(auth_bytes).decode('ascii')

headers = {
    'Authorization': f'Basic {auth_b64}',
    'Content-Type': 'application/json'
}

def get_page_content(page_id):
    """指定したページIDのConfluenceページの内容を取得する"""
    content_url = f"{base_url}/rest/api/content/{page_id}"
    params = {
        'expand': 'body.view,space,version'
    }
    
    try:
        response = requests.get(content_url, headers=headers, params=params)
        response.raise_for_status()
        
        page_data = response.json()
        title = page_data['title']
        space_name = page_data['space']['name']
        version = page_data['version']['number']
        
        # HTML本文からテキストを抽出
        html_content = page_data['body']['view']['value']
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 画像やマクロを処理
        for macro in soup.select('.confluence-embedded-file-wrapper'):
            macro.replace_with('[添付ファイル]')
        
        for code in soup.select('pre'):
            # コードブロックは保持
            code['style'] = 'display: block; padding: 10px; background: #f5f5f5; border: 1px solid #ccc;'
        
        # 最終的なコンテンツ
        formatted_content = str(soup)
        
        print(f"タイトル: {title}")
        print(f"スペース: {space_name}")
        print(f"バージョン: {version}")
        print("\\n--- ページ内容 ---\\n")
        print(formatted_content)
        
        return {
            'id': page_id,
            'title': title,
            'space': space_name,
            'version': version,
            'htmlContent': formatted_content,
            'textContent': soup.get_text()
        }
    
    except requests.exceptions.RequestException as e:
        print(f"APIリクエストエラー: {str(e)}")
        return None
    except Exception as e:
        print(f"エラーが発生しました: {str(e)}")
        return None

# ページ内容取得
content = get_page_content("${pageId}")
print(json.dumps(content, ensure_ascii=False, indent=2))
`;    }
}
