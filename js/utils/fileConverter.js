/**
 * fileConverter.js
 * ファイル変換機能を提供します
 * @class FileConverter
 */
class FileConverter {
    static #instance = null;

    /**
     * シングルトンインスタンスを取得します
     * @returns {FileConverter} FileConverterのインスタンス
     */
    static get getInstance() {
        if (!FileConverter.#instance) {
            FileConverter.#instance = new FileConverter();
        }
        return FileConverter.#instance;
    }

    /**
     * コンストラクタ - privateなので直接newはできません
     */
    constructor() {
        if (FileConverter.#instance) {
            throw new Error('FileConverterクラスは直接インスタンス化できません。getInstance()を使用してください。');
        }
    }

    /**
     * ファイルを添付ファイル形式に変換します
     * @param {File[]} files - 変換するファイルの配列
     * @returns {Promise<Array>} 変換された添付ファイルの配列
     */
    convertFilesToAttachments(files) {
        if (!files || !Array.isArray(files)) {
            return Promise.resolve([]);
        }
        
        return Promise.all(files.map(file => this.#convertFileToAttachment(file)));
    }

    /**
     * プライベートメソッドはそのまま移行
     */
    async #convertFileToAttachment(file) {
        try {
            if (!file) {
                throw new Error('有効なファイルが指定されていません');
            }
            
            // 画像ファイルの場合
            if (file.type.startsWith('image/')) {
                const dataUrl = await FileReaderUtil.getInstance.readFileAsDataURL(file);
                return {
                    type: 'image',
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    data: dataUrl
                };
            } 
            // PDFファイルの場合
            else if (file.type === 'application/pdf') {
                const dataUrl = await FileReaderUtil.getInstance.readFileAsDataURL(file);
                const extractedText = await this.#extractTextFromPDF(file);
                
                return {
                    type: 'pdf',
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    data: dataUrl,
                    content: extractedText
                };
            }
            // Office関連ファイルの場合
            else if (this.#isOfficeFile(file.type)) {
                const dataUrl = await FileReaderUtil.getInstance.readFileAsDataURL(file);
                const extractedText = await this.#extractTextFromOfficeFile(file);
                const extractedImages = await this.#extractImagesFromOfficeFile(file);
                
                return {
                    type: 'office',
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    data: dataUrl,
                    content: extractedText,
                    images: extractedImages
                };
            }
            // その他のファイルの場合
            else {
                const dataUrl = await FileReaderUtil.getInstance.readFileAsDataURL(file);
                const textContent = await this.#readFileAsText(file);
                let extractedText = `=== ${file.type}ファイル「${file.name}」の内容 ===\n\n`;
                extractedText += textContent;
                
                return {
                    type: 'file',
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    data: dataUrl,
                    content: extractedText
                };
            }
        } catch (error) {
            console.error('ファイル変換エラー:', error);
            return {
                type: 'error',
                name: file ? file.name : 'unknown',
                error: error.message
            };
        }
    }

    #isOfficeFile(mimeType) {
        if (!mimeType) return false;
        const fileTypeMap = window.CONFIG.FILE.FILE_TYPE_MAP;
        return Object.keys(fileTypeMap)
            .some(key => fileTypeMap[key].category === 'office' && key === mimeType);
    }

    async #extractTextFromPDF(file) {
        try {
            const arrayBuffer = await FileReaderUtil.getInstance.readFileAsArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            let extractedText = `=== PDFファイル「${file.name}」の内容 ===\n\n`;
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                extractedText += `--- ページ ${i} ---\n`;
                const pageText = textContent.items.map(item => item.str).join(' ');
                extractedText += pageText + '\n\n';
            }
            
            return extractedText;
        } catch (error) {
            console.error('PDFテキスト抽出エラー:', error);
            return `PDFファイル「${file.name}」からテキストを抽出できませんでした。`;
        }
    }

    async #extractTextFromOfficeFile(file) {
        try {
            if (file.type.includes('excel') || file.type.includes('sheet')) {
                return await this.#extractTextFromExcelFile(file);
            } else if (file.type.includes('powerpoint') || file.type.includes('presentation')) {
                return await this.#extractTextFromPowerPointFile(file);
            } else if (file.type.includes('word') || file.type.includes('document')) {
                return await this.#extractTextFromWordFile(file);
            }
            
            throw new Error('未対応のOfficeファイル形式です');
        } catch (error) {
            console.error('Officeファイルテキスト抽出エラー:', error);
            return `${this.#getOfficeFileTypeName(file.type)}ファイル「${file.name}」からのテキスト抽出に失敗しました。`;
        }
    }

    async #extractTextFromExcelFile(file) {
        if (typeof XLSX === 'undefined') {
            return `Excelファイル「${file.name}」からのテキスト抽出に失敗しました。\nSheetJSライブラリが見つかりません。`;
        }
        
        const arrayBuffer = await FileReaderUtil.getInstance.readFileAsArrayBuffer(file);
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        let extractedText = `=== Excelファイル「${file.name}」の内容 ===\n\n`;
        
        workbook.SheetNames.forEach(sheetName => {
            extractedText += `--- シート: ${sheetName} ---\n\n`;
            
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            
            if (jsonData?.length > 0) {
                jsonData.forEach(row => {
                    if (row?.length > 0) {
                        const rowText = row.filter(cell => cell !== '').join('\t');
                        if (rowText.trim()) {
                            extractedText += rowText + '\n';
                        }
                    }
                });
            } else {
                extractedText += '（空のシート）\n';
            }
            extractedText += '\n';
        });
        
        return extractedText;
    }

    async #extractTextFromPowerPointFile(file) {
        try {
            const arrayBuffer = await FileReaderUtil.getInstance.readFileAsArrayBuffer(file);
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            const slideEntries = [];
            zip.forEach((path, zipEntry) => {
                if (path.match(/ppt\/slides\/slide[0-9]+\.xml$/)) {
                    slideEntries.push({
                        number: parseInt(path.match(/slide([0-9]+)\.xml$/)[1]),
                        entry: zipEntry
                    });
                }
            });
            
            slideEntries.sort((a, b) => a.number - b.number);
            
            let result = [];
            
            for (const slideEntry of slideEntries) {
                const xmlContent = await zip.file(slideEntry.entry.name).async("text");
                const slideText = this.#extractTextFromXML(xmlContent);
                
                if (slideText) {
                    result.push(`--- スライド ${slideEntry.number} ---\n${slideText}`);
                } else {
                    result.push(`--- スライド ${slideEntry.number} ---\n(テキストなし)`);
                }
            }
            
            if (result.length === 0) {
                return `=== PowerPointファイル「${file.name}」の内容 ===\n\nスライドが見つかりませんでした。`;
            }
            
            return `=== PowerPointファイル「${file.name}」の内容 ===\n\n${result.join('\n\n')}`;
        } catch (error) {
            throw new Error("PowerPointファイルの処理中にエラーが発生しました。");
        }
    }

    #extractTextFromXML(xmlContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
            const textElements = xmlDoc.getElementsByTagName('a:t');
            const uniqueTexts = new Set();
            
            Array.from(textElements).forEach(element => {
                const text = element.textContent.trim();
                if (text) {
                    uniqueTexts.add(text);
                }
            });

            return Array.from(uniqueTexts).join('\n');
        } catch (error) {
            console.error("XMLパース中のエラー:", error);
            return "";
        }
    }

    async #extractTextFromWordFile(file) {
        if (typeof mammoth === 'undefined') {
            return `Wordファイル「${file.name}」からのテキスト抽出に失敗しました。\nmammoth.jsライブラリが見つかりません。`;
        }
        
        const arrayBuffer = await FileReaderUtil.getInstance.readFileAsArrayBuffer(file);
        const result = await mammoth.extractRawText({ arrayBuffer });
        
        if (result.value) {
            return `=== Wordファイル「${file.name}」の内容 ===\n\n${result.value}`;
        } else {
            console.warn('Word文書からのテキスト抽出の警告:', result.messages.map(msg => msg.message).join('\n'));
            return `=== Wordファイル「${file.name}」の内容 ===\n\n（テキストを抽出できませんでした）`;
        }
    }

    #readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsText(file);
        });
    }

    #getOfficeFileTypeName(mimeType) {
        if (!mimeType) return 'Office';
        
        if (mimeType.includes('word')) return 'Word';
        if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'Excel';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PowerPoint';
        
        return 'Office';
    }

    /**
     * Officeファイルから画像を抽出します
     * @param {File} file - 対象ファイル
     * @returns {Promise<Array>} 抽出された画像の配列
     */
    async #extractImagesFromOfficeFile(file) {
        try {
            if (file.type.includes('word') || file.type.includes('document')) {
                return await this.#extractImagesFromWordFile(file);
            } else if (file.type.includes('powerpoint') || file.type.includes('presentation')) {
                return await this.#extractImagesFromPowerPointFile(file);
            } else if (file.type.includes('excel') || file.type.includes('sheet')) {
                return await this.#extractImagesFromExcelFile(file);
            }
            return [];
        } catch (error) {
            console.error('Officeファイル画像抽出エラー:', error);
            return [];
        }
    }

    /**
     * Wordファイルから画像を抽出します
     * @param {File} file - 対象ファイル
     * @returns {Promise<Array>} 抽出された画像の配列
     */
    async #extractImagesFromWordFile(file) {
        try {
            const arrayBuffer = await FileReaderUtil.getInstance.readFileAsArrayBuffer(file);
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // 画像ファイルを格納する配列
            const extractedImages = [];
            
            // Word文書内の画像を探索
            const imageRegex = /word\/media\/.*?\.(png|jpg|jpeg|gif|svg|bmp)/i;
            const promises = [];
            
            zip.forEach((relativePath, zipEntry) => {
                if (imageRegex.test(relativePath)) {
                    const promise = (async () => {
                        const imageData = await zipEntry.async('base64');
                        const extension = relativePath.split('.').pop().toLowerCase();
                        const mimeType = this.#getMimeTypeFromExtension(extension);
                        
                        if (mimeType) {
                            extractedImages.push({
                                name: relativePath.split('/').pop(),
                                data: `data:${mimeType};base64,${imageData}`,
                                mimeType: mimeType
                            });
                        }
                    })();
                    promises.push(promise);
                }
            });
            
            await Promise.all(promises);
            return extractedImages;
        } catch (error) {
            console.error('Word画像抽出エラー:', error);
            return [];
        }
    }

    /**
     * PowerPointファイルから画像を抽出します
     * @param {File} file - 対象ファイル
     * @returns {Promise<Array>} 抽出された画像の配列
     */
    async #extractImagesFromPowerPointFile(file) {
        try {
            const arrayBuffer = await FileReaderUtil.getInstance.readFileAsArrayBuffer(file);
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // 画像ファイルを格納する配列
            const extractedImages = [];
            
            // PowerPoint文書内の画像を探索
            const imageRegex = /ppt\/media\/.*?\.(png|jpg|jpeg|gif|svg|bmp)/i;
            const promises = [];
            
            zip.forEach((relativePath, zipEntry) => {
                if (imageRegex.test(relativePath)) {
                    const promise = (async () => {
                        const imageData = await zipEntry.async('base64');
                        const extension = relativePath.split('.').pop().toLowerCase();
                        const mimeType = this.#getMimeTypeFromExtension(extension);
                        
                        if (mimeType) {
                            extractedImages.push({
                                name: relativePath.split('/').pop(),
                                data: `data:${mimeType};base64,${imageData}`,
                                mimeType: mimeType
                            });
                        }
                    })();
                    promises.push(promise);
                }
            });
            
            await Promise.all(promises);
            return extractedImages;
        } catch (error) {
            console.error('PowerPoint画像抽出エラー:', error);
            return [];
        }
    }

    /**
     * Excelファイルから画像を抽出します
     * @param {File} file - 対象ファイル
     * @returns {Promise<Array>} 抽出された画像の配列
     */
    async #extractImagesFromExcelFile(file) {
        try {
            const arrayBuffer = await FileReaderUtil.getInstance.readFileAsArrayBuffer(file);
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // 画像ファイルを格納する配列
            const extractedImages = [];
            
            // Excel文書内の画像を探索
            const imageRegex = /xl\/media\/.*?\.(png|jpg|jpeg|gif|svg|bmp)/i;
            const promises = [];
            
            zip.forEach((relativePath, zipEntry) => {
                if (imageRegex.test(relativePath)) {
                    const promise = (async () => {
                        const imageData = await zipEntry.async('base64');
                        const extension = relativePath.split('.').pop().toLowerCase();
                        const mimeType = this.#getMimeTypeFromExtension(extension);
                        
                        if (mimeType) {
                            extractedImages.push({
                                name: relativePath.split('/').pop(),
                                data: `data:${mimeType};base64,${imageData}`,
                                mimeType: mimeType
                            });
                        }
                    })();
                    promises.push(promise);
                }
            });
            
            await Promise.all(promises);
            return extractedImages;
        } catch (error) {
            console.error('Excel画像抽出エラー:', error);
            return [];
        }
    }

    /**
     * ファイル拡張子からMIMEタイプを取得します
     * @param {string} extension - ファイル拡張子
     * @returns {string} MIMEタイプ
     */
    #getMimeTypeFromExtension(extension) {
        const mimeTypeMap = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'bmp': 'image/bmp'
        };
        
        return mimeTypeMap[extension.toLowerCase()] || null;
    }
}
