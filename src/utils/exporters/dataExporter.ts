/**
 * データエクスポートモジュール
 * 財務データをさまざまな形式に変換してエクスポート
 */

import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { FinancialData, StatementType } from '../../types/xbrl';

type ExportFormat = 'json' | 'csv' | 'excel';

interface ExportOptions {
  includeComments?: boolean;
  includeTaxonomyInfo?: boolean;
  statementTypes?: StatementType[];
  fileName?: string;
}

/**
 * 財務データをエクスポートする
 * @param data 財務データ
 * @param format エクスポート形式
 * @param options エクスポートオプション
 */
export const exportFinancialData = (
  data: FinancialData,
  format: ExportFormat,
  options: ExportOptions = {}
): void => {
  const {
    includeComments = true,
    includeTaxonomyInfo = true,
    statementTypes = [StatementType.BalanceSheet, StatementType.IncomeStatement, StatementType.CashFlow],
    fileName = 'financial_data'
  } = options;

  switch (format) {
    case 'json':
      exportAsJSON(data, includeComments, includeTaxonomyInfo, fileName);
      break;
    case 'csv':
      exportAsCSV(data, statementTypes, fileName);
      break;
    case 'excel':
      exportAsExcel(data, includeComments, includeTaxonomyInfo, statementTypes, fileName);
      break;
    default:
      throw new Error(`未サポートのエクスポート形式: ${format}`);
  }
};

/**
 * JSONとしてエクスポート
 */
const exportAsJSON = (
  data: FinancialData,
  includeComments: boolean,
  includeTaxonomyInfo: boolean,
  fileName: string
): void => {
  const exportData = {
    financialItems: data.financialItems,
    taxonomyReferences: includeTaxonomyInfo ? data.taxonomyReferences : undefined,
    comments: includeComments ? data.comments : undefined
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  saveAs(blob, `${fileName}.json`);
};

/**
 * CSVとしてエクスポート
 */
const exportAsCSV = (
  data: FinancialData,
  statementTypes: StatementType[],
  fileName: string
): void => {
  const header = ['項目名', '値', '単位', '期間', 'タクソノミ要素'];
  const rows = data.financialItems.map(item => [
    item.taxonomyElement.label || item.name,
    item.value,
    item.unitRef || '',
    item.contextRef,
    item.taxonomyElement.namespace + ':' + item.taxonomyElement.name
  ]);

  const csvContent = [
    header.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${fileName}.csv`);
};

/**
 * Excelとしてエクスポート
 */
const exportAsExcel = (
  data: FinancialData,
  includeComments: boolean,
  includeTaxonomyInfo: boolean,
  statementTypes: StatementType[],
  fileName: string
): void => {
  const wb = XLSX.utils.book_new();

  const financialSheet = [
    ['項目名', '値', '単位', '期間', 'タクソノミ要素']
  ];

  data.financialItems.forEach(item => {
    financialSheet.push([
      item.taxonomyElement.label || item.name,
      String(item.value),
      item.unitRef || '',
      item.contextRef,
      item.taxonomyElement.namespace + ':' + item.taxonomyElement.name
    ]);
  });

  const wsFinancial = XLSX.utils.aoa_to_sheet(financialSheet);
  XLSX.utils.book_append_sheet(wb, wsFinancial, '財務データ');

  if (includeComments && data.comments && data.comments.length > 0) {
    const commentsSheet = [
      ['タイトル', '内容', '関連項目']
    ];

    data.comments.forEach(comment => {
      commentsSheet.push([
        comment.title,
        comment.content,
        comment.relatedItems.join(', ')
      ]);
    });

    const wsComments = XLSX.utils.aoa_to_sheet(commentsSheet);
    XLSX.utils.book_append_sheet(wb, wsComments, '注記情報');
  }

  if (includeTaxonomyInfo && data.taxonomyReferences.length > 0) {
    const taxonomySheet = [
      ['タイプ', 'リファレンス', '役割']
    ];

    data.taxonomyReferences.forEach(ref => {
      taxonomySheet.push([
        ref.type,
        ref.href,
        ref.role || ''
      ]);
    });

    const wsTaxonomy = XLSX.utils.aoa_to_sheet(taxonomySheet);
    XLSX.utils.book_append_sheet(wb, wsTaxonomy, 'タクソノミ情報');
  }

  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
