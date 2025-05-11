import { XBRLData, StatementType, FinancialRatio, RatioCategory } from '../types/xbrl';

/**
 * XBRLデータから財務指標を計算します
 * @param xbrlData XBRLデータ
 * @returns 計算された財務指標のリスト
 */
export const calculateFinancialRatios = (xbrlData: XBRLData): FinancialRatio[] => {
  const ratios: FinancialRatio[] = [];
  
  // 貸借対照表データ取得
  const balanceSheet = xbrlData.statements[StatementType.BalanceSheet];
  // 損益計算書データ取得
  const incomeStatement = xbrlData.statements[StatementType.IncomeStatement];
  // キャッシュフロー計算書データ取得
  const cashFlow = xbrlData.statements[StatementType.CashFlow];
  
  // 項目値の検索関数（キーワードで項目を検索）
  const findItemValue = (statement: StatementType, keywords: string[]): number => {
    const items = xbrlData.statements[statement].items;
    
    for (const item of items) {
      const name = (item.nameJa || item.name).toLowerCase();
      if (keywords.some(keyword => name.includes(keyword.toLowerCase())) && item.values.length > 0) {
        const value = typeof item.values[0].value === 'string' 
          ? parseFloat(item.values[0].value.replace(/,/g, '')) 
          : item.values[0].value;
        if (!isNaN(value)) {
          return value;
        }
      }
    }
    
    return 0;
  };
  
  // 貸借対照表項目
  const totalAssets = findItemValue(StatementType.BalanceSheet, ['資産合計', 'total assets']);
  const currentAssets = findItemValue(StatementType.BalanceSheet, ['流動資産合計', 'current assets']);
  const cash = findItemValue(StatementType.BalanceSheet, ['現金', '預金', 'cash', 'cash equivalents']);
  const inventory = findItemValue(StatementType.BalanceSheet, ['棚卸資産', '商品', '製品', 'inventory', 'inventories']);
  const totalLiabilities = findItemValue(StatementType.BalanceSheet, ['負債合計', 'total liabilities']);
  const currentLiabilities = findItemValue(StatementType.BalanceSheet, ['流動負債合計', 'current liabilities']);
  const equity = findItemValue(StatementType.BalanceSheet, ['純資産合計', '株主資本合計', 'total equity', 'net assets']);
  
  // 損益計算書項目
  const revenue = findItemValue(StatementType.IncomeStatement, ['売上高', '営業収益', 'revenue', 'sales']);
  const grossProfit = findItemValue(StatementType.IncomeStatement, ['売上総利益', 'gross profit']);
  const operatingIncome = findItemValue(StatementType.IncomeStatement, ['営業利益', 'operating income', 'operating profit']);
  const netIncome = findItemValue(StatementType.IncomeStatement, ['当期純利益', '当期利益', 'net income', 'profit']);
  const interestExpense = findItemValue(StatementType.IncomeStatement, ['支払利息', 'interest expense']);
  
  // キャッシュフロー項目
  const operatingCashFlow = findItemValue(StatementType.CashFlow, ['営業活動によるキャッシュ・フロー', 'operating activities', 'operating cash flow']);
  
  // 項目が存在するか確認し、財務指標を計算
  
  // 収益性指標
  if (revenue > 0) {
    // 営業利益率
    if (operatingIncome !== 0) {
      ratios.push({
        name: '営業利益率',
        value: (operatingIncome / revenue) * 100,
        description: '売上高に対する営業利益の割合。企業の本業での収益性を示します。',
        category: RatioCategory.Profitability
      });
    }
    
    // 売上総利益率
    if (grossProfit !== 0) {
      ratios.push({
        name: '売上総利益率',
        value: (grossProfit / revenue) * 100,
        description: '売上高に対する売上総利益の割合。企業の製品・サービスの基本的な収益性を示します。',
        category: RatioCategory.Profitability
      });
    }
    
    // 当期純利益率
    if (netIncome !== 0) {
      ratios.push({
        name: '当期純利益率',
        value: (netIncome / revenue) * 100,
        description: '売上高に対する当期純利益の割合。企業の最終的な収益性を示します。',
        category: RatioCategory.Profitability
      });
    }
  }
  
  // 総資産利益率（ROA）
  if (totalAssets > 0 && netIncome !== 0) {
    ratios.push({
      name: '総資産利益率(ROA)',
      value: (netIncome / totalAssets) * 100,
      description: '総資産に対する当期純利益の割合。資産の効率的な利用度を示します。',
      category: RatioCategory.Profitability
    });
  }
  
  // 自己資本利益率（ROE）
  if (equity > 0 && netIncome !== 0) {
    ratios.push({
      name: '自己資本利益率(ROE)',
      value: (netIncome / equity) * 100,
      description: '自己資本に対する当期純利益の割合。株主投資に対する収益性を示します。',
      category: RatioCategory.Profitability
    });
  }
  
  // 流動性指標
  if (currentLiabilities > 0) {
    // 流動比率
    if (currentAssets > 0) {
      ratios.push({
        name: '流動比率',
        value: (currentAssets / currentLiabilities) * 100,
        description: '流動負債に対する流動資産の割合。短期的な支払能力を示します。',
        category: RatioCategory.Liquidity
      });
    }
    
    // 当座比率
    const quickAssets = currentAssets - inventory;
    if (quickAssets > 0) {
      ratios.push({
        name: '当座比率',
        value: (quickAssets / currentLiabilities) * 100,
        description: '流動負債に対する当座資産（流動資産から棚卸資産を除いたもの）の割合。より厳格な短期支払能力を示します。',
        category: RatioCategory.Liquidity
      });
    }
    
    // 現金比率
    if (cash > 0) {
      ratios.push({
        name: '現金比率',
        value: (cash / currentLiabilities) * 100,
        description: '流動負債に対する現金および現金同等物の割合。即時の支払能力を示します。',
        category: RatioCategory.Liquidity
      });
    }
  }
  
  // 安全性指標
  if (totalAssets > 0) {
    // 自己資本比率
    if (equity > 0) {
      ratios.push({
        name: '自己資本比率',
        value: (equity / totalAssets) * 100,
        description: '総資産に対する自己資本の割合。財務の安全性や独立性を示します。',
        category: RatioCategory.Solvency
      });
    }
    
    // 負債比率
    if (totalLiabilities > 0) {
      ratios.push({
        name: '負債比率',
        value: (totalLiabilities / totalAssets) * 100,
        description: '総資産に対する負債の割合。財務レバレッジの度合いを示します。',
        category: RatioCategory.Solvency
      });
    }
  }
  
  // デット・エクイティ・レシオ
  if (equity > 0 && totalLiabilities > 0) {
    ratios.push({
      name: 'デット・エクイティ・レシオ',
      value: (totalLiabilities / equity),
      description: '自己資本に対する負債の割合。財務レバレッジの別の指標です。',
      category: RatioCategory.Solvency
    });
  }
  
  // 利息カバレッジレシオ
  if (interestExpense > 0 && operatingIncome > 0) {
    ratios.push({
      name: '利息カバレッジレシオ',
      value: (operatingIncome / interestExpense),
      description: '利息の支払いに対する営業利益の割合。負債の利息を支払う能力を示します。',
      category: RatioCategory.Solvency
    });
  }
  
  // 効率性指標
  if (totalAssets > 0 && revenue > 0) {
    // 総資産回転率
    ratios.push({
      name: '総資産回転率',
      value: (revenue / totalAssets),
      description: '総資産に対する売上高の割合。資産の効率的な利用を示します。',
      category: RatioCategory.Efficiency
    });
  }
  
  // 棚卸資産回転率
  if (inventory > 0 && revenue > 0) {
    ratios.push({
      name: '棚卸資産回転率',
      value: (revenue / inventory),
      description: '棚卸資産に対する売上高の割合。在庫管理の効率性を示します。',
      category: RatioCategory.Efficiency
    });
  }
  
  // キャッシュフロー関連指標
  if (operatingCashFlow > 0) {
    // 営業キャッシュフロー対当期純利益比率
    if (netIncome > 0) {
      ratios.push({
        name: '営業CF対純利益比率',
        value: (operatingCashFlow / netIncome),
        description: '当期純利益に対する営業キャッシュフローの割合。利益の質を示します。',
        category: RatioCategory.Efficiency
      });
    }
    
    // 営業キャッシュフロー対負債比率
    if (totalLiabilities > 0) {
      ratios.push({
        name: '営業CF対負債比率',
        value: (operatingCashFlow / totalLiabilities) * 100,
        description: '負債に対する営業キャッシュフローの割合。債務の返済能力を示します。',
        category: RatioCategory.Solvency
      });
    }
  }
  
  return ratios;
};