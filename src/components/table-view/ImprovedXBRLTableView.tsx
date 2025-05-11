import React, { useState } from 'react';
import { ProcessedXBRLData } from '../../types/extractors/xbrl';

interface ImprovedXBRLTableViewProps {
  data: ProcessedXBRLData | null;
  isDarkMode?: boolean;
}

/**
 * 改善されたXBRLテーブル表示コンポーネント
 * 階層構造のXBRLデータを視覚的にわかりやすく表示します
 */
const ImprovedXBRLTableView: React.FC<ImprovedXBRLTableViewProps> = ({ data, isDarkMode = false }) => {
  const [showAllLevels, setShowAllLevels] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  // データがない場合は何も表示しない
  if (!data || !data.hierarchical) {
    return (
      <div className={`p-6 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        表示可能なデータがありません。
      </div>
    );
  }
  
  // 通貨単位を整形
  const unitDisplay = (data.hierarchical.metadata.unit || '円')
    .replace('JPY', '円')
    .replace('JPY_UNIT', '円')
    .replace('yen', '円');
  
  // 期間表示を整形
  const previousPeriod = data.hierarchical.metadata.periods.previous || '前期';
  const currentPeriod = data.hierarchical.metadata.periods.current || '当期';
  
  // アイテムを開閉するトグル関数
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // レベルに応じたインデント表示用のクラスを取得
  const getIndentClass = (level: number) => {
    const baseIndent = 'pl-';
    const indentSize = Math.min(level * 6, 24); // 最大24pxまで
    return `${baseIndent}${indentSize}`;
  };

  // 上位レベルの項目名（親）に対する書式設定
  const getParentStyle = (level: number, isTotal: boolean) => {
    if (level === 0) {
      return isDarkMode 
        ? 'font-bold text-white bg-gray-700' 
        : 'font-bold text-gray-900 bg-gray-100';
    } else if (isTotal) {
      return isDarkMode 
        ? 'font-semibold text-yellow-300' 
        : 'font-semibold text-gray-900';
    }
    return isDarkMode 
      ? 'font-medium text-gray-200' 
      : 'font-medium text-gray-800';
  };
  
  // 数値表示用のフォーマット
  const formatNumber = (num: number | null) => {
    if (num === null || isNaN(Number(num))) return '-';
    return new Intl.NumberFormat('ja-JP').format(num);
  };
  
  // 値の変化に応じた色を取得
  const getChangeColor = (value: number | null) => {
    if (value === null) return '';
    if (value > 0) return isDarkMode ? 'text-green-400' : 'text-green-600';
    if (value < 0) return isDarkMode ? 'text-red-400' : 'text-red-600';
    return '';
  };
  
  // 階層構造の再帰的表示
  const renderHierarchicalRows = (
    items: Array<{
      itemName: string;
      xbrlTag?: string;
      previousPeriod: number | null;
      currentPeriod: number | null;
      level: number;
      children?: Array<any>;
    }>,
    path: string = ''
  ) => {
    return items.map((item, idx) => {
      const itemId = `${path}-${idx}`;
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedItems[itemId] !== false; // デフォルトで開く
      const isTotal = item.itemName.includes('合計') || 
                      item.itemName.includes('総額') || 
                      item.itemName.includes('純資産');
      
      // レベルに応じたフィルタリング
      if (!showAllLevels && item.level > 1 && !isTotal) return null;
      
      return (
        <React.Fragment key={itemId}>
          <tr className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors duration-150`}>
            {/* 項目名 */}
            <td className={`px-4 py-2 border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center">
                {/* 階層表示のためのインデント */}
                <div className={getIndentClass(item.level)}>
                  {/* 展開/折りたたみボタン */}
                  {hasChildren && (
                    <button
                      className={`mr-2 p-1 rounded-sm ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors`}
                      onClick={() => toggleExpand(itemId)}
                      aria-label={isExpanded ? '折りたたむ' : '展開する'}
                    >
                      <svg
                        className={`w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  )}
                  
                  {/* 項目名の表示 */}
                  <span className={`${getParentStyle(item.level, isTotal)}`}>
                    {item.itemName}
                  </span>
                </div>
              </div>
              
              {/* XBRLタグがあれば小さく表示 */}
              {item.xbrlTag && (
                <div className={`text-xs mt-1 ${getIndentClass(item.level)} ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {item.xbrlTag}
                </div>
              )}
            </td>
            
            {/* 前期の値 */}
            <td className={`px-4 py-2 text-right whitespace-nowrap border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${isTotal ? (isDarkMode ? 'font-semibold text-yellow-300' : 'font-semibold') : ''}`}>
              {formatNumber(item.previousPeriod)}
            </td>
            
            {/* 当期の値 */}
            <td className={`px-4 py-2 text-right whitespace-nowrap border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${isTotal ? (isDarkMode ? 'font-semibold text-yellow-300' : 'font-semibold') : ''}`}>
              {formatNumber(item.currentPeriod)}
            </td>
            
            {/* 増減 */}
            <td className={`px-4 py-2 text-right whitespace-nowrap border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${getChangeColor(
              item.previousPeriod !== null && item.currentPeriod !== null 
                ? item.currentPeriod - item.previousPeriod 
                : null
            )}`}>
              {item.previousPeriod !== null && item.currentPeriod !== null 
                ? formatNumber(item.currentPeriod - item.previousPeriod) 
                : '-'}
            </td>
            
            {/* 増減率 */}
            <td className={`px-4 py-2 text-right whitespace-nowrap border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${getChangeColor(
              item.previousPeriod !== null && item.currentPeriod !== null && item.previousPeriod !== 0
                ? item.currentPeriod - item.previousPeriod
                : null
            )}`}>
              {item.previousPeriod !== null && item.currentPeriod !== null && item.previousPeriod !== 0
                ? `${((item.currentPeriod - item.previousPeriod) / Math.abs(item.previousPeriod) * 100).toFixed(1)}%`
                : '-'}
            </td>
          </tr>
          
          {/* 子要素を再帰的に表示 */}
          {hasChildren && isExpanded && renderHierarchicalRows(item.children!, `${itemId}`)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className={`${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'} rounded-lg overflow-hidden shadow-lg transition-colors duration-200`}>
      {/* ヘッダー情報 */}
      <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-gray-50'} transition-colors duration-200`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              {data.hierarchical.metadata.reportType || '財務諸表'}
            </h2>
            <div className={`mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <span className="font-medium">単位:</span> {unitDisplay} / 
              <span className="ml-2 font-medium">期間:</span> {previousPeriod} → {currentPeriod}
            </div>
          </div>
          
          <div className="flex items-center">
            <label className={`inline-flex items-center ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <input
                type="checkbox"
                className={`form-checkbox h-5 w-5 ${isDarkMode ? 'text-blue-500' : 'text-blue-600'}`}
                checked={showAllLevels}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowAllLevels(e.target.checked)}
              />
              <span className="ml-2">全ての階層を表示</span>
            </label>
          </div>
        </div>
        
        {/* 注釈情報があれば表示 */}
        {data.hierarchical.annotations && Object.keys(data.hierarchical.annotations).length > 0 && (
          <div className={`mt-3 p-3 rounded text-sm ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
            <span className="font-medium">注釈情報:</span>
            <ul className="mt-1 list-disc list-inside">
              {Object.entries(data.hierarchical.annotations).map(([key, value], idx) => (
                <li key={idx}>{key}: {value}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* データテーブル */}
      <div className="overflow-x-auto">
        <table className={`w-full ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} transition-colors duration-200`}>
          <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors duration-200`}>
            <tr>
              <th className={`px-4 py-3 text-left border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>項目</th>
              <th className={`px-4 py-3 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{previousPeriod}</th>
              <th className={`px-4 py-3 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{currentPeriod}</th>
              <th className={`px-4 py-3 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>増減</th>
              <th className={`px-4 py-3 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>増減率</th>
            </tr>
          </thead>
          <tbody>
            {data.hierarchical.data && renderHierarchicalRows(data.hierarchical.data)}
          </tbody>
        </table>
      </div>
      
      {/* フッター */}
      <div className={`p-4 ${isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'} border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} text-sm transition-colors duration-200`}>
        <div className="flex flex-col sm:flex-row justify-between gap-2">
          <div>
            <span className="font-medium">レポートタイプ:</span> {data.hierarchical.metadata.reportType || '不明'}
          </div>
          <div>
            <span className="font-medium">データ項目数:</span> {data.hierarchical.data ? data.hierarchical.data.length : 0}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImprovedXBRLTableView;
