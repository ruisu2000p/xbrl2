import React, { useState } from 'react';
import { XBRLData, StatementType, FinancialRatio, RatioCategory } from '../types/xbrl';
import { calculateFinancialRatios } from '../utils/ratioCalculator';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Chart.jsの必要なコンポーネントを登録
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface CompanyComparisonProps {
  primaryCompanyData: XBRLData;
  secondaryCompaniesData: XBRLData[];
  secondaryCompanyNames: string[];
}

/**
 * 企業間比較コンポーネント
 * 主要な企業と複数の他企業との財務指標を比較・可視化します
 */
const CompanyComparison: React.FC<CompanyComparisonProps> = ({ 
  primaryCompanyData, 
  secondaryCompaniesData,
  secondaryCompanyNames
}) => {
  // 選択されている財務指標カテゴリ
  const [selectedCategory, setSelectedCategory] = useState<RatioCategory | 'all'>(RatioCategory.Profitability);
  
  // 主要企業の財務指標を計算
  const primaryCompanyRatios = calculateFinancialRatios(primaryCompanyData);
  
  // 比較企業の財務指標を計算
  const secondaryCompaniesRatios = secondaryCompaniesData.map(companyData => 
    calculateFinancialRatios(companyData)
  );
  
  // 表示する財務指標をフィルタリング
  const getFilteredRatios = (ratios: FinancialRatio[]) => {
    return selectedCategory === 'all' 
      ? ratios 
      : ratios.filter(ratio => ratio.category === selectedCategory);
  };
  
  // 主要企業の表示対象指標
  const filteredPrimaryRatios = getFilteredRatios(primaryCompanyRatios);
  
  // 主要企業と比較企業で共通して存在する指標名を取得
  const commonRatioNames = filteredPrimaryRatios
    .map(ratio => ratio.name)
    .filter(name => {
      return secondaryCompaniesRatios.every(companyRatios => {
        return getFilteredRatios(companyRatios).some(ratio => ratio.name === name);
      });
    });
  
  // チャートデータの準備
  const prepareChartData = (ratioName: string) => {
    // 主要企業の値を取得
    const primaryValue = filteredPrimaryRatios.find(r => r.name === ratioName)?.value || 0;
    
    // 比較企業の値を取得
    const secondaryValues = secondaryCompaniesRatios.map(companyRatios => {
      const ratio = getFilteredRatios(companyRatios).find(r => r.name === ratioName);
      return ratio?.value || 0;
    });
    
    // 全企業の値をまとめる
    const values = [primaryValue, ...secondaryValues];
    
    // 企業名を準備
    const labels = [primaryCompanyData.companyInfo.name || '主要企業', ...secondaryCompanyNames];
    
    // チャートの色を準備
    const backgroundColor = [
      'rgba(54, 162, 235, 0.6)', // 主要企業
      ...secondaryCompaniesData.map(() => 'rgba(255, 99, 132, 0.6)') // 比較企業
    ];
    
    return {
      labels,
      datasets: [
        {
          label: ratioName,
          data: values,
          backgroundColor,
          borderWidth: 1,
        },
      ],
    };
  };
  
  // 指標の説明を取得
  const getRatioDescription = (ratioName: string) => {
    const ratio = primaryCompanyRatios.find(r => r.name === ratioName);
    return ratio?.description || '';
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">企業間比較</h3>
      
      {/* カテゴリ選択 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">財務指標カテゴリ:</label>
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

      {commonRatioNames.length > 0 ? (
        <div className="space-y-10">
          {commonRatioNames.map((ratioName, index) => (
            <div key={index} className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <h4 className="text-lg font-medium mb-2">{ratioName}</h4>
              <p className="text-gray-600 mb-4 text-sm">{getRatioDescription(ratioName)}</p>
              <div className="h-72">
                <Bar 
                  data={prepareChartData(ratioName)}
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
                            return `${value.toLocaleString(undefined, { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })}`;
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      }
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 p-4 rounded">
          <p>共通の財務指標が見つかりませんでした。比較するには、同じ指標が両方の企業データに存在する必要があります。</p>
        </div>
      )}

      {/* 比較企業がない場合のメッセージ */}
      {secondaryCompaniesData.length === 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-400 text-blue-700 p-4 rounded">
          <p className="font-medium">比較企業を追加</p>
          <p>他のXBRLファイルをアップロードすることで、複数の企業を比較できます。</p>
        </div>
      )}
    </div>
  );
};

export default CompanyComparison;