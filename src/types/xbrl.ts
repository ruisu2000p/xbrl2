/**
 * XBRLデータに関する型定義
 * アプリケーション全体でXBRLデータの構造を統一的に扱うための型定義です
 */

// 財務項目の値を表す型
export interface FinancialValue {
  value: number | string;
  unit?: string;
  contextRef?: string;
  period?: string;
  decimals?: string;
}

// 財務諸表の項目を表す型
export interface FinancialItem {
  id: string;
  name: string;
  nameJa?: string; // 日本語名
  values: FinancialValue[];
}

// 財務諸表の種類
export enum StatementType {
  BalanceSheet = 'bs', // 貸借対照表
  IncomeStatement = 'pl', // 損益計算書
  CashFlow = 'cf', // キャッシュフロー計算書
  Other = 'other' // その他
}

// コンテキスト（期間）情報
export interface Context {
  id: string;
  instant?: string; // 特定時点
  startDate?: string; // 期間開始日
  endDate?: string; // 期間終了日
  scenario?: string; // シナリオ情報
}

// 単位情報
export interface Unit {
  id: string;
  measure: string;
}

// 財務諸表データ
export interface FinancialStatement {
  type: StatementType;
  items: FinancialItem[];
}

// 企業情報
export interface CompanyInfo {
  name?: string;
  ticker?: string;
  fiscalYear?: string;
  endDate?: string;
}

// XBRLデータ全体
export interface XBRLData {
  companyInfo: CompanyInfo;
  contexts: Record<string, Context>; // コンテキストID→コンテキスト情報のマップ
  units: Record<string, Unit>; // 単位ID→単位情報のマップ
  statements: Record<StatementType, FinancialStatement>; // 財務諸表の種類→財務諸表データのマップ
}

// 財務指標を表す型
export interface FinancialRatio {
  name: string;
  value: number;
  description: string;
  category: RatioCategory;
}

// 財務指標のカテゴリ
export enum RatioCategory {
  Profitability = '収益性',
  Liquidity = '流動性',
  Solvency = '安全性',
  Efficiency = '効率性',
  Valuation = '株式評価'
}

// チャートデータ型
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  }[];
}