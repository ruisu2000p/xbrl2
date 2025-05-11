import React, { useState } from 'react';
import { XBRLData, StatementType, FinancialItem } from '../types/xbrl';

interface XBRLViewerProps {
  xbrlData: XBRLData;
}

/**
 * XBRLデータを表示するためのビューアーコンポーネント
 * 財務諸表の種類を選択して表示することができます
 */
const XBRLViewer: React.FC<XBRLViewerProps> = ({ xbrlData }) => {
  // 現在選択されている財務諸表の種類
  const [selectedStatement, setSelectedStatement] = useState<StatementType>(StatementType.BalanceSheet);
  // 現在表示しているページ番号（ページネーション用）
  const [currentPage, setCurrentPage] = useState(1);
  // 1ページあたりの表示件数
  const itemsPerPage = 15;

  // 財務諸表の種類を切り替える関数
  const handleStatementChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatement(event.target.value as StatementType);
    setCurrentPage(1); // 財務諸表を切り替えたらページをリセット
  };

  // 現在選択されている財務諸表のデータを取得
  const currentStatement = xbrlData.statements[selectedStatement];
  
  // 財務諸表のデータが存在しない場合
  if (!currentStatement || currentStatement.items.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 p-4 rounded">
        <p>この種類の財務諸表データは見つかりませんでした。</p>
      </div>
    );
  }

  // 全アイテム数
  const totalItems = currentStatement.items.length;
  // 総ページ数の計算
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  // 現在のページに表示するアイテムを取得
  const currentItems = currentStatement.items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 人間が読みやすい財務諸表の名称を取得する関数
  const getStatementName = (type: StatementType): string => {
    switch (type) {
      case StatementType.BalanceSheet:
        return '貸借対照表';
      case StatementType.IncomeStatement:
        return '損益計算書';
      case StatementType.CashFlow:
        return 'キャッシュフロー計算書';
      default:
        return 'その他';
    }
  };

  // ページを変更する関数
  const changePage = (page: number) => {
    setCurrentPage(page);
  };

  // コンテキスト参照から期間情報を抽出する関数
  const getPeriodInfo = (item: FinancialItem): string => {
    if (item.values.length === 0 || !item.values[0].contextRef) {
      return '期間情報なし';
    }
    
    const contextRef = item.values[0].contextRef;
    const context = xbrlData.contexts[contextRef];
    
    if (!context) {
      return '不明な期間';
    }
    
    if (context.instant) {
      return `時点: ${context.instant}`;
    }
    
    if (context.startDate && context.endDate) {
      return `期間: ${context.startDate} ～ ${context.endDate}`;
    }
    
    return '期間情報なし';
  };

  return (
    <div>
      {/* 財務諸表選択 */}
      <div className="mb-6">
        <label htmlFor="statement-select" className="block text-sm font-medium text-gray-700 mb-1">
          表示する財務諸表:
        </label>
        <select
          id="statement-select"
          value={selectedStatement}
          onChange={handleStatementChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
        >
          <option value={StatementType.BalanceSheet}>貸借対照表</option>
          <option value={StatementType.IncomeStatement}>損益計算書</option>
          <option value={StatementType.CashFlow}>キャッシュフロー計算書</option>
          <option value={StatementType.Other}>その他</option>
        </select>
      </div>

      {/* 財務諸表データのテーブル表示 */}
      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                項目ID
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                項目名
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                値
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                単位
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                期間
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentItems.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.nameJa || item.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.values.length > 0 ? item.values[0].value : '値なし'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.values.length > 0 && item.values[0].unit ? 
                    (xbrlData.units[item.values[0].unit!]?.measure || item.values[0].unit) : 
                    '単位なし'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {getPeriodInfo(item)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => changePage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 
                ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            >
              前へ
            </button>
            <button
              onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 
                ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            >
              次へ
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                <span className="font-medium">{totalItems}</span> 件中 
                <span className="font-medium"> {(currentPage - 1) * itemsPerPage + 1} </span>
                - 
                <span className="font-medium"> {Math.min(currentPage * itemsPerPage, totalItems)} </span> 件を表示
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => changePage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 
                    ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                >
                  <span className="sr-only">前へ</span>
                  ←
                </button>
                
                {/* ページ番号ボタン */}
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => changePage(i + 1)}
                    className={`relative inline-flex items-center border ${
                      currentPage === i + 1
                        ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                        : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                    } px-4 py-2 text-sm font-medium`}
                  >
                    {i + 1}
                  </button>
                ))}
                
                <button
                  onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 
                    ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                >
                  <span className="sr-only">次へ</span>
                  →
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default XBRLViewer;