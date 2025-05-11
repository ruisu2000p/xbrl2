
/**
 * XBRL抽出ツールで使用する型定義
 */

// XBRLセルデータの型定義
export interface XBRLCellData {
  value: string;
  xbrlTag: string | null;
}

// XBRLテーブルデータの型定義
export interface XBRLTableData {
  id: string;
  headers: XBRLCellData[];
  rows: XBRLCellData[][];
  originalTable: string;
  tableType: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'unknown';
  tableTitle: string;
  statistics: {
    rowCount: number;
    columnCount: number;
    emptyCells: number;
    totalCells: number;
    xbrlTagCount: number;
    xbrlTags: string[];
  };
}

// 処理結果データの型定義
export interface ProcessedXBRLData {
  success: boolean;
  message?: string;
  comparative?: {
    comparativeData: Array<{
      itemName: string;
      xbrlTag?: string;
      previousPeriod: number | null;
      currentPeriod: number | null;
      change: number | null;
      changeRate: string;
      level?: number;
    }>;
    metadata?: Record<string, unknown>;
  };
  hierarchical: {
    data: Array<{
      itemName: string;
      xbrlTag?: string;
      previousPeriod: number | null;
      currentPeriod: number | null;
      level: number;
      children?: Array<unknown>;
    }>;
    metadata: {
      reportType: string;
      unit: string;
      periods: {
        previous: string;
        current: string;
      };
    };
    annotations?: Record<string, string>;
  };
}

// ElementRef型
export interface ElementRef<T> {
  current: T | null;
}
