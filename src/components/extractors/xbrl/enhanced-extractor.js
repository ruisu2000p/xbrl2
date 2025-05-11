/**
 * 拡張版XBRL抽出モジュール
 * 
 * XBRL財務データをより詳細に抽出し、多くの項目を検出するための拡張処理
 */
import { extractEnhancedXBRL } from '../../../utils/xbrl/enhanced-xbrl-extractor';
import { convertXBRLData } from '../../../utils/formatters/improved-xbrl-formatter';

/**
 * 拡張版XBRL抽出処理
 * 
 * @param {string} htmlContent XBRL/HTMLコンテンツ
 * @param {Object} extractionOptions 抽出オプション
 * @param {Function} onProgress 進捗更新コールバック
 * @param {Function} onSuccess 成功時コールバック
 * @param {Function} onError エラー時コールバック
 */
export function extractXBRLEnhanced(htmlContent, extractionOptions = {}, onProgress, onSuccess, onError) {
  try {
    // 開始進捗
    if (onProgress) {
      onProgress(10);
    }
    
    // 拡張版XBRL抽出処理
    const result = extractEnhancedXBRL(htmlContent);
    
    // 中間進捗
    if (onProgress) {
      onProgress(50);
    }
    
    // 抽出結果の確認
    if (result.tables.length === 0) {
      if (onError) {
        onError('HTMLコンテンツから有効なXBRLテーブルが抽出できませんでした。別のXBRLファイルを試すか、抽出オプションを変更してください。');
      }
      return;
    }
    
    // テーブルを選択
    let selectedTableIndex = 0;
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
        const financialTagCount = table.statistics.xbrlTags.filter((tag) => 
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
        const jsonData = result.tables[selectedTableIndex].rows.map((row) => {
          const obj = {};
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
          const unitLabels = new Set();
          result.tables[selectedTableIndex].rows.forEach((row) => {
            row.forEach((cell) => {
              if (cell.unitInfo && cell.unitInfo.displayLabel) {
                unitLabels.add(cell.unitInfo.displayLabel);
              }
            });
          });
          
          // 最も多く使われている単位を優先
          const unitCounts = {};
          unitLabels.forEach(label => {
            unitCounts[label] = 0;
            result.tables[selectedTableIndex].rows.forEach((row) => {
              row.forEach((cell) => {
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
          const addUnitInfo = (items) => {
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
          
          // 処理結果を返す
          if (onSuccess) {
            onSuccess({
              processedData: convertResult,
              tables: result.tables,
              contexts: result.contexts,
              units: result.units
            });
          }
        } else {
          // 変換に失敗した場合でも元のテーブルを返す
          if (onSuccess) {
            onSuccess({
              processedData: null,
              tables: result.tables,
              contexts: result.contexts,
              units: result.units
            });
          }
        }
      } catch (conversionError) {
        console.error('データ変換エラー:', conversionError instanceof Error ? conversionError.message : String(conversionError));
        
        // 元のテーブルだけを返す
        if (onSuccess) {
          onSuccess({
            processedData: null,
            tables: result.tables,
            contexts: result.contexts,
            units: result.units
          });
        }
      }
    }
    
    // 完了進捗
    if (onProgress) {
      onProgress(100);
    }
  } catch (error) {
    console.error('XBRL抽出エラー:', error instanceof Error ? error.message : String(error));
    
    if (onError) {
      onError(`XBRL抽出エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
