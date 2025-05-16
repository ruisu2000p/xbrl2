import { XBRLData, FinancialStatement, CompanyInfo, Context, Unit, StatementType } from '../../types/xbrl';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DatabaseService as LocalStorageDB } from './DatabaseService';

/**
 * IndexedDBデータベーススキーマの定義
 */
interface XBRLDBSchema extends DBSchema {
  companies: {
    key: string;
    value: {
      id: string;
      name: string;
      ticker?: string;
      fiscalYear?: string;
      endDate?: string;
      createdAt: number;
    };
    indexes: {
      'by-name': string;
      'by-ticker': string;
    };
  };
  xbrlData: {
    key: string;
    value: XBRLData;
  };
}

/**
 * IndexedDBを使用したXBRLデータの保存と取得を管理するサービス
 */
export class IndexedDBService {
  private static DB_NAME = 'xbrl-analysis-db';
  private static DB_VERSION = 1;
  private static instance: IDBPDatabase<XBRLDBSchema> | null = null;

  /**
   * データベース接続を初期化する
   * @returns データベース接続インスタンス
   */
  private static async getDBInstance(): Promise<IDBPDatabase<XBRLDBSchema>> {
    if (this.instance) {
      return this.instance;
    }

    try {
      this.instance = await openDB<XBRLDBSchema>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('companies')) {
            const companyStore = db.createObjectStore('companies', { keyPath: 'id' });
            companyStore.createIndex('by-name', 'name');
            companyStore.createIndex('by-ticker', 'ticker');
          }

          if (!db.objectStoreNames.contains('xbrlData')) {
            db.createObjectStore('xbrlData', { keyPath: 'id' });
          }
        },
      });

      return this.instance;
    } catch (error) {
      console.error('IndexedDBの初期化中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * XBRLデータをデータベースに保存します
   * @param xbrlData 保存するXBRLデータ
   * @returns 保存が成功したかどうか
   */
  public static async saveXBRLData(xbrlData: XBRLData): Promise<boolean> {
    try {
      const companyId = this.getCompanyIdentifier(xbrlData);
      if (!companyId) {
        console.error('会社識別子が見つかりません。データを保存できません。');
        return false;
      }

      const db = await this.getDBInstance();

      const companyInfo = {
        id: companyId,
        name: xbrlData.companyInfo.name || '名称不明',
        ticker: xbrlData.companyInfo.ticker,
        fiscalYear: xbrlData.companyInfo.fiscalYear,
        endDate: xbrlData.companyInfo.endDate,
        createdAt: Date.now(),
      };

      await db.put('companies', companyInfo);

      await db.put('xbrlData', xbrlData, companyId);

      console.log(`XBRLデータを保存しました: ${companyId}`);
      return true;
    } catch (error) {
      console.error('XBRLデータの保存中にエラーが発生しました:', error);
      return false;
    }
  }

  /**
   * 指定された会社のXBRLデータをデータベースから取得します
   * @param companyId 会社識別子
   * @returns 取得したXBRLデータ、存在しない場合はnull
   */
  public static async getXBRLData(companyId: string): Promise<XBRLData | null> {
    try {
      const db = await this.getDBInstance();
      const data = await db.get('xbrlData', companyId);
      
      if (!data) {
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('XBRLデータの取得中にエラーが発生しました:', error);
      return null;
    }
  }

  /**
   * 保存されているすべての会社のリストを取得します
   * @returns 会社IDと名前のマップ
   */
  public static async getCompanyList(): Promise<Map<string, string>> {
    try {
      const db = await this.getDBInstance();
      const companies = await db.getAll('companies');
      
      const companyMap = new Map<string, string>();
      companies.forEach(company => {
        companyMap.set(company.id, company.name);
      });
      
      return companyMap;
    } catch (error) {
      console.error('会社リストの取得中にエラーが発生しました:', error);
      return new Map<string, string>();
    }
  }

  /**
   * 指定された会社のXBRLデータをデータベースから削除します
   * @param companyId 会社識別子
   * @returns 削除が成功したかどうか
   */
  public static async deleteXBRLData(companyId: string): Promise<boolean> {
    try {
      const db = await this.getDBInstance();
      
      await db.delete('companies', companyId);
      
      await db.delete('xbrlData', companyId);
      
      console.log(`XBRLデータを削除しました: ${companyId}`);
      return true;
    } catch (error) {
      console.error('XBRLデータの削除中にエラーが発生しました:', error);
      return false;
    }
  }

  /**
   * XBRLデータから会社識別子を取得します
   * @param xbrlData XBRLデータ
   * @returns 会社識別子
   */
  private static getCompanyIdentifier(xbrlData: XBRLData): string | null {
    const companyName = xbrlData.companyInfo.name;
    const ticker = xbrlData.companyInfo.ticker;
    const fiscalYear = xbrlData.companyInfo.fiscalYear;
    
    if (!companyName && !ticker) {
      return null;
    }
    
    let identifier = '';
    
    if (ticker) {
      identifier += ticker;
    }
    
    if (companyName) {
      identifier += (identifier ? '_' : '') + companyName;
    }
    
    if (fiscalYear) {
      identifier += (identifier ? '_' : '') + fiscalYear;
    }
    
    return identifier;
  }

  /**
   * LocalStorageからデータを移行します
   * @returns 移行が成功したかどうか
   */
  public static async migrateFromLocalStorage(): Promise<boolean> {
    try {
      console.log('LocalStorageからIndexedDBへのデータ移行を開始します...');
      
      const companyList = LocalStorageDB.getCompanyList();
      
      let migratedCount = 0;
      
      const entries = Array.from(companyList.entries());
      for (const [companyId, companyName] of entries) {
        const xbrlData = LocalStorageDB.getXBRLData(companyId);
        
        if (xbrlData) {
          await this.saveXBRLData(xbrlData);
          migratedCount++;
        }
      }
      
      console.log(`データ移行が完了しました。移行された企業数: ${migratedCount}`);
      return true;
    } catch (error) {
      console.error('データ移行中にエラーが発生しました:', error);
      return false;
    }
  }

  /**
   * データベースの初期化
   */
  public static async initDatabase(): Promise<boolean> {
    try {
      await this.getDBInstance();
      console.log('IndexedDBデータベースが初期化されました');
      return true;
    } catch (error) {
      console.error('IndexedDBデータベースの初期化に失敗しました:', error);
      return false;
    }
  }

  /**
   * データベースの接続を閉じる
   */
  public static async closeDatabase(): Promise<boolean> {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
      console.log('IndexedDBデータベース接続を閉じました');
    }
    return true;
  }

  /**
   * データベースの削除
   */
  public static async deleteDatabase(): Promise<boolean> {
    try {
      if (this.instance) {
        this.instance.close();
        this.instance = null;
      }
      
      await indexedDB.deleteDatabase(this.DB_NAME);
      console.log('IndexedDBデータベースが削除されました');
      return true;
    } catch (error) {
      console.error('IndexedDBデータベースの削除に失敗しました:', error);
      return false;
    }
  }
}
