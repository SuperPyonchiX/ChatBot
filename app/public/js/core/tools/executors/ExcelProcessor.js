/**
 * ExcelProcessor.js
 * XLSX.jsを使用したExcel操作ツール
 * ワークブック作成、データ分析機能を提供
 */
class ExcelProcessor extends ToolExecutorBase {
    static #instance = null;

    constructor() {
        super();
        if (ExcelProcessor.#instance) {
            return ExcelProcessor.#instance;
        }
        ExcelProcessor.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!ExcelProcessor.#instance) {
            ExcelProcessor.#instance = new ExcelProcessor();
        }
        return ExcelProcessor.#instance;
    }

    /**
     * Excelを処理
     * @param {Object} params - パラメータ
     * @param {string} params.operation - 操作種類 ('create' | 'analyze')
     * @param {Object} params.data - データ
     * @param {string} params.filename - ファイル名
     * @returns {Promise<Object>} 結果
     */
    async execute(params) {
        this.validateParams(params, ['operation', 'data']);

        const { operation, data, filename = 'output.xlsx' } = params;

        switch (operation) {
            case 'create':
                return await this.#createWorkbook(data, filename);
            case 'analyze':
                return await this.#analyzeData(data);
            default:
                throw new Error(`未対応の操作: ${operation}。'create' または 'analyze' を指定してください。`);
        }
    }

    /**
     * ワークブックを作成
     * @param {Object} data - データ
     * @param {string} filename - ファイル名
     * @returns {Promise<Object>} ファイル結果
     */
    async #createWorkbook(data, filename) {
        // XLSX.jsの存在確認
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX.jsがロードされていません');
        }

        const wb = XLSX.utils.book_new();

        // シートデータを処理
        const sheets = data.sheets || [{ name: 'Sheet1', data: data.data || data }];

        for (const sheetData of sheets) {
            const sheetName = this.#sanitizeSheetName(sheetData.name || 'Sheet');
            const tableData = this.#normalizeTableData(sheetData.data || sheetData);

            if (!tableData || tableData.length === 0) {
                console.warn(`シート "${sheetName}" にデータがありません`);
                continue;
            }

            // ワークシートを作成
            const ws = XLSX.utils.aoa_to_sheet(tableData);

            // 列幅を自動調整
            ws['!cols'] = this.#calculateColumnWidths(tableData);

            // ヘッダースタイルの適用（XLSX.jsの制限内で）
            if (sheetData.headerStyle && tableData.length > 0) {
                this.#applyBasicFormatting(ws, tableData[0].length);
            }

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        // シートが1つもない場合はエラー
        if (wb.SheetNames.length === 0) {
            throw new Error('有効なシートデータがありません');
        }

        // BLOBを生成
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        // ファイル名を正規化
        let finalFilename = this.sanitizeFilename(filename);
        if (!finalFilename.endsWith('.xlsx')) {
            finalFilename += '.xlsx';
        }

        return this.createFileResult(
            blob,
            finalFilename,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
    }

    /**
     * データを分析
     * @param {Object} data - データ
     * @returns {Promise<Object>} 分析結果
     */
    async #analyzeData(data) {
        const tableData = this.#normalizeTableData(data.data || data);

        if (!tableData || tableData.length === 0) {
            return this.createJsonResult({
                error: 'データがありません',
                rowCount: 0,
                columnCount: 0
            });
        }

        const results = {
            rowCount: tableData.length,
            columnCount: tableData[0]?.length || 0,
            hasHeader: this.#detectHeader(tableData),
            columns: [],
            statistics: {}
        };

        // ヘッダー行を除いたデータ行
        const dataStartRow = results.hasHeader ? 1 : 0;
        const headers = results.hasHeader ? tableData[0] : [];

        // 各列を分析
        for (let col = 0; col < results.columnCount; col++) {
            const columnName = headers[col] || `Column${col + 1}`;
            const values = tableData.slice(dataStartRow).map(row => row[col]);

            const columnInfo = {
                name: columnName,
                index: col,
                type: this.#detectColumnType(values),
                nonEmptyCount: values.filter(v => v !== null && v !== undefined && v !== '').length,
                uniqueCount: new Set(values.filter(v => v !== null && v !== undefined && v !== '')).size
            };

            results.columns.push(columnInfo);

            // 数値列の場合は統計を計算
            if (columnInfo.type === 'number') {
                const numericValues = values
                    .map(v => parseFloat(v))
                    .filter(v => !isNaN(v));

                if (numericValues.length > 0) {
                    results.statistics[columnName] = {
                        count: numericValues.length,
                        sum: this.#round(numericValues.reduce((a, b) => a + b, 0)),
                        average: this.#round(numericValues.reduce((a, b) => a + b, 0) / numericValues.length),
                        min: Math.min(...numericValues),
                        max: Math.max(...numericValues),
                        range: this.#round(Math.max(...numericValues) - Math.min(...numericValues))
                    };

                    // 標準偏差
                    const avg = results.statistics[columnName].average;
                    const variance = numericValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / numericValues.length;
                    results.statistics[columnName].stdDev = this.#round(Math.sqrt(variance));
                }
            }
        }

        return this.createJsonResult(results);
    }

    /**
     * テーブルデータを正規化
     * @param {any} data - 入力データ
     * @returns {Array<Array>} 2次元配列
     */
    #normalizeTableData(data) {
        if (!data) return [];

        // すでに2次元配列の場合
        if (Array.isArray(data) && (data.length === 0 || Array.isArray(data[0]))) {
            return data;
        }

        // オブジェクトの配列の場合
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
            const keys = Object.keys(data[0]);
            const header = keys;
            const rows = data.map(obj => keys.map(key => obj[key]));
            return [header, ...rows];
        }

        // 1次元配列の場合（1行として扱う）
        if (Array.isArray(data)) {
            return [data];
        }

        // その他の場合
        return [];
    }

    /**
     * シート名をサニタイズ
     * @param {string} name - シート名
     * @returns {string} サニタイズされたシート名
     */
    #sanitizeSheetName(name) {
        // Excelのシート名制限: 31文字以下、特殊文字禁止
        return String(name)
            .replace(/[:\\/\\?\\*\\[\\]]/g, '_')
            .substring(0, 31) || 'Sheet';
    }

    /**
     * 列幅を計算
     * @param {Array<Array>} data - テーブルデータ
     * @returns {Array} 列幅情報
     */
    #calculateColumnWidths(data) {
        if (!data || data.length === 0) return [];

        const colCount = Math.max(...data.map(row => row?.length || 0));
        const widths = [];

        for (let col = 0; col < colCount; col++) {
            let maxWidth = 8; // 最小幅

            for (const row of data) {
                if (row && row[col] !== undefined && row[col] !== null) {
                    const cellValue = String(row[col]);
                    // 日本語文字は2倍幅として計算
                    const width = [...cellValue].reduce((sum, char) => {
                        return sum + (char.charCodeAt(0) > 255 ? 2 : 1);
                    }, 0);
                    maxWidth = Math.max(maxWidth, width);
                }
            }

            // 最大幅を制限
            widths.push({ wch: Math.min(maxWidth + 2, 50) });
        }

        return widths;
    }

    /**
     * 基本的なフォーマットを適用
     * @param {Object} ws - ワークシート
     * @param {number} colCount - 列数
     */
    #applyBasicFormatting(ws, colCount) {
        // XLSX.jsの無料版では限定的なスタイル適用のみ可能
        // ヘッダー行のセル参照を取得
        for (let col = 0; col < colCount; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
            if (ws[cellRef]) {
                // セルにコメントでヘッダーであることを示す（実際のスタイルは限定的）
                ws[cellRef].s = { font: { bold: true } };
            }
        }
    }

    /**
     * ヘッダー行を検出
     * @param {Array<Array>} data - テーブルデータ
     * @returns {boolean} ヘッダーがあるかどうか
     */
    #detectHeader(data) {
        if (data.length < 2) return false;

        const firstRow = data[0];
        const secondRow = data[1];

        // 1行目が全て文字列で、2行目に数値が含まれる場合はヘッダーと判定
        const firstRowAllStrings = firstRow.every(cell =>
            typeof cell === 'string' || cell === null || cell === undefined
        );
        const secondRowHasNumbers = secondRow.some(cell =>
            typeof cell === 'number' || !isNaN(parseFloat(cell))
        );

        return firstRowAllStrings && secondRowHasNumbers;
    }

    /**
     * 列の型を検出
     * @param {Array} values - 列の値配列
     * @returns {string} 型名
     */
    #detectColumnType(values) {
        const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');

        if (nonEmptyValues.length === 0) return 'empty';

        const numericCount = nonEmptyValues.filter(v => !isNaN(parseFloat(v))).length;
        const dateCount = nonEmptyValues.filter(v => this.#isDateString(v)).length;

        if (numericCount === nonEmptyValues.length) return 'number';
        if (dateCount > nonEmptyValues.length * 0.5) return 'date';
        return 'string';
    }

    /**
     * 日付文字列かどうか判定
     * @param {any} value - 値
     * @returns {boolean}
     */
    #isDateString(value) {
        if (typeof value !== 'string') return false;
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
            /^\d{4}\/\d{2}\/\d{2}$/,         // YYYY/MM/DD
            /^\d{2}\/\d{2}\/\d{4}$/,         // MM/DD/YYYY
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ // ISO形式
        ];
        return datePatterns.some(pattern => pattern.test(value));
    }

    /**
     * 数値を丸める
     * @param {number} num - 数値
     * @param {number} decimals - 小数点以下桁数
     * @returns {number} 丸められた数値
     */
    #round(num, decimals = 4) {
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
    }
}
