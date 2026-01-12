/**
 * PowerPointGenerator.js
 * JSZip + OOXMLでPowerPointファイル(.pptx)を生成するツール
 */
class PowerPointGenerator extends ToolExecutorBase {
    static #instance = null;

    // EMU (English Metric Units) 変換定数
    // 1インチ = 914400 EMU
    #EMU_PER_INCH = 914400;
    #SLIDE_WIDTH = 9144000;  // 10インチ
    #SLIDE_HEIGHT = 6858000; // 7.5インチ

    constructor() {
        super();
        if (PowerPointGenerator.#instance) {
            return PowerPointGenerator.#instance;
        }
        PowerPointGenerator.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     */
    static get getInstance() {
        if (!PowerPointGenerator.#instance) {
            PowerPointGenerator.#instance = new PowerPointGenerator();
        }
        return PowerPointGenerator.#instance;
    }

    /**
     * PowerPointを生成
     * @param {Object} params - パラメータ
     * @param {string} params.title - プレゼンテーションタイトル
     * @param {Array} params.slides - スライド配列
     * @param {string} params.theme - テーマ名
     * @returns {Promise<Object>} ファイル結果
     */
    async execute(params) {
        this.validateParams(params, ['title', 'slides']);

        const { title, slides, theme = 'default' } = params;

        if (!Array.isArray(slides) || slides.length === 0) {
            throw new Error('スライドは1つ以上必要です');
        }

        const maxSlides = window.CONFIG?.TOOLS?.POWERPOINT?.MAX_SLIDES || 50;
        if (slides.length > maxSlides) {
            throw new Error(`スライド数は${maxSlides}以下にしてください`);
        }

        // JSZipインスタンス作成
        const zip = new JSZip();

        // 基本構造を作成
        this.#addContentTypes(zip, slides.length);
        this.#addRels(zip);
        this.#addPresentation(zip, slides.length);
        this.#addPresentationRels(zip, slides.length);
        this.#addTheme(zip, theme);
        this.#addSlideMaster(zip);
        this.#addSlideLayout(zip);

        // 各スライドを生成
        slides.forEach((slide, index) => {
            this.#addSlide(zip, slide, index + 1);
            this.#addSlideRels(zip, index + 1);
        });

        // BLOBを生成
        const blob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        const filename = this.sanitizeFilename(title) + '.pptx';

        return this.createFileResult(
            blob,
            filename,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        );
    }

    /**
     * [Content_Types].xmlを追加
     */
    #addContentTypes(zip, slideCount) {
        let overrides = '';
        for (let i = 1; i <= slideCount; i++) {
            overrides += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
        }

        const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
    <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
    <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
    <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
    ${overrides}
</Types>`;

        zip.file('[Content_Types].xml', contentTypes);
    }

    /**
     * _rels/.relsを追加
     */
    #addRels(zip) {
        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

        zip.folder('_rels').file('.rels', rels);
    }

    /**
     * ppt/presentation.xmlを追加
     */
    #addPresentation(zip, slideCount) {
        let slideRefs = '';
        for (let i = 1; i <= slideCount; i++) {
            slideRefs += `<p:sldId id="${255 + i}" r:id="rId${i + 2}"/>`;
        }

        const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                saveSubsetFonts="1">
    <p:sldMasterIdLst>
        <p:sldMasterId id="2147483648" r:id="rId1"/>
    </p:sldMasterIdLst>
    <p:sldIdLst>
        ${slideRefs}
    </p:sldIdLst>
    <p:sldSz cx="${this.#SLIDE_WIDTH}" cy="${this.#SLIDE_HEIGHT}"/>
    <p:notesSz cx="${this.#SLIDE_HEIGHT}" cy="${this.#SLIDE_WIDTH}"/>
</p:presentation>`;

        zip.folder('ppt').file('presentation.xml', presentation);
    }

    /**
     * ppt/_rels/presentation.xml.relsを追加
     */
    #addPresentationRels(zip, slideCount) {
        let slideRels = '';
        for (let i = 1; i <= slideCount; i++) {
            slideRels += `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
        }

        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
    ${slideRels}
</Relationships>`;

        zip.folder('ppt').folder('_rels').file('presentation.xml.rels', rels);
    }

    /**
     * テーマを追加
     */
    #addTheme(zip, themeName) {
        const colors = this.#getThemeColors(themeName);

        const theme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
    <a:themeElements>
        <a:clrScheme name="Custom">
            <a:dk1><a:srgbClr val="${colors.dark1}"/></a:dk1>
            <a:lt1><a:srgbClr val="${colors.light1}"/></a:lt1>
            <a:dk2><a:srgbClr val="${colors.dark2}"/></a:dk2>
            <a:lt2><a:srgbClr val="${colors.light2}"/></a:lt2>
            <a:accent1><a:srgbClr val="${colors.accent1}"/></a:accent1>
            <a:accent2><a:srgbClr val="${colors.accent2}"/></a:accent2>
            <a:accent3><a:srgbClr val="${colors.accent3}"/></a:accent3>
            <a:accent4><a:srgbClr val="${colors.accent4}"/></a:accent4>
            <a:accent5><a:srgbClr val="${colors.accent5}"/></a:accent5>
            <a:accent6><a:srgbClr val="${colors.accent6}"/></a:accent6>
            <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
            <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
        </a:clrScheme>
        <a:fontScheme name="Office">
            <a:majorFont>
                <a:latin typeface="Yu Gothic UI"/>
                <a:ea typeface="Yu Gothic UI"/>
                <a:cs typeface="Yu Gothic UI"/>
            </a:majorFont>
            <a:minorFont>
                <a:latin typeface="Yu Gothic UI"/>
                <a:ea typeface="Yu Gothic UI"/>
                <a:cs typeface="Yu Gothic UI"/>
            </a:minorFont>
        </a:fontScheme>
        <a:fmtScheme name="Office">
            <a:fillStyleLst>
                <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
                <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
                <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
            </a:fillStyleLst>
            <a:lnStyleLst>
                <a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
                <a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
                <a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
            </a:lnStyleLst>
            <a:effectStyleLst>
                <a:effectStyle><a:effectLst/></a:effectStyle>
                <a:effectStyle><a:effectLst/></a:effectStyle>
                <a:effectStyle><a:effectLst/></a:effectStyle>
            </a:effectStyleLst>
            <a:bgFillStyleLst>
                <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
                <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
                <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
            </a:bgFillStyleLst>
        </a:fmtScheme>
    </a:themeElements>
</a:theme>`;

        zip.folder('ppt').folder('theme').file('theme1.xml', theme);
    }

    /**
     * テーマカラーを取得
     */
    #getThemeColors(themeName) {
        const themes = {
            default: {
                dark1: '000000', light1: 'FFFFFF',
                dark2: '1F497D', light2: 'EEECE1',
                accent1: '4F81BD', accent2: 'C0504D',
                accent3: '9BBB59', accent4: '8064A2',
                accent5: '4BACC6', accent6: 'F79646'
            },
            dark: {
                dark1: 'FFFFFF', light1: '1E1E1E',
                dark2: 'E0E0E0', light2: '2D2D2D',
                accent1: '4FC3F7', accent2: 'F48FB1',
                accent3: 'AED581', accent4: 'CE93D8',
                accent5: '4DD0E1', accent6: 'FFB74D'
            },
            corporate: {
                dark1: '000000', light1: 'FFFFFF',
                dark2: '003366', light2: 'F5F5F5',
                accent1: '003366', accent2: 'CC0000',
                accent3: '336699', accent4: '666666',
                accent5: '0066CC', accent6: '990000'
            },
            minimal: {
                dark1: '333333', light1: 'FFFFFF',
                dark2: '666666', light2: 'F8F8F8',
                accent1: '333333', accent2: '666666',
                accent3: '999999', accent4: 'CCCCCC',
                accent5: '333333', accent6: '666666'
            }
        };

        return themes[themeName] || themes.default;
    }

    /**
     * スライドマスターを追加
     */
    #addSlideMaster(zip) {
        const slideMaster = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
        <p:bg>
            <p:bgRef idx="1001">
                <a:schemeClr val="bg1"/>
            </p:bgRef>
        </p:bg>
        <p:spTree>
            <p:nvGrpSpPr>
                <p:cNvPr id="1" name=""/>
                <p:cNvGrpSpPr/>
                <p:nvPr/>
            </p:nvGrpSpPr>
            <p:grpSpPr/>
        </p:spTree>
    </p:cSld>
    <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
    <p:sldLayoutIdLst>
        <p:sldLayoutId id="2147483649" r:id="rId1"/>
    </p:sldLayoutIdLst>
</p:sldMaster>`;

        zip.folder('ppt').folder('slideMasters').file('slideMaster1.xml', slideMaster);

        // slideMaster rels
        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;

        zip.folder('ppt').folder('slideMasters').folder('_rels').file('slideMaster1.xml.rels', rels);
    }

    /**
     * スライドレイアウトを追加
     */
    #addSlideLayout(zip) {
        const slideLayout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="blank">
    <p:cSld name="Blank">
        <p:spTree>
            <p:nvGrpSpPr>
                <p:cNvPr id="1" name=""/>
                <p:cNvGrpSpPr/>
                <p:nvPr/>
            </p:nvGrpSpPr>
            <p:grpSpPr/>
        </p:spTree>
    </p:cSld>
</p:sldLayout>`;

        zip.folder('ppt').folder('slideLayouts').file('slideLayout1.xml', slideLayout);

        // slideLayout rels
        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

        zip.folder('ppt').folder('slideLayouts').folder('_rels').file('slideLayout1.xml.rels', rels);
    }

    /**
     * スライドを追加
     */
    #addSlide(zip, slideData, slideNum) {
        const { title, content, bullets, layout = 'content' } = slideData;
        let slideXml;

        switch (layout) {
            case 'title':
                slideXml = this.#generateTitleSlide(title, content || bullets?.join('\n') || '');
                break;
            case 'two_column':
                slideXml = this.#generateTwoColumnSlide(title, content, bullets);
                break;
            case 'blank':
                slideXml = this.#generateBlankSlide(title);
                break;
            case 'content':
            default:
                slideXml = this.#generateContentSlide(title, content, bullets);
                break;
        }

        zip.folder('ppt').folder('slides').file(`slide${slideNum}.xml`, slideXml);
    }

    /**
     * スライドのリレーションシップを追加
     */
    #addSlideRels(zip, slideNum) {
        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

        zip.folder('ppt').folder('slides').folder('_rels').file(`slide${slideNum}.xml.rels`, rels);
    }

    /**
     * タイトルスライドを生成
     */
    #generateTitleSlide(title, subtitle) {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
        <p:spTree>
            <p:nvGrpSpPr>
                <p:cNvPr id="1" name=""/>
                <p:cNvGrpSpPr/>
                <p:nvPr/>
            </p:nvGrpSpPr>
            <p:grpSpPr/>
            <p:sp>
                <p:nvSpPr>
                    <p:cNvPr id="2" name="Title"/>
                    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
                    <p:nvPr/>
                </p:nvSpPr>
                <p:spPr>
                    <a:xfrm>
                        <a:off x="457200" y="2286000"/>
                        <a:ext cx="8229600" cy="1143000"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </p:spPr>
                <p:txBody>
                    <a:bodyPr anchor="ctr"/>
                    <a:lstStyle/>
                    <a:p>
                        <a:pPr algn="ctr"/>
                        <a:r>
                            <a:rPr lang="ja-JP" sz="4400" b="1">
                                <a:solidFill><a:schemeClr val="dk1"/></a:solidFill>
                            </a:rPr>
                            <a:t>${this.escapeXml(title || '')}</a:t>
                        </a:r>
                    </a:p>
                </p:txBody>
            </p:sp>
            ${subtitle ? `<p:sp>
                <p:nvSpPr>
                    <p:cNvPr id="3" name="Subtitle"/>
                    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
                    <p:nvPr/>
                </p:nvSpPr>
                <p:spPr>
                    <a:xfrm>
                        <a:off x="457200" y="3657600"/>
                        <a:ext cx="8229600" cy="914400"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </p:spPr>
                <p:txBody>
                    <a:bodyPr anchor="ctr"/>
                    <a:lstStyle/>
                    <a:p>
                        <a:pPr algn="ctr"/>
                        <a:r>
                            <a:rPr lang="ja-JP" sz="2400">
                                <a:solidFill><a:schemeClr val="dk2"/></a:solidFill>
                            </a:rPr>
                            <a:t>${this.escapeXml(subtitle)}</a:t>
                        </a:r>
                    </a:p>
                </p:txBody>
            </p:sp>` : ''}
        </p:spTree>
    </p:cSld>
</p:sld>`;
    }

    /**
     * コンテンツスライドを生成
     */
    #generateContentSlide(title, content, bullets) {
        const paragraphs = this.#contentToParagraphs(content, bullets);

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
        <p:spTree>
            <p:nvGrpSpPr>
                <p:cNvPr id="1" name=""/>
                <p:cNvGrpSpPr/>
                <p:nvPr/>
            </p:nvGrpSpPr>
            <p:grpSpPr/>
            <p:sp>
                <p:nvSpPr>
                    <p:cNvPr id="2" name="Title"/>
                    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
                    <p:nvPr/>
                </p:nvSpPr>
                <p:spPr>
                    <a:xfrm>
                        <a:off x="457200" y="274638"/>
                        <a:ext cx="8229600" cy="857250"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </p:spPr>
                <p:txBody>
                    <a:bodyPr anchor="b"/>
                    <a:lstStyle/>
                    <a:p>
                        <a:r>
                            <a:rPr lang="ja-JP" sz="3200" b="1">
                                <a:solidFill><a:schemeClr val="dk1"/></a:solidFill>
                            </a:rPr>
                            <a:t>${this.escapeXml(title || '')}</a:t>
                        </a:r>
                    </a:p>
                </p:txBody>
            </p:sp>
            <p:sp>
                <p:nvSpPr>
                    <p:cNvPr id="3" name="Content"/>
                    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
                    <p:nvPr/>
                </p:nvSpPr>
                <p:spPr>
                    <a:xfrm>
                        <a:off x="457200" y="1371600"/>
                        <a:ext cx="8229600" cy="4953000"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </p:spPr>
                <p:txBody>
                    <a:bodyPr/>
                    <a:lstStyle/>
                    ${paragraphs}
                </p:txBody>
            </p:sp>
        </p:spTree>
    </p:cSld>
</p:sld>`;
    }

    /**
     * 2カラムスライドを生成
     */
    #generateTwoColumnSlide(title, content, bullets) {
        const leftContent = content || '';
        const rightContent = bullets ? bullets.join('\n') : '';

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
        <p:spTree>
            <p:nvGrpSpPr>
                <p:cNvPr id="1" name=""/>
                <p:cNvGrpSpPr/>
                <p:nvPr/>
            </p:nvGrpSpPr>
            <p:grpSpPr/>
            <p:sp>
                <p:nvSpPr>
                    <p:cNvPr id="2" name="Title"/>
                    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
                    <p:nvPr/>
                </p:nvSpPr>
                <p:spPr>
                    <a:xfrm>
                        <a:off x="457200" y="274638"/>
                        <a:ext cx="8229600" cy="857250"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </p:spPr>
                <p:txBody>
                    <a:bodyPr anchor="b"/>
                    <a:lstStyle/>
                    <a:p>
                        <a:r>
                            <a:rPr lang="ja-JP" sz="3200" b="1">
                                <a:solidFill><a:schemeClr val="dk1"/></a:solidFill>
                            </a:rPr>
                            <a:t>${this.escapeXml(title || '')}</a:t>
                        </a:r>
                    </a:p>
                </p:txBody>
            </p:sp>
            <p:sp>
                <p:nvSpPr>
                    <p:cNvPr id="3" name="Left Content"/>
                    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
                    <p:nvPr/>
                </p:nvSpPr>
                <p:spPr>
                    <a:xfrm>
                        <a:off x="457200" y="1371600"/>
                        <a:ext cx="4000000" cy="4953000"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </p:spPr>
                <p:txBody>
                    <a:bodyPr/>
                    <a:lstStyle/>
                    ${this.#contentToParagraphs(leftContent)}
                </p:txBody>
            </p:sp>
            <p:sp>
                <p:nvSpPr>
                    <p:cNvPr id="4" name="Right Content"/>
                    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
                    <p:nvPr/>
                </p:nvSpPr>
                <p:spPr>
                    <a:xfrm>
                        <a:off x="4686800" y="1371600"/>
                        <a:ext cx="4000000" cy="4953000"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </p:spPr>
                <p:txBody>
                    <a:bodyPr/>
                    <a:lstStyle/>
                    ${this.#contentToParagraphs(rightContent)}
                </p:txBody>
            </p:sp>
        </p:spTree>
    </p:cSld>
</p:sld>`;
    }

    /**
     * 空白スライドを生成
     */
    #generateBlankSlide(title) {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
        <p:spTree>
            <p:nvGrpSpPr>
                <p:cNvPr id="1" name=""/>
                <p:cNvGrpSpPr/>
                <p:nvPr/>
            </p:nvGrpSpPr>
            <p:grpSpPr/>
            ${title ? `<p:sp>
                <p:nvSpPr>
                    <p:cNvPr id="2" name="Title"/>
                    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
                    <p:nvPr/>
                </p:nvSpPr>
                <p:spPr>
                    <a:xfrm>
                        <a:off x="457200" y="274638"/>
                        <a:ext cx="8229600" cy="857250"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </p:spPr>
                <p:txBody>
                    <a:bodyPr anchor="b"/>
                    <a:lstStyle/>
                    <a:p>
                        <a:r>
                            <a:rPr lang="ja-JP" sz="3200" b="1">
                                <a:solidFill><a:schemeClr val="dk1"/></a:solidFill>
                            </a:rPr>
                            <a:t>${this.escapeXml(title)}</a:t>
                        </a:r>
                    </a:p>
                </p:txBody>
            </p:sp>` : ''}
        </p:spTree>
    </p:cSld>
</p:sld>`;
    }

    /**
     * コンテンツをパラグラフXMLに変換
     */
    #contentToParagraphs(content, bullets) {
        let items = [];

        if (bullets && Array.isArray(bullets)) {
            items = bullets;
        } else if (typeof content === 'string') {
            items = content.split('\n').filter(line => line.trim());
        }

        if (items.length === 0) {
            return '<a:p><a:r><a:t></a:t></a:r></a:p>';
        }

        return items.map(item => `
            <a:p>
                <a:pPr marL="342900" indent="-342900">
                    <a:buFont typeface="Arial"/>
                    <a:buChar char="•"/>
                </a:pPr>
                <a:r>
                    <a:rPr lang="ja-JP" sz="2000">
                        <a:solidFill><a:schemeClr val="dk1"/></a:solidFill>
                    </a:rPr>
                    <a:t>${this.escapeXml(item)}</a:t>
                </a:r>
            </a:p>
        `).join('');
    }
}
