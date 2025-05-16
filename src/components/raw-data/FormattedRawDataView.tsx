import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDisplayMode } from '../../contexts/DisplayModeContext';
import TextComponent from '../html/TextComponent';
import TableCellComponent from '../html/TableCellComponent';
import DisplayModeToggle from '../common/DisplayModeToggle';
import { FinancialStatement, FinancialItem, FinancialValue, InlineXBRLElement } from '../../types/xbrl';

interface FormattedRawDataViewProps {
  statements: Record<string, FinancialStatement>;
  isDarkMode: boolean;
  inlineXbrlElements?: InlineXBRLElement[];
}

const FormattedRawDataView: React.FC<FormattedRawDataViewProps> = ({ statements, isDarkMode, inlineXbrlElements }) => {
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
        <div className="flex space-x-2">
          {inlineXbrlElements && inlineXbrlElements.length > 0 && (
            <button
              onClick={() => setShowInlineXbrl(!showInlineXbrl)}
              className={`px-3 py-1 text-sm rounded flex items-center ${
                isDarkMode 
                ? 'bg-blue-700 hover:bg-blue-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-400 text-white'
              }`}
              title={showInlineXbrl ? '財務諸表データを表示' : 'インラインXBRLデータを表示'}
            >
              {showInlineXbrl ? '財務諸表データ' : 'インラインXBRLデータ'}
            </button>
          )}
          <DisplayModeToggle />
        </div>
      </div>
      
      <div className="p-4 space-y-6">
        {showInlineXbrl && inlineXbrlElements && inlineXbrlElements.length > 0 ? (
          <div>
            <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              インラインXBRL要素
            </h3>
            <div className="overflow-x-auto">
              <table className={`min-w-full border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <tr>
                    <th className={`px-4 py-2 text-left border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>タグ名</th>
                    <th className={`px-4 py-2 text-left border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>値</th>
                    <th className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>単位</th>
                    <th className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>コンテキスト参照</th>
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
                      </td>
                      <td className={`px-4 py-2 text-left border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        {typeof element.value === 'number' ? formatNumber(element.value) : element.value}
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
            </div>
          </div>
        ) : (
          Object.entries(statements).map(([statementType, statement]) => (
          <div key={statementType} className="mb-6">
            <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              {statementLabels[statementType] || statementType}
            </h3>
            
            <div className="overflow-x-auto">
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
                  {statement.items.map((item: FinancialItem, idx: number) => (
                    <React.Fragment key={idx}>
                      {item.values.map((value: FinancialValue, valueIdx: number) => (
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
                            <TextComponent 
                              htmlContent={item.nameJa || item.name} 
                              className={item.isTotal ? 'font-semibold' : ''}
                            />
                          </td>
                          <td className={`px-4 py-2 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <TableCellComponent 
                              content={isHtmlMode ? value.value : formatNumber(value.value)} 
                              className="text-right"
                              isHtml={true}
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
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  );
};

export default FormattedRawDataView;
