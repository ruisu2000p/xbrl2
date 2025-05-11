import React, { useState, useEffect } from 'react';
import { XBRLData, StatementType } from '../types/xbrl';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';

// Chart.jsの必要なコンポーネントを登録
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
);

interface FinancialAnalysisDetailsProps {
  xbrlData: XBRLData;
}

/**
 * 詳細な財務分析コンポーネント
 * 財務データの時系列分析、KPIの可視化などを行います
 */
const FinancialAnalysisDetails: React.FC<FinancialAnalysisDetailsProps> = ({ xbrlData }) => {
  // アクティブな分析タブ
  const [activeTab, setActiveTab] = useState<'kpi' | 'balancesheet' | 'income' | 'cashflow'>('kpi');
  // トレンドチャートデータ
  const [trendChartData, setTrendChartData] = useState<any>(null);
  // 財務構造データ
  const [financialStructureData, setFinancialStructureData] = useState<any>(null);
  
  useEffect(() => {
    // 主要KPIのトレンドチャートデータを準備
    prepareKPITrendData();
    // 財務構造データを準備
    prepareFinancialStructureData();
  }, [xbrlData]);
  
  // 主要KPIのトレンドチャートデータを準備する関数
  const prepareKPITrendData = () => {
    // XBRLデータから期間情報を抽出し、ソートするロジック
    // これはサンプルとしてダミーデータを使用
    const periods = ['1Q', '2Q', '3Q', '4Q'];
    
    // 主要KPIの値をデータから抽出するロジック
    // サンプルとしてダミーデータを使用
    
    // 売上高
    const revenueTrend = [2400, 2600, 2900, 3100];
    
    // 営業利益
    const operatingIncomeTrend = [350, 400, 450, 500];
    
    // 当期純利益
    const netIncomeTrend = [250, 280, 310, 340];
    
    // トレンドチャートデータを設定
    setTrendChartData({
      labels: periods,
      datasets: [
        {
          label: '売上高',
          data: revenueTrend,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.4,
          fill: false,
        },
        {
          label: '営業利益',
          data: operatingIncomeTrend,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.4,
          fill: false,
        },
        {
          label: '当期純利益',
          data: netIncomeTrend,
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          tension: 0.4,
          fill: false,
        }
      ],
    });
  };
  
  // 財務構造データを準備する関数
  const prepareFinancialStructureData = () => {
    // 貸借対照表データを取得
    const balanceSheet = xbrlData.statements[StatementType.BalanceSheet];
    if (!balanceSheet || balanceSheet.items.length === 0) {
      return;
    }
    
    // 財務項目を検索する関数
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
    
    // 財務構造データを作成
    const data = {
      // 資産構成
      assets: {
        currentAssets: findItemValue(['流動資産合計', 'current assets']),
        tangibleAssets: findItemValue(['有形固定資産合計', 'tangible assets']),
        intangibleAssets: findItemValue(['無形固定資産合計', 'intangible assets']),
        investmentsAndOther: findItemValue(['投資その他の資産合計', 'investments and other']),
      },
      // 負債・資本構成
      liabilitiesAndEquity: {
        currentLiabilities: findItemValue(['流動負債合計', 'current liabilities']),
        nonCurrentLiabilities: findItemValue(['固定負債合計', 'non-current liabilities']),
        equity: findItemValue(['純資産合計', 'equity', 'net assets']),
      },
    };
    
    setFinancialStructureData(data);
  };
  
  // 表示するコンテンツを切り替える関数
  const renderContent = () => {
    switch (activeTab) {
      case 'kpi':
        return renderKPIContent();
      case 'balancesheet':
        return renderBalanceSheetContent();
      case 'income':
        return renderIncomeContent();
      case 'cashflow':
        return renderCashFlowContent();
      default:
        return renderKPIContent();
    }
  };
  
  // KPI分析コンテンツ
  const renderKPIContent = () => {
    return (
      <div>
        <h4 className="text-lg font-medium mb-4">主要業績評価指標（KPI）</h4>
        
        {/* KPIトレンドチャート */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h5 className="text-primary-700 font-medium mb-3">業績推移</h5>
          {trendChartData ? (
            <div className="h-80">
              <Line 
                data={trendChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const value = context.raw as number;
                          return `${context.dataset.label}: ${value.toLocaleString()} 百万円`;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: '金額（百万円）'
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center">
              <p className="text-gray-500">チャートを表示するためのデータが不足しています。</p>
            </div>
          )}
        </div>
        
        {/* KPIサマリーカード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* 売上高カード */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
            <h5 className="text-sm font-medium text-gray-500">売上高</h5>
            <div className="mt-2 flex items-baseline">
              <p className="text-2xl font-semibold text-blue-600">
                {trendChartData?.datasets[0].data[3].toLocaleString()} 百万円
              </p>
              <p className="ml-2 text-sm text-green-600">
                +{Math.round((trendChartData?.datasets[0].data[3] / trendChartData?.datasets[0].data[2] - 1) * 100)}%
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-500">前期比</p>
          </div>
          
          {/* 営業利益カード */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-teal-200">
            <h5 className="text-sm font-medium text-gray-500">営業利益</h5>
            <div className="mt-2 flex items-baseline">
              <p className="text-2xl font-semibold text-teal-600">
                {trendChartData?.datasets[1].data[3].toLocaleString()} 百万円
              </p>
              <p className="ml-2 text-sm text-green-600">
                +{Math.round((trendChartData?.datasets[1].data[3] / trendChartData?.datasets[1].data[2] - 1) * 100)}%
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-500">前期比</p>
          </div>
          
          {/* 当期純利益カード */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-200">
            <h5 className="text-sm font-medium text-gray-500">当期純利益</h5>
            <div className="mt-2 flex items-baseline">
              <p className="text-2xl font-semibold text-purple-600">
                {trendChartData?.datasets[2].data[3].toLocaleString()} 百万円
              </p>
              <p className="ml-2 text-sm text-green-600">
                +{Math.round((trendChartData?.datasets[2].data[3] / trendChartData?.datasets[2].data[2] - 1) * 100)}%
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-500">前期比</p>
          </div>
          
          {/* 営業利益率カード */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-amber-200">
            <h5 className="text-sm font-medium text-gray-500">営業利益率</h5>
            <div className="mt-2 flex items-baseline">
              <p className="text-2xl font-semibold text-amber-600">
                {Math.round((trendChartData?.datasets[1].data[3] / trendChartData?.datasets[0].data[3]) * 100)}%
              </p>
              <p className="ml-2 text-sm text-green-600">
                +{Math.round(((trendChartData?.datasets[1].data[3] / trendChartData?.datasets[0].data[3]) - 
                              (trendChartData?.datasets[1].data[2] / trendChartData?.datasets[0].data[2])) * 100)}pt
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-500">前期比</p>
          </div>
        </div>
        
        {/* 指標解説 */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h5 className="text-primary-700 font-medium mb-3">指標の解説</h5>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="font-medium text-gray-700">売上高：</span>
              <span className="text-gray-600">企業の総収入を表し、ビジネスの規模を示す基本的な指標です。</span>
            </li>
            <li>
              <span className="font-medium text-gray-700">営業利益：</span>
              <span className="text-gray-600">本業の活動から得られた利益を表し、企業の収益力を示します。</span>
            </li>
            <li>
              <span className="font-medium text-gray-700">当期純利益：</span>
              <span className="text-gray-600">全ての収益と費用を考慮した後の最終的な利益であり、企業の総合的な収益性を表します。</span>
            </li>
            <li>
              <span className="font-medium text-gray-700">営業利益率：</span>
              <span className="text-gray-600">売上高に対する営業利益の割合であり、本業でどれだけ効率的に利益を生み出しているかを示します。</span>
            </li>
          </ul>
        </div>
      </div>
    );
  };
  
  // 貸借対照表分析コンテンツ
  const renderBalanceSheetContent = () => {
    return (
      <div>
        <h4 className="text-lg font-medium mb-4">貸借対照表分析</h4>
        
        {financialStructureData ? (
          <div className="space-y-6">
            {/* 資産構成分析 */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h5 className="text-primary-700 font-medium mb-3">資産構成</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 資産構成情報 */}
                <div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">資産区分</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額（百万円）</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">構成比</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* 流動資産 */}
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">流動資産</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.assets.currentAssets / 1000000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.assets.currentAssets / 
                            (financialStructureData.assets.currentAssets + 
                             financialStructureData.assets.tangibleAssets + 
                             financialStructureData.assets.intangibleAssets + 
                             financialStructureData.assets.investmentsAndOther) * 100)}%
                        </td>
                      </tr>
                      {/* 有形固定資産 */}
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">有形固定資産</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.assets.tangibleAssets / 1000000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.assets.tangibleAssets / 
                            (financialStructureData.assets.currentAssets + 
                             financialStructureData.assets.tangibleAssets + 
                             financialStructureData.assets.intangibleAssets + 
                             financialStructureData.assets.investmentsAndOther) * 100)}%
                        </td>
                      </tr>
                      {/* 無形固定資産 */}
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">無形固定資産</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.assets.intangibleAssets / 1000000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.assets.intangibleAssets / 
                            (financialStructureData.assets.currentAssets + 
                             financialStructureData.assets.tangibleAssets + 
                             financialStructureData.assets.intangibleAssets + 
                             financialStructureData.assets.investmentsAndOther) * 100)}%
                        </td>
                      </tr>
                      {/* 投資その他の資産 */}
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">投資その他の資産</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.assets.investmentsAndOther / 1000000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.assets.investmentsAndOther / 
                            (financialStructureData.assets.currentAssets + 
                             financialStructureData.assets.tangibleAssets + 
                             financialStructureData.assets.intangibleAssets + 
                             financialStructureData.assets.investmentsAndOther) * 100)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* 資産構成グラフ */}
                <div className="h-60 flex items-center justify-center">
                  <p className="text-gray-500">このサンプルではグラフは表示されません。</p>
                </div>
              </div>
            </div>
            
            {/* 負債・資本構成分析 */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h5 className="text-primary-700 font-medium mb-3">負債・資本構成</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 負債・資本構成情報 */}
                <div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">区分</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額（百万円）</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">構成比</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* 流動負債 */}
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">流動負債</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.liabilitiesAndEquity.currentLiabilities / 1000000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.liabilitiesAndEquity.currentLiabilities / 
                            (financialStructureData.liabilitiesAndEquity.currentLiabilities + 
                             financialStructureData.liabilitiesAndEquity.nonCurrentLiabilities + 
                             financialStructureData.liabilitiesAndEquity.equity) * 100)}%
                        </td>
                      </tr>
                      {/* 固定負債 */}
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">固定負債</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.liabilitiesAndEquity.nonCurrentLiabilities / 1000000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.liabilitiesAndEquity.nonCurrentLiabilities / 
                            (financialStructureData.liabilitiesAndEquity.currentLiabilities + 
                             financialStructureData.liabilitiesAndEquity.nonCurrentLiabilities + 
                             financialStructureData.liabilitiesAndEquity.equity) * 100)}%
                        </td>
                      </tr>
                      {/* 純資産 */}
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">純資産</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.liabilitiesAndEquity.equity / 1000000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(financialStructureData.liabilitiesAndEquity.equity / 
                            (financialStructureData.liabilitiesAndEquity.currentLiabilities + 
                             financialStructureData.liabilitiesAndEquity.nonCurrentLiabilities + 
                             financialStructureData.liabilitiesAndEquity.equity) * 100)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* 負債・資本構成グラフ */}
                <div className="h-60 flex items-center justify-center">
                  <p className="text-gray-500">このサンプルではグラフは表示されません。</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 p-4 rounded">
            <p>財務構造データを表示するための十分な情報がありません。</p>
          </div>
        )}
      </div>
    );
  };
  
  // 損益計算書分析コンテンツ
  const renderIncomeContent = () => {
    return (
      <div>
        <h4 className="text-lg font-medium mb-4">損益計算書分析</h4>
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 p-4 rounded">
          <p>このセクションはデモ用で、実際のデータに基づいていません。完全な分析を行うには、より詳細なXBRLデータが必要です。</p>
        </div>
      </div>
    );
  };
  
  // キャッシュフロー分析コンテンツ
  const renderCashFlowContent = () => {
    return (
      <div>
        <h4 className="text-lg font-medium mb-4">キャッシュフロー分析</h4>
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 p-4 rounded">
          <p>このセクションはデモ用で、実際のデータに基づいていません。完全な分析を行うには、より詳細なXBRLデータが必要です。</p>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">財務分析詳細</h3>
      
      {/* タブナビゲーション */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('kpi')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'kpi'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            KPI分析
          </button>
          <button
            onClick={() => setActiveTab('balancesheet')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'balancesheet'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            貸借対照表
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'income'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            損益計算書
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'cashflow'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            キャッシュフロー
          </button>
        </nav>
      </div>
      
      {/* タブコンテンツ */}
      {renderContent()}
    </div>
  );
};

export default FinancialAnalysisDetails;