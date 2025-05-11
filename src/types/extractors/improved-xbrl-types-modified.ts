/**
 * 改善版XBRL抽出用の型定義
 */

/**
 * XBRLセルデータの拡張インターフェース
 * 抽出されたセルデータとXBRL属性を格納
 */
export interface XBRLCellData {
  value: string;
  xbrlTag: string | null;
  contextRef?: string | null;
  unitRef?: string | null;
  decimals?: string | null;
  scale?: string | null;
  format?: string | null;
  periodInfo?: XBRLContextInfo | null;
  unitInfo?: XBRLUnitInfo | null;
}

/**
 * XBRLコンテキスト情報の型定義
 * 期間情報や会計年度などを格納
 */
export interface XBRLContextInfo {
  id?: string; // IDを許可
  periodType: 'instant' | 'duration' | 'unknown';
  instant: string | null;
  startDate: string | null;
  endDate: string | null;
  entity: string | null; // string型に修正
  scheme: string | null; // string型に修正
  explicitMember: {
    dimension: string | null;
    value: string | null;
  } | null;
  fiscalYear: 'current' | 'previous' | 'unknown';
  isCurrentPeriod: boolean;
  isPreviousPeriod: boolean;
  memberType: 'consolidated' | 'non_consolidated' | 'unknown'; // individualは非対応
  memberValue: string | null;
  segment?: Record<string, string>; // セグメント情報を追加
}

/**
 * XBRL単位情報の型定義
 * 通貨、株数などの単位を格納
 */
export interface XBRLUnitInfo {
  id?: string; // idプロパティをオプションとして追加
  type: 'simple' | 'fraction';
  measure?: string;
  numerator?: string;
  denominator?: string;
  displayLabel: string;
  symbol?: string; // 追加プロパティ
  name?: string; // 追加プロパティ
}

/**
 * XBRLテーブルデータの型定義
 * 抽出されたテーブル情報の全体構造
 */
export interface XBRLTableData {
  id: string;
  headers: XBRLCellData[];
  rows: XBRLCellData[][];
  originalTable: string;
  tableType: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'shareholder' | 'unknown';
  tableTitle: string;
  statistics: {
    rowCount: number;
    columnCount: number;
    emptyCells: number;
    totalCells: number;
    xbrlTagCount: number;
    xbrlTags: string[];
  };
  contextInfo?: Record<string, XBRLContextInfo>;
  unitInfo?: Record<string, XBRLUnitInfo>;
}

/**
 * 階層化されたXBRLデータの型定義
 */
export interface HierarchicalXBRLData {
  metadata: {
    reportType: string;
    unit: string;
    periods: {
      previous: string | null;
      current: string | null;
    };
    entityName?: string;
    documentDate?: string;
  };
  data: HierarchicalXBRLItem[];
  annotations?: Record<string, string>;
}

/**
 * 階層化されたXBRLデータ項目の型定義
 */
export interface HierarchicalXBRLItem {
  itemName: string;
  itemPath?: string[];
  level: number;
  xbrlTag: string | null;
  previousPeriod: number | null;
  currentPeriod: number | null;
  change?: number | null;
  changeRate?: number | null;
  children?: HierarchicalXBRLItem[];
  parentPath?: string;
  isCalculated?: boolean;
  isTotal?: boolean;
  contextRef?: string | null;
  unitRef?: string | null;
  unitLabel?: string | null;
}

/**
 * 処理済みXBRLデータの型定義
 */
export interface ProcessedXBRLData {
  success: boolean;
  rawData?: any;
  hierarchical: HierarchicalXBRLData;
  errors?: string[];
  warnings?: string[];
}

/**
 * 抽出オプションの型定義
 */
export interface XBRLExtractionOptions {
  detectHeaders: boolean;
  trimWhitespace: boolean;
  ignoreEmptyRows: boolean;
  convertSpecialChars: boolean;
  includeXbrlTags: boolean;
  intelligentProcessing: boolean;
  contextAware: boolean;
}
