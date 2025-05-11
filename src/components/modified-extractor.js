/**
 * XBRL抽出処理の改善版インポート関数
 * 既存の抽出処理に代わり、新しくenhanced-xbrl-extractor.tsのロジックを使用する
 */

// 拡張版XBRL抽出関数をインポート
import { extractEnhancedXBRL } from '../utils/xbrl/enhanced-xbrl-extractor';

/**
 * 拡張版XBRL抽出処理を実行する関数
 * @param {string} htmlContent HTMLコンテンツ
 * @param {Function} onSuccess 成功時のコールバック関数
 * @param {Function} onError エラー時のコールバック関数
 * @param {Function} onProgress 進捗更新のコールバック関数
 */
export function performEnhancedExtraction(htmlContent, onSuccess, onError, onProgress) {
  try {
    // 処理開始
    if (onProgress) {
      onProgress(10);
    }
    
    // 拡張版XBRL抽出を実行
    const result = extractEnhancedXBRL(htmlContent);
    
    // 中間進捗
    if (onProgress) {
      onProgress(50);
    }
    
    // 結果が空でないか確認
    if (result.tables.length === 0) {
      if (onError) {
        onError('XBRL財務テーブルが見つかりませんでした。別のXBRLファイルを試すか、抽出オプションを変更してください。');
      }
      return;
    }
    
    // 処理完了
    if (onProgress) {
      onProgress(100);
    }
    
    // 成功コールバックを呼び出し
    if (onSuccess) {
      onSuccess(result);
    }
  } catch (error) {
    // エラー処理
    if (onError) {
      onError(`XBRL抽出エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
