import { XBRLData, StatementType, FinancialItem, FinancialValue, Context, Unit, InlineXBRLElement } from '../types/xbrl';
import * as xmljs from 'xml-js';
import { sanitizeHtml, sanitizeHtmlPreserveTables, sanitizeHtmlEnhanced, formatText } from './htmlSanitizer';
import { processIXBRL, extractXBRLTag } from './xbrl/xbrl-helpers';

/**
 * XBRLファイルを解析し、アプリケーションで使用可能な形式にデータを変換します
 * @param file XBRLファイル
 * @returns 処理されたXBRLデータ
 */
export const parseXBRLFile = async (file: File): Promise<XBRLData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        if (!event.target || !event.target.result) {
          throw new Error('ファイルの読み込みに失敗しました');
        }
        
        // XMLをJavaScriptオブジェクトに変換
        const xmlContent = event.target.result as string;
        
        let xbrlData: XBRLData;
        if (isInlineXBRL(xmlContent)) {
          xbrlData = processInlineXBRLData(xmlContent);
        } else {
          const result = xmljs.xml2js(xmlContent, { compact: true });
          xbrlData = processXBRLData(result);
        }
        
        resolve(xbrlData);
      } catch (error) {
        console.error('XBRLファイルの解析中にエラーが発生しました:', error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      console.error('ファイルの読み込み中にエラーが発生しました:', error);
      reject(error);
    };
    
    reader.readAsText(file);
  });
};

/**
 * XML-JSによって変換されたXBRLデータを処理し、アプリケーションのデータ構造に変換します
 * @param data XML-JSによって変換されたXBRLデータ
 * @returns 処理されたXBRLデータ
 */
const processXBRLData = (data: any): XBRLData => {
  // 初期データ構造を作成
  const xbrlData: XBRLData = {
    companyInfo: {},
    contexts: {},
    units: {},
    statements: {
      [StatementType.BalanceSheet]: { type: StatementType.BalanceSheet, items: [] },
      [StatementType.IncomeStatement]: { type: StatementType.IncomeStatement, items: [] },
      [StatementType.CashFlow]: { type: StatementType.CashFlow, items: [] },
      [StatementType.Other]: { type: StatementType.Other, items: [] },
    }
  };
  
  // XBRLドキュメントのルート要素を取得
  const xbrlRoot = data['xbrl'] || data['xbrli:xbrl'] || Object.values(data)[0];
  if (!xbrlRoot) {
    throw new Error('XBRLドキュメントのルート要素が見つかりません');
  }
  
  // コンテキスト情報を抽出
  processContexts(xbrlRoot, xbrlData);
  
  // 単位情報を抽出
  processUnits(xbrlRoot, xbrlData);
  
  // 会社情報を抽出
  processCompanyInfo(xbrlRoot, xbrlData);
  
  // 財務データを抽出
  processFinancialData(xbrlRoot, xbrlData);
  
  return xbrlData;
};

/**
 * コンテキスト（期間）情報を抽出します
 * @param xbrlRoot XBRLのルート要素
 * @param xbrlData 出力用XBRLデータ
 */
const processContexts = (xbrlRoot: any, xbrlData: XBRLData): void => {
  // コンテキスト要素を探す
  const contexts = xbrlRoot['xbrli:context'] || xbrlRoot['context'] || [];
  
  // 配列でない場合は配列に変換
  const contextArray = Array.isArray(contexts) ? contexts : [contexts];
  
  // 各コンテキストを処理
  contextArray.forEach(ctx => {
    if (!ctx || !ctx._attributes) return;
    
    const contextId = ctx._attributes.id;
    const context: Context = { id: contextId };
    
    // 期間情報を抽出
    const period = ctx['xbrli:period'] || ctx['period'];
    if (period) {
      // 特定時点
      if (period['xbrli:instant'] || period['instant']) {
        context.instant = extractTextContent(period['xbrli:instant'] || period['instant']);
      }
      // 期間（開始日～終了日）
      else if ((period['xbrli:startDate'] || period['startDate']) && (period['xbrli:endDate'] || period['endDate'])) {
        context.startDate = extractTextContent(period['xbrli:startDate'] || period['startDate']);
        context.endDate = extractTextContent(period['xbrli:endDate'] || period['endDate']);
      }
    }
    
    // シナリオ情報があれば抽出
    const scenario = ctx['xbrli:scenario'] || ctx['scenario'];
    if (scenario) {
      context.scenario = JSON.stringify(scenario);
    }
    
    // コンテキスト情報を追加
    xbrlData.contexts[contextId] = context;
  });
};

/**
 * 単位情報を抽出します
 * @param xbrlRoot XBRLのルート要素
 * @param xbrlData 出力用XBRLデータ
 */
const processUnits = (xbrlRoot: any, xbrlData: XBRLData): void => {
  // 単位要素を探す
  const units = xbrlRoot['xbrli:unit'] || xbrlRoot['unit'] || [];
  
  // 配列でない場合は配列に変換
  const unitArray = Array.isArray(units) ? units : [units];
  
  // 各単位を処理
  unitArray.forEach(unit => {
    if (!unit || !unit._attributes) return;
    
    const unitId = unit._attributes.id;
    let measure = '';
    
    // 単純な単位
    if (unit['xbrli:measure'] || unit['measure']) {
      measure = extractTextContent(unit['xbrli:measure'] || unit['measure']);
    }
    // 複合単位（分数など）
    else if ((unit['xbrli:divide'] || unit['divide'])) {
      const divide = unit['xbrli:divide'] || unit['divide'];
      const numerator = extractTextContent(divide['xbrli:unitNumerator'] || divide['unitNumerator']);
      const denominator = extractTextContent(divide['xbrli:unitDenominator'] || divide['unitDenominator']);
      measure = `${numerator}/${denominator}`;
    }
    
    // 単位情報を追加
    xbrlData.units[unitId] = {
      id: unitId,
      measure: measure
    };
  });
};

/**
 * 会社情報を抽出します
 * @param xbrlRoot XBRLのルート要素
 * @param xbrlData 出力用XBRLデータ
 */
const processCompanyInfo = (xbrlRoot: any, xbrlData: XBRLData): void => {
  // 会社名を探す（jpdei_cor:CompanyNameの形式が一般的）
  for (const key in xbrlRoot) {
    if (key.includes('CompanyName') && xbrlRoot[key]) {
      xbrlData.companyInfo.name = extractTextContent(xbrlRoot[key]);
      break;
    }
  }
  
  // 証券コードを探す
  for (const key in xbrlRoot) {
    if ((key.includes('SecurityCode') || key.includes('TickerSymbol')) && xbrlRoot[key]) {
      xbrlData.companyInfo.ticker = extractTextContent(xbrlRoot[key]);
      break;
    }
  }
  
  // 会計期間を探す
  for (const key in xbrlRoot) {
    if (key.includes('FiscalYear') || key.includes('AccountingPeriod')) {
      xbrlData.companyInfo.fiscalYear = extractTextContent(xbrlRoot[key]);
      break;
    }
  }
  
  // 決算日を探す
  for (const key in xbrlRoot) {
    if (key.includes('CurrentFiscalYearEndDate') || key.includes('AccountingPeriodEndDate')) {
      xbrlData.companyInfo.endDate = extractTextContent(xbrlRoot[key]);
      break;
    }
  }
};

/**
 * 財務データを抽出し、財務諸表の種類ごとに分類します
 * @param xbrlRoot XBRLのルート要素
 * @param xbrlData 出力用XBRLデータ
 */
const processFinancialData = (xbrlRoot: any, xbrlData: XBRLData): void => {
  // 財務項目を示すkeyのパターン
  // 日本語XBRLの場合、項目名は通常 jppfs_cor: などの名前空間で始まる
  const balanceSheetPatterns = ['Equity', 'Asset', 'Liability', 'NetAssets', 'BalanceSheet'];
  const incomeStatementPatterns = ['OperatingIncome', 'Revenue', 'Income', 'Loss', 'Expense', 'ProfitLoss', 'IncomeStatement'];
  const cashFlowPatterns = ['CashFlow', 'Cash'];
  
  // XBRLドキュメントのすべての要素を処理
  for (const key in xbrlRoot) {
    // メタデータ要素はスキップ
    if (key.startsWith('_') || key.includes('context') || key.includes('unit')) {
      continue;
    }
    
    const element = xbrlRoot[key];
    // 要素がオブジェクトでない場合や属性がない場合はスキップ
    if (!element || typeof element !== 'object' || !element._attributes) {
      continue;
    }
    
    // 財務項目のIDと名前を取得
    const itemId = key;
    // 名前を先頭の名前空間部分を除いて取得
    const itemName = key.includes(':') ? key.split(':')[1] : key;
    
    // 項目の値を取得
    const contextRef = element._attributes.contextRef;
    const unitRef = element._attributes.unitRef;
    const decimals = element._attributes.decimals;
    const value = extractTextContent(element);
    
    // 項目の値がない場合はスキップ
    if (!value || !contextRef) {
      continue;
    }
    
    // 財務項目の種類を判定
    let statementType = StatementType.Other;
    
    // 項目名に基づいて財務諸表の種類を判定
    if (balanceSheetPatterns.some(pattern => itemName.includes(pattern))) {
      statementType = StatementType.BalanceSheet;
    } else if (incomeStatementPatterns.some(pattern => itemName.includes(pattern))) {
      statementType = StatementType.IncomeStatement;
    } else if (cashFlowPatterns.some(pattern => itemName.includes(pattern))) {
      statementType = StatementType.CashFlow;
    }
    
    // 財務項目の値オブジェクトを作成
    const financialValue: FinancialValue = {
      value: value,
      contextRef: contextRef,
      unit: unitRef,
      decimals: decimals
    };
    
    // すでに同じIDの項目が存在するか確認
    const existingItemIndex = xbrlData.statements[statementType].items.findIndex(item => item.id === itemId);
    
    // 既存の項目がある場合は値を追加、なければ新しい項目を作成
    if (existingItemIndex !== -1) {
      xbrlData.statements[statementType].items[existingItemIndex].values.push(financialValue);
    } else {
      const financialItem: FinancialItem = {
        id: itemId,
        name: itemName,
        values: [financialValue]
      };
      
      xbrlData.statements[statementType].items.push(financialItem);
    }
  }
};

/**
 * XML要素からテキスト内容を抽出し、テーブル構造とスタイルを保持しながらHTMLをサニタイズします
 * @param element XML要素
 * @returns サニタイズされたテキスト内容（テーブル構造とスタイルを保持）
 */
const extractTextContent = (element: any): string => {
  if (!element) return '';
  
  // 要素が文字列の場合
  if (typeof element === 'string') {
    return sanitizeHtmlEnhanced(element);
  }
  
  // 要素がオブジェクトの場合
  if (typeof element === 'object') {
    // _textプロパティがある場合
    if (element._text !== undefined) {
      return sanitizeHtmlEnhanced(String(element._text));
    }
    
    // 配列の場合
    if (Array.isArray(element)) {
      if (element.length > 0 && element[0]._text !== undefined) {
        return sanitizeHtmlEnhanced(String(element[0]._text));
      }
    }
  }
  
  return '';
};

/**
 * 文字列がインラインXBRL（iXBRL）かどうかを判定します
 * @param content XMLまたはHTML文字列
 * @returns インラインXBRLの場合はtrue
 */
const isInlineXBRL = (content: string): boolean => {
  const result = (
    content.includes('xmlns:ix=') || 
    content.includes('xmlns:ix ') || 
    content.includes('<ix:') || 
    content.includes('contextRef=') || 
    content.includes('unitRef=') ||
    content.includes('<!DOCTYPE html') // HTMLドキュメントの場合はインラインXBRLの可能性が高い
  );
  console.log('インラインXBRL判定:', result, '最初の100文字:', content.substring(0, 100));
  return result;
};

/**
 * インラインXBRL（iXBRL）データを処理し、アプリケーションのデータ構造に変換します
 * @param content インラインXBRLを含むHTML文字列
 * @returns 処理されたXBRLデータ
 */
const processInlineXBRLData = (content: string): XBRLData => {
  // 初期データ構造を作成
  const xbrlData: XBRLData = {
    companyInfo: {},
    contexts: {},
    units: {},
    statements: {
      [StatementType.BalanceSheet]: { type: StatementType.BalanceSheet, items: [] },
      [StatementType.IncomeStatement]: { type: StatementType.IncomeStatement, items: [] },
      [StatementType.CashFlow]: { type: StatementType.CashFlow, items: [] },
      [StatementType.Other]: { type: StatementType.Other, items: [] },
    }
  };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    console.log('DOMParser結果:', doc.documentElement.outerHTML.substring(0, 200));
    
    const ixbrlElements = processIXBRL(doc);
    console.log('インラインXBRL要素抽出結果:', {
      contextElements: ixbrlElements.contextElements.length,
      unitElements: ixbrlElements.unitElements.length,
      inlineElements: ixbrlElements.inlineElements.length
    });
    
    // コンテキスト情報を処理
    const contexts: Record<string, Context> = {};
    ixbrlElements.contextElements.forEach(element => {
      const id = element.getAttribute('id');
      if (!id) return;
      
      const instant = element.querySelector('xbrli\\:instant, instant');
      const startDate = element.querySelector('xbrli\\:startDate, startDate');
      const endDate = element.querySelector('xbrli\\:endDate, endDate');
      
      const context: Context = { 
        id,
        instant: instant ? instant.textContent?.trim() : undefined,
        startDate: startDate ? startDate.textContent?.trim() : undefined,
        endDate: endDate ? endDate.textContent?.trim() : undefined
      };
      
      // シナリオ情報があれば抽出
      const scenario = element.querySelector('xbrli\\:scenario, scenario');
      if (scenario) {
        context.scenario = scenario.textContent?.trim();
      }
      
      contexts[id] = context;
    });
    
    const units: Record<string, Unit> = {};
    ixbrlElements.unitElements.forEach(element => {
      const id = element.getAttribute('id');
      if (!id) return;
      
      const measure = element.querySelector('xbrli\\:measure, measure');
      const measureText = measure ? measure.textContent?.trim() : '';
      
      units[id] = {
        id,
        measure: measureText || ''
      };
    });
    
    const inlineElements: InlineXBRLElement[] = [];
    
    ixbrlElements.inlineElements.forEach(element => {
      const xbrlInfo = extractXBRLTag(element, {
        includeXbrlTags: true,
        contextAware: true
      });
      
      if (xbrlInfo.xbrlTag && xbrlInfo.contextRef) {
        inlineElements.push({
          tag: xbrlInfo.xbrlTag,
          name: xbrlInfo.xbrlTag.includes(':') ? xbrlInfo.xbrlTag.split(':')[1] : xbrlInfo.xbrlTag,
          value: element.textContent?.trim() || '',
          contextRef: xbrlInfo.contextRef,
          unitRef: xbrlInfo.unitRef,
          decimals: xbrlInfo.decimals,
          format: xbrlInfo.format,
          scale: xbrlInfo.scale,
          originalHtml: element.outerHTML
        });
      }
    });
    
    const balanceSheetPatterns = ['Equity', 'Asset', 'Liability', 'NetAssets', 'BalanceSheet'];
    const incomeStatementPatterns = ['OperatingIncome', 'Revenue', 'Income', 'Loss', 'Expense', 'ProfitLoss', 'IncomeStatement'];
    const cashFlowPatterns = ['CashFlow', 'Cash'];
    
    inlineElements.forEach(element => {
      // 財務項目の種類を判定
      let statementType = StatementType.Other;
      const itemName = element.name;
      
      // 項目名に基づいて財務諸表の種類を判定
      if (balanceSheetPatterns.some(pattern => itemName.includes(pattern))) {
        statementType = StatementType.BalanceSheet;
      } else if (incomeStatementPatterns.some(pattern => itemName.includes(pattern))) {
        statementType = StatementType.IncomeStatement;
      } else if (cashFlowPatterns.some(pattern => itemName.includes(pattern))) {
        statementType = StatementType.CashFlow;
      }
      
      // 財務項目の値オブジェクトを作成
      const financialValue: FinancialValue = {
        value: element.value,
        contextRef: element.contextRef,
        unit: element.unitRef || undefined,
        decimals: element.decimals || undefined
      };
      
      // すでに同じIDの項目が存在するか確認
      const existingItemIndex = xbrlData.statements[statementType].items.findIndex(item => item.id === element.tag);
      
      // 既存の項目がある場合は値を追加、なければ新しい項目を作成
      if (existingItemIndex !== -1) {
        xbrlData.statements[statementType].items[existingItemIndex].values.push(financialValue);
      } else {
        const financialItem: FinancialItem = {
          id: element.tag,
          name: itemName,
          values: [financialValue]
        };
        
        xbrlData.statements[statementType].items.push(financialItem);
      }
    });
    
    xbrlData.contexts = contexts;
    xbrlData.units = units;
    
    (xbrlData as any).inlineXbrlElements = inlineElements;
    console.log('抽出されたインラインXBRL要素数:', inlineElements.length);
    
  } catch (error) {
    console.error('インラインXBRL処理エラー:', error instanceof Error ? error.message : String(error));
  }
  
  return xbrlData;
};
