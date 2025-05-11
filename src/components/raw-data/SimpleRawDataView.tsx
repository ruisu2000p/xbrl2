import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDisplayMode } from '../../contexts/DisplayModeContext';
import TableCellComponent from '../html/TableCellComponent';
import DisplayModeToggle from '../common/DisplayModeToggle';
import { FinancialStatement, FinancialItem, FinancialValue, InlineXBRLElement } from '../../types/xbrl';

interface SimpleRawDataViewProps {
  statements: Record<string, FinancialStatement>;
  isDarkMode: boolean;
  inlineXbrlElements?: InlineXBRLElement[];
}

const SimpleRawDataView: React.FC<SimpleRawDataViewProps> = ({ statements, isDarkMode, inlineXbrlElements }) => {
  const { isHtmlMode } = useDisplayMode();
  const [showInlineXbrl, setShowInlineXbrl] = useState(false);
  const statementLabels: Record<string, string> = {
    'BalanceSheet': '貸借対照表',
    'IncomeStatement': '損益計算書',
    'CashFlow': 'キャッシュフロー計算書'
  };

  const formatNumber = (num: number | null | string) => {
    if (num === null || num === undefined || isNaN(Number(num))) return '-';
    return new Intl.NumberFormat('ja-JP').format(Number(num));
  };

  return (
    <div className={`${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'} rounded-lg shadow-md transition-colors duration-300`}>
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          生データ
        </h2>
        <div className="flex items-center space-x-4">
          {inlineXbrlElements && inlineXbrlElements.length > 0 && (
            <button
              onClick={() => setShowInlineXbrl(!showInlineXbrl)}
              className={`px-3 py-1 rounded text-sm ${
                isDarkMode
                  ? showInlineXbrl ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'
                  : showInlineXbrl ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {showInlineXbrl ? 'インラインXBRL表示中' : 'インラインXBRL表示'}
            </button>
          )}
          <DisplayModeToggle />
        </div>
      </div>
      
      <div className="p-4">
        <div className="overflow-x-auto">
          {showInlineXbrl && inlineXbrlElements && inlineXbrlElements.length > 0 ? (
            <table className={`min-w-full border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <tr>
                  <th className={`px-4 py-2 text-left border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>タグ名</th>
                  <th className={`px-4 py-2 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>値</th>
                  <th className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>単位</th>
                  <th className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>コンテキスト</th>
                  <th className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>小数点</th>
                  <th className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>フォーマット</th>
                </tr>
              </thead>
              <tbody>
                {inlineXbrlElements.map((element, idx) => (
                  <tr 
                    key={idx} 
                    className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                  >
                    <td className={`px-4 py-2 border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <span className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        {element.tag}
                      </span>
                      <div>{element.name}</div>
                    </td>
                    <td className={`px-4 py-2 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <TableCellComponent 
                        content={isHtmlMode ? element.originalHtml : formatNumber(element.value)} 
                        isHtml={isHtmlMode}
                        className="text-right"
                      />
                    </td>
                    <td className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      {element.unitRef || '-'}
                    </td>
                    <td className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      {element.contextRef || '-'}
                    </td>
                    <td className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      {element.decimals || '-'}
                    </td>
                    <td className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      {element.format || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className={`min-w-full border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <tr>
                  <th className={`px-4 py-2 text-left border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>項目名</th>
                  <th className={`px-4 py-2 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>値</th>
                  <th className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>単位</th>
                  <th className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>期間</th>
                  <th className={`px-4 py-2 text-left border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>タクソノミ要素</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statements).map(([statementType, statement]) => (
                  <React.Fragment key={statementType}>
                    <tr className={`${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                      <td colSpan={5} className={`px-4 py-2 font-semibold border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        {statementLabels[statementType] || statementType}
                      </td>
                    </tr>
                    {statement.items.map((item: FinancialItem, idx: number) => (
                      item.values.map((value: FinancialValue, valueIdx: number) => (
                        <tr 
                          key={`${idx}-${valueIdx}`} 
                          className={`${
                            isDarkMode 
                              ? 'hover:bg-gray-700' 
                              : 'hover:bg-gray-50'
                          } ${
                            item.isTotal 
                              ? isDarkMode 
                                ? 'bg-gray-600 font-semibold' 
                                : 'bg-gray-200 font-semibold'
                              : ''
                          }`}
                        >
                          <td className={`px-4 py-2 border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <TableCellComponent 
                              content={item.nameJa || item.name} 
                              isHtml={isHtmlMode}
                              className={item.isTotal ? 'font-semibold' : ''}
                            />
                          </td>
                          <td className={`px-4 py-2 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <TableCellComponent 
                              content={isHtmlMode ? value.value : formatNumber(value.value)} 
                              isHtml={isHtmlMode}
                              className="text-right"
                            />
                          </td>
                          <td className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            {value.unit || '-'}
                          </td>
                          <td className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            {value.period || '-'}
                          </td>
                          <td className={`px-4 py-2 text-left border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <span className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              {item.name}
                            </span>
                          </td>
                        </tr>
                      ))
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleRawDataView;
