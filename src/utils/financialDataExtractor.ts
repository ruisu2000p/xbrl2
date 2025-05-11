/**
 * 財務データ抽出モジュール
 * XBRLとHTMLファイルからの総合的なデータ抽出を行う
 */

import { parseXBRLFile } from './xbrlParser';
import { extractCommentsFromHTML } from './htmlParser';
import { sanitizeHtml } from './htmlSanitizer';
import { XBRLData, CommentSection, FinancialData, TaxonomyReference, StatementType } from '../types/xbrl';

/**
 * XBRL・HTMLファイルから財務データを抽出する総合関数
 * @param xbrlFile XBRLファイル
 * @param htmlFile HTMLファイル（オプション）
 * @returns 抽出された財務データ
 */
export const extractFinancialData = async (
  xbrlFile: File,
  htmlFile?: File
): Promise<FinancialData> => {
  const xbrlData: XBRLData = await parseXBRLFile(xbrlFile);
  
  let comments: CommentSection[] = [];
  
  if (htmlFile) {
    const htmlContent = await readFileAsText(htmlFile);
    comments = extractCommentsFromHTML(htmlContent);
  } else {
    try {
      const xbrlContentAsHtml = await readFileAsText(xbrlFile);
      comments = extractCommentsFromHTML(xbrlContentAsHtml);
    } catch (error) {
      console.warn('XBRLからの注記抽出に失敗しました:', error);
    }
  }
  
  const taxonomyReferences = extractTaxonomyReferences(xbrlData);
  
  return {
    contexts: xbrlData.contexts,
    units: xbrlData.units,
    financialItems: extractFinancialItems(xbrlData),
    taxonomyReferences,
    comments
  };
};

/**
 * XBRLデータから財務項目を抽出
 */
const extractFinancialItems = (xbrlData: XBRLData) => {
  const items = [];
  
  for (const type in xbrlData.statements) {
    const statement = xbrlData.statements[type as StatementType];
    
    for (const item of statement.items) {
      items.push({
        name: item.name,
        namespace: getTaxonomyNamespace(item.id),
        contextRef: item.values[0]?.contextRef || '',
        unitRef: item.values[0]?.unit || null,
        decimals: item.values[0]?.decimals || null,
        value: item.values[0]?.value || '',
        taxonomyElement: {
          id: item.id,
          name: item.name,
          namespace: getTaxonomyNamespace(item.id),
          label: item.nameJa || item.name,
          definition: ''
        }
      });
    }
  }
  
  return items;
};

/**
 * File オブジェクトをテキストとして読み込み、HTMLタグを処理する
 * @param file 読み込むファイル
 * @returns サニタイズされたテキスト内容のPromise
 */
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === 'string') {
        resolve(sanitizeHtml(e.target.result));
      } else {
        reject(new Error('ファイル読み込みに失敗しました'));
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

/**
 * タクソノミ参照情報を抽出
 * @param xbrlData XBRLデータ
 * @returns タクソノミ参照情報
 */
const extractTaxonomyReferences = (xbrlData: XBRLData): TaxonomyReference[] => {
  return [
    {
      type: 'schema',
      href: 'http://disclosure.edinet-fsa.go.jp/taxonomy/jppfs/2013-08-31/jppfs_cor',
      role: 'http://www.xbrl.org/2003/role/link'
    }
  ];
};

/**
 * 要素IDからタクソノミ名前空間を抽出
 */
const getTaxonomyNamespace = (id: string): string => {
  if (id.includes(':')) {
    return id.split(':')[0];
  }
  return '';
};
