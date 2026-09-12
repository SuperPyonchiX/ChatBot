/**
 * calculatorTool.js
 * 数式計算ツール
 * 四則演算、関数計算、単位変換をサポート
 */

/**
 * @typedef {Object} CalculatorResult
 * @property {boolean} success - 成功したかどうか
 * @property {number|string} result - 計算結果
 * @property {string} expression - 元の式
 * @property {string} [error] - エラーメッセージ
 */

class CalculatorTool {
    static #instance = null;

    /** @type {string} */
    name = 'calculator';

    /** @type {string} */
    description = '数式を計算します。四則演算、関数（sin, cos, sqrt等）、単位変換に対応。';

    /** @type {Object} */
    parameters = {
        type: 'object',
        properties: {
            expression: {
                type: 'string',
                description: '計算する数式（例: "2 + 3 * 4", "sqrt(16)", "100 km to miles"）'
            }
        },
        required: ['expression']
    };

    /** @type {string[]} */
    keywords = ['計算', '算出', '求め', '足', '引', '掛', '割', 'calculate', 'compute', 'math', '変換', 'convert'];

    /** @type {Object} */
    #constants = {
        PI: Math.PI,
        E: Math.E,
        LN2: Math.LN2,
        LN10: Math.LN10,
        LOG2E: Math.LOG2E,
        LOG10E: Math.LOG10E,
        SQRT2: Math.SQRT2,
        SQRT1_2: Math.SQRT1_2
    };

    /** @type {Object} */
    #unitConversions = {
        // 長さ
        'km_to_miles': 0.621371,
        'miles_to_km': 1.60934,
        'm_to_feet': 3.28084,
        'feet_to_m': 0.3048,
        'cm_to_inch': 0.393701,
        'inch_to_cm': 2.54,
        // 重さ
        'kg_to_lbs': 2.20462,
        'lbs_to_kg': 0.453592,
        'g_to_oz': 0.035274,
        'oz_to_g': 28.3495,
        // 温度（特別処理）
        'celsius_to_fahrenheit': (c) => c * 9/5 + 32,
        'fahrenheit_to_celsius': (f) => (f - 32) * 5/9,
        'celsius_to_kelvin': (c) => c + 273.15,
        'kelvin_to_celsius': (k) => k - 273.15,
        // 容量
        'l_to_gal': 0.264172,
        'gal_to_l': 3.78541,
        'ml_to_floz': 0.033814,
        'floz_to_ml': 29.5735,
        // 面積
        'sqm_to_sqft': 10.7639,
        'sqft_to_sqm': 0.092903,
        // 速度
        'kmh_to_mph': 0.621371,
        'mph_to_kmh': 1.60934,
        // 時間
        'hours_to_minutes': 60,
        'minutes_to_hours': 1/60,
        'days_to_hours': 24,
        'hours_to_days': 1/24
    };

    /**
     * @constructor
     */
    constructor() {
        if (CalculatorTool.#instance) {
            return CalculatorTool.#instance;
        }
        CalculatorTool.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {CalculatorTool}
     */
    static get getInstance() {
        if (!CalculatorTool.#instance) {
            CalculatorTool.#instance = new CalculatorTool();
        }
        return CalculatorTool.#instance;
    }

    /**
     * ツールを実行
     * @param {Object} params - パラメータ
     * @param {string} params.expression - 計算式
     * @returns {Promise<CalculatorResult>}
     */
    async execute(params) {
        const { expression } = params;

        if (!expression || typeof expression !== 'string') {
            return {
                success: false,
                expression: expression || '',
                error: '計算式が指定されていません'
            };
        }

        try {
            // 単位変換をチェック
            const conversionResult = this.#tryUnitConversion(expression);
            if (conversionResult) {
                return conversionResult;
            }

            // 数式を評価
            const result = this.#evaluateExpression(expression);

            return {
                success: true,
                result: result,
                expression: expression
            };
        } catch (error) {
            console.error('[CalculatorTool] 計算エラー:', error);
            return {
                success: false,
                expression: expression,
                error: `計算エラー: ${error.message}`
            };
        }
    }

    /**
     * 単位変換を試みる
     * @param {string} expression
     * @returns {CalculatorResult|null}
     */
    #tryUnitConversion(expression) {
        // パターン: "100 km to miles" or "100km→miles"
        const conversionPattern = /^([\d.]+)\s*([a-zA-Z°]+)\s*(?:to|→|から|を)\s*([a-zA-Z°]+)$/i;
        const match = expression.match(conversionPattern);

        if (!match) return null;

        const value = parseFloat(match[1]);
        const fromUnit = this.#normalizeUnit(match[2]);
        const toUnit = this.#normalizeUnit(match[3]);

        const conversionKey = `${fromUnit}_to_${toUnit}`;
        const conversion = this.#unitConversions[conversionKey];

        if (!conversion) {
            return {
                success: false,
                expression: expression,
                error: `未対応の単位変換: ${fromUnit} → ${toUnit}`
            };
        }

        let result;
        if (typeof conversion === 'function') {
            result = conversion(value);
        } else {
            result = value * conversion;
        }

        return {
            success: true,
            result: `${value} ${fromUnit} = ${result.toFixed(4)} ${toUnit}`,
            expression: expression
        };
    }

    /**
     * 単位名を正規化
     * @param {string} unit
     * @returns {string}
     */
    #normalizeUnit(unit) {
        const unitMap = {
            'キロメートル': 'km', 'キロ': 'km', 'kilometer': 'km', 'kilometers': 'km',
            'マイル': 'miles', 'mile': 'miles',
            'メートル': 'm', 'meter': 'm', 'meters': 'm',
            'フィート': 'feet', 'foot': 'feet', 'ft': 'feet',
            'センチメートル': 'cm', 'センチ': 'cm', 'centimeter': 'cm',
            'インチ': 'inch', 'inches': 'inch', 'in': 'inch',
            'キログラム': 'kg', 'キロ': 'kg', 'kilogram': 'kg',
            'ポンド': 'lbs', 'pound': 'lbs', 'pounds': 'lbs', 'lb': 'lbs',
            'グラム': 'g', 'gram': 'g', 'grams': 'g',
            'オンス': 'oz', 'ounce': 'oz', 'ounces': 'oz',
            '摂氏': 'celsius', '°c': 'celsius', 'c': 'celsius',
            '華氏': 'fahrenheit', '°f': 'fahrenheit', 'f': 'fahrenheit',
            'ケルビン': 'kelvin', 'k': 'kelvin',
            'リットル': 'l', 'liter': 'l', 'liters': 'l',
            'ガロン': 'gal', 'gallon': 'gal', 'gallons': 'gal',
            'ミリリットル': 'ml', 'milliliter': 'ml',
            '平方メートル': 'sqm', 'sqm': 'sqm',
            '平方フィート': 'sqft', 'sqft': 'sqft',
            '時速キロ': 'kmh', 'km/h': 'kmh', 'kph': 'kmh',
            '時速マイル': 'mph', 'mi/h': 'mph',
            '時間': 'hours', 'hour': 'hours', 'h': 'hours',
            '分': 'minutes', 'minute': 'minutes', 'min': 'minutes',
            '日': 'days', 'day': 'days'
        };

        const lower = unit.toLowerCase();
        return unitMap[lower] || lower;
    }

    /**
     * 数式を評価
     * @param {string} expression
     * @returns {number}
     */
    #evaluateExpression(expression) {
        // 定数を置換
        let processed = expression;
        for (const [name, value] of Object.entries(this.#constants)) {
            processed = processed.replace(new RegExp(`\\b${name}\\b`, 'gi'), value.toString());
        }

        // 日本語の演算子を変換
        processed = processed
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/＋/g, '+')
            .replace(/－/g, '-')
            .replace(/（/g, '(')
            .replace(/）/g, ')')
            .replace(/\^/g, '**');

        // 関数を Math オブジェクトの関数に変換
        const mathFunctions = [
            'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
            'cbrt', 'ceil', 'cos', 'cosh', 'exp', 'expm1', 'floor', 'hypot',
            'log', 'log10', 'log1p', 'log2', 'max', 'min', 'pow', 'random',
            'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'trunc'
        ];

        for (const fn of mathFunctions) {
            processed = processed.replace(
                new RegExp(`\\b${fn}\\s*\\(`, 'gi'),
                `Math.${fn}(`
            );
        }

        // 安全性チェック: 許可された文字のみ
        const safePattern = /^[\d\s+\-*/.()Math,a-z]+$/i;
        if (!safePattern.test(processed)) {
            throw new Error('無効な文字が含まれています');
        }

        // 危険なパターンをチェック
        if (/\b(eval|function|constructor|prototype|__proto__|window|document|fetch|XMLHttpRequest)\b/i.test(processed)) {
            throw new Error('セキュリティ上の理由により、この式は評価できません');
        }

        // 評価
        const result = Function(`"use strict"; return (${processed})`)();

        if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error('計算結果が無効です');
        }

        return result;
    }

    /**
     * ツール定義を取得（Function Calling用）
     * @returns {Object}
     */
    getToolDefinition() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
}

// グローバルに公開
window.CalculatorTool = CalculatorTool;
