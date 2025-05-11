/**
 * 改善版XBRLデータフォーマッター
 * XBRLテーブルデータを階層構造に変換するユーティリティ
 */

// 数値変換ユーティリティ
const parseFinancialValue = (value: string | number | null): number | null => {
  // nullやundefinedの場合
  if (value === null || value === undefined) return null;
  
  // 数値型の場合はそのまま返す
  if (typeof value === 'number') return value;
  
  // 空文字やハイフンのみの場合はnull
  if (!value || value.trim() === '' || value === '-') return null;
  
  // 財務表記の特殊表記を処理
  let cleanValue = value
    .replace(/,/g, '') // カンマ除去
    .replace(/△/g, '-') // 三角記号をマイナスに変換
    .replace(/▲/g, '-') // 黒三角記号をマイナスに変換
    .replace(/[()（）]/g, '') // 括弧除去
    .replace(/　/g, '') // 全角スペース除去
    .replace(/\s+/g, ''); // 空白除去
  
  // 括弧で囲まれた値はマイナス値として扱う
  if (value.match(/\(.*\)/) || value.match(/（.*）/)) {
    cleanValue = '-' + cleanValue;
  }
  
  // 文字コード8722（全角マイナス）を半角マイナスに変換
  cleanValue = cleanValue.replace(/\u2212/g, '-');
  
  // 数値に変換
  const numValue = parseFloat(cleanValue);
  
  // 変換結果をログ出力して確認
  if (isNaN(numValue)) {
    console.log(`数値変換失敗: 元値=[${value}], クリーン値=[${cleanValue}]`);
  } else if (numValue !== 0 && Math.abs(numValue) > 1000000) {
    console.log(`大きな数値変換: 元値=[${value}] -> ${numValue}`);
  }
  
  return isNaN(numValue) ? null : numValue;
};

// 階層構造かどうかを判断するヘルパー
const isHierarchicalItem = (key: string, value: string): boolean => {
  // インデントや空白の数で階層を判断
  const leadingSpaces = value.match(/^[\s　]*/)?.[0].length || 0;
  return leadingSpaces > 0 || key.includes('項目') || key.includes('科目');
};

// 階層レベルを推定するヘルパー
const estimateLevel = (name: string): number => {
  // 先頭の空白文字数でレベルを判断
  const leadingSpaces = name.match(/^[\s　]*/)?.[0].length || 0;
  const level = Math.floor(leadingSpaces / 2);
  
  // 特定のキーワードでレベルを調整
  if (name.includes('合計') || name.includes('総額')) {
    return Math.max(0, level - 1);
  }
  
  return level;
};

// 親子関係の階層構造に変換
const buildHierarchy = (flatItems: any[]): any[] => {
  const rootItems: any[] = [];
  const stack: any[] = [{ level: -1, item: null, children: rootItems }];
  
  for (const item of flatItems) {
    const currentLevel = item.level;
    
    // スタックから適切な親を見つける
    while (stack.length > 1 && stack[stack.length - 1].level >= currentLevel) {
      stack.pop();
    }
    
    // 親の子供として追加
    const parent = stack[stack.length - 1];
    if (!item.children) {
      item.children = [];
    }
    
    parent.children.push(item);
    
    // 現在の項目をスタックに追加
    stack.push(item);
  }
  
  return rootItems;
};

// XBRL単位の正規化
const normalizeUnit = (data: any[]): string => {
  // 単位を検出
  let unit = '円';
  
  // ヘッダーや値から単位を推定
  const unitPatterns = [
    { pattern: /百万円/i, value: '百万円' },
    { pattern: /千円/i, value: '千円' },
    { pattern: /円/i, value: '円' },
    { pattern: /million yen/i, value: '百万円' },
    { pattern: /millions of yen/i, value: '百万円' },
    { pattern: /thousand yen/i, value: '千円' },
    { pattern: /thousands of yen/i, value: '千円' },
    { pattern: /yen/i, value: '円' },
  ];
  
  for (const row of data) {
    const values = Object.values(row) as string[];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      
      for (const { pattern, value: unitValue } of unitPatterns) {
        if (pattern.test(value)) {
          unit = unitValue;
          return unit;
        }
      }
    }
  }
  
  return unit;
};

// 期間情報を抽出
const extractPeriodInfo = (data: any[]): { previous: string; current: string } => {
  const periods: { previous: string; current: string } = {
    previous: '前期',
    current: '当期',
  };
  
  // 期間のインデックスタイプを定義
  type PeriodKey = 'previous' | 'current';
  
  // ヘッダーから期間情報を検出
  const periodPatterns = [
    // 前期パターン
    { 
      patterns: [/前期/i, /前年度/i, /前連結会計年度/i, /前事業年度/i, /previous year/i, /prior year/i],
      target: 'previous' as PeriodKey
    },
    // 当期パターン
    {
      patterns: [/当期/i, /当年度/i, /当連結会計年度/i, /当事業年度/i, /current year/i, /this year/i],
      target: 'current' as PeriodKey
    }
  ];
  
  // データから期間情報を検出
  for (const row of data) {
    for (const key in row) {
      const value = row[key];
      if (typeof value !== 'string') continue;
      
      for (const { patterns, target } of periodPatterns) {
        for (const pattern of patterns) {
          if (pattern.test(key) || pattern.test(value)) {
            // 日付形式を検出
            const dateMatch = value.match(/\d{4}[年/-]\d{1,2}[月/-]\d{1,2}/);
            if (dateMatch) {
              periods[target] = dateMatch[0];
            } else {
              // 年度表記を検出
              const yearMatch = value.match(/\d{4}[年度]/);
              if (yearMatch) {
                periods[target] = yearMatch[0];
              }
            }
          }
        }
      }
    }
  }
  
  return periods;
};

// メインの変換関数
export const convertXBRLData = (data: any[]): any => {
  try {
    if (!data || data.length === 0) {
      return {
        success: false,
        message: 'データがありません',
        hierarchical: {
          data: [],
          metadata: {
            reportType: '不明',
            unit: '円',
            periods: { previous: '前期', current: '当期' }
          }
        }
      };
    }
    
    // ヘッダー行を特定
    const headers = Object.keys(data[0]);
    
    // 項目名、前期、当期のカラム特定
    let itemNameColumn = '';
    let previousPeriodColumn = '';
    let currentPeriodColumn = '';
    let xbrlTagColumn = '';
    
    // カラム特定のヒューリスティック
    for (const header of headers) {
      const lowerHeader = header.toLowerCase();
      
      // 項目名列を特定
      if (
        lowerHeader.includes('項目') || 
        lowerHeader.includes('科目') || 
        lowerHeader.includes('勘定科目') || 
        lowerHeader.includes('名称') || 
        lowerHeader.includes('item') || 
        lowerHeader.includes('name') || 
        lowerHeader === '0' || 
        lowerHeader === '列 1'
      ) {
        itemNameColumn = header;
      }
      
      // 前期カラム特定
      else if (
        lowerHeader.includes('前期') || 
        lowerHeader.includes('前年度') || 
        lowerHeader.includes('前連結会計年度') || 
        lowerHeader.includes('前事業年度') || 
        lowerHeader.includes('previous') || 
        lowerHeader.includes('prior')
      ) {
        previousPeriodColumn = header;
      }
      
      // 当期カラム特定
      else if (
        lowerHeader.includes('当期') || 
        lowerHeader.includes('当年度') || 
        lowerHeader.includes('当連結会計年度') || 
        lowerHeader.includes('当事業年度') || 
        lowerHeader.includes('current') || 
        lowerHeader.includes('this year')
      ) {
        currentPeriodColumn = header;
      }
      
      // XBRLタグ列を特定
      else if (
        lowerHeader.includes('xbrl') || 
        lowerHeader.includes('tag') || 
        lowerHeader.includes('タグ') || 
        lowerHeader.endsWith('_tag') || 
        lowerHeader.endsWith('_xbrl')
      ) {
        xbrlTagColumn = header;
      }
    }
    
    // カラムが特定できない場合はヒューリスティックで推定
    if (!itemNameColumn && headers.length > 0) {
      itemNameColumn = headers[0]; // 最初のカラムを項目名とする
      console.log(`項目名列を自動設定: ${itemNameColumn}`);
    }
    
    // 列番号から特定
    if (!previousPeriodColumn && !currentPeriodColumn && headers.length >= 3) {
      // 3列以上ある場合、典型的な　項目名、前期、当期　のパターンを仮定
      previousPeriodColumn = headers[1];
      currentPeriodColumn = headers[2];
      console.log(`列番号から期間列を設定 - 前期: ${previousPeriodColumn}, 当期: ${currentPeriodColumn}`);
    }
    
    if (!previousPeriodColumn && !currentPeriodColumn) {
      // データ型から数値列を特定
      const numericColumns = headers.filter(header => {
        return data.some(row => {
          const val = row[header];
          return typeof val === 'number' || 
                 (typeof val === 'string' && !isNaN(parseFloat(val.replace(/,/g, ''))));
        });
      });
      
      console.log(`数値列検出結果: ${numericColumns.length}列`);
      
      if (numericColumns.length >= 2) {
        previousPeriodColumn = numericColumns[0];
        currentPeriodColumn = numericColumns[1];
        console.log(`数値列から期間列を設定 - 前期: ${previousPeriodColumn}, 当期: ${currentPeriodColumn}`);
      } else if (numericColumns.length === 1) {
        currentPeriodColumn = numericColumns[0];
        console.log(`数値列から当期列のみ設定: ${currentPeriodColumn}`);
      }
    }
    
    // XBRLタグが特定できない場合
    if (!xbrlTagColumn) {
      // _XBRLがついているカラムを探す
      for (const header of headers) {
        if (header.endsWith('_XBRL')) {
          const baseColumn = header.replace('_XBRL', '');
          if (baseColumn === itemNameColumn) {
            xbrlTagColumn = header;
            break;
          }
        }
      }
    }
    
    // 期間情報の抽出
    const periodInfo = extractPeriodInfo(data);
    
    // 単位の特定
    const unit = normalizeUnit(data);
    
    // トラックする項目を準備
    const items: any[] = [];
    let currentLevel = 0;
    let previousLevel = 0;
    
    // データを階層構造に変換
    console.log(`変換情報: 項目名列=${itemNameColumn}, 前期列=${previousPeriodColumn}, 当期列=${currentPeriodColumn}`);
    
    for (const row of data) {
      const itemName = (row[itemNameColumn] || '').toString().trim();
      
      // 空の行はスキップ
      if (!itemName) continue;
      
      // XBRLタグを取得
      const xbrlTag = xbrlTagColumn ? row[xbrlTagColumn] || null : null;
      
      // 階層レベルを推定
      currentLevel = estimateLevel(itemName);
      
      // クリーンな項目名（先頭の空白を除去）
      const cleanItemName = itemName.replace(/^[\s　]+/, '');
      
      // 前期列が設定されている場合のみ渡す
      const previousValueRaw = previousPeriodColumn ? row[previousPeriodColumn] : null;
      const previousValue = parseFinancialValue(previousValueRaw);
      
      // 当期列が設定されている場合のみ渡す
      const currentValueRaw = currentPeriodColumn ? row[currentPeriodColumn] : null;
      const currentValue = parseFinancialValue(currentValueRaw);

      // 重要な行や値が大きい行のログ出力
      if (cleanItemName.includes('合計') || cleanItemName.includes('財') || 
          (currentValue !== null && Math.abs(currentValue) > 1000000)) {
        console.log(`重要行: ${cleanItemName} - 前期:${previousValue}, 当期:${currentValue}`);
      }
      
      // 項目を追加
      items.push({
        itemName: cleanItemName,
        xbrlTag,
        previousPeriod: previousValue,
        currentPeriod: currentValue,
        level: currentLevel,
      });
      
      previousLevel = currentLevel;
    }
    
    // 階層構造を構築
    const hierarchicalData = buildHierarchy(items);
    
    // 比較データの作成
    const comparativeData = items.map(item => {
      const change = item.previousPeriod !== null && item.currentPeriod !== null
        ? item.currentPeriod - item.previousPeriod
        : null;
      
      const changeRate = item.previousPeriod !== null && item.currentPeriod !== null && item.previousPeriod !== 0
        ? `${((item.currentPeriod - item.previousPeriod) / Math.abs(item.previousPeriod) * 100).toFixed(1)}%`
        : '';
      
      return {
        ...item,
        change,
        changeRate
      };
    });
    
    // レポートタイプを推定
    let reportType = '財務諸表';
    if (data.some(row => {
      const itemName = (row[itemNameColumn] || '').toString().toLowerCase();
      return itemName.includes('貸借対照表') || itemName.includes('balance sheet');
    })) {
      reportType = '貸借対照表';
    } else if (data.some(row => {
      const itemName = (row[itemNameColumn] || '').toString().toLowerCase();
      return itemName.includes('損益計算書') || itemName.includes('income statement') || itemName.includes('profit and loss');
    })) {
      reportType = '損益計算書';
    } else if (data.some(row => {
      const itemName = (row[itemNameColumn] || '').toString().toLowerCase();
      return itemName.includes('キャッシュ・フロー') || itemName.includes('cash flow');
    })) {
      reportType = 'キャッシュ・フロー計算書';
    }
    
    // メモ情報の抽出
    const annotations: Record<string, string> = {};
    for (const row of data) {
      const itemName = (row[itemNameColumn] || '').toString().trim();
      
      // 注記や追加情報を検出
      if (itemName.includes('注記') || itemName.includes('注記事項') || itemName.includes('Notes')) {
        const note = Object.values(row).find(val => 
          typeof val === 'string' && val.length > 20 && val !== itemName
        );
        
        if (note) {
          annotations[itemName] = note.toString();
        }
      }
      
      // 会計方針や重要な情報
      if (itemName.includes('会計方針') || itemName.includes('Accounting Policy')) {
        const policy = Object.values(row).find(val => 
          typeof val === 'string' && val.length > 20 && val !== itemName
        );
        
        if (policy) {
          annotations['会計方針'] = policy.toString();
        }
      }
    }
    
    return {
      success: true,
      comparative: {
        comparativeData,
        metadata: {
          reportType,
          unit,
          periods: periodInfo,
        }
      },
      hierarchical: {
        data: hierarchicalData,
        metadata: {
          reportType,
          unit,
          periods: periodInfo,
        },
        annotations: Object.keys(annotations).length > 0 ? annotations : undefined
      }
    };
  } catch (error) {
    console.error('XBRLデータの変換エラー:', error);
    return {
      success: false,
      message: `変換エラー: ${error instanceof Error ? error.message : String(error)}`,
      hierarchical: {
        data: [],
        metadata: {
          reportType: '不明',
          unit: '円',
          periods: { previous: '前期', current: '当期' }
        }
      }
    };
  }
};
