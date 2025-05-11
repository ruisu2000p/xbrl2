import { saveAs } from 'file-saver';
import React, { useState, useEffect, useRef } from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as XLSX from 'xlsx';

import { useTheme } from '../../../contexts/ThemeContext';
import { 
  ProcessedXBRLData, 
  XBRLCellData, 
  XBRLTableData,
  XBRLExtractionOptions,
  XBRLContextInfo,
  XBRLUnitInfo
} from '../../../types/extractors/improved-xbrl-types';

import { convertXBRLData } from '../../../utils/formatters/improved-xbrl-formatter';
import EnhancedXBRLTableView from '../../table-view/EnhancedXBRLTableView';

// 拡張版XBRL抽出関数をインポート
import { extractEnhancedXBRL } from '../../../utils/xbrl/enhanced-xbrl-extractor';

// スタイル修正用CSSをインポート
import './style-fixes.css';

interface EnhancedXBRLTableExtractorProps {
  isDarkMode?: boolean;
  onProcessComplete?: (data: ProcessedXBRLData) => void;
}

/**
 * 拡張版XBRL対応テーブル抽出コンポーネント
 * XBRLタグを含む財務諸表のテーブルを抽出し、階層構造化して表示します
 * 
 * 主な改善点:
 * 1. XBRLタグの検出強化 - より多くの名前空間パターンをサポート
 * 2. iXBRL特有の要素処理 - 隠れた要素や特殊な名前空間の処理
 * 3. コンテキスト参照の適切な処理 - 期間情報や単位情報の取得
 * 4. 財務表の自動識別メカニズムの改善
 */
const EnhancedXBRLTableExtractor: React.FC<EnhancedXBRLTableExtractorProps> = ({ 
  isDarkMode: propIsDarkMode, 
  onProcessComplete 
}) => {
  // テーマコンテキストからダークモード設定を取得
  const { isDarkMode: contextIsDarkMode } = useTheme();
  const isDarkMode = propIsDarkMode !== undefined ? propIsDarkMode : contextIsDarkMode;
  
  // コンポーネントの状態管理
  const [inputType, setInputType] = useState('paste');
  const [htmlContent, setHtmlContent] = useState('');
  const [url, setUrl] = useState('');
  const [proxyUrl, setProxyUrl] = useState('https://cors-anywhere.herokuapp.com/');
  const [useProxy, setUseProxy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tables, setTables] = useState<XBRLTableData[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedXBRLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTableIndex, setActiveTableIndex] = useState(0);
  const [extractionOptions, setExtractionOptions] = useState<XBRLExtractionOptions>({
    detectHeaders: true,
    trimWhitespace: true,
    ignoreEmptyRows: true,
    convertSpecialChars: true,
    includeXbrlTags: true,
    intelligentProcessing: true,
    contextAware: true, // 新しいオプション: コンテキスト情報を取得
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [fileName, setFileName] = useState('XBRL_データ');
  const [extractionProgress, setExtractionProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processingTips, setProcessingTips] = useState([
    'XBRLタグを抽出しています...',
    '財務データを階層構造に変換しています...',
    '前期と当期のデータを比較しています...',
    'コンテキスト情報を処理しています...',
    '単位情報を解析しています...',
    'データの可視化準備をしています...'
  ]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [showInputHelp, setShowInputHelp] = useState(false);
  const [showExtractionHelp, setShowExtractionHelp] = useState(false);
  const [contextInfo, setContextInfo] = useState<Record<string, XBRLContextInfo>>({});
  const [unitInfo, setUnitInfo] = useState<Record<string, XBRLUnitInfo>>({});

  // 抽出状態をリセット
  const resetExtractionState = () => {
    setTables([]);
    setProcessedData(null);
    setError('');
    setSuccessMessage('');
    setActiveTableIndex(0);
    setExtractionProgress(0);
    setCurrentTipIndex(0);
    setContextInfo({});
    setUnitInfo({});
  };

  // 成功メッセージを5秒後に消去
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // 処理中のヒントを回転表示
  useEffect(() => {
    if (loading) {
      const timer = setInterval(() => {
        setCurrentTipIndex((prevIndex) => (prevIndex + 1) % processingTips.length);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [loading, processingTips.length]);

  // 処理完了時に親コンポーネントに通知
  useEffect(() => {
    if (processedData && onProcessComplete) {
      onProcessComplete(processedData);
    }
  }, [processedData, onProcessComplete]);

  // テーブルとXBRLタグを抽出する関数
  const extractTables = (html: string) => {
    setLoading(true);
    resetExtractionState();

    try {
      // 進捗状況を更新
      setExtractionProgress(10);
      
      // 拡張版XBRL抽出を実行
      const result = extractEnhancedXBRL(html);
      
      // コンテキストと単位情報を設定
      setContextInfo(result.contexts);
      setUnitInfo(result.units);
      
      // 進捗状況を更新
      setExtractionProgress(50);
      
      // テーブルが抽出できない場合
      if (result.tables.length === 0) {
        setError('HTMLコンテンツから有効なXBRLテーブルが抽出できませんでした。別のXBRLファイルを試すか、抽出オプションを変更してください。');
        setLoading(false);
        return;
      }
      
      // 抽出されたテーブルを設定
      setTables(result.tables);
      
      // 処理するテーブルを選択
      let selectedTableIndex = 0;
      
      // 財務諸表を検出して優先的に処理
      if (extractionOptions.intelligentProcessing) {
        // 最も財務関連のXBRLタグを含むテーブルを優先
        let maxFinancialTags = 0;
        
        result.tables.forEach((table, index) => {
          // 財務表の種類に基づいて重み付け
          let weight = 0;
          if (table.tableType === 'balance_sheet' || 
              table.tableType === 'income_statement' || 
              table.tableType === 'cash_flow') {
            weight = 100; // 財務諸表を優先
          }
          
          // XBRLタグの数に基づいて重み付け
          const financialTagCount = table.statistics.xbrlTags.filter((tag: string) => 
            tag?.includes('jppfs') || // 日本の財務諸表タグ
            tag?.includes('jpcrp') || // 企業情報
            tag?.includes('Asset') || 
            tag?.includes('Liability') || 
            tag?.includes('Equity') || 
            tag?.includes('Revenue') || 
            tag?.includes('Expense')
          ).length;
          
          const totalWeight = weight + financialTagCount;
          
          if (totalWeight > maxFinancialTags) {
            maxFinancialTags = totalWeight;
            selectedTableIndex = index;
          }
        });
      }
      
      // 選択されたテーブルを処理
      if (result.tables.length > 0) {
        try {
          // テーブルデータをJSON形式に変換
          const jsonData = result.tables[selectedTableIndex].rows.map((row: XBRLCellData[]) => {
            const obj: Record<string, any> = {};
            result.tables[selectedTableIndex].headers.forEach((header, index) => {
              const cell = row[index] || {
                value: '', 
                xbrlTag: null,
                contextRef: null,
                unitRef: null,
                decimals: null,
                scale: null,
                format: null,
                periodInfo: null,
                unitInfo: null
              };
              const headerName = header.value || `列 ${index + 1}`;
              
              // 値を格納
              obj[headerName] = cell.value || '';
              
              // XBRL関連の情報を格納
              if (cell.xbrlTag) obj[`${headerName}_XBRL`] = cell.xbrlTag;
              if (cell.contextRef) obj[`${headerName}_ContextRef`] = cell.contextRef;
              if (cell.unitRef) obj[`${headerName}_UnitRef`] = cell.unitRef;
              
              // 期間情報があれば格納
              if (cell.periodInfo) {
                if (cell.periodInfo.isCurrentPeriod) obj[`${headerName}_Period`] = 'current';
                else if (cell.periodInfo.isPreviousPeriod) obj[`${headerName}_Period`] = 'previous';
                
                if (cell.periodInfo.memberType !== 'unknown') {
                  obj[`${headerName}_MemberType`] = cell.periodInfo.memberType;
                }
              }
              
              // 単位情報があれば格納
              if (cell.unitInfo && cell.unitInfo.displayLabel) {
                obj[`${headerName}_Unit`] = cell.unitInfo.displayLabel;
              }
            });
            return obj;
          });
          
          // 改善されたフォーマットに変換
          const convertResult = convertXBRLData(jsonData);
          if (convertResult.success) {
            // テーブルタイプを設定
            if (result.tables[selectedTableIndex].tableType !== 'unknown') {
              convertResult.hierarchical.metadata.reportType = result.tables[selectedTableIndex].tableTitle || 
                (result.tables[selectedTableIndex].tableType === 'balance_sheet' ? '貸借対照表' :
                 result.tables[selectedTableIndex].tableType === 'income_statement' ? '損益計算書' :
                 result.tables[selectedTableIndex].tableType === 'cash_flow' ? 'キャッシュ・フロー計算書' :
                 result.tables[selectedTableIndex].tableType === 'shareholder' ? '大株主の状況' :
                 '財務諸表');
            }
            
            // 単位情報を追加
            const unitLabels = new Set<string>();
            result.tables[selectedTableIndex].rows.forEach((row: XBRLCellData[]) => {
              row.forEach((cell: XBRLCellData) => {
                if (cell.unitInfo && cell.unitInfo.displayLabel) {
                  unitLabels.add(cell.unitInfo.displayLabel);
                }
              });
            });
            
            // 最も多く使われている単位を優先
            const unitCounts: Record<string, number> = {};
            unitLabels.forEach(label => {
              unitCounts[label] = 0;
              result.tables[selectedTableIndex].rows.forEach((row: XBRLCellData[]) => {
                row.forEach((cell: XBRLCellData) => {
                  if (cell.unitInfo && cell.unitInfo.displayLabel === label) {
                    unitCounts[label]++;
                  }
                });
              });
            });
            
            let mostUsedUnit = '';
            let maxCount = 0;
            Object.entries(unitCounts).forEach(([unit, count]) => {
              if (count > maxCount) {
                mostUsedUnit = unit;
                maxCount = count;
              }
            });
            
            if (mostUsedUnit) {
              convertResult.hierarchical.metadata.unit = mostUsedUnit;
            }
            
            // 階層データの各項目に単位情報を追加
            const addUnitInfo = (items: any[]) => {
              items.forEach(item => {
                if (item.contextRef && item.unitRef) {
                  const context = result.contexts[item.contextRef];
                  const unit = result.units[item.unitRef];
                  
                  if (unit && unit.displayLabel) {
                    item.unitLabel = unit.displayLabel;
                  }
                  
                  if (context && context.memberType !== 'unknown') {
                    item.memberType = context.memberType;
                  }
                }
                
                if (item.children && item.children.length > 0) {
                  addUnitInfo(item.children);
                }
              });
            };
            
            if (convertResult.hierarchical.data) {
              addUnitInfo(convertResult.hierarchical.data);
            }
            
            setProcessedData(convertResult);
          }
        } catch (conversionError) {
          console.error('データ変換エラー:', conversionError instanceof Error ? conversionError.message : String(conversionError));
          // 変換エラーがあっても処理は続行（元のテーブル表示を使用）
        }
      }
      
      // 完了メッセージを設定
      setSuccessMessage(`${result.tables.length}個のテーブルを抽出しました！`);
      setExtractionProgress(100);
      setLoading(false);
    } catch (err) {
      setError(`HTML解析エラー: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  // ファイルアップロード処理
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // ファイルタイプとサイズをチェック
      const validTypes = ['text/html', 'application/xhtml+xml', 'text/xml'];
      const maxSize = 15 * 1024 * 1024; // 15MB
      
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(html|htm|xhtml|xml)$/i)) {
        setError('有効なHTML、XMLファイルを選択してください');
        setFile(null);
        // ファイル入力をリセット
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      if (selectedFile.size > maxSize) {
        setError(`ファイルサイズが上限の15MBを超えています。選択されたファイルは${(selectedFile.size / (1024 * 1024)).toFixed(2)}MBです`);
        setFile(null);
        // ファイル入力をリセット
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      setFile(selectedFile);
      setFileName(selectedFile.name.replace(/\.(html|htm|xhtml|xml)$/i, ''));
      
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const content = e.target?.result;
          // 文字列以外の場合は空文字列を設定
          setHtmlContent(typeof content === 'string' ? content : '');
          
          // プレビュー: ファイル内のテーブル数をカウント
          const parser = new DOMParser();
          const doc = parser.parseFromString(
            typeof content === 'string' ? content : '', 
            'text/html'
          );
          const tableCount = doc.querySelectorAll('table').length;
          setSuccessMessage(`ファイルを読み込みました。${tableCount}個のテーブルが見つかりました。「テーブルを抽出」ボタンをクリックして処理を開始してください。`);
        } catch (err) {
          setError(`ファイル読み込みエラー: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      reader.onerror = () => {
        setError('ファイルの読み込みに失敗しました。もう一度お試しください。');
      };
      reader.readAsText(selectedFile);
    }
  };

  // URLからHTMLを取得
  const fetchFromUrl = async () => {
    if (!url) {
      setError('URLを入力してください');
      return;
    }

    // URLを検証
    try {
      new URL(url); // 無効な場合は例外をスロー
    } catch (e) {
      setError('有効なURLを入力してください（例：https://example.com）');
      return;
    }

    setLoading(true);
    resetExtractionState();

    try {
      const fetchUrl = useProxy ? `${proxyUrl}${url}` : url;
      const response = await fetch(fetchUrl, {
        headers: useProxy ? { 'X-Requested-With': 'XMLHttpRequest' } : {}
      });
      
      if (!response.ok) {
        throw new Error(`HTTPエラー！ステータス: ${response.status}`);
      }
      
      const html = await response.text();
      setHtmlContent(html);
      
      // URLからファイル名を設定
      try {
        const urlObj = new URL(url);
        setFileName(urlObj.hostname.replace('www.', ''));
      } catch (e) {
        setFileName('XBRL_データ');
      }
      
      extractTables(html);
    } catch (err) {
      let errorMessage = `URL取得エラー: ${err instanceof Error ? err.message : String(err)}`;
      
      if (err instanceof Error && err.message.includes('CORS') && !useProxy) {
        errorMessage += ' CORSエラーが検出されました。CORSプロキシオプションを有効にしてみてください。';
      } else if (useProxy) {
        errorMessage += ' プロキシ使用中にエラーが発生しました。プロキシサーバーが容量制限に達しているか、URLがブロックされている可能性があります。';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  // 入力タイプに基づいて処理を実行
  const processInput = () => {
    resetExtractionState();
    
    if (inputType === 'paste') {
      if (!htmlContent) {
        setError('HTMLコンテンツを貼り付けてください');
        return;
      }
      extractTables(htmlContent);
    } else if (inputType === 'file') {
      if (!file) {
        setError('ファイルを選択してください');
        return;
      }
      // ファイルコンテンツは既にhtmlContentに読み込まれている
      extractTables(htmlContent);
    } else if (inputType === 'url') {
      fetchFromUrl();
    }
  };

  // 階層構造のデータを保存
  const saveHierarchicalData = (format: 'json' | 'excel') => {
    if (!processedData || !processedData.hierarchical) {
      setError('保存可能なデータがありません。');
      return;
    }
    
    if (format === 'json') {
      const jsonString = JSON.stringify(processedData.hierarchical, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      saveAs(blob, `${fileName}-階層構造.json`);
      setSuccessMessage('階層構造データをJSON形式で保存しました！');
    } else if (format === 'excel') {
      // Excelワークブックを作成
      const wb = XLSX.utils.book_new();
      
      // メタデータシートを作成
      const metadataSheet = [
        ['XBRL財務データ - 階層構造'],
        [''],
        ['レポートタイプ', processedData.hierarchical.metadata.reportType],
        ['単位', processedData.hierarchical.metadata.unit],
        ['前期', processedData.hierarchical.metadata.periods.previous],
        ['当期', processedData.hierarchical.metadata.periods.current],
        ['']
      ];
      
      // 注釈情報を追加
      if (processedData.hierarchical.annotations) {
        metadataSheet.push(['注釈情報']);
        Object.entries(processedData.hierarchical.annotations).forEach(([key,  value]) => {
          metadataSheet.push([key, value]);
        });
      }
      
      const metaWs = XLSX.utils.aoa_to_sheet(metadataSheet);
      XLSX.utils.book_append_sheet(wb, metaWs, "メタデータ");
      
      // 比較データシートを作成
      const comparativeData = [
        ['項目名', '階層レベル', 'XBRLタグ', '前期', '当期', '増減', '増減率(%)', '単位']
      ];
      
      // 平坦なデータを再帰的に構築
      const flattenHierarchy = (node: any,  level = 0) => {
        const indent = '　'.repeat(level);
        const change = node.previousPeriod !== null && node.currentPeriod !== null ? 
          node.currentPeriod - node.previousPeriod : null;
        const changeRate = node.previousPeriod !== null && node.currentPeriod !== null && node.previousPeriod !== 0 ? 
          ((node.currentPeriod - node.previousPeriod) / node.previousPeriod * 100) : null;
          
        comparativeData.push([
          indent + node.itemName,
          node.level,
          node.xbrlTag || '',
          node.previousPeriod,
          node.currentPeriod,
          change,
          changeRate !== null ? changeRate.toFixed(2) : '',
          node.unitLabel || processedData.hierarchical.metadata.unit
        ]);
        
        if (node.children && node.children.length > 0) {
          node.children.forEach((child: any) => {
            flattenHierarchy(child, level + 1);
          });
        }
      };
      
      // 階層構造を平坦なデータに変換
      processedData.hierarchical.data.forEach((section: any) => {
        flattenHierarchy(section);
      });
      
      const dataWs = XLSX.utils.aoa_to_sheet(comparativeData);
      XLSX.utils.book_append_sheet(wb, dataWs, "財務データ");
      
      // Excelファイルを保存
      XLSX.writeFile(wb, `${fileName}-階層構造.xlsx`);
      setSuccessMessage('階層構造データをExcel形式で保存しました！');
    }
  };

  return (
    <div className={`bg-${isDarkMode ? 'gray-900' : 'gray-50'} min-h-screen p-4 md:p-6 transition-colors duration-200`}>
      <div className={`max-w-7xl mx-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-md overflow-hidden transition-colors duration-200`}>
        
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white relative">
          <h1 className="text-3xl font-bold">拡張版XBRL対応テーブル抽出ツール</h1>
          <p className="mt-2 text-blue-100">財務諸表から財務データとXBRLタグを抽出し、より使いやすい階層構造で表示・分析</p>
        </div>
        
        {/* メインコンテンツ */}
        <div className={`p-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} transition-colors duration-200`}>
          
          {/* 入力選択 */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-4 transition-colors duration-200`}>
                入力ソース
              </h2>
              <button
                className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} flex items-center`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInputHelp(!showInputHelp);
                }}
              >
                <svg className="w-4 h-4 mr-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span className="pointer-events-none">ヘルプ</span>
              </button>
            </div>
            
            {/* 入力ヘルプパネル */}
            {showInputHelp && (
              <div className={`mb-4 p-4 rounded-md ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-gray-700'} text-sm leading-relaxed transition-colors duration-200`}>
                <h3 className="font-medium mb-2">入力方法について</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><span className="font-medium">HTMLを貼り付け</span>: 財務諸表を含むHTMLを直接貼り付けて処理します</li>
                  <li><span className="font-medium">ファイルをアップロード</span>: EDINET・TDnetからダウンロードしたHTMLファイルを処理します</li>
                  <li><span className="font-medium">URLから取得</span>: 財務諸表が公開されているWebページのURLから直接取得します</li>
                </ul>
                <p className="mt-2">
                  ※ XBRLタグが含まれる財務諸表であれば、自動的にテーブル構造を解析し、階層化、比較表示を行います
                </p>
                <div className="mt-3 text-right">
                  <button
                    className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInputHelp(false);
                    }}
                  >
                    <span className="pointer-events-none">閉じる</span>
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                className={`px-4 py-2 rounded-md transition-colors ${inputType === 'paste' ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setInputType('paste');
                }}
                aria-pressed={inputType === 'paste'}
              >
                <span className="pointer-events-none">HTMLを貼り付け</span>
              </button>
              <button
                className={`px-4 py-2 rounded-md transition-colors ${inputType === 'file' ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setInputType('file');
                }}
                aria-pressed={inputType === 'file'}
              >
                <span className="pointer-events-none">ファイルをアップロード</span>
              </button>
              <button
                className={`px-4 py-2 rounded-md transition-colors ${inputType === 'url' ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setInputType('url');
                }}
                aria-pressed={inputType === 'url'}
              >
                <span className="pointer-events-none">URLから取得</span>
              </button>
            </div>

            {/* HTML貼り付け入力 */}
            {inputType === 'paste' && (
              <div className="animate-fadeIn">
                <label htmlFor="html-content" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1 transition-colors duration-200`}>
                  テーブルを含むHTMLコンテンツを貼り付けてください:
                </label>
                <textarea
                  id="html-content"
                  className={`w-full h-64 p-3 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200' : 'border-gray-300 bg-white text-gray-800'} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                  placeholder="ここにHTMLコンテンツを貼り付け... (例: <table><tr><td>データ</td></tr></table>)"
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                />
                <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} transition-colors duration-200`}>
                  &lt;table&gt;要素を含むHTMLを貼り付けてください。XBRLタグが含まれているコンテンツも自動的に処理されます。
                </p>
              </div>
            )}

            {/* ファイルアップロード入力 */}
            {inputType === 'file' && (
              <div className="animate-fadeIn">
                <div className={`file-input-wrapper flex flex-col items-center justify-center border-2 border-dashed ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'} rounded-lg p-8 transition-colors hover:border-blue-400 duration-200 relative`}>
                  <svg className={`w-12 h-12 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mb-3 pointer-events-none`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"></path>
                  </svg>
                  <p className={`mb-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} pointer-events-none`}>
                    <span className="font-semibold">クリックしてアップロード</span>またはドラッグ＆ドロップ
                  </p>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} pointer-events-none`}>HTML、HTM、XHTML、またはXMLファイル（最大15MB）</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm,.xhtml,.xml"
                    onChange={handleFileChange}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                    tabIndex={0}
                    aria-label="ファイルをアップロード"
                  />
                </div>
                {file && (
                  <div className={`mt-3 flex items-center justify-between p-3 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-50'} rounded-md transition-colors duration-200`}>
                    <div className="flex items-center">
                      <svg className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} mr-2 pointer-events-none`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      <span className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} pointer-events-none`}>{file && file.name} ({(file && file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      className={`text-sm ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-800'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setHtmlContent('');
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      <span className="pointer-events-none">削除</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* URL入力 */}
            {inputType === 'url' && (
              <div className="animate-fadeIn">
                <label htmlFor="url-input" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1 transition-colors duration-200`}>
                  HTMLテーブルを含むURLを入力してください:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-grow">
                    <input
                      id="url-input"
                      type="text"
                      className={`w-full p-3 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200' : 'border-gray-300 bg-white text-gray-800'} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                      placeholder="https://example.com/テーブルを含むページ"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <input
                    id="use-proxy"
                    type="checkbox"
                    className={`h-4 w-4 text-blue-600 focus:ring-blue-500 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'} rounded transition-colors duration-200`}
                    checked={useProxy}
                    onChange={(e) => setUseProxy(e.target.checked)}
                  />
                  <label 
                    htmlFor="use-proxy" 
                    className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors duration-200`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUseProxy(!useProxy);
                    }}
                  >
                    <span className="pointer-events-none">CORSプロキシを使用する（クロスオリジン問題の解決に）</span>
                  </label>
                </div>
                {useProxy && (
                  <div className="mt-2">
                    <label htmlFor="proxy-url" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1 transition-colors duration-200`}>
                      プロキシURL:
                    </label>
                    <input
                      id="proxy-url"
                      type="text"
                      className={`w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200' : 'border-gray-300 bg-white text-gray-800'} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                      placeholder="https://cors-proxy.example.com/"
                      value={proxyUrl}
                      onChange={(e) => setProxyUrl(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* 詳細オプション */}
            <div className="mt-4">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} focus:outline-none flex items-center transition-colors duration-200`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAdvancedOptions(!showAdvancedOptions);
                  }}
                  aria-expanded={showAdvancedOptions}
                >
                  <svg className={`w-4 h-4 mr-1 transform ${showAdvancedOptions ? 'rotate-90' : ''} transition-transform pointer-events-none`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  <span className="pointer-events-none">詳細オプション</span>
                </button>
                
                <button
                  className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} flex items-center`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExtractionHelp(!showExtractionHelp);
                  }}
                >
                  <svg className="w-4 h-4 mr-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="pointer-events-none">抽出オプションについて</span>
                </button>
              </div>
              
              {/* 抽出ヘルプパネル */}
              {showExtractionHelp && (
                <div className={`mt-3 p-4 rounded-md ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-gray-700'} text-sm leading-relaxed transition-colors duration-200`}>
                  <h3 className="font-medium mb-2">抽出オプションについて</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><span className="font-medium">テーブルヘッダーを自動検出</span>: テーブルの最初の行をヘッダーとして識別します</li>
                    <li><span className="font-medium">空白を削除</span>: セルデータ内の余分な空白を削除します</li>
                    <li><span className="font-medium">空の行を無視</span>: 空のデータ行を無視します</li>
                    <li><span className="font-medium">特殊文字を変換</span>: 財務記号（△▲）などをマイナス記号に変換します</li>
                    <li><span className="font-medium">XBRLタグを抽出</span>: 財務データに関連付けられたXBRLタグを検出します</li>
                    <li><span className="font-medium">インテリジェント処理</span>: 検出したテーブルから最も関連性の高い財務データを選択します</li>
                    <li><span className="font-medium">コンテキスト認識</span>: コンテキスト参照と単位情報を処理します（期間、通貨単位など）</li>
                  </ul>
                  <div className="mt-3 text-right">
                    <button
                      className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExtractionHelp(false);
                      }}
                    >
                      <span className="pointer-events-none">閉じる</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* 詳細オプションパネル */}
            {showAdvancedOptions && (
              <div className={`mt-3 p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-md animate-fadeIn transition-colors duration-200`}>
                <h3 className={`text-md font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-2 transition-colors duration-200`}>抽出オプション</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center checkbox-container">
                    <input
                      id="detect-headers"
                      type="checkbox"
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'} rounded transition-colors duration-200`}
                      checked={extractionOptions.detectHeaders}
                      onChange={(e) => {
                        e.stopPropagation();
                        setExtractionOptions({...extractionOptions, detectHeaders: e.target.checked});
                      }}
                    />
                    <label 
                      htmlFor="detect-headers" 
                      className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors duration-200`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newValue = !extractionOptions.detectHeaders;
                        setExtractionOptions({...extractionOptions, detectHeaders: newValue});
                      }}
                    >
                      <span className="pointer-events-none">テーブルヘッダーを自動検出</span>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="trim-whitespace"
                      type="checkbox"
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'} rounded transition-colors duration-200`}
                      checked={extractionOptions.trimWhitespace}
                      onChange={(e) => {
                        e.stopPropagation();
                        setExtractionOptions({...extractionOptions, trimWhitespace: e.target.checked})
                      }}
                    />
                    <label 
                      htmlFor="trim-whitespace" 
                      className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors duration-200`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newValue = !extractionOptions.trimWhitespace;
                        setExtractionOptions({...extractionOptions, trimWhitespace: newValue});
                      }}
                    >
                      <span className="pointer-events-none">空白を削除</span>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="ignore-empty-rows"
                      type="checkbox"
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'} rounded transition-colors duration-200`}
                      checked={extractionOptions.ignoreEmptyRows}
                      onChange={(e) => {
                        e.stopPropagation();
                        setExtractionOptions({...extractionOptions, ignoreEmptyRows: e.target.checked})
                      }}
                    />
                    <label 
                      htmlFor="ignore-empty-rows" 
                      className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors duration-200`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newValue = !extractionOptions.ignoreEmptyRows;
                        setExtractionOptions({...extractionOptions, ignoreEmptyRows: newValue});
                      }}
                    >
                      <span className="pointer-events-none">空の行を無視</span>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="convert-special-chars"
                      type="checkbox"
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'} rounded transition-colors duration-200`}
                      checked={extractionOptions.convertSpecialChars}
                      onChange={(e) => {
                        e.stopPropagation();
                        setExtractionOptions({...extractionOptions, convertSpecialChars: e.target.checked})
                      }}
                    />
                    <label 
                      htmlFor="convert-special-chars" 
                      className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors duration-200`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newValue = !extractionOptions.convertSpecialChars;
                        setExtractionOptions({...extractionOptions, convertSpecialChars: newValue});
                      }}
                    >
                      <span className="pointer-events-none">特殊文字を変換</span>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="include-xbrl-tags"
                      type="checkbox"
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'} rounded transition-colors duration-200`}
                      checked={extractionOptions.includeXbrlTags}
                      onChange={(e) => {
                        e.stopPropagation();
                        setExtractionOptions({...extractionOptions, includeXbrlTags: e.target.checked})
                      }}
                    />
                    <label 
                      htmlFor="include-xbrl-tags" 
                      className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors duration-200`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newValue = !extractionOptions.includeXbrlTags;
                        setExtractionOptions({...extractionOptions, includeXbrlTags: newValue});
                      }}
                    >
                      <span className="pointer-events-none">XBRLタグを抽出</span>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="intelligent-processing"
                      type="checkbox"
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'} rounded transition-colors duration-200`}
                      checked={extractionOptions.intelligentProcessing}
                      onChange={(e) => {
                        e.stopPropagation();
                        setExtractionOptions({...extractionOptions, intelligentProcessing: e.target.checked})
                      }}
                    />
                    <label 
                      htmlFor="intelligent-processing" 
                      className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors duration-200`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newValue = !extractionOptions.intelligentProcessing;
                        setExtractionOptions({...extractionOptions, intelligentProcessing: newValue});
                      }}
                    >
                      <span className="pointer-events-none">インテリジェント処理</span>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="context-aware"
                      type="checkbox"
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'} rounded transition-colors duration-200`}
                      checked={extractionOptions.contextAware}
                      onChange={(e) => {
                        e.stopPropagation();
                        setExtractionOptions({...extractionOptions, contextAware: e.target.checked})
                      }}
                    />
                    <label 
                      htmlFor="context-aware" 
                      className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors duration-200`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newValue = !extractionOptions.contextAware;
                        setExtractionOptions({...extractionOptions, contextAware: newValue});
                      }}
                    >
                      <span className="pointer-events-none">コンテキスト認識</span>
                    </label>
                  </div>
                </div>
                
                <div className="mt-3">
                  <label htmlFor="filename-prefix" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1 transition-colors duration-200`}>
                    エクスポートファイル名のプレフィックス:
                  </label>
                  <input
                    id="filename-prefix"
                    type="text"
                    className={`w-full sm:w-64 p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200' : 'border-gray-300 bg-white text-gray-800'} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                    placeholder="XBRL_データ"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-start">
              <button
                className={`px-6 py-3 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center shadow-lg transform hover:scale-105 transition-transform`}
                onClick={(e) => {
                  e.stopPropagation();
                  processInput();
                }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="mr-2 animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white pointer-events-none"></div>
                    <span className="pointer-events-none">
                      {extractionProgress < 100 ? `抽出中 (${extractionProgress}%)` : '処理中...'}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    <span className="pointer-events-none">テーブルを抽出</span>
                  </>
                )}
              </button>
            </div>
            
            {/* ローディング時のヒント表示 */}
            {loading && (
              <div className={`mt-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm animate-pulse transition-colors duration-200`}>
                {processingTips[currentTipIndex]}
              </div>
            )}
          </div>
          
          {/* フィードバックメッセージ */}
          {error && (
            <div className={`mb-6 p-4 ${isDarkMode ? 'bg-red-900 border-red-700 text-red-200' : 'bg-red-50 border-red-500 text-red-700'} border-l-4 rounded-md animate-fadeIn transition-colors duration-200`} role="alert">
              <div className="flex">
                <svg className="w-5 h-5 mr-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span className="pointer-events-none">{error}</span>
              </div>
            </div>
          )}
          
          {successMessage && (
            <div className={`mb-6 p-4 ${isDarkMode ? 'bg-green-900 border-green-700 text-green-200' : 'bg-green-50 border-green-500 text-green-700'} border-l-4 rounded-md animate-fadeIn transition-colors duration-200`} role="alert">
              <div className="flex">
                <svg className="w-5 h-5 mr-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span className="pointer-events-none">{successMessage}</span>
              </div>
            </div>
          )}

          {/* 結果セクション - 改善された表示 */}
          {processedData && processedData.success && (
            <div className="mt-8 animate-fadeIn">
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} transition-colors duration-200`}>
                  XBRL財務データ（拡張表示）
                </h2>
                
                <div className="flex space-x-2">
                  <button
                    className={`px-4 py-2 ${isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-md transition-colors flex items-center`}
                    onClick={(e) => {
                      e.stopPropagation();
                      saveHierarchicalData('json');
                    }}
                  >
                    <svg className="w-4 h-4 mr-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    <span className="pointer-events-none">JSONで保存</span>
                  </button>
                  <button
                    className={`px-4 py-2 ${isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-md transition-colors flex items-center`}
                    onClick={(e) => {
                      e.stopPropagation();
                      saveHierarchicalData('excel');
                    }}
                  >
                    <svg className="w-4 h-4 mr-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    <span className="pointer-events-none">Excelで保存</span>
                  </button>
                </div>
              </div>
              
              {/* 改善されたXBRLテーブル表示 */}
              <EnhancedXBRLTableView data={processedData} isDarkMode={isDarkMode} />
            </div>
          )}
          
          {/* 元のテーブル表示 (階層化に失敗した場合やプロセスしていない場合のバックアップ) */}
          {tables.length > 0 && !processedData && (
            <div className="mt-8 animate-fadeIn">
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} transition-colors duration-200`}>
                  抽出されたテーブル（標準表示）
                </h2>
                
                <div className={`text-sm ${isDarkMode ? 'text-yellow-400 bg-yellow-900' : 'text-yellow-600 bg-yellow-100'} p-2 rounded-md transition-colors duration-200`}>
                  <span className="font-medium">注意:</span> XBRLデータの階層化処理に失敗しました。標準表示で表示します。
                </div>
              </div>
              
              {/* テーブルナビゲーション */}
              {tables.length > 1 && (
                <div className="mb-6 overflow-x-auto">
                  <div className="flex flex-nowrap gap-2 pb-2">
                    {tables.map((table,  index) => (
                      <button
                        key={table.id}
                        className={`px-3 py-2 rounded-md whitespace-nowrap transition-colors ${
                          activeTableIndex === index 
                            ? 'bg-blue-600 text-white' 
                            : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTableIndex(index);
                        }}
                      >
                        <span className="pointer-events-none">{table.tableTitle || `テーブル ${index + 1}`}</span>
                        <span className="ml-1 text-xs opacity-80 pointer-events-none">
                          ({table.rows.length} 行)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* テーブル表示 */}
              {tables[activeTableIndex] && (
                <div className={`border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} rounded-lg overflow-hidden shadow-sm transition-colors duration-200`}>
                  <div className={`p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border-b transition-colors duration-200`}>
                    <h3 className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} transition-colors duration-200`}>
                      {tables[activeTableIndex].tableTitle || `テーブル ${activeTableIndex + 1}`}
                    </h3>
                    <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} transition-colors duration-200`}>
                      {tables[activeTableIndex].tableType !== 'unknown' && (
                        <span className={`inline-block px-2 py-1 rounded ${
                          tables[activeTableIndex].tableType === 'balance_sheet' ? 'bg-blue-100 text-blue-800' :
                          tables[activeTableIndex].tableType === 'income_statement' ? 'bg-green-100 text-green-800' :
                          tables[activeTableIndex].tableType === 'cash_flow' ? 'bg-purple-100 text-purple-800' :
                          tables[activeTableIndex].tableType === 'shareholder' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        } mr-2`}>
                          {tables[activeTableIndex].tableType === 'balance_sheet' ? '貸借対照表' :
                           tables[activeTableIndex].tableType === 'income_statement' ? '損益計算書' :
                           tables[activeTableIndex].tableType === 'cash_flow' ? 'キャッシュ・フロー計算書' :
                           tables[activeTableIndex].tableType === 'shareholder' ? '大株主の状況' : '不明'}
                        </span>
                      )}
                      <span>XBRLタグ: {tables[activeTableIndex].statistics.xbrlTagCount}個</span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'} transition-colors duration-200`}>
                      <thead className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-200`}>
                        <tr>
                          {tables[activeTableIndex].headers.map((header,  index) => (
                            <th 
                              key={index}
                              className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider transition-colors duration-200`}
                            >
                              {header.value || `列 ${index + 1}`}
                              {header.xbrlTag && (
                                <div className="text-xs text-blue-600 font-normal normal-case mt-1">
                                  {header.xbrlTag}
                                </div>
                              )}
                              {header.contextRef && header.periodInfo && (
                                <div className="text-xs text-purple-600 font-normal normal-case mt-1">
                                  {header.periodInfo.isCurrentPeriod ? '当期' : 
                                   header.periodInfo.isPreviousPeriod ? '前期' : ''}
                                  {header.periodInfo.memberType !== 'unknown' && 
                                   ` (${header.periodInfo.memberType === 'consolidated' ? '連結' : '個別'})`}
                                </div>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`${isDarkMode ? 'bg-gray-900 divide-gray-700' : 'bg-white divide-gray-200'} divide-y transition-colors duration-200`}>
                        {tables[activeTableIndex].rows.map((row,  rowIndex) => (
                          <tr key={rowIndex} className={rowIndex % 2 === 0 ? (isDarkMode ? 'bg-gray-900' : 'bg-white') : (isDarkMode ? 'bg-gray-800' : 'bg-gray-50')}>
                            {row.map((cell,  cellIndex) => (
                              <td 
                                key={cellIndex}
                                className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-800'} transition-colors duration-200`}
                              >
                                <div className="pointer-events-none">
                                  {cell.value}
                                  {cell.xbrlTag && (
                                    <div className="text-xs text-blue-600 mt-1">
                                      {cell.xbrlTag}
                                    </div>
                                  )}
                                  {cell.contextRef && cell.periodInfo && (
                                    <div className="text-xs text-purple-600 mt-1">
                                      {cell.periodInfo.isCurrentPeriod ? '当期' : 
                                       cell.periodInfo.isPreviousPeriod ? '前期' : ''}
                                      {cell.periodInfo.memberType !== 'unknown' && 
                                       ` (${cell.periodInfo.memberType === 'consolidated' ? '連結' : '個別'})`}
                                    </div>
                                  )}
                                  {cell.unitRef && cell.unitInfo && (
                                    <div className="text-xs text-green-600 mt-1">
                                      {cell.unitInfo.displayLabel}
                                    </div>
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* フッター */}
        <div className={`${isDarkMode ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-gray-50 text-gray-600 border-gray-200'} p-4 text-center text-sm border-t transition-colors duration-200`}>
          拡張版XBRL対応テーブル抽出ツール v3.0 • 財務データを階層構造化して表示
          <div className="mt-1 text-xs">◆ 階層構造表示と年度間比較により財務データの分析が容易になります</div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedXBRLTableExtractor;
