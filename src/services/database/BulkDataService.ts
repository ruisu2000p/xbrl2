import { XBRLData } from '../../types/xbrl';
import { UnifiedDatabaseService } from './UnifiedDatabaseService';

export interface BulkImportResult {
  totalFiles: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ fileName: string; error: string }>;
  duration: number;
}

export interface BulkImportProgress {
  current: number;
  total: number;
  currentFile: string;
  successCount: number;
  errorCount: number;
}

export class BulkDataService {
  private static readonly BATCH_SIZE = 10;
  private static readonly DELAY_BETWEEN_BATCHES = 100;

  public static async bulkImportXBRLData(
    dataArray: Array<{ fileName: string; xbrlData: XBRLData }>,
    onProgress?: (progress: BulkImportProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<BulkImportResult> {
    const startTime = Date.now();
    const result: BulkImportResult = {
      totalFiles: dataArray.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      duration: 0
    };

    for (let i = 0; i < dataArray.length; i += this.BATCH_SIZE) {
      if (abortSignal?.aborted) {
        break;
      }

      const batch = dataArray.slice(i, i + this.BATCH_SIZE);
      
      await Promise.all(
        batch.map(async ({ fileName, xbrlData }, batchIndex) => {
          const currentIndex = i + batchIndex;
          
          try {
            onProgress?.({
              current: currentIndex + 1,
              total: dataArray.length,
              currentFile: fileName,
              successCount: result.successCount,
              errorCount: result.errorCount
            });

            const success = await UnifiedDatabaseService.saveXBRLData(xbrlData);
            
            if (success) {
              result.successCount++;
            } else {
              result.errorCount++;
              result.errors.push({
                fileName,
                error: 'データベース保存に失敗しました'
              });
            }
          } catch (error) {
            result.errorCount++;
            result.errors.push({
              fileName,
              error: error instanceof Error ? error.message : '不明なエラー'
            });
          }
        })
      );

      if (i + this.BATCH_SIZE < dataArray.length) {
        await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_BATCHES));
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  public static async bulkDeleteXBRLData(
    companyIds: string[],
    onProgress?: (current: number, total: number) => void,
    abortSignal?: AbortSignal
  ): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
    const result = {
      successCount: 0,
      errorCount: 0,
      errors: [] as string[]
    };

    for (let i = 0; i < companyIds.length; i++) {
      if (abortSignal?.aborted) {
        break;
      }

      const companyId = companyIds[i];
      onProgress?.(i + 1, companyIds.length);

      try {
        const success = await UnifiedDatabaseService.deleteXBRLData(companyId);
        if (success) {
          result.successCount++;
        } else {
          result.errorCount++;
          result.errors.push(`${companyId}: 削除に失敗しました`);
        }
      } catch (error) {
        result.errorCount++;
        result.errors.push(`${companyId}: ${error instanceof Error ? error.message : '不明なエラー'}`);
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return result;
  }

  public static async getAllCompaniesWithData(): Promise<Array<{ id: string; name: string; xbrlData: XBRLData }>> {
    try {
      const companyList = await UnifiedDatabaseService.getCompanyList();
      const companies: Array<{ id: string; name: string; xbrlData: XBRLData }> = [];

      for (const [companyId, companyName] of Array.from(companyList.entries())) {
        try {
          const xbrlData = await UnifiedDatabaseService.getXBRLData(companyId);
          if (xbrlData) {
            companies.push({
              id: companyId,
              name: companyName,
              xbrlData
            });
          }
        } catch (error) {
          console.warn(`企業データの取得に失敗: ${companyId}`, error);
        }
      }

      return companies;
    } catch (error) {
      console.error('全企業データの取得に失敗しました:', error);
      return [];
    }
  }

  public static async getCompanyDataByIds(companyIds: string[]): Promise<Array<{ id: string; xbrlData: XBRLData }>> {
    const companies: Array<{ id: string; xbrlData: XBRLData }> = [];

    for (const companyId of companyIds) {
      try {
        const xbrlData = await UnifiedDatabaseService.getXBRLData(companyId);
        if (xbrlData) {
          companies.push({ id: companyId, xbrlData });
        }
      } catch (error) {
        console.warn(`企業データの取得に失敗: ${companyId}`, error);
      }
    }

    return companies;
  }

  public static async searchCompaniesByName(query: string): Promise<Map<string, string>> {
    try {
      const allCompanies = await UnifiedDatabaseService.getCompanyList();
      const filteredCompanies = new Map<string, string>();

      for (const [id, name] of Array.from(allCompanies.entries())) {
        if (name.toLowerCase().includes(query.toLowerCase())) {
          filteredCompanies.set(id, name);
        }
      }

      return filteredCompanies;
    } catch (error) {
      console.error('企業検索に失敗しました:', error);
      return new Map<string, string>();
    }
  }

  public static async getDatabaseStats(): Promise<{
    totalCompanies: number;
    totalDataSize: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    try {
      const companyList = await UnifiedDatabaseService.getCompanyList();
      
      return {
        totalCompanies: companyList.size,
        totalDataSize: 0,
        oldestEntry: null,
        newestEntry: null
      };
    } catch (error) {
      console.error('データベース統計の取得に失敗しました:', error);
      return {
        totalCompanies: 0,
        totalDataSize: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  }
}
