import React, { useState, useEffect } from 'react';
import { XBRLData, StatementType, FinancialRatio, RatioCategory, ChartData } from '../types/xbrl';
import { calculateFinancialRatios } from '../utils/ratioCalculator';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

// Chart.jsの必要なコンポーネントを登録
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

interface FinancialDashboardProps {
  xbrlData: XBRLData;
}

/**
 * 財務データをダッシュボード形式で表示するコンポーネント
 * 主要な財務指標と財務データのグラフ表示を行います
 */
const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ xbrlData }) => {
  // 財務指標データ
  const [ratios, setRatios] = useState<FinancialRatio[]>([]);
  // 選択されているカテゴリ
  const [selectedCategory, setSelectedCategory] = useState<RatioCategory | 'all'>('all');
  // 資産負債構成のチャートデータ
  const [assetLiabilityChartData, setAssetLiabilityChartData] = useState<ChartData | null>(null);
  // 収益構成のチャートデータ
  const [revenueChartData, setRevenueChartData] = useState<ChartData | null>(null);

  // 財務データから指標を計算
  useEffect(() => {
    if (xbrlData) {
      const calculatedRatios = calculateFinancialRatios(xbrlData);
      setRatios(calculatedRatios);
      
      // 資産負債構成のチャートデータを準備
      prepareAssetLiabilityChartData();
      // 収益構成のチャートデータを準備
      prepareRevenueChartData();
    }
  }, [xbrlData]);

  // 表示する財務指標のフィルタリング
  const filteredRatios = selectedCategory === 'all' 
    ? ratios 
    : ratios.filter(ratio => ratio.category === selectedCategory);

  // 資産負債構成のチャートデータを準備する関数
  const prepareAssetLiabilityChartData = () => {
    // 貸借対照表データを取得
    const balanceSheet = xbrlData.statements[StatementType.BalanceSheet];
    if (!balanceSheet || balanceSheet.items.length === 0) {
      return;
    }

    // 資産・負債・資本の主要項目を検索
    // キーワードで検索して集計します（XBRLタグはタクソノミによって異なる場合があるため）
    const findItemValue = (keywords: string[]): number => {
      for (const item of balanceSheet.items) {
        const name = (item.nameJa || item.name).toLowerCase();
        if (keywords.some(keyword => name.includes(keyword)) && item.values.length > 0) {
          const value = typeof item.values[0].value === 'string' 
            ? parseFloat(item.values[0].value.replace(/,/g, '')) 
            : item.values[0].value;
          if (!isNaN(value)) {
            return value;
          }
        }
      }
      return 0;
    };

    // 主要項目の値を取得
    const currentAssets = findItemValue(['流動資産', 'current assets']);
    const nonCurrentAssets = findItemValue(['固定資産', '投資その他の資産', 'non-current assets', 'property']);
    const currentLiabilities = findItemValue(['流動負債', 'current liabilities']);
    const nonCurrentLiabilities = findItemValue(['固定負債', '非流動負債', 'non-current liabilities']);
    const equity = findItemValue(['純資産', '株主資本', 'equity', 'net assets']);

    // チャートデータを設定
    setAssetLiabilityChartData({
      labels: ['流動資産', '固定資産', '流動負債', '固定負債', '純資産'],
      datasets: [
        {
          label: '資産・負債・資本',
          data: [currentAssets, nonCurrentAssets, currentLiabilities, nonCurrentLiabilities, equity],
          backgroundColor: [
            'rgba(54, 162, 235, 0.6)', // 流動資産
            'rgba(75, 192, 192, 0.6)', // 固定資産
            'rgba(255, 99, 132, 0.6)', // 流動負債
            'rgba(255, 159, 64, 0.6)', // 固定負債
            'rgba(153, 102, 255, 0.6)', // 純資産
          ] as unknown as string, // 型エラー回避のための型アサーション
          borderWidth: 1,
        },
      ],
    });
  };

  // 収益構成のチャートデータを準備する関数
  const prepareRevenueChartData = () => {
    // 損益計算書データを取得
    const incomeStatement = xbrlData.statements[StatementType.IncomeStatement];
    if (!incomeStatement || incomeStatement.items.length === 0) {
      return;
    }

    // 収益・費用の主要項目を検索
    const findItemValue = (keywords: string[]): number => {
      for (const item of incomeStatement.items) {
        const name = (item.nameJa || item.name).toLowerCase();
        if (keywords.some(keyword => name.includes(keyword)) && item.values.length > 0) {
          const value = typeof item.values[0].value === 'string' 
            ? parseFloat(item.values[0].value.replace(/,/g, '')) 
            : item.values[0].value;
          if (!isNaN(value)) {
            return value;
          }
        }
      }
      return 0;
    };

    // 主要項目の値を取得
    const revenue = findItemValue(['売上高', '営業収益', 'revenue', 'sales']);
    const costOfSales = findItemValue(['売上原価', '営業費用', 'cost of sales', 'cost of revenue']);
    const sellingGeneral = findItemValue(['販売費', '一般管理費', 'selling', 'general', 'administrative']);
    const operatingIncome = findItemValue(['営業利益', 'operating income', 'operating profit']);
    const netIncome = findItemValue(['当期純利益', '当期利益', 'net income', 'profit']);

    // チャートデータを設定
    setRevenueChartData({
      labels: ['売上高', '売上原価', '販管費', '営業利益', '当期純利益'],
      datasets: [
        {
          label: '金額',
          data: [revenue, costOfSales, sellingGeneral, operatingIncome, netIncome],
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    });
  };

  return (
    <div>
      {/* 財務指標のセクション */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold mb-4">財務指標</h3>
        
        {/* カテゴリフィルター */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as RatioCategory | 'all')}
            className="block w-full max-w-md pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="all">すべて</option>
            <option value={RatioCategory.Profitability}>{RatioCategory.Profitability}</option>
            <option value={RatioCategory.Liquidity}>{RatioCategory.Liquidity}</option>
            <option value={RatioCategory.Solvency}>{RatioCategory.Solvency}</option>
            <option value={RatioCategory.Efficiency}>{RatioCategory.Efficiency}</option>
            <option value={RatioCategory.Valuation}>{RatioCategory.Valuation}</option>
          </select>
        </div>
        
        {/* 財務指標のカード表示 */}
        {filteredRatios.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRatios.map((ratio, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h4 className="text-primary-700 font-medium">{ratio.name}</h4>
                <div className="mt-2 text-2xl font-semibold">
                  {ratio.value.toLocaleString(undefined, { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </div>
                <p className="mt-1 text-sm text-gray-500">{ratio.description}</p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {ratio.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">指標を計算できる十分なデータがありません。</p>
        )}
      </div>
      
      {/* チャートセクション */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 資産負債構成のチャート */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">資産・負債・資本の構成</h3>
          {assetLiabilityChartData ? (
            <div className="h-80">
              <Pie 
                data={assetLiabilityChartData} 
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const value = context.raw as number;
                          return `${context.label}: ${value.toLocaleString()} 円`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500">チャートを表示するための十分なデータがありません。</p>
            </div>
          )}
        </div>
        
        {/* 収益構成のチャート */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">収益と費用の内訳</h3>
          {revenueChartData ? (
            <div className="h-80">
              <Bar 
                data={revenueChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const value = context.raw as number;
                          return `${value.toLocaleString()} 円`;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return (value as number).toLocaleString() + ' 円';
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500">チャートを表示するための十分なデータがありません。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;