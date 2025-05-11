import { XBRLCellData, XBRLContextInfo, XBRLTableData, XBRLUnitInfo } from '../../types/extractors/improved-xbrl-types';

/**
 * 診断情報インターフェース
 */
interface DiagnosticsInfo {
  fileType?: string;
  elements: number;
  contexts: number;
  units: number;
  tables: number;
  mappedTables?: number;
  errors: string[];
  stack?: any; // スタックトレース情報
  error?: any; // エラーメッセージ
}

/**
 * 改良版XBRL抽出関数 - より多くの財務項目を認識する
 * @param doc HTML文書
 * @returns 抽出されたXBRLデータ
 */
export function extractImprovedXBRL(doc: Document): { 
  tables: XBRLTableData[], 
  contexts: Record<string, XBRLContextInfo>, 
  units: Record<string, XBRLUnitInfo>,
  diagnostics: DiagnosticsInfo 
} {
  try {
    // 診断情報の初期化
    const diagnostics: DiagnosticsInfo = { 
      fileType: detectXBRLType(doc),
      elements: 0,
      contexts: 0,
      units: 0,
      tables: 0,
      mappedTables: 0,
      errors: []
    };
    
    console.log("XBRL抽出開始");
    
    // コンテキスト情報を収集（期間など）
    const contexts = processXBRLContexts(doc);
    diagnostics.contexts = Object.keys(contexts).length;
    console.log(`抽出されたコンテキスト数: ${diagnostics.contexts}`);
    
    // 単位情報を収集（通貨など）
    const units = processXBRLUnits(doc);
    diagnostics.units = Object.keys(units).length;
    console.log(`抽出された単位情報数: ${diagnostics.units}`);
    
    // XBRLタグを持つすべての要素を抽出（範囲を拡大）
    const xbrlElements = extractAllXBRLElements(doc);
    diagnostics.elements = xbrlElements.length;
    console.log(`抽出されたXBRL要素数: ${diagnostics.elements}`);
    
    if (diagnostics.elements === 0) {
      console.warn("XBRL要素が見つかりませんでした。ファイル形式を確認してください。");
      diagnostics.errors.push("XBRL要素が検出されませんでした。ファイル形式が適切か確認してください。");
    }
    
    // ドキュメント内のテーブルを抽出
    const tableCandidates = Array.from(doc.querySelectorAll('table'));
    diagnostics.tables = tableCandidates.length;
    console.log(`文書内のテーブル数: ${diagnostics.tables}`);
    
    if (diagnostics.tables === 0) {
      console.warn("テーブルが見つかりませんでした。ファイル形式を確認してください。");
      diagnostics.errors.push("テーブルが検出されませんでした。手動で抽出を試みます。");
    }
    
    // 財務テーブルを優先的に抽出（よりインテリジェントな検出）
    const financialTables = detectFinancialTables(tableCandidates);
    console.log(`検出された財務テーブル数: ${financialTables.length}`);
    
    // 抽出したXBRL要素をテーブルにマッピング
    const mappedTables = mapXBRLElementsToTables(financialTables, xbrlElements, contexts, units);
    diagnostics.mappedTables = mappedTables.length;
    console.log(`マッピングされたテーブル数: ${diagnostics.mappedTables}`);
    
    // XBRL要素が見つからなかった場合は、テーブルデータだけを使用して表示用のデータを構築
    if (mappedTables.length === 0 && tableCandidates.length > 0) {
      console.log("XBRL要素がマッピングできなかったため、フォールバック処理を実行します");
      diagnostics.errors.push("XBRL要素がテーブルにマッピングできませんでした。基本的なテーブル構造のみを表示します。");
      const fallbackTables = processTablesAsFallback(tableCandidates);
      return { tables: fallbackTables, contexts, units, diagnostics };
    }
    
    return { tables: mappedTables, contexts, units, diagnostics };
  } catch (error: any) {
    console.error("XBRL抽出エラー:", error);
    return { 
      tables: [], 
      contexts: {}, 
      units: {}, 
      diagnostics: { 
        elements: 0,
        contexts: 0,
        units: 0,
        tables: 0,
        errors: [error?.message || "XBRL抽出中にエラーが発生しました。詳細はコンソールを確認してください。"]
      } 
    };
  }
}

/**
 * XBRLファイルの種類を特定する関数
 */
function detectXBRLType(doc: Document): string {
  // iXBRL形式の検出
  if (doc.querySelector('html[xmlns\\:ix], html[xmlns:ix]') || 
      doc.querySelector('ix\\:nonnumeric, ix\\:nonFraction')) {
    return 'ixbrl';
  }
  
  // 標準XBRL形式の検出
  if (doc.querySelector('xbrl, xbrli\\:xbrl')) {
    return 'xbrl';
  }
  
  // EDINET特有の形式検出
  if (doc.querySelector('[name^="jpdei_"], [name^="jpcrp_"]')) {
    return 'edinet';
  }
  
  // TDnet特有の形式検出
  if (doc.querySelector('[name^="tse_"]')) {
    return 'tdnet';
  }
  
  return 'unknown';
}

/**
 * ドキュメント内のすべてのXBRLコンテキストを処理
 */
function processXBRLContexts(doc: Document): Record<string, XBRLContextInfo> {
  const contexts: Record<string, XBRLContextInfo> = {};
  
  // 標準的なXBRLコンテキスト要素
  const contextElements = doc.querySelectorAll('context, xbrli\\:context');
  contextElements.forEach(contextEl => {
    const contextId = contextEl.getAttribute('id');
    if (!contextId) return;
    
    // 期間情報抽出（瞬間・期間）
    const periodInfo = extractPeriodInfo(contextEl);
    
    // エンティティ情報抽出
    const entityInfo = extractEntityInfo(contextEl);
    
    // セグメント情報抽出
    const segmentInfo = extractSegmentInfo(contextEl);
    
    // 連結・個別情報抽出
    const consolidationInfo = determineConsolidationType(contextEl, segmentInfo);
    
    // periodInfo から periodType を決定
    const periodType = periodInfo.instant 
      ? 'instant' 
      : (periodInfo.startDate && periodInfo.endDate ? 'duration' : 'unknown');
    
    // 現在期間か前期間かを判定
    const isCurrentPeriod = isPeriodCurrent(periodInfo);
    const isPreviousPeriod = isPeriodPrevious(periodInfo);
    
    // fiscalYear を決定
    const fiscalYear = isCurrentPeriod 
      ? 'current' 
      : (isPreviousPeriod ? 'previous' : 'unknown');
    
    contexts[contextId] = {
      id: contextId,
      entity: entityInfo.identifier,
      scheme: entityInfo.scheme,
      startDate: periodInfo.startDate,
      endDate: periodInfo.endDate,
      instant: periodInfo.instant,
      periodType,
      isCurrentPeriod,
      isPreviousPeriod,
      memberType: consolidationInfo,
      fiscalYear,
      explicitMember: null,
      memberValue: null,
      segment: segmentInfo
    };
  });
  
  // iXBRL（インラインXBRL）コンテキスト要素も処理
  const ixbrlContexts = doc.querySelectorAll('[contextref], [contextRef]');
  console.log(`コンテキスト参照を持つ要素数: ${ixbrlContexts.length}`);
  
  // コンテキスト参照の集計
  const contextRefs = new Set<string>();
  
  ixbrlContexts.forEach(el => {
    const contextRef = el.getAttribute('contextref') || el.getAttribute('contextRef');
    if (contextRef) contextRefs.add(contextRef);
    
    if (!contextRef || contexts[contextRef]) return;
    
    // 既存のコンテキストがない場合、最小限の情報で作成
    let memberType: 'consolidated' | 'non_consolidated' | 'unknown' = 'unknown';
    let isCurrentPeriod = false;
    let isPreviousPeriod = false;
    
    // コンテキスト識別子からの情報抽出試行
    if (
      contextRef.includes('Current') || 
      contextRef.includes('ThisPeriod') || 
      contextRef.includes('Current') ||
      contextRef.includes('Instant') ||
      contextRef.includes('ThisYear') ||
      contextRef.includes('当期') ||
      contextRef.includes('当年')
    ) {
      isCurrentPeriod = true;
      console.log(`当期コンテキストを発見: ${contextRef}`);
    } else if (
      contextRef.includes('Prior') || 
      contextRef.includes('LastPeriod') || 
      contextRef.includes('Previous') ||
      contextRef.includes('LastYear') ||
      contextRef.includes('前期') ||
      contextRef.includes('前年')
    ) {
      isPreviousPeriod = true;
      console.log(`前期コンテキストを発見: ${contextRef}`);
    }
    
    if (
      contextRef.includes('Consolidated') || 
      contextRef.includes('Consolidate') ||
      contextRef.includes('Cnsl') ||
      contextRef.includes('Cons') ||
      contextRef.includes('連結')
    ) {
      memberType = 'consolidated';
    } else if (
      contextRef.includes('NonConsolidated') || 
      contextRef.includes('Individual') ||
      contextRef.includes('Noncnsl') ||
      contextRef.includes('NonCons') ||
      contextRef.includes('個別')
    ) {
      memberType = 'non_consolidated';
    }
    
    const fiscalYear = isCurrentPeriod 
      ? 'current' 
      : (isPreviousPeriod ? 'previous' : 'unknown');
    
    contexts[contextRef] = {
      id: contextRef,
      entity: '',
      scheme: '',
      startDate: null,
      endDate: null,
      instant: null,
      periodType: 'unknown',
      isCurrentPeriod,
      isPreviousPeriod,
      memberType,
      fiscalYear,
      explicitMember: null,
      memberValue: null,
      segment: {}
    };
  });
  
  console.log(`抽出された固有コンテキスト参照: ${contextRefs.size}`);
  if (contextRefs.size > 0) {
    console.log(`サンプルコンテキスト参照: ${Array.from(contextRefs).slice(0, 5).join(', ')}`);
  }
  
  return contexts;
}

/**
 * 期間情報を抽出
 */
function extractPeriodInfo(contextEl: Element): { startDate: string | null, endDate: string | null, instant: string | null } {
  const periodEl = contextEl.querySelector('period, xbrli\\:period');
  if (!periodEl) return { startDate: null, endDate: null, instant: null };
  
  const instantEl = periodEl.querySelector('instant, xbrli\\:instant');
  if (instantEl && instantEl.textContent) {
    return { startDate: null, endDate: null, instant: instantEl.textContent.trim() };
  }
  
  const startDateEl = periodEl.querySelector('startDate, xbrli\\:startDate');
  const endDateEl = periodEl.querySelector('endDate, xbrli\\:endDate');
  
  return {
    startDate: startDateEl && startDateEl.textContent ? startDateEl.textContent.trim() : null,
    endDate: endDateEl && endDateEl.textContent ? endDateEl.textContent.trim() : null,
    instant: null
  };
}

/**
 * エンティティ情報を抽出
 */
function extractEntityInfo(contextEl: Element): { identifier: string, scheme: string } {
  const entityEl = contextEl.querySelector('entity, xbrli\\:entity');
  if (!entityEl) return { identifier: '', scheme: '' };
  
  const identifierEl = entityEl.querySelector('identifier, xbrli\\:identifier');
  if (!identifierEl) return { identifier: '', scheme: '' };
  
  return {
    identifier: identifierEl.textContent ? identifierEl.textContent.trim() : '',
    scheme: identifierEl.getAttribute('scheme') || ''
  };
}

/**
 * セグメント情報を抽出
 */
function extractSegmentInfo(contextEl: Element): Record<string, string> {
  const segmentInfo: Record<string, string> = {};
  const segmentEl = contextEl.querySelector('segment, xbrli\\:segment');
  
  if (segmentEl) {
    // xbrldi:explicitMember要素を処理
    const explicitMembers = segmentEl.querySelectorAll('explicitMember, xbrldi\\:explicitMember');
    explicitMembers.forEach(memberEl => {
      const dimension = memberEl.getAttribute('dimension');
      const value = memberEl.textContent;
      if (dimension && value) {
        segmentInfo[dimension] = value.trim();
      }
    });
    
    // 他のセグメント情報も抽出
    const typedMembers = segmentEl.querySelectorAll('typedMember, xbrldi\\:typedMember');
    typedMembers.forEach(memberEl => {
      const dimension = memberEl.getAttribute('dimension');
      if (dimension) {
        const childElements = memberEl.children;
        if (childElements.length > 0) {
          const firstChild = childElements[0];
          const localName = firstChild.localName;
          const value = firstChild.textContent;
          if (localName && value) {
            segmentInfo[`${dimension}[${localName}]`] = value.trim();
          }
        }
      }
    });
  }
  
  return segmentInfo;
}

/**
 * 連結タイプを決定
 */
function determineConsolidationType(contextEl: Element, segmentInfo: Record<string, string>): 'consolidated' | 'non_consolidated' | 'unknown' {
  // セグメント情報から連結・個別を判定
  for (const key in segmentInfo) {
    const value = segmentInfo[key].toLowerCase();
    
    if (
      value.includes('consolidated') || 
      value.includes('連結') || 
      key.toLowerCase().includes('consolidated')
    ) {
      return 'consolidated';
    }
    
    if (
      value.includes('non-consolidated') || 
      value.includes('individual') || 
      value.includes('non_consolidated') || 
      value.includes('個別') ||
      key.toLowerCase().includes('individual')
    ) {
      return 'non_consolidated';
    }
  }
  
  // コンテキストIDから判定を試みる
  const contextId = contextEl.getAttribute('id');
  if (contextId) {
    const lowerContextId = contextId.toLowerCase();
    if (
      lowerContextId.includes('consolidated') || 
      lowerContextId.includes('cons')
    ) {
      return 'consolidated';
    }
    
    if (
      lowerContextId.includes('non-consolidated') || 
      lowerContextId.includes('individual') || 
      lowerContextId.includes('ncons')
    ) {
      return 'non_consolidated';
    }
  }
  
  return 'unknown';
}

/**
 * 現在期間かどうかを判定
 */
function isPeriodCurrent(periodInfo: { startDate: string | null, endDate: string | null, instant: string | null }): boolean {
  // 期間情報がない場合はfalse
  if (!periodInfo.endDate && !periodInfo.instant) return false;
  
  // 現在の日付
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;
  
  // 期末日またはinstantを使用
  const dateStr = periodInfo.endDate || periodInfo.instant;
  if (!dateStr) return false;
  
  try {
    // コンテキストIDの判定
    if (periodInfo.hasOwnProperty('id')) {
      const contextId = (periodInfo as any).id?.toLowerCase() || '';
      if (contextId && (
        contextId.includes('current') ||
        contextId.includes('instant') ||
        contextId.includes('ending') ||
        contextId.includes('thisyear') ||
        contextId.includes('当期') ||
        contextId.includes('当年')
      )) {
        console.log(`コンテキストIDから当期と判定: ${contextId}`);
        return true;
      }
    }

    const date = new Date(dateStr);
    const year = date.getFullYear();
    
    // 今年または昨年のデータを現在期間と判断
    return year === thisYear || year === lastYear;
  } catch (e) {
    console.error('期間判定エラー:', e);
    return false;
  }
}

/**
 * 前期間かどうかを判定
 */
function isPeriodPrevious(periodInfo: { startDate: string | null, endDate: string | null, instant: string | null }): boolean {
  // 期間情報がない場合はfalse
  if (!periodInfo.endDate && !periodInfo.instant) return false;
  
  // コンテキストIDの判定
  if (periodInfo.hasOwnProperty('id')) {
    const contextId = (periodInfo as any).id?.toLowerCase() || '';
    if (contextId && (
      contextId.includes('prior') ||
      contextId.includes('previous') ||
      contextId.includes('lastyear') ||
      contextId.includes('preceding') ||
      contextId.includes('前期') ||
      contextId.includes('前年')
    )) {
      console.log(`コンテキストIDから前期と判定: ${contextId}`);
      return true;
    }
  }

  // 現在の日付
  const now = new Date();
  const thisYear = now.getFullYear();
  const prevYear = thisYear - 2;
  const prevPrevYear = thisYear - 3;
  
  // 期末日またはinstantを使用
  const dateStr = periodInfo.endDate || periodInfo.instant;
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    
    // 2〜3年前のデータを前期間と判断
    return year === prevYear || year === prevPrevYear;
  } catch (e) {
    console.error('期間判定エラー:', e);
    return false;
  }
}

/**
 * 単位情報を処理
 */
function processXBRLUnits(doc: Document): Record<string, XBRLUnitInfo> {
  const units: Record<string, XBRLUnitInfo> = {};
  
  // 標準的なXBRL単位要素
  const unitElements = doc.querySelectorAll('unit, xbrli\\:unit');
  unitElements.forEach(unitEl => {
    const unitId = unitEl.getAttribute('id');
    if (!unitId) return;
    
    // 通貨情報を抽出
    const measure = unitEl.querySelector('measure, xbrli\\:measure');
    const measureText = measure ? measure.textContent?.trim() : '';
    
    // 単位記号を抽出
    let unitSymbol = '';
    let unitName = '';
    
    if (measureText) {
      // 通貨単位を処理
      if (measureText.includes('iso4217:')) {
        const currencyCode = measureText.split(':')[1];
        unitSymbol = currencyCode;
        unitName = `Currency (${currencyCode})`;
        
        // よく使われる通貨コードに対する記号をマッピング
        const currencySymbols: Record<string, string> = {
          'JPY': '¥',
          'USD': '$',
          'EUR': '€',
          'GBP': '£',
          'CNY': '¥',
          'KRW': '₩'
        };
        
        if (currencyCode in currencySymbols) {
          unitSymbol = currencySymbols[currencyCode];
        }
      } 
      // 株式単位を処理
      else if (measureText.includes('shares')) {
        unitSymbol = '株';
        unitName = '株式数';
      }
      // パーセント単位を処理
      else if (measureText.includes('percent') || measureText.includes('ratio')) {
        unitSymbol = '%';
        unitName = 'パーセント';
      }
      // 純粋な数値単位を処理
      else if (measureText.includes('pure')) {
        unitSymbol = '';
        unitName = '数値';
      }
      // その他の単位
      else {
        const parts = measureText.split(':');
        unitSymbol = parts.length > 1 ? parts[1] : measureText;
        unitName = unitSymbol;
      }
    }
    
    // divide要素を処理（比率など）
    const divideEl = unitEl.querySelector('divide, xbrli\\:divide');
    if (divideEl) {
      // 複雑な単位（割合など）
      const numerator = divideEl.querySelector('unitNumerator, xbrli\\:unitNumerator')?.textContent?.trim() || '';
      const denominator = divideEl.querySelector('unitDenominator, xbrli\\:unitDenominator')?.textContent?.trim() || '';
      
      if (numerator && denominator) {
        // 比率として表示
        unitSymbol = numerator.includes('iso4217:') ? numerator.split(':')[1] : numerator;
        unitName = `${unitSymbol}/${denominator.split(':')[1] || denominator}`;
      }
    }
    
    units[unitId] = {
      id: unitId,
      measure: measureText || '',
      symbol: unitSymbol,
      name: unitName,
      displayLabel: unitSymbol || '',
      type: divideEl ? 'fraction' : 'simple'
    };
  });
  
  // iXBRL（インラインXBRL）単位参照も処理
  const ixbrlUnits = doc.querySelectorAll('[unitref]');
  ixbrlUnits.forEach(el => {
    const unitRef = el.getAttribute('unitref');
    if (!unitRef || units[unitRef]) return;
    
    // 既存の単位情報がない場合、最小限の情報を作成
    // unitRefから単位タイプを推測
    let symbol = '';
    let name = '';
    
    if (unitRef.includes('JPY') || unitRef.includes('USD') || unitRef.includes('EUR')) {
      const currencyCode = 
        unitRef.includes('JPY') ? 'JPY' : 
        unitRef.includes('USD') ? 'USD' : 
        unitRef.includes('EUR') ? 'EUR' : '';
      
      const currencySymbols: Record<string, string> = {
        'JPY': '¥',
        'USD': '$',
        'EUR': '€'
      };
      
      symbol = currencySymbols[currencyCode] || currencyCode;
      name = `Currency (${currencyCode})`;
    } else if (unitRef.includes('Share')) {
      symbol = '株';
      name = '株式数';
    } else if (unitRef.includes('Percent') || unitRef.includes('Ratio')) {
      symbol = '%';
      name = 'パーセント';
    } else if (unitRef.includes('Pure')) {
      symbol = '';
      name = '数値';
    }
    
    units[unitRef] = {
      id: unitRef,
      measure: '',
      symbol,
      name,
      displayLabel: symbol || '',
      type: 'simple'
    };
  });
  
  return units;
}

/**
 * ドキュメント内のすべてのXBRL要素を抽出
 */
function extractAllXBRLElements(doc: Document): Element[] {
  const xbrlElements: Element[] = [];
  const selectors = [
    // 基本的なXBRL要素
    'ix\\:nonnumeric', 'ix\\:nonfraction', 'ix\\:nonFraction', 'nonnumeric',
    'ix\\:numeric', 'numeric',
    // 属性ベースの検索を追加
    '[name^="jppfs"]', '[name^="jpcrp"]', '[name*="xbrl"]',
    '[contextRef]', '[contextref]', '[unitRef]', '[unitref]',
    // 日本特有のXBRL要素
    '[name*="jpdei"]', '[name*="tse"]'
  ];
  
  // 各セレクタで要素を取得
  selectors.forEach(selector => {
    try {
      const elements = doc.querySelectorAll(selector);
      Array.from(elements).forEach(el => {
        if (!xbrlElements.includes(el)) {
          xbrlElements.push(el);
        }
      });
    } catch (error) {
      console.warn(`セレクタ '${selector}' の検索中にエラーが発生しました:`, error);
    }
  });
  
  // XBRL 2.1標準要素 - 前のセレクタで捕捉できなかった場合に備えて
  Array.from(doc.querySelectorAll('[contextRef], [contextref]')).forEach(el => {
    if (!xbrlElements.includes(el)) {
      xbrlElements.push(el);
    }
  });
  
  // 名前でXBRL要素を検出 - 追加のセレクタ
  Array.from(doc.querySelectorAll('[name]')).forEach(el => {
    const name = el.getAttribute('name');
    if (name && (
      name.includes(':') || 
      name.startsWith('jppfs') || 
      name.startsWith('jpcrp') ||
      name.startsWith('jpdei') ||
      name.startsWith('tse')
    )) {
      if (!xbrlElements.includes(el)) {
        xbrlElements.push(el);
      }
    }
  });
  
  // 拡張検索：SCALEクラス属性を持つテーブルセル
  Array.from(doc.querySelectorAll('.SCALE')).forEach(el => {
    if (!xbrlElements.includes(el)) {
      xbrlElements.push(el);
    }
  });
  
  // hidden-xbrl クラスを持つ要素を検索（隠しXBRL要素）
  Array.from(doc.querySelectorAll('.hidden-xbrl, .xbrl-hidden')).forEach(el => {
    if (!xbrlElements.includes(el)) {
      xbrlElements.push(el);
    }
  });
  
  // xbrlタグが含まれる要素を検索
  Array.from(doc.querySelectorAll('xbrl, xbrli\\:xbrl, ix\\:header')).forEach(el => {
    if (!xbrlElements.includes(el)) {
      xbrlElements.push(el);
    }
  });
  
  return xbrlElements;
}

/**
 * 財務テーブルを検出
 */
function detectFinancialTables(tables: Element[]): Element[] {
  const financialTables: Element[] = [];
  const financialKeywords = [
    // 日本語キーワード
    '貸借対照表', '損益計算書', 'キャッシュ・フロー計算書', '株主資本等変動計算書',
    '財政状態', '経営成績', '包括利益', '連結財務諸表', '財務諸表',
    '資産', '負債', '純資産', '売上高', '売上', '収益', '費用', '利益', '営業',
    // 英語キーワード
    'balance sheet', 'income statement', 'cash flow', 'statement of changes',
    'financial position', 'financial performance', 'comprehensive income',
    'assets', 'liabilities', 'equity', 'revenue', 'expenses', 'profit', 'loss',
    // XBRL関連
    'jppfs', 'jpcrp', 'xbrl'
  ];
  
  // 財務テーブルの検出ロジック
  tables.forEach(table => {
    // テーブルの前の見出しを確認
    let hasFinancialHeader = false;
    const previousElement = table.previousElementSibling;
    if (previousElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(previousElement.tagName)) {
      const headerText = previousElement.textContent?.toLowerCase() || '';
      if (financialKeywords.some(keyword => headerText.includes(keyword.toLowerCase()))) {
        hasFinancialHeader = true;
      }
    }
    
    // テーブルの内容を確認
    const tableText = table.textContent?.toLowerCase() || '';
    const hasFinancialContent = financialKeywords.some(keyword => 
      tableText.includes(keyword.toLowerCase())
    );
    
    // テーブルがXBRL要素を含むか確認
    const hasXBRLAttr = table.querySelector('[contextref], [name*="jppfs"], [name*="jpcrp"]') !== null;
    
    // 財務テーブル判定のスコアリング
    let score = 0;
    if (hasFinancialHeader) score += 3;
    if (hasFinancialContent) score += 2;
    if (hasXBRLAttr) score += 5;
    
    // 行数と列数を取得
    const rows = table.querySelectorAll('tr');
    const firstRow = rows[0];
    const cols = firstRow ? firstRow.querySelectorAll('td, th').length : 0;
    
    // 適切な構造を持ったテーブルか確認
    if (rows.length >= 3 && cols >= 2) {
      score += 1;
    }
    
    // テーブルの特徴を確認
    const firstColCells = Array.from(table.querySelectorAll('tr > td:first-child, tr > th:first-child'));
    const hasItemLabels = firstColCells.some(cell => {
      const text = cell.textContent?.trim() || '';
      return text.length > 0 && 
        (text.includes('資産') || text.includes('負債') || text.includes('純資産') || 
         text.includes('売上') || text.includes('費用') || text.includes('利益') ||
         text.includes('cash') || text.includes('assets') || text.includes('liabilities') ||
         text.includes('equity') || text.includes('revenue') || text.includes('expenses'));
    });
    
    if (hasItemLabels) score += 2;
    
    // スコアが一定以上なら財務テーブルとみなす
    if (score >= 3) {
      financialTables.push(table);
    }
  });
  
  // スコアによってソート（高いスコアほど先頭に）
  return financialTables;
}

/**
 * XBRL要素をテーブルにマッピング
 */
function mapXBRLElementsToTables(
  tables: Element[], 
  xbrlElements: Element[], 
  contexts: Record<string, XBRLContextInfo>, 
  units: Record<string, XBRLUnitInfo>
): XBRLTableData[] {
  const result: XBRLTableData[] = [];
  
  // テーブルがない場合、XBRLデータから仮想テーブルを構築
  if (tables.length === 0 && xbrlElements.length > 0) {
    console.log("テーブルが見つからないため、XBRLデータから仮想テーブルを構築します");
    const virtualTable = createVirtualTableFromXBRL(xbrlElements, contexts, units);
    if (virtualTable) {
      result.push(virtualTable);
    }
    return result;
  }
  
  tables.forEach((table, tableIndex) => {
    // テーブルタイトルを取得
    let tableTitle = '';
    const previousElement = table.previousElementSibling;
    if (previousElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(previousElement.tagName)) {
      tableTitle = previousElement.textContent?.trim() || '';
    }
    
    // テーブルタイプを特定
    let tableType: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'shareholder' | 'unknown' = 'unknown';
    const tableHTML = table.outerHTML.toLowerCase();
    const tableText = table.textContent?.toLowerCase() || '';
    
    if (
      tableTitle.includes('貸借対照表') || 
      tableTitle.includes('財政状態') || 
      tableText.includes('資産の部') || 
      tableText.includes('負債の部') ||
      tableHTML.includes('balance sheet') ||
      tableHTML.includes('financial position')
    ) {
      tableType = 'balance_sheet';
    } else if (
      tableTitle.includes('損益計算書') || 
      tableTitle.includes('経営成績') || 
      tableText.includes('売上高') || 
      tableText.includes('営業利益') ||
      tableHTML.includes('income statement') ||
      tableHTML.includes('profit and loss')
    ) {
      tableType = 'income_statement';
    } else if (
      tableTitle.includes('キャッシュ・フロー') || 
      tableText.includes('営業活動によるキャッシュ・フロー') ||
      tableHTML.includes('cash flow')
    ) {
      tableType = 'cash_flow';
    } else if (
      tableTitle.includes('株主資本') || 
      tableText.includes('株主持分') ||
      tableHTML.includes('shareholder') ||
      tableHTML.includes('equity')
    ) {
      tableType = 'shareholder';
    }
    
    // テーブルの行と列を処理
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return;
    
    // ヘッダー行を識別
    let headerRows: Element[] = [];
    const headerCandidates = Array.from(rows).slice(0, Math.min(3, rows.length));
    
    // TH要素を含む行をヘッダーと判断
    headerRows = headerCandidates.filter(row => 
      row.querySelector('th') !== null || 
      // または最初の行が最大列数を持つ場合
      (headerCandidates.indexOf(row) === 0 && row.querySelectorAll('td, th').length >= 2)
    );
    
    // ヘッダーがなければ最初の行をヘッダーとして使用
    if (headerRows.length === 0 && rows.length > 0) {
      headerRows = [rows[0]];
    }
    
    // データ行を抽出（ヘッダー以外）
    const dataRows = Array.from(rows).filter(row => !headerRows.includes(row));
    
    // ヘッダーとデータをXBRL形式に変換
    const headers: XBRLCellData[] = processHeaderRow(headerRows, contexts, units);
    const processedRows: XBRLCellData[][] = dataRows.map(row => 
      processDataRow(row, contexts, units)
    );
    
    // 列数を揃える
    const maxCols = Math.max(
      headers.length, 
      ...processedRows.map(row => row.length)
    );
    
    // XBRLタグを統計
    const xbrlTags = new Set<string>();
    headers.forEach(cell => {
      if (cell.xbrlTag) xbrlTags.add(cell.xbrlTag);
    });
    
    processedRows.forEach(row => {
      row.forEach(cell => {
        if (cell.xbrlTag) xbrlTags.add(cell.xbrlTag);
      });
    });
    
    // XBRL要素の存在しない空のセルの数を計算
    let emptyCells = 0;
    processedRows.forEach(row => {
      row.forEach(cell => {
        if (cell.value === '' && !cell.xbrlTag) emptyCells++;
      });
    });
    
    // テーブルデータを作成
    result.push({
      id: `table-${tableIndex}`,
      headers,
      rows: processedRows,
      originalTable: table.outerHTML,
      tableType,
      tableTitle,
      statistics: {
        rowCount: processedRows.length,
        columnCount: headers.length,
        emptyCells,
        totalCells: processedRows.length * maxCols,
        xbrlTagCount: xbrlTags.size,
        xbrlTags: Array.from(xbrlTags)
      },
      contextInfo: contexts,
      unitInfo: units
    });
  });
  
  return result;
}

/**
 * XBRLデータから仮想テーブルを構築
 */
function createVirtualTableFromXBRL(
  xbrlElements: Element[],
  contexts: Record<string, XBRLContextInfo>,
  units: Record<string, XBRLUnitInfo>
): XBRLTableData | null {
  // XBRLデータからテーブルを構築するロジック
  if (xbrlElements.length === 0) return null;
  
  // XBRL要素を分類
  const financialItems: {
    tag: string;
    label: string;
    value: string;
    contextRef: string | null;
    unitRef: string | null;
  }[] = [];
  
  xbrlElements.forEach(el => {
    const name = el.getAttribute('name');
    const contextRef = el.getAttribute('contextref') || el.getAttribute('contextRef');
    const unitRef = el.getAttribute('unitref') || el.getAttribute('unitRef');
    const text = el.textContent?.trim() || '';
    
    if (name && text) {
      // 最後の部分を取得（ラベル用）
      const parts = name.split(':');
      const labelPart = parts.length > 1 ? parts[1] : name;
      
      financialItems.push({
        tag: name,
        label: labelPart, // 後でより良いラベル付けを行う
        value: text,
        contextRef,
        unitRef
      });
    }
  });
  
  if (financialItems.length === 0) return null;
  
  // 仮想テーブルの構築
  console.log(`${financialItems.length}個のXBRL要素から仮想テーブルを構築します`);
  
  // コンテキストでグループ化
  const itemsByContext: Record<string, typeof financialItems> = {};
  financialItems.forEach(item => {
    if (item.contextRef) {
      if (!itemsByContext[item.contextRef]) {
        itemsByContext[item.contextRef] = [];
      }
      itemsByContext[item.contextRef].push(item);
    }
  });
  
  // 現在期間と前期間のコンテキストを見つける
  let currentPeriodContext = '';
  let previousPeriodContext = '';
  
  for (const contextId in contexts) {
    const context = contexts[contextId];
    if (context.isCurrentPeriod) {
      currentPeriodContext = contextId;
    } else if (context.isPreviousPeriod) {
      previousPeriodContext = contextId;
    }
  }
  
  // ヘッダーを構築
  const headers: XBRLCellData[] = [
    { value: '項目', xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null, periodInfo: null, unitInfo: null },
    { 
      value: '前期', 
      xbrlTag: null, 
      contextRef: previousPeriodContext, 
      unitRef: null, 
      decimals: null, 
      scale: null, 
      format: null, 
      periodInfo: previousPeriodContext ? contexts[previousPeriodContext] : null, 
      unitInfo: null 
    },
    { 
      value: '当期', 
      xbrlTag: null, 
      contextRef: currentPeriodContext, 
      unitRef: null, 
      decimals: null, 
      scale: null, 
      format: null, 
      periodInfo: currentPeriodContext ? contexts[currentPeriodContext] : null, 
      unitInfo: null 
    }
  ];
  
  // 行を構築（すべての一意なタグを収集）
  const uniqueTags = new Set(financialItems.map(item => item.tag));
  const rows: XBRLCellData[][] = [];
  
  uniqueTags.forEach(tag => {
    const itemsWithTag = financialItems.filter(item => item.tag === tag);
    if (itemsWithTag.length === 0) return;
    
    const label = itemsWithTag[0].label;
    const row: XBRLCellData[] = [
      { value: label, xbrlTag: tag, contextRef: null, unitRef: null, decimals: null, scale: null, format: null, periodInfo: null, unitInfo: null }
    ];
    
    // 前期のデータを見つける
    const previousItem = itemsWithTag.find(item => 
      item.contextRef && contexts[item.contextRef] && contexts[item.contextRef].isPreviousPeriod
    );
    
    row.push({
      value: previousItem ? previousItem.value : '',
      xbrlTag: tag,
      contextRef: previousItem ? previousItem.contextRef : null,
      unitRef: previousItem ? previousItem.unitRef : null,
      decimals: null,
      scale: null,
      format: null,
      periodInfo: previousItem && previousItem.contextRef ? contexts[previousItem.contextRef] : null,
      unitInfo: previousItem && previousItem.unitRef ? units[previousItem.unitRef] : null
    });
    
    // 当期のデータを見つける
    const currentItem = itemsWithTag.find(item => 
      item.contextRef && contexts[item.contextRef] && contexts[item.contextRef].isCurrentPeriod
    );
    
    row.push({
      value: currentItem ? currentItem.value : '',
      xbrlTag: tag,
      contextRef: currentItem ? currentItem.contextRef : null,
      unitRef: currentItem ? currentItem.unitRef : null,
      decimals: null,
      scale: null,
      format: null,
      periodInfo: currentItem && currentItem.contextRef ? contexts[currentItem.contextRef] : null,
      unitInfo: currentItem && currentItem.unitRef ? units[currentItem.unitRef] : null
    });
    
    rows.push(row);
  });
  
  // タグの種類に基づいてテーブルタイプを推測
  let tableType: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'shareholder' | 'unknown' = 'unknown';
  const allTags = Array.from(uniqueTags).join(' ').toLowerCase();
  
  if (
    allTags.includes('assets') || 
    allTags.includes('liabilities') || 
    allTags.includes('equity') ||
    allTags.includes('資産') || 
    allTags.includes('負債') || 
    allTags.includes('純資産')
  ) {
    tableType = 'balance_sheet';
  } else if (
    allTags.includes('revenue') || 
    allTags.includes('income') || 
    allTags.includes('expense') ||
    allTags.includes('売上') || 
    allTags.includes('収益') || 
    allTags.includes('営業利益')
  ) {
    tableType = 'income_statement';
  } else if (
    allTags.includes('cash') || 
    allTags.includes('flow') ||
    allTags.includes('キャッシュ') || 
    allTags.includes('フロー')
  ) {
    tableType = 'cash_flow';
  }
  
  return {
    id: 'virtual-table',
    headers,
    rows,
    originalTable: '<table class="virtual-xbrl-table"><tr><td>仮想テーブル - XBRLデータから自動生成</td></tr></table>',
    tableType,
    tableTitle: 'XBRLデータから生成された財務情報',
    statistics: {
      rowCount: rows.length,
      columnCount: headers.length,
      emptyCells: 0, // 後で計算
      totalCells: rows.length * headers.length,
      xbrlTagCount: uniqueTags.size,
      xbrlTags: Array.from(uniqueTags)
    },
    contextInfo: contexts,
    unitInfo: units
  };
}

/**
 * ヘッダー行を処理
 */
function processHeaderRow(
  headerRows: Element[], 
  contexts: Record<string, XBRLContextInfo>,
  units: Record<string, XBRLUnitInfo>
): XBRLCellData[] {
  const headerCells: XBRLCellData[] = [];
  
  // 複数のヘッダー行がある場合は統合
  headerRows.forEach(row => {
    const cells = row.querySelectorAll('th, td');
    Array.from(cells).forEach((cell, index) => {
      // colspan属性の処理
      const colspan = parseInt(cell.getAttribute('colspan') || '1') || 1;
      
      // XBRLタグ情報の抽出
      const xbrlInfo = extractXBRLFromElement(cell, contexts, units);
      
      // セルのテキスト内容
      const text = cell.textContent?.trim() || '';
      
      // 単一のセルを追加するか、colspanに応じて複数のセルを追加
      if (colspan === 1) {
        // 既存のヘッダーセルを更新または新しいセルを追加
        if (index < headerCells.length) {
          // 既存のセルに新しいコンテンツがある場合のみ更新
          if (text && !headerCells[index].value) {
            headerCells[index].value = text;
          }
          // XBRLタグが存在する場合は更新
          if (xbrlInfo.xbrlTag && !headerCells[index].xbrlTag) {
            headerCells[index].xbrlTag = xbrlInfo.xbrlTag;
            headerCells[index].contextRef = xbrlInfo.contextRef;
            headerCells[index].unitRef = xbrlInfo.unitRef;
            headerCells[index].periodInfo = xbrlInfo.periodInfo;
            headerCells[index].unitInfo = xbrlInfo.unitInfo;
          }
        } else {
          // 新しいセルを追加
          headerCells.push({
            value: text,
            xbrlTag: xbrlInfo.xbrlTag,
            contextRef: xbrlInfo.contextRef,
            unitRef: xbrlInfo.unitRef,
            decimals: xbrlInfo.decimals,
            scale: xbrlInfo.scale,
            format: xbrlInfo.format,
            periodInfo: xbrlInfo.periodInfo,
            unitInfo: xbrlInfo.unitInfo
          });
        }
      } else {
        // colspanが1より大きい場合、複数のセルに分割
        for (let i = 0; i < colspan; i++) {
          if (index + i < headerCells.length) {
            // 既存のセルを更新（最初のセルだけテキストを設定）
            if (i === 0 && text && !headerCells[index + i].value) {
              headerCells[index + i].value = text;
            }
            // XBRLタグが存在する場合は最初のセルだけ更新
            if (i === 0 && xbrlInfo.xbrlTag && !headerCells[index + i].xbrlTag) {
              headerCells[index + i].xbrlTag = xbrlInfo.xbrlTag;
              headerCells[index + i].contextRef = xbrlInfo.contextRef;
              headerCells[index + i].unitRef = xbrlInfo.unitRef;
              headerCells[index + i].periodInfo = xbrlInfo.periodInfo;
              headerCells[index + i].unitInfo = xbrlInfo.unitInfo;
            }
          } else {
            // 新しいセルを追加
            headerCells.push({
              value: i === 0 ? text : '',
              xbrlTag: i === 0 ? xbrlInfo.xbrlTag : null,
              contextRef: i === 0 ? xbrlInfo.contextRef : null,
              unitRef: i === 0 ? xbrlInfo.unitRef : null,
              decimals: i === 0 ? xbrlInfo.decimals : null,
              scale: i === 0 ? xbrlInfo.scale : null,
              format: i === 0 ? xbrlInfo.format : null,
              periodInfo: i === 0 ? xbrlInfo.periodInfo : null,
              unitInfo: i === 0 ? xbrlInfo.unitInfo : null
            });
          }
        }
      }
    });
  });
  
  // 列見出しが空の場合にデフォルト見出しを設定
  if (headerCells.length === 0) {
    return [
      { value: '項目', xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null, periodInfo: null, unitInfo: null },
      { value: '前期', xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null, periodInfo: null, unitInfo: null },
      { value: '当期', xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null, periodInfo: null, unitInfo: null }
    ];
  }
  
  // ヘッダーにコンテキスト情報を基に前期/当期のラベルを設定
  headerCells.forEach(cell => {
    if (cell.periodInfo) {
      if (cell.periodInfo.isCurrentPeriod && !cell.value) {
        cell.value = '当期';
      } else if (cell.periodInfo.isPreviousPeriod && !cell.value) {
        cell.value = '前期';
      }
    }
  });
  
  return headerCells;
}

/**
 * データ行を処理
 */
function processDataRow(
  row: Element, 
  contexts: Record<string, XBRLContextInfo>,
  units: Record<string, XBRLUnitInfo>
): XBRLCellData[] {
  const rowCells: XBRLCellData[] = [];
  const cells = row.querySelectorAll('th, td');
  
  Array.from(cells).forEach(cell => {
    // colspanの処理
    const colspan = parseInt(cell.getAttribute('colspan') || '1') || 1;
    
    // XBRLタグ情報の抽出
    const xbrlInfo = extractXBRLFromElement(cell, contexts, units);
    
    // セルのテキスト内容
    let text = cell.textContent?.trim() || '';
    
    // 金額表示の整形
    if (text) {
      // カンマ区切りを保持
      text = text.replace(/△/g, '-').replace(/▲/g, '-').replace(/　/g, ' ');
    }
    
    // colspanの処理
    for (let i = 0; i < colspan; i++) {
      rowCells.push({
        value: i === 0 ? text : '',
        xbrlTag: i === 0 ? xbrlInfo.xbrlTag : null,
        contextRef: i === 0 ? xbrlInfo.contextRef : null,
        unitRef: i === 0 ? xbrlInfo.unitRef : null,
        decimals: i === 0 ? xbrlInfo.decimals : null,
        scale: i === 0 ? xbrlInfo.scale : null,
        format: i === 0 ? xbrlInfo.format : null,
        periodInfo: i === 0 ? xbrlInfo.periodInfo : null,
        unitInfo: i === 0 ? xbrlInfo.unitInfo : null
      });
    }
  });
  
  return rowCells;
}

/**
 * HTML要素からXBRL情報を抽出
 */
function extractXBRLFromElement(
  element: Element, 
  contexts: Record<string, XBRLContextInfo>,
  units: Record<string, XBRLUnitInfo>
): {
  xbrlTag: string | null;
  contextRef: string | null;
  unitRef: string | null;
  decimals: string | null;
  scale: string | null;
  format: string | null;
  periodInfo: XBRLContextInfo | null;
  unitInfo: XBRLUnitInfo | null;
} {
  // まず要素自体の属性を確認
  let contextRef = element.getAttribute('contextref') || element.getAttribute('contextRef');
  let unitRef = element.getAttribute('unitref') || element.getAttribute('unitRef');
  let name = element.getAttribute('name');
  let decimals = element.getAttribute('decimals');
  let scale = element.getAttribute('scale');
  let format = element.getAttribute('format');
  
  // XBRLクラスの有無を確認
  if (element.classList.contains('xbrl') || element.classList.contains('XBRL')) {
    // クラスからXBRLタグ情報を抽出する試み
    const classNames = Array.from(element.classList);
    for (const className of classNames) {
      if (className.startsWith('jp') || className.includes('xbrl')) {
        name = name || className;
      }
      if (className.startsWith('ctx')) {
        contextRef = contextRef || className.replace('ctx-', '');
      }
      if (className.startsWith('unit')) {
        unitRef = unitRef || className.replace('unit-', '');
      }
    }
    
    // data-属性も確認
    if (!contextRef) contextRef = element.getAttribute('data-contextref') || element.getAttribute('data-context');
    if (!unitRef) unitRef = element.getAttribute('data-unitref') || element.getAttribute('data-unit');
    if (!name) name = element.getAttribute('data-name') || element.getAttribute('data-xbrl');
  }
  
  // 子要素も確認
  if (!contextRef || !name) {
    const xbrlChild = element.querySelector('[contextref], [contextRef], [name]');
    if (xbrlChild) {
      contextRef = contextRef || xbrlChild.getAttribute('contextref') || xbrlChild.getAttribute('contextRef');
      unitRef = unitRef || xbrlChild.getAttribute('unitref') || xbrlChild.getAttribute('unitRef');
      name = name || xbrlChild.getAttribute('name');
      decimals = decimals || xbrlChild.getAttribute('decimals');
      scale = scale || xbrlChild.getAttribute('scale');
      format = format || xbrlChild.getAttribute('format');
    }
  }
  
  // コンテキスト情報と単位情報を設定
  const periodInfo = contextRef && contexts[contextRef] ? contexts[contextRef] : null;
  const unitInfo = unitRef && units[unitRef] ? units[unitRef] : null;
  
  return {
    xbrlTag: name,
    contextRef,
    unitRef,
    decimals,
    scale,
    format,
    periodInfo,
    unitInfo
  };
}

/**
 * フォールバックとしてテーブルを処理
 * XBRLタグが見つからない場合でもテーブル構造からデータを抽出
 */
function processTablesAsFallback(tables: Element[]): XBRLTableData[] {
  return tables.map((table, index) => {
    // テーブルタイトルを取得
    let tableTitle = '';
    const previousElement = table.previousElementSibling;
    if (previousElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(previousElement.tagName)) {
      tableTitle = previousElement.textContent?.trim() || '';
    }
    
    // テーブルタイプを推測（テキスト内容から）
    let tableType: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'shareholder' | 'unknown' = 'unknown';
    const tableText = table.textContent?.toLowerCase() || '';
    
    if (
      tableText.includes('資産') && tableText.includes('負債') || 
      tableText.includes('貸借対照表') || 
      tableText.includes('財政状態')
    ) {
      tableType = 'balance_sheet';
    } else if (
      tableText.includes('売上') && tableText.includes('利益') || 
      tableText.includes('損益計算書') || 
      tableText.includes('経営成績')
    ) {
      tableType = 'income_statement';
    } else if (
      tableText.includes('キャッシュ・フロー') || 
      tableText.includes('営業活動') && tableText.includes('投資活動')
    ) {
      tableType = 'cash_flow';
    }
    
    // 行と列を処理
    const rows = table.querySelectorAll('tr');
    const headerRows = rows.length > 0 ? [rows[0]] : [];
    const dataRows = Array.from(rows).slice(1);
    
    // ヘッダーとデータを基本形式で変換
    const headers: XBRLCellData[] = [];
    if (headerRows.length > 0) {
      const headerCells = headerRows[0].querySelectorAll('th, td');
      Array.from(headerCells).forEach(cell => {
        const text = cell.textContent?.trim() || '';
        const colspan = parseInt(cell.getAttribute('colspan') || '1') || 1;
        
        for (let i = 0; i < colspan; i++) {
          headers.push({
            value: i === 0 ? text : '',
            xbrlTag: null,
            contextRef: null,
            unitRef: null,
            decimals: null,
            scale: null,
            format: null,
            periodInfo: null,
            unitInfo: null
          });
        }
      });
    }
    
    // データ行を処理
    const processedRows: XBRLCellData[][] = dataRows.map(row => {
      const rowCells: XBRLCellData[] = [];
      const cells = row.querySelectorAll('th, td');
      
      Array.from(cells).forEach(cell => {
        const text = cell.textContent?.trim().replace(/△/g, '-').replace(/▲/g, '-') || '';
        const colspan = parseInt(cell.getAttribute('colspan') || '1') || 1;
        
        for (let i = 0; i < colspan; i++) {
          rowCells.push({
            value: i === 0 ? text : '',
            xbrlTag: null,
            contextRef: null,
            unitRef: null,
            decimals: null,
            scale: null,
            format: null,
            periodInfo: null,
            unitInfo: null
          });
        }
      });
      
      return rowCells;
    });
    
    // 列数を揃える
    const maxCols = Math.max(
      headers.length, 
      ...processedRows.map(row => row.length)
    );
    
    // 列見出しがない場合はデフォルト見出しを設定
    if (headers.length === 0) {
      // デフォルトのヘッダーを生成
      for (let i = 0; i < maxCols; i++) {
        if (i === 0) {
          headers.push({ value: '項目', xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null, periodInfo: null, unitInfo: null });
        } else if (i === maxCols - 2) {
          headers.push({ value: '前期', xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null, periodInfo: null, unitInfo: null });
        } else if (i === maxCols - 1) {
          headers.push({ value: '当期', xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null, periodInfo: null, unitInfo: null });
        } else {
          headers.push({ value: `列 ${i + 1}`, xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null, periodInfo: null, unitInfo: null });
        }
      }
    }
    
    // 空のセルの数
    let emptyCells = 0;
    processedRows.forEach(row => {
      row.forEach(cell => {
        if (cell.value === '') emptyCells++;
      });
    });
    
    return {
      id: `table-${index}`,
      headers,
      rows: processedRows,
      originalTable: table.outerHTML,
      tableType,
      tableTitle,
      statistics: {
        rowCount: processedRows.length,
        columnCount: headers.length,
        emptyCells,
        totalCells: processedRows.length * maxCols,
        xbrlTagCount: 0,
        xbrlTags: []
      },
      contextInfo: {},
      unitInfo: {}
    };
  });
}
