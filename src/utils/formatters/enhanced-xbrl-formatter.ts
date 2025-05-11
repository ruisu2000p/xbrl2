/**
 * 拡張版XBRLフォーマッター
 * 
 * XBRLデータを構造化された階層形式に変換するためのユーティリティ関数
 */

import { 
  ProcessedXBRLData, 
  HierarchicalXBRLData, 
  HierarchicalXBRLItem
} from '../../types/extractors/improved-xbrl-types';

/**
 * 抽出されたXBRLデータを階層構造化された形式に変換する
 * @param rawData 抽出されたXBRLデータ（JSON形式）
 * @returns 変換結果と階層化されたデータ
 */
export const convertXBRLData = (rawData: any[]): ProcessedXBRLData => {
  try {
    // 処理結果を格納するオブジェクト
    const result: ProcessedXBRLData = {
      success: true,
      rawData,
      hierarchical: {
        metadata: {
          reportType: '財務諸表',
          unit: '',
          periods: {
            previous: null,
            current: null
          }
        },
        data: []
      },
      errors: [],
      warnings: []
    };

    // 期間情報（前期/当期）を抽出
    const periodInfo = extractPeriodInfo(rawData);
    result.hierarchical.metadata.periods = periodInfo;

    // 指標の単位情報を抽出
    const unitInfo = extractUnitInfo(rawData);
    if (unitInfo) {
      result.hierarchical.metadata.unit = unitInfo;
    }

    // レポートタイプ（貸借対照表、損益計算書など）を識別
    const reportType = identifyReportType(rawData);
    if (reportType) {
      result.hierarchical.metadata.reportType = reportType;
    }

    // データの階層構造を構築
    const hierarchicalData = buildHierarchy(rawData, periodInfo);
    result.hierarchical.data = hierarchicalData;

    // 注釈情報を抽出
    const annotations = extractAnnotations(rawData);
    if (Object.keys(annotations).length > 0) {
      result.hierarchical.annotations = annotations;
    }

    return result;
  } catch (error) {
    console.error('XBRL階層化エラー:', error instanceof Error ? error.message : String(error));
    return {
      success: false,
      rawData,
      hierarchical: {
        metadata: {
          reportType: '変換エラー',
          unit: '',
          periods: {
            previous: null,
            current: null
          }
        },
        data: []
      },
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
};

/**
 * 財務データの期間情報（前期/当期）を抽出する
 * @param data 抽出データ
 * @returns 期間情報
 */
const extractPeriodInfo = (data: any[]): { previous: string | null; current: string | null } => {
  const periodInfo = {
    previous: null as string | null,
    current: null as string | null
  };

  // データの各行を調査
  for (const row of data) {
    for (const key in row) {
      // 期間情報を含むキーを検索
      const periodValue = row[`${key}_Period`];
      if (periodValue === 'current') {
        // 対応する日付情報を探す（コンテキスト情報から）
        const contextRef = row[`${key}_ContextRef`];
        if (contextRef && contextRef.includes('Current') || contextRef?.includes('ThisYear')) {
          // 期間の値を設定
          periodInfo.current = '当期';
        }
      } else if (periodValue === 'previous') {
        // 対応する日付情報を探す（コンテキスト情報から）
        const contextRef = row[`${key}_ContextRef`];
        if (contextRef && contextRef.includes('Prior') || contextRef?.includes('LastYear')) {
          // 期間の値を設定
          periodInfo.previous = '前期';
        }
      }
    }
  }

  // 期間情報が見つからない場合はデフォルト値を設定
  if (!periodInfo.current) {
    periodInfo.current = '当期';
  }
  if (!periodInfo.previous) {
    periodInfo.previous = '前期';
  }

  return periodInfo;
};

/**
 * 財務データの単位情報を抽出する
 * @param data 抽出データ
 * @returns 単位情報
 */
const extractUnitInfo = (data: any[]): string => {
  // 単位情報のマップ（出現回数をカウント）
  const unitCounts: Record<string, number> = {};

  // データの各行を調査
  for (const row of data) {
    for (const key in row) {
      // 単位情報を含むキーを検索
      if (key.endsWith('_Unit')) {
        const unit = row[key];
        if (unit && typeof unit === 'string') {
          unitCounts[unit] = (unitCounts[unit] || 0) + 1;
        }
      }
    }
  }

  // 最も出現回数の多い単位を返す
  let maxUnit = '';
  let maxCount = 0;
  for (const unit in unitCounts) {
    if (unitCounts[unit] > maxCount) {
      maxUnit = unit;
      maxCount = unitCounts[unit];
    }
  }

  return maxUnit || '円'; // デフォルトは円
};

/**
 * レポートタイプ（貸借対照表、損益計算書など）を識別する
 * @param data 抽出データ
 * @returns レポートタイプ
 */
const identifyReportType = (data: any[]): string => {
  // レポートタイプを特定するキーワード
  const balanceSheetKeywords = ['資産', '負債', '純資産', 'Assets', 'Liabilities', 'Equity'];
  const incomeStatementKeywords = ['売上高', '営業利益', '経常利益', '当期純利益', 'Revenue', 'Income'];
  const cashFlowKeywords = ['キャッシュ・フロー', '営業活動', '投資活動', '財務活動', 'Cash Flow'];
  
  // 各キーワードの出現回数
  let balanceSheetCount = 0;
  let incomeStatementCount = 0;
  let cashFlowCount = 0;
  
  // データの各行を調査
  for (const row of data) {
    for (const key in row) {
      const value = row[key];
      if (typeof value === 'string') {
        // 貸借対照表のキーワードをカウント
        balanceSheetKeywords.forEach(keyword => {
          if (value.includes(keyword)) {
            balanceSheetCount++;
          }
        });
        
        // 損益計算書のキーワードをカウント
        incomeStatementKeywords.forEach(keyword => {
          if (value.includes(keyword)) {
            incomeStatementCount++;
          }
        });
        
        // キャッシュフロー計算書のキーワードをカウント
        cashFlowKeywords.forEach(keyword => {
          if (value.includes(keyword)) {
            cashFlowCount++;
          }
        });
        
        // XBRLタグからも識別
        const xbrlTag = row[`${key}_XBRL`];
        if (xbrlTag) {
          if (xbrlTag.includes('BalanceSheet') || xbrlTag.includes('BS')) {
            balanceSheetCount += 2;
          } else if (xbrlTag.includes('ProfitAndLoss') || xbrlTag.includes('PL')) {
            incomeStatementCount += 2;
          } else if (xbrlTag.includes('CashFlow') || xbrlTag.includes('CF')) {
            cashFlowCount += 2;
          }
        }
      }
    }
  }
  
  // 最も出現回数の多いレポートタイプを返す
  if (balanceSheetCount > incomeStatementCount && balanceSheetCount > cashFlowCount) {
    return '貸借対照表';
  } else if (incomeStatementCount > balanceSheetCount && incomeStatementCount > cashFlowCount) {
    return '損益計算書';
  } else if (cashFlowCount > balanceSheetCount && cashFlowCount > incomeStatementCount) {
    return 'キャッシュ・フロー計算書';
  }
  
  return '財務諸表'; // デフォルト
};

/**
 * 財務データの注釈情報を抽出する
 * @param data 抽出データ
 * @returns 注釈情報
 */
const extractAnnotations = (data: any[]): Record<string, string> => {
  const annotations: Record<string, string> = {};
  
  // 注釈と思われる行を検出
  for (const row of data) {
    const keys = Object.keys(row);
    
    // 1つのキーしかなく、それが長いテキストである場合は注釈として扱う
    if (keys.length === 1 && typeof row[keys[0]] === 'string' && row[keys[0]].length > 50) {
      annotations[`注釈${Object.keys(annotations).length + 1}`] = row[keys[0]];
      continue;
    }
    
    // 特定のキーワードを含む行を注釈として扱う
    const annotationKeywords = ['注記', '注釈', '備考', 'Note', 'Memo'];
    for (const key in row) {
      if (annotationKeywords.some(keyword => key.includes(keyword))) {
        annotations[key] = row[key];
      }
    }
  }
  
  return annotations;
};

/**
 * 財務データの階層構造を構築する
 * @param data 抽出データ
 * @param periodInfo 期間情報
 * @returns 階層構造化されたデータ
 */
const buildHierarchy = (
  data: any[], 
  periodInfo: { previous: string | null; current: string | null }
): HierarchicalXBRLItem[] => {
  // 階層構造のルート項目
  const rootItems: HierarchicalXBRLItem[] = [];
  
  // 項目名によるインデックス
  const itemIndex: Record<string, HierarchicalXBRLItem> = {};
  
  // インデント検出用の正規表現パターン
  const indentPattern = /^(\s+|\t+|　+)/;
  
  // 期間カラム（当期/前期）を特定
  const currentPeriodColumns: string[] = [];
  const previousPeriodColumns: string[] = [];
  
  // まず期間カラムを特定
  for (const row of data) {
    for (const key in row) {
      // 期間情報から当期/前期のカラムを特定
      const periodValue = row[`${key}_Period`];
      if (periodValue === 'current' && !currentPeriodColumns.includes(key)) {
        currentPeriodColumns.push(key);
      } else if (periodValue === 'previous' && !previousPeriodColumns.includes(key)) {
        previousPeriodColumns.push(key);
      }
      
      // コンテキスト情報からも期間を推測
      const contextRef = row[`${key}_ContextRef`];
      if (contextRef) {
        if ((contextRef.includes('Current') || contextRef.includes('ThisYear')) && 
            !currentPeriodColumns.includes(key)) {
          currentPeriodColumns.push(key);
        } else if ((contextRef.includes('Prior') || contextRef.includes('LastYear')) && 
                  !previousPeriodColumns.includes(key)) {
          previousPeriodColumns.push(key);
        }
      }
    }
  }
  
  // データを順番に処理して階層構造を構築
  let currentLevel = 0;
  let parentStack: HierarchicalXBRLItem[] = [];
  let currentTotal: HierarchicalXBRLItem | null = null;
  
  // データの各行を処理
  for (const row of data) {
    // 項目名カラムと値カラムを特定
    let itemNameColumn = '';
    let currentValueColumn = '';
    let previousValueColumn = '';
    
    // 最初の非空のカラムを項目名として使用
    for (const key in row) {
      if (!key.includes('_') && row[key] && typeof row[key] === 'string' && row[key].trim()) {
        itemNameColumn = key;
        break;
      }
    }
    
    // 項目名がない場合はスキップ
    if (!itemNameColumn || !row[itemNameColumn]) {
      continue;
    }
    
    // 当期/前期の値カラムを特定
    if (currentPeriodColumns.length > 0) {
      currentValueColumn = currentPeriodColumns[0];
    }
    if (previousPeriodColumns.length > 0) {
      previousValueColumn = previousPeriodColumns[0];
    }
    
    // 特に指定がない場合、項目名の次のカラムを当期、その次を前期と仮定
    if (!currentValueColumn) {
      const columns = Object.keys(row);
      const idx = columns.indexOf(itemNameColumn);
      if (idx !== -1 && idx + 1 < columns.length) {
        currentValueColumn = columns[idx + 1];
      }
    }
    if (!previousValueColumn) {
      const columns = Object.keys(row);
      const currentIdx = columns.indexOf(currentValueColumn);
      if (currentIdx !== -1 && currentIdx + 1 < columns.length) {
        previousValueColumn = columns[currentIdx + 1];
      }
    }
    
    // 項目名からレベルを推定
    const itemName = row[itemNameColumn];
    let level = 0;
    
    // インデントからレベルを推定
    const indentMatch = indentPattern.exec(itemName);
    if (indentMatch) {
      level = indentMatch[0].length;
    }
    
    // 特殊な項目名の特徴でもレベルを推定
    if (itemName.startsWith('　') || itemName.startsWith('  ')) {
      level = Math.max(1, level);
    } else if (itemName.includes('合計') || itemName.includes('Total')) {
      // 合計行は親アイテムと同じレベル
      level = Math.max(0, currentLevel);
    } else if (itemName.match(/^\d+\.\s/) || itemName.match(/^[IVX]+\.\s/)) {
      // 数字やローマ数字の節番号がある場合
      level = 0;
    }
    
    // XBRLタグからもレベルを推定
    const xbrlTag = row[`${itemNameColumn}_XBRL`];
    if (xbrlTag && xbrlTag.includes('heading')) {
      level = 0; // 見出しタグは最上位
    }
    
    // 値を数値に変換
    let currentValue: number | null = null;
    let previousValue: number | null = null;
    
    if (currentValueColumn && row[currentValueColumn]) {
      currentValue = convertToNumber(row[currentValueColumn]);
    }
    
    if (previousValueColumn && row[previousValueColumn]) {
      previousValue = convertToNumber(row[previousValueColumn]);
    }
    
    // 階層構造内の位置を調整
    if (level > currentLevel) {
      // 階層が深くなる場合、現在の項目を親として追加
      if (parentStack.length > 0) {
        parentStack.push(parentStack[parentStack.length - 1]);
      }
    } else if (level < currentLevel) {
      // 階層が浅くなる場合、適切なレベルまで親スタックを戻す
      while (parentStack.length > level) {
        parentStack.pop();
      }
    }
    
    currentLevel = level;
    
    // XBRLタグ、コンテキスト、単位情報を取得
    const contextRef = row[`${itemNameColumn}_ContextRef`] || null;
    const unitRef = row[`${itemNameColumn}_UnitRef`] || null;
    const unitLabel = row[`${itemNameColumn}_Unit`] || null;
    
    // 項目を作成
    const item: HierarchicalXBRLItem = {
      itemName: itemName.trim(),
      itemPath: [...(parentStack.length > 0 ? parentStack[parentStack.length - 1].itemPath || [] : []), itemName.trim()],
      level,
      xbrlTag,
      previousPeriod: previousValue,
      currentPeriod: currentValue,
      change: currentValue !== null && previousValue !== null ? currentValue - previousValue : null,
      changeRate: currentValue !== null && previousValue !== null && previousValue !== 0 ? 
                 ((currentValue - previousValue) / previousValue) * 100 : null,
      children: [],
      contextRef,
      unitRef,
      unitLabel
    };
    
    // 合計項目かどうかを判定
    if (itemName.includes('合計') || itemName.includes('Total')) {
      item.isTotal = true;
      currentTotal = item;
    }
    
    // 親子関係を設定
    if (parentStack.length > 0 && level > 0) {
      const parent = parentStack[parentStack.length - 1];
      parent.children = [...(parent.children || []), item];
      item.parentPath = parent.itemName;
    } else {
      // ルート項目として追加
      rootItems.push(item);
    }
    
    // インデックスに登録
    itemIndex[itemName.trim()] = item;
  }
  
  // 階層構造を調整（小計・合計の処理など）
  for (const item of rootItems) {
    adjustHierarchy(item, 0);
  }
  
  return rootItems;
};

/**
 * 階層構造を調整する
 * @param item 階層項目
 * @param level 現在のレベル
 */
const adjustHierarchy = (item: HierarchicalXBRLItem, level: number): void => {
  // レベルを更新
  item.level = level;
  
  // 計算項目（合計など）の場合
  if (item.isTotal) {
    item.isCalculated = true;
  } else if (item.itemName.includes('合計') || item.itemName.includes('小計') || 
             item.itemName.includes('Total') || item.itemName.includes('Subtotal')) {
    item.isTotal = true;
    item.isCalculated = true;
  }
  
  // 子項目を再帰的に処理
  if (item.children && item.children.length > 0) {
    for (const child of item.children) {
      adjustHierarchy(child, level + 1);
    }
  }
};

/**
 * 文字列を数値に変換する
 * @param value 変換対象の文字列
 * @returns 変換された数値またはnull
 */
const convertToNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // 既に数値の場合はそのまま返す
  if (typeof value === 'number') {
    return value;
  }
  
  // 文字列の場合は変換を試みる
  if (typeof value === 'string') {
    // カンマや通貨記号、空白を削除
    const cleanedValue = value.replace(/[¥,$€£₹\s,]/g, '')
                               .replace(/△/g, '-')  // 日本の会計で使用される△（マイナス）
                               .replace(/▲/g, '-')  // 同じくマイナス
                               .replace(/\(([0-9.]+)\)/g, '-$1'); // 括弧で囲まれた数値はマイナス
    
    // 数値に変換
    const num = parseFloat(cleanedValue);
    return isNaN(num) ? null : num;
  }
  
  return null;
};
