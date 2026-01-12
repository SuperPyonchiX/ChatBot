/**
 * toolSchemaConverter.js
 * 統一ツール定義を各APIプロバイダ形式に変換するモジュール
 * 対応プロバイダ: Claude, OpenAI (Chat Completions), OpenAI (Responses), Gemini
 */
class ToolSchemaConverter {
    static #instance = null;

    constructor() {
        if (ToolSchemaConverter.#instance) {
            return ToolSchemaConverter.#instance;
        }
        ToolSchemaConverter.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ToolSchemaConverter.#instance) {
            ToolSchemaConverter.#instance = new ToolSchemaConverter();
        }
        return ToolSchemaConverter.#instance;
    }

    /**
     * ツール定義をプロバイダ形式に変換
     * @param {Array} tools - 統一形式のツール定義配列
     * @param {string} provider - プロバイダ名 ('claude', 'openai', 'openai-responses', 'gemini')
     * @returns {Array|Object} プロバイダ形式のツール定義
     */
    convert(tools, provider) {
        if (!tools || tools.length === 0) {
            return [];
        }

        switch (provider) {
            case 'claude':
                return this.#toClaudeFormat(tools);
            case 'openai':
                return this.#toOpenAIFormat(tools);
            case 'openai-responses':
                return this.#toResponsesFormat(tools);
            case 'gemini':
                return this.#toGeminiFormat(tools);
            default:
                console.warn(`未対応のプロバイダ: ${provider}`);
                return [];
        }
    }

    /**
     * Claude API形式に変換
     * @param {Array} tools - ツール定義配列
     * @returns {Array} Claude形式のツール定義
     */
    #toClaudeFormat(tools) {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: this.#ensureValidSchema(tool.parameters)
        }));
    }

    /**
     * OpenAI Chat Completions API形式に変換
     * @param {Array} tools - ツール定義配列
     * @returns {Array} OpenAI形式のツール定義
     */
    #toOpenAIFormat(tools) {
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: this.#ensureValidSchema(tool.parameters)
            }
        }));
    }

    /**
     * OpenAI Responses API形式に変換
     * @param {Array} tools - ツール定義配列
     * @returns {Array} Responses API形式のツール定義
     */
    #toResponsesFormat(tools) {
        return tools.map(tool => ({
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: this.#ensureValidSchema(tool.parameters)
        }));
    }

    /**
     * Gemini API形式に変換
     * @param {Array} tools - ツール定義配列
     * @returns {Array} Gemini形式のツール定義（functionDeclarationsを含む）
     */
    #toGeminiFormat(tools) {
        return [{
            functionDeclarations: tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                parameters: this.#convertToGeminiSchema(tool.parameters)
            }))
        }];
    }

    /**
     * JSONスキーマが有効であることを確認
     * @param {Object} schema - パラメータスキーマ
     * @returns {Object} 正規化されたスキーマ
     */
    #ensureValidSchema(schema) {
        if (!schema || typeof schema !== 'object') {
            return {
                type: 'object',
                properties: {},
                required: []
            };
        }

        return {
            type: schema.type || 'object',
            properties: schema.properties || {},
            required: schema.required || [],
            ...(schema.additionalProperties !== undefined && { additionalProperties: schema.additionalProperties })
        };
    }

    /**
     * Gemini用のスキーマ形式に変換
     * Geminiは一部のJSONスキーマ機能をサポートしていないため変換が必要
     * @param {Object} schema - パラメータスキーマ
     * @returns {Object} Gemini形式のスキーマ
     */
    #convertToGeminiSchema(schema) {
        if (!schema || typeof schema !== 'object') {
            return { type: 'OBJECT', properties: {} };
        }

        const geminiSchema = {
            type: this.#toGeminiType(schema.type),
            properties: {}
        };

        if (schema.properties) {
            for (const [key, value] of Object.entries(schema.properties)) {
                geminiSchema.properties[key] = this.#convertPropertyToGemini(value);
            }
        }

        if (schema.required && schema.required.length > 0) {
            geminiSchema.required = schema.required;
        }

        return geminiSchema;
    }

    /**
     * プロパティをGemini形式に変換
     * @param {Object} prop - プロパティ定義
     * @returns {Object} Gemini形式のプロパティ
     */
    #convertPropertyToGemini(prop) {
        const result = {
            type: this.#toGeminiType(prop.type)
        };

        if (prop.description) {
            result.description = prop.description;
        }

        if (prop.enum) {
            result.enum = prop.enum;
        }

        if (prop.type === 'array' && prop.items) {
            result.items = this.#convertPropertyToGemini(prop.items);
        }

        if (prop.type === 'object' && prop.properties) {
            result.properties = {};
            for (const [key, value] of Object.entries(prop.properties)) {
                result.properties[key] = this.#convertPropertyToGemini(value);
            }
            if (prop.required) {
                result.required = prop.required;
            }
        }

        return result;
    }

    /**
     * JSONスキーマの型をGemini型に変換
     * @param {string} type - JSONスキーマの型
     * @returns {string} Geminiの型
     */
    #toGeminiType(type) {
        const typeMap = {
            'string': 'STRING',
            'number': 'NUMBER',
            'integer': 'INTEGER',
            'boolean': 'BOOLEAN',
            'array': 'ARRAY',
            'object': 'OBJECT'
        };
        return typeMap[type] || 'STRING';
    }

    /**
     * ツール呼び出し結果をプロバイダ形式に変換
     * @param {Object} toolCall - ツール呼び出し情報
     * @param {Object} result - 実行結果
     * @param {string} provider - プロバイダ名
     * @returns {Object} プロバイダ形式の結果メッセージ
     */
    formatToolResult(toolCall, result, provider) {
        const content = typeof result === 'string' ? result : JSON.stringify(result);

        switch (provider) {
            case 'claude':
                return {
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: content
                };
            case 'openai':
                return {
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: content
                };
            case 'openai-responses':
                return {
                    type: 'function_call_output',
                    call_id: toolCall.id,
                    output: content
                };
            case 'gemini':
                return {
                    functionResponse: {
                        name: toolCall.name,
                        response: typeof result === 'object' ? result : { result: result }
                    }
                };
            default:
                return { content: content };
        }
    }

    /**
     * ツール呼び出しエラーをプロバイダ形式に変換
     * @param {Object} toolCall - ツール呼び出し情報
     * @param {Error} error - エラーオブジェクト
     * @param {string} provider - プロバイダ名
     * @returns {Object} プロバイダ形式のエラーメッセージ
     */
    formatToolError(toolCall, error, provider) {
        const errorMessage = `ツール実行エラー: ${error.message || 'Unknown error'}`;

        switch (provider) {
            case 'claude':
                return {
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: errorMessage,
                    is_error: true
                };
            case 'openai':
                return {
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: errorMessage
                };
            case 'openai-responses':
                return {
                    type: 'function_call_output',
                    call_id: toolCall.id,
                    output: errorMessage
                };
            case 'gemini':
                return {
                    functionResponse: {
                        name: toolCall.name,
                        response: { error: errorMessage }
                    }
                };
            default:
                return { content: errorMessage };
        }
    }
}
