/**
 * 拡張版XBRL抽出モジュール
 * 
 * より多くの財務項目を抽出するための強化版モジュール
 * 特に貸借対照表、損益計算書の詳細項目を正確に抽出
 */

import { 
  processIXBRL, 
  processContexts, 
  processUnits, 
  extractXBRLTag,
  detectFinancialTable,
  formatFinancialValue
} from './xbrl-helpers';

import { XBRLCellData, XBRLContextInfo, XBRLTableData, XBRLUnitInfo } from '../../types/extractors/improved-xbrl-types';

/**
 * XBRLファイルから財務データをより詳細に抽出する強化版関数
 * @param htmlContent XBRL/iXBRLを含むHTML文字列
 * @returns 抽出された財務データ
 */
export function extractEnhancedXBRL(htmlContent: string): { 
  tables: XBRLTableData[], 
  contexts: Record<string, XBRLContextInfo>, 
  units: Record<string, XBRLUnitInfo> 
} {
  try {
    // HTMLをパース
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // iXBRL専用の処理を実行
    const ixbrlElements = processIXBRL(doc);
    
    // コンテキスト情報を処理
    const contexts = processContexts(ixbrlElements.contextElements);
    
    // 単位情報を処理
    const units = processUnits(ixbrlElements.unitElements);
    
    // テーブル要素を処理
    const tableElements = doc.querySelectorAll('table');
    if (tableElements.length === 0) {
      throw new Error('HTMLコンテンツにテーブルが見つかりませんでした。');
    }
    
    // 抽出されたテーブル
    const extractedTables: XBRLTableData[] = [];
    
    // テーブルを処理
    for (let tableIndex = 0; tableIndex < tableElements.length; tableIndex++) {
      const table = tableElements[tableIndex];
      
      // テーブルの種類を検出
      const tableDetection = detectFinancialTable(table, table.outerHTML, table.textContent || '');
      
      // 財務表でない場合はスキップ
      if (!tableDetection.isFinancialTable) continue;
      
      // テーブルのタイトルと種類
      const { tableTitle, tableType } = tableDetection;
      
      // テーブルの行を処理
      const rows = table.querySelectorAll('tr');
      if (rows.length === 0) continue;
      
      // ヘッダー行を特定
      let headerRowIndex = detectHeaderRow(rows);
      
      // ヘッダー行が特定できない場合、最初の行を使用
      if (headerRowIndex < 0 && rows.length > 0) {
        headerRowIndex = 0;
      }
      
      // ヘッダーとデータ行を分離
      const headerRow = rows[headerRowIndex];
      const dataRows = Array.from(rows).filter((_, index) => index !== headerRowIndex);
      
      // ヘッダーセルを処理
      const headerCells = headerRow.querySelectorAll('th, td');
      const headers: XBRLCellData[] = [];
      
      // ヘッダーの最大列数を算出
      let maxHeaderCols = 0;
      
      // ヘッダーセルの処理
      Array.from(headerCells).forEach(cell => {
        // colspan属性の処理
        const colspan = parseInt(cell.getAttribute('colspan') || '1') || 1;
        maxHeaderCols += colspan;
        
        // XBRLタグ情報の抽出
        const xbrlInfo = extractXBRLTag(cell, {
          includeXbrlTags: true,
          contextAware: true
        });
        
        const cellText = cell.textContent?.trim() || '';
        
        // コンテキスト情報の取得
        const contextRef = xbrlInfo.contextRef;
        const cellPeriodInfo = contextRef && contexts[contextRef] ? contexts[contextRef] : null;
        
        // 単位情報の取得
        const unitRef = xbrlInfo.unitRef;
        const cellUnitInfo = unitRef && units[unitRef] ? units[unitRef] : null;
        
        // ヘッダー情報を追加
        for (let i = 0; i < colspan; i++) {
          headers.push({
            value: i === 0 ? cellText : '',
            xbrlTag: i === 0 ? xbrlInfo.xbrlTag : null,
            contextRef: i === 0 ? xbrlInfo.contextRef : null,
            unitRef: i === 0 ? xbrlInfo.unitRef : null,
            decimals: i === 0 ? xbrlInfo.decimals : null,
            scale: i === 0 ? xbrlInfo.scale : null,
            format: i === 0 ? xbrlInfo.format : null,
            periodInfo: i === 0 ? cellPeriodInfo : null,
            unitInfo: i === 0 ? cellUnitInfo : null
          });
        }
      });
      
      // ヘッダーに期間情報がない場合は自動的に追加
      if (headers.length >= 3) {
        const periodColumns = detectPeriodColumns(headers);
        
        // 期間情報の更新
        if (periodColumns.previousIndex >= 0 && !headers[periodColumns.previousIndex].value) {
          headers[periodColumns.previousIndex].value = '前期';
        }
        
        if (periodColumns.currentIndex >= 0 && !headers[periodColumns.currentIndex].value) {
          headers[periodColumns.currentIndex].value = '当期';
        }

        // 増減列を検出
        if (periodColumns.differenceIndex >= 0 && !headers[periodColumns.differenceIndex].value) {
          headers[periodColumns.differenceIndex].value = '増減';
        }
        
        if (periodColumns.differenceRateIndex >= 0 && !headers[periodColumns.differenceRateIndex].value) {
          headers[periodColumns.differenceRateIndex].value = '増減率';
        }
      }
      
      // ヘッダーが空の場合はデフォルトの値を設定
      if (headers.length === 0) {
        headers.push({
          value: '項目',
          xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null,
          periodInfo: null, unitInfo: null
        });
        
        headers.push({
          value: '前期',
          xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null,
          periodInfo: null, unitInfo: null
        });
        
        headers.push({
          value: '当期',
          xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null,
          periodInfo: null, unitInfo: null
        });
      }
      
      // データ行の処理
      const processedRows: XBRLCellData[][] = [];
      
      // 各データ行を処理
      dataRows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        if (cells.length === 0) return;
        
        const rowData: XBRLCellData[] = [];
        let currentCol = 0;
        
        // 行内の各セルを処理
        Array.from(cells).forEach(cell => {
          // colspan属性の処理
          const colspan = parseInt(cell.getAttribute('colspan') || '1') || 1;
          
          // XBRLタグ情報の抽出 - 改善版
          const xbrlInfo = extractXBRLTag(cell, {
            includeXbrlTags: true,
            contextAware: true
          });
          
          // テキスト内容の取得と整形
          let text = cell.textContent?.trim() || '';
          
          // 金額表示の整形（△▲記号をマイナスに変換など）
          text = text.replace(/△/g, '-').replace(/▲/g, '-').replace(/　/g, ' ');
          
          // コンテキスト情報と単位情報の取得
          const contextRef = xbrlInfo.contextRef;
          const cellPeriodInfo = contextRef && contexts[contextRef] ? contexts[contextRef] : null;
          
          const unitRef = xbrlInfo.unitRef;
          const cellUnitInfo = unitRef && units[unitRef] ? units[unitRef] : null;
          
          // 正しい数値フォーマットの適用（通貨単位や小数点処理）
          if (text && xbrlInfo.contextRef && cellUnitInfo) {
            // 数値と見なせる場合はフォーマットを適用
            if (/^-?[\d,]+(\.\d+)?$/.test(text.replace(/,/g, ''))) {
              text = formatFinancialValue(
                text,
                xbrlInfo.decimals,
                xbrlInfo.scale,
                xbrlInfo.format,
                cellUnitInfo
              );
            }
          }
          
          // colspan分のセルデータを追加
          for (let i = 0; i < colspan; i++) {
            if (currentCol + i < headers.length) {
              rowData.push({
                value: i === 0 ? text : '',
                xbrlTag: i === 0 ? xbrlInfo.xbrlTag : null,
                contextRef: i === 0 ? xbrlInfo.contextRef : null,
                unitRef: i === 0 ? xbrlInfo.unitRef : null,
                decimals: i === 0 ? xbrlInfo.decimals : null,
                scale: i === 0 ? xbrlInfo.scale : null,
                format: i === 0 ? xbrlInfo.format : null,
                periodInfo: i === 0 ? cellPeriodInfo : null,
                unitInfo: i === 0 ? cellUnitInfo : null
              });
            }
          }
          
          currentCol += colspan;
        });
        
        // 列数が足りない場合は空セルで埋める
        while (rowData.length < headers.length) {
          rowData.push({
            value: '',
            xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null,
            periodInfo: null, unitInfo: null
          });
        }
        
        // 空でない行だけを追加
        if (rowData.some(cell => cell.value !== '')) {
          processedRows.push(rowData);
        }
      });
      
      // 項目名の標準化と詳細項目の抽出
      enhanceFinancialItems(processedRows, tableType as 'balance_sheet' | 'income_statement' | 'cash_flow' | 'shareholder' | 'unknown');
      
      // 見つかったXBRLタグを統計
      const xbrlTags = new Set<string>();
      headers.forEach(cell => {
        if (cell.xbrlTag) xbrlTags.add(cell.xbrlTag);
      });
      
      processedRows.forEach(row => {
        row.forEach(cell => {
          if (cell.xbrlTag) xbrlTags.add(cell.xbrlTag);
        });
      });
      
      // 空のセルの数を計算
      let emptyCells = 0;
      processedRows.forEach(row => {
        row.forEach(cell => {
          if (cell.value === '') emptyCells++;
        });
      });
      
      // テーブルデータとして登録
      extractedTables.push({
        id: `table-${tableIndex}`,
        headers,
        rows: processedRows,
        originalTable: table.outerHTML,
        tableType,
        tableTitle: tableTitle || '',
        statistics: {
          rowCount: processedRows.length,
          columnCount: headers.length,
          emptyCells,
          totalCells: processedRows.length * headers.length,
          xbrlTagCount: xbrlTags.size,
          xbrlTags: Array.from(xbrlTags)
        },
        contextInfo: contexts,
        unitInfo: units
      });
    }
    
    // 財務テーブルが見つからない場合
    if (extractedTables.length === 0) {
      // 一般的なテーブルをフォールバックとして使用
      for (let tableIndex = 0; tableIndex < Math.min(tableElements.length, 5); tableIndex++) {
        const table = tableElements[tableIndex];
        
        // テーブルのタイトルを取得
        let tableTitle = '';
        const previousElement = table.previousElementSibling;
        if (previousElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(previousElement.tagName)) {
          tableTitle = previousElement.textContent?.trim() || '';
        }
        
        // データ行の処理
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) continue;
        
        // ヘッダー行
        const headerRow = rows[0];
        const dataRows = Array.from(rows).slice(1);
        
        // ヘッダーを処理
        const headerCells = headerRow.querySelectorAll('th, td');
        const headers: XBRLCellData[] = Array.from(headerCells).map(cell => {
          const text = cell.textContent?.trim() || '';
          return {
            value: text,
            xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null,
            periodInfo: null, unitInfo: null
          };
        });
        
        // ヘッダーが空の場合はスキップ
        if (headers.length === 0) continue;
        
        // データ行を処理
        const processedRows: XBRLCellData[][] = dataRows.map(row => {
          const cells = row.querySelectorAll('th, td');
          const rowData = Array.from(cells).map(cell => {
            const text = cell.textContent?.trim().replace(/△/g, '-').replace(/▲/g, '-') || '';
            return {
              value: text,
              xbrlTag: null, contextRef: null, unitRef: null, decimals: null, scale: null, format: null,
              periodInfo: null, unitInfo: null
            };
          });
          
          return rowData;
        });
        
        // 空でない行だけを追加
        const filteredRows = processedRows.filter(row => row.some(cell => cell.value !== ''));
        
        // 空のセルの数
        let emptyCells = 0;
        filteredRows.forEach(row => {
          row.forEach(cell => {
            if (cell.value === '') emptyCells++;
          });
        });
        
        // テーブルデータとして登録
        extractedTables.push({
          id: `table-${tableIndex}`,
          headers,
          rows: filteredRows,
          originalTable: table.outerHTML,
          tableType: 'unknown',
          tableTitle,
          statistics: {
            rowCount: filteredRows.length,
            columnCount: headers.length,
            emptyCells,
            totalCells: filteredRows.length * headers.length,
            xbrlTagCount: 0,
            xbrlTags: []
          },
          contextInfo: contexts,
          unitInfo: units
        });
      }
    }
    
    return {
      tables: extractedTables,
      contexts,
      units
    };
  } catch (error) {
    console.error('XBRL抽出エラー:', error instanceof Error ? error.message : String(error));
    return {
      tables: [],
      contexts: {},
      units: {}
    };
  }
}

/**
 * 財務項目の名前や値を強化
 * @param rows 財務テーブルの行データ
 * @param tableType テーブルのタイプ
 */
function enhanceFinancialItems(
  rows: XBRLCellData[][],
  tableType: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'shareholder' | 'unknown'
) {
  // 財務項目名の標準化
  if (tableType === 'balance_sheet') {
    // 貸借対照表の標準項目とその子項目
    const balanceSheetItems: Record<string, string[]> = {
      '資産の部': [],
      '流動資産': ['現金及び預金', '受取手形', '売掛金', '有価証券', '商品及び製品', '仕掛品', '原材料及び貯蔵品', '前払費用', '繰延税金資産', 'その他'],
      '固定資産': [],
      '有形固定資産': ['建物', '構築物', '機械装置及び運搬具', '工具、器具及び備品', '土地', 'リース資産', '建設仮勘定'],
      '無形固定資産': ['のれん', 'ソフトウエア', 'リース資産', 'その他'],
      '投資その他の資産': ['投資有価証券', '関係会社株式', '出資金', '関係会社出資金', '長期貸付金', '関係会社長期貸付金', '破産更生債権等', '長期前払費用', '繰延税金資産', 'その他'],
      '資産合計': [],
      '負債の部': [],
      '流動負債': ['支払手形', '買掛金', '短期借入金', '1年内償還予定の社債', '1年内返済予定の長期借入金', 'リース債務', '未払金', '未払費用', '未払法人税等', '前受金', '預り金', '賞与引当金', '役員賞与引当金', '製品保証引当金', 'その他'],
      '固定負債': ['社債', '長期借入金', 'リース債務', '繰延税金負債', '退職給付引当金', '役員退職慰労引当金', 'その他'],
      '負債合計': [],
      '純資産の部': [],
      '株主資本': ['資本金', '資本剰余金', '利益剰余金', '自己株式'],
      '評価・換算差額等': ['その他有価証券評価差額金', '繰延ヘッジ損益', '土地再評価差額金', '為替換算調整勘定'],
      '新株予約権': [],
      '非支配株主持分': [],
      '純資産合計': [],
      '負債純資産合計': []
    };
    
    // 貸借対照表の項目を検出して詳細項目を強化
    extractFinancialItemsRecursive(rows, balanceSheetItems, 0);
  } 
  else if (tableType === 'income_statement') {
    // 損益計算書の標準項目とその子項目
    const incomeStatementItems: Record<string, string[]> = {
      '売上高': [],
      '売上原価': ['商品期首たな卸高', '当期商品仕入高', '合計', '商品期末たな卸高'],
      '売上総利益': [],
      '販売費及び一般管理費': ['広告宣伝費', '運搬費', '給料及び手当', '賞与引当金繰入額', '退職給付費用', '減価償却費', '研究開発費', 'その他'],
      '営業利益': [],
      '営業外収益': ['受取利息', '受取配当金', '為替差益', '持分法による投資利益', 'その他'],
      '営業外費用': ['支払利息', '為替差損', '持分法による投資損失', 'その他'],
      '経常利益': [],
      '特別利益': ['固定資産売却益', '投資有価証券売却益', '関係会社株式売却益', '新株予約権戻入益', 'その他'],
      '特別損失': ['固定資産売却損', '固定資産除却損', '減損損失', '投資有価証券売却損', '投資有価証券評価損', '関係会社株式売却損', '関係会社株式評価損', 'その他'],
      '税引前当期純利益': [],
      '法人税、住民税及び事業税': [],
      '法人税等調整額': [],
      '法人税等合計': [],
      '当期純利益': [],
      '非支配株主に帰属する当期純利益': [],
      '親会社株主に帰属する当期純利益': []
    };
    
    // 損益計算書の項目を検出して詳細項目を強化
    extractFinancialItemsRecursive(rows, incomeStatementItems, 0);
  }
  else if (tableType === 'cash_flow') {
    // キャッシュフロー計算書の標準項目とその子項目
    const cashFlowItems: Record<string, string[]> = {
      '営業活動によるキャッシュ・フロー': ['税引前当期純利益', '減価償却費', 'のれん償却額', '減損損失', '貸倒引当金の増減額', '賞与引当金の増減額', '退職給付に係る負債の増減額', '受取利息及び受取配当金', '支払利息', '為替差損益', '持分法による投資損益', '投資有価証券売却損益', '固定資産売却損益', '売上債権の増減額', 'たな卸資産の増減額', '仕入債務の増減額', 'その他'],
      '投資活動によるキャッシュ・フロー': ['定期預金の預入による支出', '定期預金の払戻による収入', '有形固定資産の取得による支出', '有形固定資産の売却による収入', '無形固定資産の取得による支出', '投資有価証券の取得による支出', '投資有価証券の売却による収入', '貸付けによる支出', '貸付金の回収による収入', 'その他'],
      '財務活動によるキャッシュ・フロー': ['短期借入金の純増減額', '長期借入れによる収入', '長期借入金の返済による支出', '社債の発行による収入', '社債の償還による支出', '自己株式の取得による支出', '配当金の支払額', 'その他'],
      '現金及び現金同等物に係る換算差額': [],
      '現金及び現金同等物の増減額': [],
      '現金及び現金同等物の期首残高': [],
      '現金及び現金同等物の期末残高': []
    };
    
    // キャッシュフロー計算書の項目を検出して詳細項目を強化
    extractFinancialItemsRecursive(rows, cashFlowItems, 0);
  }
}

/**
 * 財務項目を再帰的に抽出して詳細化
 * @param rows 財務テーブルの行データ
 * @param itemsMap 標準財務項目マップ
 * @param startIndex 処理開始インデックス
 * @returns 処理した行のインデックス
 */
function extractFinancialItemsRecursive(
  rows: XBRLCellData[][],
  itemsMap: Record<string, string[]>,
  startIndex: number
): number {
  if (startIndex >= rows.length) return startIndex;
  
  // 財務項目のマッチングと子項目の処理
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0) continue;
    
    // 項目名（最初の列）のテキスト
    const itemName = row[0].value.trim();
    if (!itemName) continue;
    
    // 親項目としてマッチングする場合
    if (itemsMap[itemName]) {
      const childItems = itemsMap[itemName];
      
      // 子項目がある場合は次の行から処理
      if (childItems.length > 0) {
        let currentIndex = i + 1;
        
        // 子項目を検索
        while (currentIndex < rows.length) {
          const currentRow = rows[currentIndex];
          const currentItemName = currentRow[0].value.trim();
          
          // 次の親項目が見つかったら終了
          if (itemsMap[currentItemName]) {
            break;
          }
          
          // 子項目に合致する場合はインデントを付与
          if (childItems.includes(currentItemName)) {
            // 行のレベルを指定（子項目はレベル2）
            currentRow[0].value = `  ${currentItemName}`;
          }
          
          currentIndex++;
        }
        
        // 処理済みの最後の行を返す
        i = currentIndex - 1;
      }
    }
    // 子項目としてマッチングする場合（すでに処理済みの可能性あり）
    else {
      for (const parentItem in itemsMap) {
        if (itemsMap[parentItem].includes(itemName) && !row[0].value.startsWith('  ')) {
          // インデントを付与
          row[0].value = `  ${itemName}`;
          break;
        }
      }
    }
  }
  
  return rows.length;
}

/**
 * ヘッダー行を検出
 * @param rows テーブルの行要素配列
 * @returns ヘッダー行のインデックス
 */
function detectHeaderRow(rows: NodeListOf<Element>): number {
  if (rows.length === 0) return -1;
  
  // TH要素を含む行を探す
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const headingCells = rows[i].querySelectorAll('th');
    if (headingCells.length > 0) {
      return i;
    }
  }
  
  // 特徴的なヘッダーパターンを探す
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cells = rows[i].querySelectorAll('td, th');
    const texts = Array.from(cells).map(cell => cell.textContent?.trim().toLowerCase() || '');
    
    // 「項目」「前期」「当期」などのパターンを検出
    if (texts.some(t => t.includes('項目')) || 
        texts.some(t => t.includes('科目')) ||
        (texts.some(t => t.includes('前期') || t.includes('前連結会計年度')) && 
         texts.some(t => t.includes('当期') || t.includes('当連結会計年度')))) {
      return i;
    }
  }
  
  // 最初の行を返す
  return 0;
}

/**
 * 財務表の期間列を検出
 * @param headers ヘッダーセル配列
 * @returns 各期間列のインデックス
 */
function detectPeriodColumns(headers: XBRLCellData[]): {
  previousIndex: number;
  currentIndex: number;
  differenceIndex: number;
  differenceRateIndex: number;
} {
  let previousIndex = -1;
  let currentIndex = -1;
  let differenceIndex = -1;
  let differenceRateIndex = -1;
  
  // 最初の列は項目名と仮定
  const itemLabelIndex = 0;
  
  // 期間情報を持つセルを検出
  for (let i = 0; i < headers.length; i++) {
    if (i === itemLabelIndex) continue;
    
    const header = headers[i];
    const text = header.value.toLowerCase();
    
    // 前期列
    if (i > 0 && (text.includes('前期') || text.includes('前年') || text.includes('前連結') || header.periodInfo?.isPreviousPeriod)) {
      previousIndex = i;
      continue;
    }
    
    // 当期列
    if (i > 0 && (text.includes('当期') || text.includes('当年') || text.includes('当連結') || header.periodInfo?.isCurrentPeriod)) {
      currentIndex = i;
      continue;
    }
    
    // 増減列
    if (i > 0 && (text.includes('増減') || text.includes('差額') || text.includes('差異'))) {
      if (text.includes('%') || text.includes('率')) {
        differenceRateIndex = i;
      } else {
        differenceIndex = i;
      }
      continue;
    }
  }
  
  // 期間列が見つからない場合は位置から推測
  if (previousIndex < 0 && currentIndex < 0 && headers.length >= 3) {
    // 最初の列を項目名、2番目を前期、3番目を当期と仮定
    previousIndex = 1;
    currentIndex = 2;
    
    // 4列以上ある場合は増減と増減率も設定
    if (headers.length >= 4) {
      differenceIndex = 3;
    }
    
    if (headers.length >= 5) {
      differenceRateIndex = 4;
    }
  }
  
  return {
    previousIndex,
    currentIndex,
    differenceIndex,
    differenceRateIndex
  };
}
