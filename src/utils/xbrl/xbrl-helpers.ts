/**
 * XBRL/iXBRL処理用ヘルパー関数
 * 
 * 財務データの抽出と構造化のための各種ユーティリティ関数を提供します。
 * 主に日本のEDINET XBRLフォーマットを対象としています。
 */

/**
 * iXBRL文書から特殊な要素と構造を抽出する
 * @param doc HTML/XML文書
 * @returns iXBRL特有の要素と情報
 */
export const processIXBRL = (doc: Document) => {
  // 名前空間情報を取得
  const namespaces = resolveXBRLNamespace(doc);
  
  // 隠れた要素の取得（表示されていないXBRL要素）- 拡張検索
  let hiddenElements: Element[] = [];
  try {
    // 複数の隠れた要素パターンを検索
    const hiddenSelectors = [
      'ix\\:hidden', 
      '[style*="display:none"]', 
      '[style*="visibility:hidden"]',
      '[hidden]', 
      '.hidden', 
      '.ixbrl-hidden', 
      '.xbrl-hidden', 
      'span[style*="display:none"]',
      'div[style*="display:none"]'
    ];
    
    hiddenElements = Array.from(doc.querySelectorAll(hiddenSelectors.join(',')));
    
    // XPath検索も試みる（ブラウザサポートによる）
    try {
      const xpathResult = doc.evaluate('//ix:hidden', doc, 
        (prefix: string | null) => {
          if (prefix === 'ix') return namespaces['ix'] || 'http://www.xbrl.org/2013/inlineXBRL';
          return null;
        }, 
        XPathResult.ANY_TYPE, null);
      
      let element = xpathResult.iterateNext();
      while (element) {
        if (!hiddenElements.includes(element as Element)) {
          hiddenElements.push(element as Element);
        }
        element = xpathResult.iterateNext();
      }
    } catch (e) {
      console.log('XPath検索エラー:', e instanceof Error ? e.message : String(e));
    }
    
    // コメント内の隠れたXBRL要素を検索
    try {
      // コメントノードを取得
      const walker = doc.createTreeWalker(
        doc.documentElement,
        NodeFilter.SHOW_COMMENT,
        null
      );
      
      let commentNode = walker.nextNode();
      while (commentNode) {
        const commentContent = commentNode.nodeValue || '';
        if (commentContent.includes('xbrl') || 
            commentContent.includes('contextRef') || 
            commentContent.includes('unitRef')) {
          // コメント内にXBRL情報があれば処理
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = commentContent;
          
          // コメント内のXBRL要素を検索
          const commentXbrlElements = tempDiv.querySelectorAll('[contextRef], [name], [unitRef]');
          if (commentXbrlElements.length > 0) {
            // コメント内の要素を追加
            Array.from(commentXbrlElements).forEach(el => {
              if (el instanceof Element) {
                // 新しい要素として文書に挿入
                hiddenElements.push(el);
              }
            });
          }
        }
        commentNode = walker.nextNode();
      }
    } catch (e) {
      console.log('コメント検索エラー:', e instanceof Error ? e.message : String(e));
    }
  } catch (e) {
    console.log('Hidden要素検索エラー:', e instanceof Error ? e.message : String(e));
  }
  
  // コンテキスト要素の取得（期間、エンティティなどの情報）- 拡張検索
  let contextElements: Element[] = [];
  try {
    // 複数のセレクタパターンで検索
    const contextSelectors = [
      'xbrli\\:context', 
      'context', 
      'ix\\:context', 
      '[contextRef]', 
      '[contextref]',
      '[id^="Context"]',
      '[id^="context"]'
    ];
    
    contextElements = Array.from(doc.querySelectorAll(contextSelectors.join(',')));
    
    // カスタム属性でコンテキスト情報を持つ要素も検索
    const dataContextElements = Array.from(doc.querySelectorAll(
      '[data-context], [data-xbrl-context], [context-id], [contextId]'
    ));
    
    // 重複を排除して追加
    dataContextElements.forEach(el => {
      if (!contextElements.includes(el)) {
        contextElements.push(el);
      }
    });
  } catch (e) {
    console.log('Context要素検索エラー:', e instanceof Error ? e.message : String(e));
  }
  
  // 単位要素の取得（円、株などの単位情報）- 拡張検索
  let unitElements: Element[] = [];
  try {
    // 複数のセレクタパターンで検索
    const unitSelectors = [
      'xbrli\\:unit', 
      'unit', 
      'ix\\:unit', 
      '[unitRef]', 
      '[unitref]',
      '[id^="Unit"]',
      '[id^="unit"]'
    ];
    
    unitElements = Array.from(doc.querySelectorAll(unitSelectors.join(',')));
    
    // カスタム属性で単位情報を持つ要素も検索
    const dataUnitElements = Array.from(doc.querySelectorAll(
      '[data-unit], [data-xbrl-unit], [unit-id], [unitId]'
    ));
    
    // 重複を排除して追加
    dataUnitElements.forEach(el => {
      if (!unitElements.includes(el)) {
        unitElements.push(el);
      }
    });
  } catch (e) {
    console.log('Unit要素検索エラー:', e instanceof Error ? e.message : String(e));
  }
  
  // 脚注要素の取得（注記情報）
  const footnoteElements = Array.from(doc.querySelectorAll(
    'xbrli\\:footnote, footnote, link\\:footnote, [role*="footnote"]'
  ));
  
  // フットノートアーク要素の取得（注記と財務項目の関連付け）
  const footnoteArcs = Array.from(doc.querySelectorAll(
    'link\\:footnoteArc, footnoteArc, [arcrole*="fact-footnote"]'
  ));
  
  // インラインXBRL要素の取得（値を含む要素）- 拡張検索
  const inlineElements = [
    ...Array.from(doc.querySelectorAll('ix\\:nonnumeric, [*|nonnumeric]')),
    ...Array.from(doc.querySelectorAll('ix\\:nonfraction, [*|nonfraction]')),
    ...Array.from(doc.querySelectorAll('ix\\:fraction, [*|fraction]')),
    ...Array.from(doc.querySelectorAll('[name][contextRef]')),
    ...Array.from(doc.querySelectorAll('[name][contextref]')),
    ...Array.from(doc.querySelectorAll('[format]')),
    ...Array.from(doc.querySelectorAll('[scale]')),
    ...Array.from(doc.querySelectorAll('[decimals]')),
    ...Array.from(doc.querySelectorAll('[sign]'))
  ];
  
  // Edinet特有の要素検索
  const edinetSpecificElements = [
    ...Array.from(doc.querySelectorAll('[jpcrp_cor]')),
    ...Array.from(doc.querySelectorAll('[jppfs_cor]')),
    ...Array.from(doc.querySelectorAll('[jpdei_cor]')),
    ...Array.from(doc.querySelectorAll('[jpcrp]')),
    ...Array.from(doc.querySelectorAll('[jppfs]'))
  ];
  
  // テーブル内の財務データを含む可能性が高い要素を特定
  const tableDataElements = Array.from(doc.querySelectorAll(
    'table td, table th'
  ));
  
  // テーブルデータ要素内のXBRL情報を検索
  const tableXbrlElements: Element[] = [];
  tableDataElements.forEach(el => {
    // contextRef属性または関連属性を持つ子要素があるか確認
    const hasXbrlChild = el.querySelector('[contextRef], [name], [unitRef]');
    if (hasXbrlChild) {
      tableXbrlElements.push(el);
    }
  });
  
  return {
    namespaces,
    hiddenElements,
    contextElements,
    unitElements,
    footnoteElements,
    footnoteArcs,
    inlineElements,
    edinetSpecificElements,
    tableXbrlElements
  };
};

/**
 * XML/XBRL文書から名前空間情報を抽出する
 * @param doc HTML/XML文書
 * @returns 名前空間プレフィックスとURIのマッピング
 */
export const resolveXBRLNamespace = (doc: Document) => {
  // 標準的なXBRL名前空間のマッピング（初期値）
  const namespaces: Record<string, string> = {
    'ix': 'http://www.xbrl.org/2013/inlineXBRL',
    'xbrli': 'http://www.xbrl.org/2003/instance',
    'jppfs': 'http://disclosure.edinet-fsa.go.jp/taxonomy/jppfs/2013-08-31/jppfs_cor',
    'jpcrp': 'http://disclosure.edinet-fsa.go.jp/taxonomy/jpcrp/2013-08-31/jpcrp_cor',
    'jpdei': 'http://disclosure.edinet-fsa.go.jp/taxonomy/jpdei/2013-08-31/jpdei_cor',
    'jpigp': 'http://disclosure.edinet-fsa.go.jp/taxonomy/jpigp/2013-08-31/jpigp_cor',
    'jplvh': 'http://disclosure.edinet-fsa.go.jp/taxonomy/jplvh/2013-08-31/jplvh_cor',
    'jpfie': 'http://disclosure.edinet-fsa.go.jp/taxonomy/jpfie/2013-08-31/jpfie_cor',
    'jpcai': 'http://disclosure.edinet-fsa.go.jp/taxonomy/jpcai/2013-08-31/jpcai_cor',
    'jppre': 'http://disclosure.edinet-fsa.go.jp/taxonomy/jppre/2013-08-31/jppre_cor',
    'link': 'http://www.xbrl.org/2003/linkbase',
    'xbrldt': 'http://xbrl.org/2005/xbrldt',
    'xlink': 'http://www.w3.org/1999/xlink'
  };
  
  // ドキュメントの名前空間定義を取得（上書き）
  try {
    Array.from(doc.documentElement.attributes).forEach(attr => {
      if (attr.name.startsWith('xmlns:')) {
        const prefix = attr.name.substring(6); // 'xmlns:'の後の部分
        namespaces[prefix] = attr.value;
      }
    });
  } catch (e) {
    console.error('名前空間解決エラー:', e instanceof Error ? e.message : String(e));
  }
  
  return namespaces;
};

/**
 * XBRLコンテキスト要素を処理して構造化する
 * @param elements コンテキスト要素の配列
 * @returns 構造化されたコンテキスト情報のマップ
 */
export const processContexts = (elements: Element[]) => {
  const contexts: Record<string, any> = {};
  
  elements.forEach(context => {
    const id = context.getAttribute('id');
    if (!id) return;
    
    // 期間情報を取得
    const instant = context.querySelector('xbrli\\:instant, instant');
    const startDate = context.querySelector('xbrli\\:startDate, startDate');
    const endDate = context.querySelector('xbrli\\:endDate, endDate');
    
    // エンティティ情報を取得
    const identifier = context.querySelector('xbrli\\:identifier, identifier');
    const scheme = identifier ? identifier.getAttribute('scheme') : null;
    
    // シナリオ情報（分析軸）を取得
    const scenario = context.querySelector('xbrli\\:scenario, scenario');
    const explicitMember = scenario ? scenario.querySelector('xbrldi\\:explicitMember, explicitMember') : null;
    
    // 期間タイプを判定
    let periodType = 'unknown';
    if (instant) {
      periodType = 'instant';
    } else if (startDate && endDate) {
      periodType = 'duration';
    }
    
    // 年度の判定（当期/前期）
    let fiscalYear = 'unknown';
    if (instant) {
      const instantDate = instant.textContent?.trim();
      fiscalYear = instantDate ? determineFiscalYear(instantDate) : 'unknown';
    } else if (endDate) {
      const endDateValue = endDate.textContent?.trim();
      fiscalYear = endDateValue ? determineFiscalYear(endDateValue) : 'unknown';
    }
    
    // コンテキストIDを財務データの期間に関連付け
    const isCurrentPeriod = fiscalYear === 'current';
    const isPreviousPeriod = fiscalYear === 'previous';
    
    // メンバー情報を処理（連結・個別の識別など）
    let memberType = 'unknown';
    let memberValue = null;
    
    if (explicitMember) {
      const dimension = explicitMember.getAttribute('dimension');
      const value = explicitMember.textContent?.trim();
      
      memberValue = value;
      
      // 連結・個別の判定
      if (dimension && dimension.includes('ConsolidatedOrNonConsolidatedAxis') ||
          dimension && dimension.includes('jpcrp_cor:ConsolidatedOrNonConsolidatedAxis')) {
        if (value && value.includes('Consolidated')) {
          memberType = 'consolidated'; // 連結
        } else if (value && value.includes('NonConsolidated')) {
          memberType = 'non_consolidated'; // 個別
        }
      }
    }
    
    // コンテキスト情報を保存
    contexts[id] = {
      periodType,
      instant: instant ? instant.textContent?.trim() : null,
      startDate: startDate ? startDate.textContent?.trim() : null,
      endDate: endDate ? endDate.textContent?.trim() : null,
      entity: identifier ? identifier.textContent?.trim() : null,
      scheme: scheme,
      explicitMember: explicitMember ? {
        dimension: explicitMember.getAttribute('dimension'),
        value: explicitMember.textContent?.trim()
      } : null,
      fiscalYear,
      isCurrentPeriod,
      isPreviousPeriod,
      memberType,
      memberValue
    };
  });
  
  return contexts;
};

/**
 * 日付文字列から会計年度（当期/前期）を判定する
 * @param dateString 日付文字列（YYYY-MM-DD形式）
 * @returns 会計年度の種類
 */
export const determineFiscalYear = (dateString: string): 'current' | 'previous' | 'unknown' => {
  try {
    // 日付のフォーマットを確認（YYYY-MM-DD）
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return 'unknown';
    }
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const currentYear = new Date().getFullYear();
    
    // コンテキストIDに基づく判定（EDINETの命名規則）
    if (dateString.includes('CurrentYear') || dateString.includes('Current')) {
      return 'current';
    } else if (dateString.includes('PriorYear') || dateString.includes('Prior')) {
      return 'previous';
    }
    
    // 現在の年から最大2年前までを当期、3-4年前を前期と判定
    // この部分は実際の財務データの期間に合わせて調整が必要
    if (year >= currentYear - 2) {
      return 'current';
    } else if (year >= currentYear - 4) {
      return 'previous';
    } else {
      return 'unknown';
    }
  } catch (e) {
    console.error('日付解析エラー:', e instanceof Error ? e.message : String(e));
    return 'unknown';
  }
};

/**
 * XBRL単位要素を処理して構造化する
 * @param elements 単位要素の配列
 * @returns 構造化された単位情報のマップ
 */
export const processUnits = (elements: Element[]) => {
  const units: Record<string, any> = {};
  
  elements.forEach(unit => {
    const id = unit.getAttribute('id');
    if (!id) return;
    
    // 単位情報を取得
    const measure = unit.querySelector('xbrli\\:measure, measure');
    const divide = unit.querySelector('xbrli\\:divide, divide');
    
    if (measure) {
      // 単純な単位（例: 円、ドル）
      units[id] = {
        type: 'simple',
        measure: measure.textContent?.trim()
      };
    } else if (divide) {
      // 複合単位（例: 1株あたり円）
      const numerator = divide.querySelector('xbrli\\:unitNumerator, unitNumerator');
      const denominator = divide.querySelector('xbrli\\:unitDenominator, unitDenominator');
      
      units[id] = {
        type: 'fraction',
        numerator: numerator?.querySelector('xbrli\\:measure, measure')?.textContent?.trim(),
        denominator: denominator?.querySelector('xbrli\\:measure, measure')?.textContent?.trim()
      };
    }
    
    // 単位の表示用ラベルを設定
    if (units[id]) {
      const displayLabel = getUnitDisplayLabel(units[id]);
      units[id].displayLabel = displayLabel;
    }
  });
  
  return units;
};

/**
 * 単位情報から表示用のラベルを生成する
 * @param unitInfo 単位情報
 * @returns 表示用ラベル（例: '円', '株', '円/株'）
 */
export const getUnitDisplayLabel = (unitInfo: any): string => {
  if (!unitInfo) return '';
  
  if (unitInfo.type === 'simple') {
    const measure = unitInfo.measure || '';
    if (measure.includes('iso4217:JPY')) return '円';
    if (measure.includes('iso4217:USD')) return 'ドル';
    if (measure.includes('iso4217:EUR')) return 'ユーロ';
    if (measure.includes('pure')) return '';
    if (measure.includes('shares')) return '株';
    return measure;
  } else if (unitInfo.type === 'fraction') {
    const numerator = unitInfo.numerator || '';
    const denominator = unitInfo.denominator || '';
    
    let numLabel = '';
    if (numerator.includes('iso4217:JPY')) numLabel = '円';
    else if (numerator.includes('iso4217:USD')) numLabel = 'ドル';
    else if (numerator.includes('pure')) numLabel = '';
    else numLabel = numerator.split(':').pop() || numerator;
    
    let denomLabel = '';
    if (denominator.includes('shares')) denomLabel = '株';
    else denomLabel = denominator.split(':').pop() || denominator;
    
    if (numLabel && denomLabel) {
      return `${numLabel}/${denomLabel}`;
    }
    
    return `${numerator}/${denominator}`;
  }
  
  return '';
};

/**
 * HTMLテーブルから財務表の種類を自動識別する
 * @param table テーブル要素
 * @param tableHTML テーブルのHTML
 * @param tableText テーブルのテキスト内容
 * @returns 財務表の種類と関連情報
 */
export const detectFinancialTable = (table: HTMLTableElement, tableHTML: string, tableText: string) => {
  // 財務表のマーカーパターン
  const balanceSheetPatterns = [
    '貸借対照表', 'バランスシート', '資産の部', '負債の部', '純資産の部',
    'BalanceSheet', 'balance sheet', 'Assets', 'Liabilities', 'Equity'
  ];
  
  const incomeStatementPatterns = [
    '損益計算書', '収益の部', '費用の部', '売上高', '営業利益', '経常利益', '当期純利益',
    'ProfitAndLoss', 'income statement', 'Revenue', 'OperatingIncome', 'OrdinaryIncome', 'NetIncome'
  ];
  
  const cashFlowPatterns = [
    'キャッシュ・フロー計算書', 'CF計算書', '営業活動による', '投資活動による', '財務活動による',
    'CashFlow', 'cash flow', 'OperatingActivities', 'InvestingActivities', 'FinancingActivities'
  ];
  
  const shareholderPatterns = [
    '株主', '大株主', '株式', '持株', '所有株式', '持株比率',
    'Shareholders', 'Major Shareholders', 'Shareholding', 'Stock Ownership'
  ];
  
  // XBRLタグパターン
  const balanceSheetTagPatterns = ['jppfs_cor:BS', 'BalanceSheet', 'Assets', 'Liabilities', 'Equity'];
  const incomeStatementTagPatterns = ['jppfs_cor:PL', 'ProfitAndLoss', 'Income', 'Revenue', 'Expense'];
  const cashFlowTagPatterns = ['jppfs_cor:CF', 'CashFlow', 'Cash'];
  const shareholderTagPatterns = ['jpcrp_cor:NameMajorShareholders', 'Shareholder'];
  
  // テキストパターンによる判定
  const isBalanceSheetByText = balanceSheetPatterns.some(pattern => tableText.includes(pattern));
  const isIncomeStatementByText = incomeStatementPatterns.some(pattern => tableText.includes(pattern));
  const isCashFlowByText = cashFlowPatterns.some(pattern => tableText.includes(pattern));
  const isShareholderByText = shareholderPatterns.some(pattern => tableText.includes(pattern));
  
  // XBRLタグによる判定
  const isBalanceSheetByTags = balanceSheetTagPatterns.some(pattern => tableHTML.includes(pattern));
  const isIncomeStatementByTags = incomeStatementTagPatterns.some(pattern => tableHTML.includes(pattern));
  const isCashFlowByTags = cashFlowTagPatterns.some(pattern => tableHTML.includes(pattern));
  const isShareholderByTags = shareholderTagPatterns.some(pattern => tableHTML.includes(pattern));
  
  // テーブル構造による判定
  // 資産、負債、純資産などの特徴的な項目を検索
  const hasAssetsLiabilitiesStructure = (
    (tableText.includes('資産') && tableText.includes('負債')) ||
    (tableText.includes('Assets') && tableText.includes('Liabilities'))
  );
  
  // 収益、費用などの特徴的な項目を検索
  const hasRevenueExpenseStructure = (
    (tableText.includes('売上') && tableText.includes('費用')) ||
    (tableText.includes('Revenue') && tableText.includes('Expense'))
  );
  
  // 営業活動、投資活動、財務活動などの特徴的な項目を検索
  const hasCashFlowStructure = (
    (tableText.includes('営業活動') && tableText.includes('投資活動')) ||
    (tableText.includes('Operating') && tableText.includes('Investing'))
  );
  
  // 株主名、持株数などの特徴的な項目を検索
  const hasShareholderStructure = (
    (tableText.includes('株主名') && tableText.includes('持株数')) ||
    (tableText.includes('株主名') && tableText.includes('所有株式数')) ||
    (tableText.includes('Shareholder') && tableText.includes('Shares'))
  );
  
  // 総合判定
  const isBalanceSheet = isBalanceSheetByText || isBalanceSheetByTags || hasAssetsLiabilitiesStructure;
  const isIncomeStatement = isIncomeStatementByText || isIncomeStatementByTags || hasRevenueExpenseStructure;
  const isCashFlow = isCashFlowByText || isCashFlowByTags || hasCashFlowStructure;
  const isShareholder = isShareholderByText || isShareholderByTags || hasShareholderStructure;
  
  // タイトルの推定
  let tableTitle = '';
  let tableType: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'shareholder' | 'unknown' = 'unknown';
  
  if (isBalanceSheet) {
    tableTitle = '貸借対照表';
    tableType = 'balance_sheet';
  } else if (isIncomeStatement) {
    tableTitle = '損益計算書';
    tableType = 'income_statement';
  } else if (isCashFlow) {
    tableTitle = 'キャッシュ・フロー計算書';
    tableType = 'cash_flow';
  } else if (isShareholder) {
    tableTitle = '大株主の状況';
    tableType = 'shareholder';
  }
  
  return {
    isFinancialTable: isBalanceSheet || isIncomeStatement || isCashFlow || isShareholder,
    tableType,
    tableTitle
  };
};

/**
 * HTML要素からXBRLタグ関連情報を抽出する
 * @param cell HTML要素
 * @param options 抽出オプション
 * @returns 抽出されたXBRLタグと関連情報
 */
export const extractXBRLTag = (cell: Element, options: {
  includeXbrlTags: boolean,
  contextAware?: boolean
}) => {
  if (!options.includeXbrlTags) {
    return { xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null };
  }
  
  let xbrlTag = null;
  let contextRef = null;
  let unitRef = null;
  let decimals = null;
  let scale = null;
  let format = null;
  
  try {
    // 0. 再帰的にすべての子要素を検索する関数
    const findXBRLInDescendants = (element: Element): Element | null => {
      // 直接属性を持つ場合
      if (element.hasAttribute('name') || 
          element.hasAttribute('contextRef') || 
          element.hasAttribute('unitRef')) {
        return element;
      }
      
      // 子要素を再帰的に検索
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        const found = findXBRLInDescendants(child);
        if (found) return found;
      }
      
      return null;
    };
    
    // 1. インラインXBRL（iXBRL）の要素を拡張検索
    const ixNonfractions = cell.querySelectorAll('ix\\:nonfraction, [*|nonfraction], [contextref], [contextRef], [name]');
    if (ixNonfractions && ixNonfractions.length > 0) {
      const element = ixNonfractions[0];
      xbrlTag = element.getAttribute('name') || '';
      contextRef = element.getAttribute('contextRef') || element.getAttribute('contextref') || '';
      unitRef = element.getAttribute('unitRef') || element.getAttribute('unitref') || '';
      decimals = element.getAttribute('decimals');
      scale = element.getAttribute('scale');
      format = element.getAttribute('format');
    }
    
    // 2. テキスト要素の検索 (拡張バージョン)
    if (!xbrlTag) {
      const ixNonnumerics = cell.querySelectorAll('ix\\:nonnumeric, [*|nonnumeric], [escape], [format]');
      if (ixNonnumerics && ixNonnumerics.length > 0) {
        const element = ixNonnumerics[0];
        xbrlTag = element.getAttribute('name') || '';
        contextRef = element.getAttribute('contextRef') || element.getAttribute('contextref') || '';
        format = element.getAttribute('format');
      }
    }
    
    // 3. 分数要素の検索
    if (!xbrlTag) {
      const ixFractions = cell.querySelectorAll('ix\\:fraction, [*|fraction]');
      if (ixFractions && ixFractions.length > 0) {
        const element = ixFractions[0];
        xbrlTag = element.getAttribute('name') || '';
        contextRef = element.getAttribute('contextRef') || element.getAttribute('contextref') || '';
        unitRef = element.getAttribute('unitRef') || element.getAttribute('unitref') || '';
      }
    }
    
    // 4. 拡張された名前空間パターンの検索 (大幅に拡張)
    if (!xbrlTag) {
      // 日本のXBRLタグパターンを拡張して検索 (名前空間をさらに追加)
      const xbrlElements = cell.querySelectorAll(
        '[name^="jppfs_cor:"], [name^="jpcrp"], [name^="jpdei_cor:"], ' +
        '[name^="jpigp_cor:"], [name^="jplvh_cor:"], [name^="jpfie_cor:"], ' +
        '[name^="jpcai_cor:"], [name^="jppre_cor:"], [name^="jppfs_"], [name^="jppfs:"], ' +
        '[name^="jpcrp_"], [name^="jpcrp:"], [name^="xbrl"], [name^="xbrli:"], ' +
        '[name^="xbrldi:"], [name^="xbrldt:"], [name^="link:"], [name^="num:"], ' +
        '[contextRef], [unitRef], [contextref], [unitref]'
      );
      
      if (xbrlElements && xbrlElements.length > 0) {
        const element = xbrlElements[0];
        xbrlTag = element.getAttribute('name') || '';
        contextRef = element.getAttribute('contextRef') || element.getAttribute('contextref') || '';
        unitRef = element.getAttribute('unitRef') || element.getAttribute('unitref') || '';
        decimals = element.getAttribute('decimals');
        scale = element.getAttribute('scale');
        format = element.getAttribute('format');
      }
    }
    
    // 5. 再帰的な子要素検索 (新機能)
    if (!xbrlTag || !contextRef) {
      const descendantWithXBRL = findXBRLInDescendants(cell);
      if (descendantWithXBRL) {
        if (!xbrlTag) {
          xbrlTag = descendantWithXBRL.getAttribute('name') || '';
        }
        if (!contextRef) {
          contextRef = descendantWithXBRL.getAttribute('contextRef') || 
                      descendantWithXBRL.getAttribute('contextref') || '';
        }
        if (!unitRef) {
          unitRef = descendantWithXBRL.getAttribute('unitRef') || 
                   descendantWithXBRL.getAttribute('unitref') || '';
        }
        if (!decimals) {
          decimals = descendantWithXBRL.getAttribute('decimals');
        }
        if (!scale) {
          scale = descendantWithXBRL.getAttribute('scale');
        }
        if (!format) {
          format = descendantWithXBRL.getAttribute('format');
        }
      }
    }
    
    // 6. コンテキスト参照による検出 (改善)
    if (!contextRef && options.contextAware) {
      // contextRefの大文字小文字のバリエーションを試す
      const contextVariations = ['contextRef', 'contextref', 'ContextRef', 'CONTEXTREF'];
      for (const attr of contextVariations) {
        const elements = cell.querySelectorAll(`[${attr}]`);
        if (elements && elements.length > 0) {
          const element = elements[0];
          contextRef = element.getAttribute(attr) || '';
          
          // XBRLタグが見つかっていない場合、要素名かコンテンツを使用
          if (!xbrlTag) {
            xbrlTag = element.getAttribute('name') || 
                      element.tagName.toLowerCase() || 
                      'context-ref-element';
          }
          break;
        }
      }
    }
    
    // 7. 単位参照による検出 (改善)
    if (!unitRef && options.contextAware) {
      // unitRefの大文字小文字のバリエーションを試す
      const unitVariations = ['unitRef', 'unitref', 'UnitRef', 'UNITREF'];
      for (const attr of unitVariations) {
        const elements = cell.querySelectorAll(`[${attr}]`);
        if (elements && elements.length > 0) {
          const element = elements[0];
          unitRef = element.getAttribute(attr) || '';
          
          // XBRLタグが見つかっていない場合、要素名を使用
          if (!xbrlTag) {
            xbrlTag = element.getAttribute('name') || 
                      element.tagName.toLowerCase() || 
                      'unit-ref-element';
          }
          break;
        }
      }
    }
    
    // 8. レベル要素による検出
    if (!xbrlTag) {
      const levelElements = cell.querySelectorAll('[level]');
      if (levelElements && levelElements.length > 0) {
        xbrlTag = 'hierarchy-level-' + (levelElements[0].getAttribute('level') || '');
      }
    }
    
    // 9. データ属性からの検出 (新機能)
    if (!xbrlTag) {
      const dataAttributes = [
        'data-xbrl-tag', 'data-xbrl-name', 'data-xbrl', 'data-tag', 'data-name',
        'xbrl-tag', 'xbrl-name', 'xbrlTag', 'xbrlName'
      ];
      
      for (const attr of dataAttributes) {
        if (cell.hasAttribute(attr)) {
          xbrlTag = cell.getAttribute(attr);
          break;
        }
      }
    }
    
    // 10. テキスト内容から財務項目を推測 (新機能)
    if (!xbrlTag) {
      const text = cell.textContent?.trim().toLowerCase() || '';
      
      // 貸借対照表の項目マッピング
      const balanceSheetItems: Record<string, string> = {
        '資産': 'Assets',
        '資産合計': 'TotalAssets',
        '流動資産': 'CurrentAssets',
        '固定資産': 'NoncurrentAssets',
        '有形固定資産': 'PropertyPlantAndEquipment',
        '無形固定資産': 'IntangibleAssets', 
        '投資その他の資産': 'InvestmentsAndOtherAssets',
        '負債': 'Liabilities',
        '負債合計': 'TotalLiabilities',
        '流動負債': 'CurrentLiabilities',
        '固定負債': 'NoncurrentLiabilities',
        '純資産': 'NetAssets',
        '純資産合計': 'TotalNetAssets',
        '株主資本': 'ShareholdersEquity',
        '資本金': 'CapitalStock',
        '資本剰余金': 'CapitalSurplus',
        '利益剰余金': 'RetainedEarnings',
        '自己株式': 'TreasuryStock',
        '負債純資産合計': 'LiabilitiesAndNetAssets'
      };
      
      // 項目テキストからXBRLタグを推測
      for (const [key, value] of Object.entries(balanceSheetItems)) {
        if (text.includes(key)) {
          xbrlTag = value;
          break;
        }
      }
    }
    
    // 11. 階層構造から親要素のコンテキスト情報を継承 (新機能)
    if (!contextRef && options.contextAware) {
      let parent = cell.parentElement;
      while (parent) {
        // 親要素にcontextRefがあれば継承
        const parentContextRef = parent.getAttribute('contextRef') || 
                                parent.getAttribute('contextref');
        if (parentContextRef) {
          contextRef = parentContextRef;
          break;
        }
        
        // 兄弟要素にcontextRefがあれば参考にする
        const siblings = Array.from(parent.children);
        for (const sibling of siblings) {
          if (sibling !== cell) {
            const siblingContextRef = sibling.getAttribute('contextRef') || 
                                     sibling.getAttribute('contextref');
            if (siblingContextRef) {
              contextRef = siblingContextRef;
              break;
            }
          }
        }
        
        if (contextRef) break;
        parent = parent.parentElement;
      }
    }
    
  } catch (e) {
    console.log('XBRLタグ検索エラー:', e instanceof Error ? e.message : String(e));
  }
  
  return { xbrlTag, contextRef, unitRef, decimals, scale, format };
};

/**
 * 財務データの値を適切にフォーマットする
 * @param value 元の値
 * @param decimals 小数点の桁数
 * @param scale スケール係数
 * @param format フォーマット
 * @param unitInfo 単位情報
 * @returns フォーマットされた値
 */
export const formatFinancialValue = (
  value: string | number,
  decimals: string | null,
  scale: string | null,
  format: string | null,
  unitInfo: any
) => {
  if (typeof value === 'string' && value.trim() === '') {
    return '';
  }
  
  let numValue: number;
  if (typeof value === 'string') {
    // カンマや特殊文字を除去してから数値に変換
    const cleanedValue = value.replace(/[,，、．]/g, '');
    numValue = parseFloat(cleanedValue);
    if (isNaN(numValue)) {
      return value; // 数値に変換できない場合は元の値を返す
    }
  } else {
    numValue = value;
  }
  
  // スケールを適用
  if (scale && !isNaN(parseInt(scale))) {
    const scaleValue = parseInt(scale);
    numValue = numValue * Math.pow(10, scaleValue);
  }
  
  // 小数点の桁数を適用
  let formattedValue = numValue;
  if (decimals && !isNaN(parseInt(decimals))) {
    const decimalValue = parseInt(decimals);
    if (decimalValue >= 0) {
      // 指定された桁数に丸める
      formattedValue = parseFloat(numValue.toFixed(decimalValue));
    }
  }
  
  // 単位情報に基づいてフォーマット
  let unitLabel = '';
  if (unitInfo) {
    unitLabel = unitInfo.displayLabel || '';
  }
  
  // 数値のカンマ区切り表示
  let displayValue = formattedValue.toLocaleString();
  
  // 単位があれば追加
  if (unitLabel) {
    displayValue = `${displayValue} ${unitLabel}`;
  }
  
  return displayValue;
};
