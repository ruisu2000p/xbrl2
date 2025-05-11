import React from 'react';
import TableCellComponent from '../html/TableCellComponent';
import DisplayModeToggle from '../common/DisplayModeToggle';
import { FinancialStatement, FinancialItem, FinancialValue } from '../../types/xbrl';

interface SimpleRawDataViewProps {
  statements: Record<string, FinancialStatement>;
  isDarkMode: boolean;
}

const SimpleRawDataView: React.FC<SimpleRawDataViewProps> = ({ statements, isDarkMode }) => {
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
        <DisplayModeToggle />
      </div>
      
      <div className="p-4">
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
                        className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} ${
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
                            isHtml={false}
                            className={item.isTotal ? 'font-semibold' : ''}
                          />
                        </td>
                        <td className={`px-4 py-2 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <TableCellComponent 
                            content={formatNumber(value.value)} 
                            isHtml={false}
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
        </div>
      </div>
    </div>
  );
};

export default SimpleRawDataView;
