import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import TextComponent from '../html/TextComponent';
import TableCellComponent from '../html/TableCellComponent';
import { FinancialStatement, FinancialItem, FinancialValue } from '../../types/xbrl';

interface FormattedRawDataViewProps {
  statements: Record<string, FinancialStatement>;
  isDarkMode: boolean;
}

const FormattedRawDataView: React.FC<FormattedRawDataViewProps> = ({ statements, isDarkMode }) => {
  const statementLabels: Record<string, string> = {
    'BalanceSheet': '貸借対照表',
    'IncomeStatement': '損益計算書',
    'CashFlow': 'キャッシュフロー計算書'
  };

  return (
    <div className="space-y-6">
      {Object.entries(statements).map(([statementType, statement]) => (
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
                          (item as any).isTotal 
                            ? isDarkMode 
                              ? 'bg-gray-600 font-semibold' 
                              : 'bg-gray-200 font-semibold'
                            : ''
                        }`}
                      >
                        <td className={`px-4 py-2 border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <TextComponent 
                            htmlContent={item.nameJa || item.name} 
                            className={(item as any).isTotal ? 'font-semibold' : ''}
                          />
                        </td>
                        <td className={`px-4 py-2 text-right border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <TableCellComponent 
                            content={value.value} 
                            className="text-right"
                          />
                        </td>
                        <td className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          {value.unit || '-'}
                        </td>
                        <td className={`px-4 py-2 text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          {value.period || '-'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FormattedRawDataView;
