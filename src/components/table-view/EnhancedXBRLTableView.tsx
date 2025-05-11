import React, { useState } from 'react';
import { ProcessedXBRLData, HierarchicalXBRLItem } from '../../types/extractors/improved-xbrl-types';
import '../extractors/xbrl/style-fixes.css';

interface EnhancedXBRLTableViewProps {
  data: ProcessedXBRLData | null;
  isDarkMode?: boolean;
  language?: 'ja' | 'en';
}

/**
 * 拡張版XBRLテーブル表示コンポーネント
 * 階層構造のXBRLデータを視覚的にわかりやすく表示します
 * コンテキスト情報と単位情報をサポート
 */
const EnhancedXBRLTableView: React.FC<EnhancedXBRLTableViewProps> = ({ data, isDarkMode = false, language = 'ja' }) => {
  const [showAllLevels, setShowAllLevels] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [showXBRLTags, setShowXBRLTags] = useState(false);
  const [showContextInfo, setShowContextInfo] = useState(false);
  const [showCalculations, setShowCalculations] = useState(true);
  
  const labels = {
    item: language === 'ja' ? '項目' : 'Item',
    currentPeriod: language === 'ja' ? '当期' : 'Current Period',
    previousPeriod: language === 'ja' ? '前期' : 'Previous Period',
    change: language === 'ja' ? '増減' : 'Change',
    changeRate: language === 'ja' ? '増減率' : 'Change Rate',
    noData: language === 'ja' ? 'データがありません' : 'No data available',
    unit: language === 'ja' ? '単位' : 'Unit',
    period: language === 'ja' ? '期間' : 'Period',
    expand: language === 'ja' ? 'すべて展開' : 'Expand All',
    collapse: language === 'ja' ? 'すべて折りたたむ' : 'Collapse All',
    showAllLevels: language === 'ja' ? '全階層表示' : 'Show All Levels',
    showXBRLTags: language === 'ja' ? 'XBRLタグ表示' : 'Show XBRL Tags',
    showContextInfo: language === 'ja' ? 'コンテキスト表示' : 'Show Context Info',
    showCalculations: language === 'ja' ? '計算項目表示' : 'Show Calculations',
    reportType: language === 'ja' ? 'レポートタイプ' : 'Report Type',
    dataItemCount: language === 'ja' ? 'データ項目数' : 'Data Item Count',
    errors: language === 'ja' ? 'エラー' : 'Errors',
    warnings: language === 'ja' ? '警告' : 'Warnings',
    annotations: language === 'ja' ? '注釈情報' : 'Annotations',
    financialStatement: language === 'ja' ? '財務諸表' : 'Financial Statement',
    unknown: language === 'ja' ? '不明' : 'Unknown'
  };
  
  // データがない場合は何も表示しない
  if (!data || !data.hierarchical) {
    return (
      <div className={`p-6 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        {labels.noData}
      </div>
    );
  }
  
  // 通貨単位を整形
  const unitDisplay = (data.hierarchical.metadata.unit || (language === 'ja' ? '円' : 'JPY'))
    .replace('iso4217:JPY', language === 'ja' ? '円' : 'JPY')
    .replace('JPY', language === 'ja' ? '円' : 'JPY')
    .replace('JPY_UNIT', language === 'ja' ? '円' : 'JPY')
    .replace('yen', language === 'ja' ? '円' : 'JPY');
  
  // 期間表示を整形
  const previousPeriod = data.hierarchical.metadata.periods.previous || labels.previousPeriod;
  const currentPeriod = data.hierarchical.metadata.periods.current || labels.currentPeriod;
  
  // アイテムを開閉するトグル関数
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // すべての項目を展開/折りたたむ
  const toggleAllItems = (expand: boolean) => {
    const items = data.hierarchical.data || [];
    const allIds: Record<string, boolean> = {};
    
    // 再帰的に全アイテムのIDを収集
    const collectIds = (items: HierarchicalXBRLItem[], path: string = '') => {
      items.forEach((item, idx) => {
        const itemId = `${path}-${idx}`;
        allIds[itemId] = expand;
        
        if (item.children && item.children.length > 0) {
          collectIds(item.children, itemId);
        }
      });
    };
    
    collectIds(items);
    setExpandedItems(allIds);
  };
  
  // レベルに応じたインデント表示用のクラスを取得
  const getIndentClass = (level: number) => {
    const baseIndent = 'pl-';
    const indentSize = Math.min(level * 6, 24); // 最大24pxまで
    return `${baseIndent}${indentSize}`;
  };

  // 上位レベルの項目名（親）に対する書式設定
  const getParentStyle = (item: HierarchicalXBRLItem) => {
    const { level, isTotal, isCalculated } = item;
    
    if (level === 0) {
      return isDarkMode 
        ? 'font-bold text-white bg-gray-700' 
        : 'font-bold text-gray-900 bg-gray-100';
    } else if (isTotal) {
      return isDarkMode 
        ? 'font-semibold text-yellow-300' 
        : 'font-semibold text-gray-900';
    } else if (isCalculated) {
      return isDarkMode 
        ? 'font-semibold text-blue-300' 
        : 'font-semibold text-blue-800';
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
    items: HierarchicalXBRLItem[],
    path: string = ''
  ) => {
    return items.map((item, idx) => {
      const itemId = `${path}-${idx}`;
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedItems[itemId] !== false; // デフォルトで開く
      
      // レベルに応じたフィルタリング
      if (!showAllLevels && item.level > 1 && !item.isTotal) return null;
      
      // 計算項目のフィルタリング
      if (!showCalculations && item.isCalculated) return null;
      
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
                  <span className={`${getParentStyle(item)}`}>
                    {item.itemName}
                  </span>
                </div>
              </div>
              
              {/* XBRLタグがあり、表示設定がオンの場合に表示 */}
              {showXBRLTags && item.xbrlTag && (
                <div className={`text-xs mt-1 ${getIndentClass(item.level)} ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {item.xbrlTag}
                </div>
              )}
              
              {/* コンテキスト情報の表示 */}
              {showContextInfo && item.contextRef && (
                <div className={`text-xs mt-1 ${getIndentClass(item.level)} ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                  Context: {item.contextRef}
                </div>
              )}
            </td>
            
            {/* 前期の値 */}
            <td className={`px-4 py-2 text-right whitespace-nowrap border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${item.isTotal ? (isDarkMode ? 'font-semibold text-yellow-300' : 'font-semibold') : ''}`}>
              {formatNumber(item.previousPeriod)}
              {item.unitLabel && item.unitLabel !== unitDisplay && (
                <span className="ml-1 text-xs text-gray-500">{item.unitLabel}</span>
              )}
            </td>
            
            {/* 当期の値 */}
            <td className={`px-4 py-2 text-right whitespace-nowrap border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${item.isTotal ? (isDarkMode ? 'font-semibold text-yellow-300' : 'font-semibold') : ''}`}>
              {formatNumber(item.currentPeriod)}
              {item.unitLabel && item.unitLabel !== unitDisplay && (
                <span className="ml-1 text-xs text-gray-500">{item.unitLabel}</span>
              )}
            </td>
            
            {/* 増減 */}
            <td className={`px-4 py-2 text-right whitespace-nowrap border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${getChangeColor(item.change || null)}`}>
              {item.change !== undefined && item.change !== null ? formatNumber(item.change) : '-'}
              {item.unitLabel && item.unitLabel !== unitDisplay && item.change !== undefined && item.change !== null && (
                <span className="ml-1 text-xs text-gray-500">{item.unitLabel}</span>
              )}
            </td>
            
            {/* 増減率 */}
            <td className={`px-4 py-2 text-right whitespace-nowrap border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${getChangeColor(item.change || null)}`}>
              {item.changeRate !== undefined && item.changeRate !== null
                ? `${item.changeRate.toFixed(1)}%`
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
              {data.hierarchical.metadata.reportType || labels.financialStatement}
            </h2>
            <div className={`mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <span className="font-medium">{labels.unit}:</span> {unitDisplay} / 
              <span className="ml-2 font-medium">{labels.period}:</span> {previousPeriod} → {currentPeriod}
              {data.hierarchical.metadata.entityName && (
                <>
                  <span className="ml-2 font-medium">{language === 'ja' ? '企業' : 'Company'}:</span> {data.hierarchical.metadata.entityName}
                </>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-3 py-1 text-sm rounded ${isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
              onClick={() => toggleAllItems(true)}
            >
              {labels.expand}
            </button>
            <button
              className={`px-3 py-1 text-sm rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-300 hover:bg-gray-400'} ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
              onClick={() => toggleAllItems(false)}
            >
              {labels.collapse}
            </button>
          </div>
        </div>
        
        {/* 表示オプション */}
        <div className="mt-3 flex flex-wrap gap-4 options-container">
          <label className={`inline-flex items-center option-label ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <input
              type="checkbox"
              className={`form-checkbox h-4 w-4 ${isDarkMode ? 'text-blue-500' : 'text-blue-600'} checkbox-input`}
              checked={showAllLevels}
              onChange={(e) => setShowAllLevels(e.target.checked)}
            />
            <span className="ml-2 text-sm option-text">{labels.showAllLevels}</span>
          </label>
          
          <label className={`inline-flex items-center option-label ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <input
              type="checkbox"
              className={`form-checkbox h-4 w-4 ${isDarkMode ? 'text-blue-500' : 'text-blue-600'} checkbox-input`}
              checked={showXBRLTags}
              onChange={(e) => setShowXBRLTags(e.target.checked)}
            />
            <span className="ml-2 text-sm option-text">{labels.showXBRLTags}</span>
          </label>
          
          <label className={`inline-flex items-center option-label ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <input
              type="checkbox"
              className={`form-checkbox h-4 w-4 ${isDarkMode ? 'text-blue-500' : 'text-blue-600'} checkbox-input`}
              checked={showContextInfo}
              onChange={(e) => setShowContextInfo(e.target.checked)}
            />
            <span className="ml-2 text-sm option-text">{labels.showContextInfo}</span>
          </label>
          
          <label className={`inline-flex items-center option-label ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <input
              type="checkbox"
              className={`form-checkbox h-4 w-4 ${isDarkMode ? 'text-blue-500' : 'text-blue-600'} checkbox-input`}
              checked={showCalculations}
              onChange={(e) => setShowCalculations(e.target.checked)}
            />
            <span className="ml-2 text-sm option-text">{labels.showCalculations}</span>
          </label>
        </div>
        
        {/* 注釈情報があれば表示 */}
        {data.hierarchical.annotations && Object.keys(data.hierarchical.annotations).length > 0 && (
          <div className={`mt-3 p-3 rounded text-sm ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
            <span className="font-medium">{labels.annotations}:</span>
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
              <th className={`px-4 py-3 text-left border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{labels.item}</th>
              <th className={`px-4 py-3 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{previousPeriod}</th>
              <th className={`px-4 py-3 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{currentPeriod}</th>
              <th className={`px-4 py-3 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{labels.change}</th>
              <th className={`px-4 py-3 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{labels.changeRate}</th>
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
            <span className="font-medium">{labels.reportType}:</span> {data.hierarchical.metadata.reportType || labels.unknown}
          </div>
          <div>
            <span className="font-medium">{labels.dataItemCount}:</span> {countTotalItems(data.hierarchical.data || [])}
          </div>
        </div>
        
        {/* エラーがあれば表示 */}
        {data.errors && data.errors.length > 0 && (
          <div className={`mt-2 p-2 rounded text-sm ${isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-50 text-red-700'}`}>
            <span className="font-medium">{labels.errors}:</span>
            <ul className="mt-1 list-disc list-inside">
              {data.errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 警告があれば表示 */}
        {data.warnings && data.warnings.length > 0 && (
          <div className={`mt-2 p-2 rounded text-sm ${isDarkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-50 text-yellow-700'}`}>
            <span className="font-medium">{labels.warnings}:</span>
            <ul className="mt-1 list-disc list-inside">
              {data.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// 総項目数を計算（子アイテムも含む）
const countTotalItems = (items: HierarchicalXBRLItem[]): number => {
  let count = items.length;
  
  items.forEach(item => {
    if (item.children && item.children.length > 0) {
      count += countTotalItems(item.children);
    }
  });
  
  return count;
};

export default EnhancedXBRLTableView;
