import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { DisplayModeProvider } from './contexts/DisplayModeContext';
import XBRLUploader from './components/XBRLUploader';
import XBRLViewer from './components/XBRLViewer';
import FinancialDashboard from './components/FinancialDashboard';
import EnhancedXBRLTableExtractor from './components/extractors/xbrl/EnhancedXBRLTableExtractor';
import EnhancedXBRLTableView from './components/table-view/EnhancedXBRLTableView';
import { XBRLData, CommentSection } from './types/xbrl';
import { ProcessedXBRLData } from './types/extractors/improved-xbrl-types';
import { parseXBRLFile } from './utils/xbrlParser';
import { extractCommentsFromHTML } from './utils/htmlParser';
import { extractEnhancedXBRL } from './utils/xbrl/enhanced-xbrl-extractor';
import { sanitizeHtmlEnhanced } from './utils/htmlSanitizer';
import CommentsViewer from './components/CommentsViewer';

/**
 * メインアプリケーションコンポーネント
 * ThemeProviderとDisplayModeProviderでラップし、全体のダークモードとHTML/テキスト表示モードの状態管理を提供します
 */
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <DisplayModeProvider>
        <AppContent />
      </DisplayModeProvider>
    </ThemeProvider>
  );
};

/**
 * アプリケーションのメインコンテンツコンポーネント
 * ThemeContextからダークモード設定を受け取り、UIに適用します
 */
const AppContent: React.FC = () => {
  // テーマコンテキストからダークモード設定を取得
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  // 現在の表示タブ（財務諸表、分析・グラフ、生データ、拡張ツール）
  const [activeTab, setActiveTab] = useState<'financial' | 'analysis' | 'raw' | 'advanced-extractor'>('financial');
  
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  
  // 主要企業のXBRLデータ
  const [primaryXbrlData, setPrimaryXbrlData] = useState<XBRLData | null>(null);
  // 比較企業のXBRLデータリスト
  const [secondaryXbrlDataList, setSecondaryXbrlDataList] = useState<XBRLData[]>([]);
  // 比較企業の名前リスト
  const [secondaryCompanyNames, setSecondaryCompanyNames] = useState<string[]>([]);
  const [comments, setComments] = useState<CommentSection[]>([]);
  
  // 改善版XBRL抽出ツールからの処理データ
  const [processedXbrlData, setProcessedXbrlData] = useState<ProcessedXBRLData | null>(null);
  const [useEnhancedMode, setUseEnhancedMode] = useState<boolean>(true);
  
  // ロード状態の管理
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // エラー状態の管理
  const [error, setError] = useState<string | null>(null);
  // 現在表示している会社名
  const [companyName, setCompanyName] = useState<string>('');

  /**
   * XBRLファイルとHTMLファイルが選択されたときのハンドラー
   * ファイルを読み込み、パースしてXBRLデータとして状態を更新します
   * 拡張モードが有効な場合は、拡張版XBRL抽出ツールも使用します
   */
  const handleFileUpload = async (xbrlFile: File, htmlFile?: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const parsedData = await parseXBRLFile(xbrlFile);
      
      if (htmlFile) {
        try {
          const reader = new FileReader();
          reader.onload = async (e) => {
            if (e.target && typeof e.target.result === 'string') {
              const htmlContent = e.target.result;
              const extractedComments = extractCommentsFromHTML(htmlContent);
              setComments(extractedComments);
            }
          };
          reader.readAsText(htmlFile);
        } catch (htmlError) {
          console.warn('HTMLファイルの解析に失敗しました:', htmlError);
        }
      }
      
      // ファイル名から会社名を抽出
      const fileName = xbrlFile.name;
      const companyMatch = fileName.match(/_(.*?)_/);
      let extractedCompanyName = '企業名不明';
      
      if (companyMatch && companyMatch[1]) {
        extractedCompanyName = companyMatch[1];
      }
      
      // 拡張版XBRL抽出ツールを使用した解析（これをメインとして使用）
      if (useEnhancedMode) {
        try {
          const reader = new FileReader();
          const xbrlContent = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => {
              if (e.target && typeof e.target.result === 'string') {
                resolve(e.target.result);
              } else {
                reject(new Error('ファイル読み込みに失敗しました'));
              }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsText(xbrlFile);
          });
          
          const enhancedResult = extractEnhancedXBRL(xbrlContent);
          
          if (enhancedResult.tables.length > 0) {
            const processedResult: ProcessedXBRLData = {
              success: true,
              rawData: enhancedResult.tables,
              hierarchical: {
                metadata: {
                  reportType: enhancedResult.tables[0].tableTitle || '財務諸表',
                  unit: '円',
                  periods: {
                    current: '当期',
                    previous: '前期'
                  }
                },
                data: []
              }
            };
            
            setProcessedXbrlData(processedResult);
          }
        } catch (enhancedError) {
          console.warn('拡張XBRLパーサーでの解析に失敗しました。基本パーサーの結果を使用します:', enhancedError);
        }
      }
      
      // 主要企業のデータがない場合は主要企業として設定
      // ある場合は比較企業として追加
      if (!primaryXbrlData) {
        setPrimaryXbrlData(parsedData);
        setCompanyName(extractedCompanyName);
      } else {
        // 既存の比較企業リストに追加
        setSecondaryXbrlDataList(prevList => [...prevList, parsedData]);
        setSecondaryCompanyNames(prevNames => [...prevNames, extractedCompanyName]);
        setActiveTab('financial');
      }

    } catch (err) {
      console.error('XBRLファイルの解析に失敗しました:', err);
      setError('XBRLファイルの解析に失敗しました。正しいXBRLファイルか確認してください。');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 主要企業のデータをリセットする関数
   */
  const resetData = () => {
    setPrimaryXbrlData(null);
    setSecondaryXbrlDataList([]);
    setSecondaryCompanyNames([]);
    setCompanyName('');
    setProcessedXbrlData(null);
    setComments([]);
    setError(null);
    setActiveTab('financial');
  };
  
  /**
   * 拡張モードの切り替え
   */
  const toggleEnhancedMode = () => {
    setUseEnhancedMode(prev => !prev);
  };
  
  /**
   * 改善版XBRL抽出ツールの処理結果を受け取るハンドラー
   */
  const handleProcessComplete = (data: ProcessedXBRLData) => {
    setProcessedXbrlData(data);
    // 処理が完了したらその結果を表示
    if (data.success) {
      console.log('XBRL処理完了:', data);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} transition-colors duration-300`}>
      <header className={`${isDarkMode ? 'bg-gray-800' : 'bg-primary-700'} text-white shadow-lg transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">XBRL財務データ可視化アプリ</h1>
            <p className={`mt-1 ${isDarkMode ? 'text-gray-300' : 'text-primary-100'} transition-colors duration-300`}>
              XBRLファイルをアップロードして財務データを分析
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* 言語切り替えボタン */}
            <button
              className={`px-3 py-1 text-sm rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors duration-300`}
              onClick={() => setLanguage(language === 'ja' ? 'en' : 'ja')}
              aria-label={language === 'ja' ? 'Switch to English' : '日本語に切り替え'}
            >
              {language === 'ja' ? 'English' : '日本語'}
            </button>
            
            {/* ダークモード切り替えボタン */}
            <button
              className="p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-700 transition-colors" 
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {isDarkMode ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* タブナビゲーション */}
        <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} mb-8 transition-colors duration-300`}>
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('financial')}
              className={`
                pb-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'financial'
                  ? isDarkMode 
                    ? 'border-blue-500 text-blue-400' 
                    : 'border-primary-500 text-primary-600'
                  : isDarkMode
                    ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              財務諸表
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`
                pb-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'analysis'
                  ? isDarkMode 
                    ? 'border-blue-500 text-blue-400' 
                    : 'border-primary-500 text-primary-600'
                  : isDarkMode
                    ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              分析・グラフ
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`
                pb-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'raw'
                  ? isDarkMode 
                    ? 'border-blue-500 text-blue-400' 
                    : 'border-primary-500 text-primary-600'
                  : isDarkMode
                    ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              生データ
            </button>
            <button
              onClick={() => setActiveTab('advanced-extractor')}
              className={`
                pb-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'advanced-extractor'
                  ? isDarkMode 
                    ? 'border-blue-500 text-blue-400' 
                    : 'border-primary-500 text-primary-600'
                  : isDarkMode
                    ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              拡張ツール
              {processedXbrlData && (
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-primary-100 text-primary-800'
                }`}>
                  処理済
                </span>
              )}
            </button>
          </nav>
        </div>
        
        {/* 拡張版XBRL抽出ツール表示 */}
        {activeTab === 'advanced-extractor' ? (
          <div className="mb-8">
            <EnhancedXBRLTableExtractor 
              isDarkMode={isDarkMode}
              onProcessComplete={handleProcessComplete}
            />
          </div>
        ) : (
          // 通常の表示内容
          <>
            {/* XBRLファイルアップローダー */}
            <section className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-md mb-8 transition-colors duration-300`}>
              <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>XBRLファイルのアップロード</h2>
              <XBRLUploader 
                onFileUpload={handleFileUpload}
                isLoading={isLoading}
                isDarkMode={isDarkMode}
                useEnhancedMode={useEnhancedMode}
                onToggleEnhancedMode={toggleEnhancedMode}
                language={language}
              />
              
              {/* リセットボタン */}
              {primaryXbrlData && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={resetData}
                    className={`inline-flex items-center px-4 py-2 border ${
                      isDarkMode 
                        ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600' 
                        : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                    } rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isDarkMode ? 'focus:ring-blue-500' : 'focus:ring-primary-500'
                    } transition-colors duration-300`}
                  >
                    データをリセット
                  </button>
                </div>
              )}
            </section>

            {/* エラー表示 */}
            {error && (
              <div className={`${isDarkMode ? 'bg-red-900 border-red-800 text-red-100' : 'bg-red-50 border-red-400 text-red-700'} px-4 py-3 rounded mb-8 border transition-colors duration-300`} role="alert">
                <p className="font-bold">エラー</p>
                <p>{error}</p>
              </div>
            )}

            {/* ローディング表示 */}
            {isLoading && (
              <div className="flex justify-center items-center py-12">
                <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${isDarkMode ? 'border-blue-500' : 'border-primary-700'} transition-colors duration-300`}></div>
                <span className="ml-3">XBRLファイルを解析中...</span>
              </div>
            )}

            {/* XBRLデータが存在する場合の表示 */}
            {primaryXbrlData && !isLoading && (
              <div>
                {/* 会社情報ヘッダー */}
                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-md mb-8 transition-colors duration-300`}>
                  <h2 className={`text-2xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{companyName}の財務データ</h2>
                  <div className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>
                      {primaryXbrlData.companyInfo.fiscalYear ? `会計年度: ${primaryXbrlData.companyInfo.fiscalYear}` : ''}
                      {primaryXbrlData.companyInfo.endDate ? ` (期末日: ${primaryXbrlData.companyInfo.endDate})` : ''}
                    </p>
                    {primaryXbrlData.companyInfo.ticker && (
                      <p>証券コード: {primaryXbrlData.companyInfo.ticker}</p>
                    )}
                  </div>
                  
                  {/* 追加の企業情報 */}
                  {secondaryXbrlDataList.length > 0 && (
                    <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} transition-colors duration-300`}>
                      <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>比較企業:</h3>
                      <ul className="mt-2 space-y-1">
                        {secondaryCompanyNames.map((name, index) => (
                          <li key={index} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* タブコンテンツ - 財務諸表 */}
                {activeTab === 'financial' && (
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-md mb-8 transition-colors duration-300`}>
                    <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>財務諸表</h2>
                    {useEnhancedMode && processedXbrlData ? (
                      <div>
                        <div className="text-sm mb-4">
                          <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} p-3 rounded mb-2`}>
                            <span className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>レポートタイプ: </span>
                            <span>{processedXbrlData.hierarchical.metadata.reportType}</span>
                          </div>
                          <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} p-3 rounded mb-2`}>
                            <span className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>単位: </span>
                            <span>{processedXbrlData.hierarchical.metadata.unit}</span>
                          </div>
                          <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} p-3 rounded mb-2`}>
                            <span className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>期間: </span>
                            <span>{processedXbrlData.hierarchical.metadata.periods.current}</span>
                          </div>
                        </div>
                        <EnhancedXBRLTableView 
                          data={processedXbrlData}
                          isDarkMode={isDarkMode}
                          language={language}
                        />
                      </div>
                    ) : (
                      <XBRLViewer xbrlData={primaryXbrlData} />
                    )}
                  </div>
                )}
                
                {/* タブコンテンツ - 分析・グラフ */}
                {activeTab === 'analysis' && (
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-md mb-8 transition-colors duration-300`}>
                    <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>財務分析・グラフ</h2>
                    <FinancialDashboard xbrlData={primaryXbrlData} />
                    
                    {/* 注記情報表示 */}
                    {comments.length > 0 && (
                      <div className="mt-8">
                        <CommentsViewer 
                          comments={comments} 
                          onSelectItem={(item) => {
                            console.log('Selected item:', item);
                          }} 
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {/* タブコンテンツ - 生データ */}
                {activeTab === 'raw' && (
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-md mb-8 transition-colors duration-300`}>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>生データ</h2>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => {
                            if (primaryXbrlData) {
                              const dataToExport = useEnhancedMode && processedXbrlData 
                                ? { ...primaryXbrlData, processedData: processedXbrlData } 
                                : primaryXbrlData;
                              
                              const jsonString = JSON.stringify(dataToExport, null, 2);
                              const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${companyName || 'xbrl-data'}_${new Date().toISOString().split('T')[0]}.json`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }
                          }}
                          className={`px-3 py-1 text-sm rounded ${isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} text-white transition-colors duration-300`}
                        >
                          JSONでエクスポート
                        </button>
                        <button 
                          onClick={() => {
                            if (primaryXbrlData) {
                              let csvContent = "項目名,値,単位,期間,タクソノミ要素\n";
                              
                              Object.values(primaryXbrlData.statements).forEach(statement => {
                                statement.items.forEach(item => {
                                  item.values.forEach(value => {
                                    csvContent += `"${item.nameJa || item.name}",${value.value},"${value.unit || ''}","${value.period || ''}","${item.name}"\n`;
                                  });
                                });
                              });
                              
                              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${companyName || 'xbrl-data'}_${new Date().toISOString().split('T')[0]}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }
                          }}
                          className={`px-3 py-1 text-sm rounded ${isDarkMode ? 'bg-green-700 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700'} text-white transition-colors duration-300`}
                        >
                          CSVでエクスポート
                        </button>
                      </div>
                    </div>
                    
                    <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} p-4 rounded-lg mb-6`}>
                      <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>企業情報</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <span className="font-medium">企業名:</span> {companyName || '不明'}
                          </p>
                          <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <span className="font-medium">会計年度:</span> {primaryXbrlData.companyInfo.fiscalYear || '不明'}
                          </p>
                          <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <span className="font-medium">期末日:</span> {primaryXbrlData.companyInfo.endDate || '不明'}
                          </p>
                        </div>
                        <div>
                          <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <span className="font-medium">証券コード:</span> {primaryXbrlData.companyInfo.ticker || '不明'}
                          </p>
                          <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <span className="font-medium">通貨単位:</span> {'円'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
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
                          {Object.entries(primaryXbrlData.statements).map(([statementType, statement]) => (
                            <React.Fragment key={statementType}>
                              <tr className={`${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                                <td colSpan={5} className="px-4 py-2 font-semibold">
                                  {statementType === 'BalanceSheet' ? '貸借対照表' : 
                                   statementType === 'IncomeStatement' ? '損益計算書' : 
                                   statementType === 'CashFlow' ? 'キャッシュフロー計算書' : statementType}
                                </td>
                              </tr>
                              {statement.items.map((item, idx) => (
                                item.values.map((value, valueIdx) => (
                                  <tr key={`${idx}-${valueIdx}`} className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                                    <td className="px-4 py-2 border-b border-gray-700" dangerouslySetInnerHTML={{ __html: sanitizeHtmlEnhanced(String(item.nameJa || item.name)) }}></td>
                                    <td className="px-4 py-2 border-b border-gray-700" dangerouslySetInnerHTML={{ __html: sanitizeHtmlEnhanced(String(value.value)) }}></td>
                                    <td className="px-4 py-2 border-b border-gray-700">{value.unit || '-'}</td>
                                    <td className="px-4 py-2 border-b border-gray-700">{value.period || '-'}</td>
                                    <td className="px-4 py-2 border-b border-gray-700">{item.name || '-'}</td>
                                  </tr>
                                ))
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* 注記情報表示 - 財務諸表タブの場合のみ表示 */}
                {activeTab === 'financial' && comments.length > 0 && (
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-md mt-6 transition-colors duration-300`}>
                    <CommentsViewer 
                      comments={comments} 
                      onSelectItem={(item) => {
                        console.log('Selected item:', item);
                      }} 
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* データが存在しない場合のウェルカムメッセージ */}
            {!primaryXbrlData && !isLoading && !error && (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-8 rounded-lg shadow-md text-center transition-colors duration-300`}>
                <h2 className={`text-2xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>XBRLデータを分析しましょう</h2>
                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
                  XBRLファイルをアップロードして、財務データの詳細な分析を始めましょう。
                  企業の財務状況を視覚的に把握し、様々な財務指標を確認できます。
                </p>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
                  <div className={`flex-1 max-w-xs ${isDarkMode ? 'bg-blue-900 border-blue-800' : 'bg-blue-50 border-blue-200'} p-4 rounded-lg border transition-colors duration-300`}>
                    <h3 className={`text-lg font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-800'} mb-2`}>基本分析</h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      財務諸表の基本的な指標を分析し、グラフで視覚化します。
                    </p>
                  </div>
                  <div className={`flex-1 max-w-xs ${isDarkMode ? 'bg-green-900 border-green-800' : 'bg-green-50 border-green-200'} p-4 rounded-lg border transition-colors duration-300`}>
                    <h3 className={`text-lg font-medium ${isDarkMode ? 'text-green-300' : 'text-green-800'} mb-2`}>詳細分析</h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      より詳細なKPIや時系列分析で、財務状況を深く理解します。
                    </p>
                  </div>
                  <div className={`flex-1 max-w-xs ${isDarkMode ? 'bg-purple-900 border-purple-800' : 'bg-purple-50 border-purple-200'} p-4 rounded-lg border transition-colors duration-300`}>
                    <h3 className={`text-lg font-medium ${isDarkMode ? 'text-purple-300' : 'text-purple-800'} mb-2`}>企業比較</h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      複数の企業のXBRLデータを比較して、相対的な財務状況を評価します。
                    </p>
                  </div>
                </div>
                
                <div className="mt-8 p-4 border border-dashed rounded-lg max-w-xl mx-auto">
                  <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} mb-2`}>新機能: 拡張版XBRL解析ツール</h3>
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-3`}>
                    より高度なXBRLデータ解析が必要な場合は、「拡張ツール」タブをお試しください。
                    階層構造表示やExcel/JSON/CSV形式への保存機能を備えています。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setActiveTab('advanced-extractor')}
                      className={`px-4 py-2 ${isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md transition-colors duration-200`}
                    >
                      拡張ツールを使う
                    </button>
                    <button
                      onClick={() => setActiveTab('financial')}
                      className={`px-4 py-2 ${isDarkMode ? 'bg-green-700 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700'} text-white rounded-md transition-colors duration-200`}
                    >
                      財務諸表を見る
                    </button>
                    <button
                      onClick={() => setActiveTab('analysis')}
                      className={`px-4 py-2 ${isDarkMode ? 'bg-purple-700 hover:bg-purple-600' : 'bg-purple-600 hover:bg-purple-700'} text-white rounded-md transition-colors duration-200`}
                    >
                      分析・グラフを見る
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-800'} text-white mt-12 transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center">© 2025 XBRL財務データ可視化アプリ</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
