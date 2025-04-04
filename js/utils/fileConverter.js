/**
 * fileConverter.js
 * ファイル変換機能を提供します
 */

window.FileConverter = {
    convertFilesToAttachments: function(files) {
        if (!files || !Array.isArray(files)) {
            return Promise.resolve([]);
        }
        
        return Promise.all(files.map(file => this._convertFileToAttachment(file)));
    },

    _convertFileToAttachment: async function(file) {
        try {
            if (!file) {
                throw new Error('有効なファイルが指定されていません');
            }
            
            // 画像ファイルの場合
            if (file.type.startsWith('image/')) {
                const dataUrl = await window.FileReaderUtil.readFileAsDataURL(file);
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
                const dataUrl = await window.FileReaderUtil.readFileAsDataURL(file);
                const extractedText = await this._extractTextFromPDF(file);
                
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
            else if (this._isOfficeFile(file.type)) {
                const dataUrl = await window.FileReaderUtil.readFileAsDataURL(file);
                const extractedText = await this._extractTextFromOfficeFile(file);
                
                return {
                    type: 'office',
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    data: dataUrl,
                    content: extractedText
                };
            }
            // その他のファイルの場合
            else {
                const dataUrl = await window.FileReaderUtil.readFileAsDataURL(file);
                const textContent = await this._readFileAsText(file);
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
    },

    _isOfficeFile: function(mimeType) {
        if (!mimeType) return false;
        return window.CONFIG.FILE.ALLOWED_FILE_TYPES.office?.includes(mimeType) ?? false;
    },

    _extractTextFromPDF: async function(file) {
        try {
            const arrayBuffer = await window.FileReaderUtil.readFileAsArrayBuffer(file);
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
    },

    _extractTextFromOfficeFile: async function(file) {
        try {
            if (file.type.includes('excel') || file.type.includes('sheet')) {
                return await this._extractTextFromExcelFile(file);
            } else if (file.type.includes('powerpoint') || file.type.includes('presentation')) {
                return await this._extractTextFromPowerPointFile(file);
            } else if (file.type.includes('word') || file.type.includes('document')) {
                return await this._extractTextFromWordFile(file);
            }
            
            throw new Error('未対応のOfficeファイル形式です');
        } catch (error) {
            console.error('Officeファイルテキスト抽出エラー:', error);
            return `${this._getOfficeFileTypeName(file.type)}ファイル「${file.name}」からのテキスト抽出に失敗しました。`;
        }
    },

    _extractTextFromExcelFile: async function(file) {
        if (typeof XLSX === 'undefined') {
            return `Excelファイル「${file.name}」からのテキスト抽出に失敗しました。\nSheetJSライブラリが見つかりません。`;
        }
        
        const arrayBuffer = await window.FileReaderUtil.readFileAsArrayBuffer(file);
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
    },

    _extractTextFromPowerPointFile: async function(file) {
        try {
            const arrayBuffer = await window.FileReaderUtil.readFileAsArrayBuffer(file);
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
                const slideText = this._extractTextFromXML(xmlContent);
                
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
    },

    _extractTextFromXML: function(xmlContent) {
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
    },

    _extractTextFromWordFile: async function(file) {
        if (typeof mammoth === 'undefined') {
            return `Wordファイル「${file.name}」からのテキスト抽出に失敗しました。\nmammoth.jsライブラリが見つかりません。`;
        }
        
        const arrayBuffer = await window.FileReaderUtil.readFileAsArrayBuffer(file);
        const result = await mammoth.extractRawText({ arrayBuffer });
        
        if (result.value) {
            return `=== Wordファイル「${file.name}」の内容 ===\n\n${result.value}`;
        } else {
            console.warn('Word文書からのテキスト抽出の警告:', result.messages.map(msg => msg.message).join('\n'));
            return `=== Wordファイル「${file.name}」の内容 ===\n\n（テキストを抽出できませんでした）`;
        }
    },

    _readFileAsText: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsText(file);
        });
    },

    _getOfficeFileTypeName: function(mimeType) {
        if (!mimeType) return 'Office';
        
        if (mimeType.includes('word')) return 'Word';
        if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'Excel';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PowerPoint';
        
        return 'Office';
    }
};