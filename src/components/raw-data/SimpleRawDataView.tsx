import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import TableCellComponent from '../html/TableCellComponent';
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

  return (
    <table className={`min-w-full ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
      <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
        <tr>
          <th className="px-4 py-2 text-left">項目名</th>
          <th className="px-4 py-2 text-left">値</th>
          <th className="px-4 py-2 text-left">単位</th>
          <th className="px-4 py-2 text-left">期間</th>
          <th className="px-4 py-2 text-left">タクソノミ要素</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(statements).map(([statementType, statement]) => (
          <React.Fragment key={statementType}>
            <tr className={`${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
              <td colSpan={5} className="px-4 py-2 font-semibold">
                {statementLabels[statementType] || statementType}
              </td>
            </tr>
            {statement.items.map((item: FinancialItem, idx: number) => (
              item.values.map((value: FinancialValue, valueIdx: number) => (
                <tr key={`${idx}-${valueIdx}`} className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <td className={`px-4 py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <TableCellComponent content={item.nameJa || item.name} isHtml={false} />
                  </td>
                  <td className={`px-4 py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <TableCellComponent content={value.value} isHtml={false} />
                  </td>
                  <td className={`px-4 py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{value.unit || '-'}</td>
                  <td className={`px-4 py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{value.period || '-'}</td>
                  <td className={`px-4 py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>{item.name || '-'}</td>
                </tr>
              ))
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
};

export default SimpleRawDataView;
