import { XBRLData } from '../../types/xbrl';
import { DatabaseService as LocalStorageDB } from './DatabaseService';
import { IndexedDBService } from './IndexedDBService';

/**
 * データベースの種類
 */
export enum DatabaseType {
  LocalStorage = 'localStorage',
  IndexedDB = 'indexedDB'
}

/**
 * 統合データベースサービス
 * LocalStorageとIndexedDBの両方をサポートし、切り替え可能
 */
export class UnifiedDatabaseService {
  private static currentType: DatabaseType = DatabaseType.IndexedDB;

  /**
   * 使用するデータベースの種類を設定
   * @param type データベースの種類
   */
  public static setDatabaseType(type: DatabaseType): void {
    this.currentType = type;
    console.log(`データベースタイプを${type}に設定しました`);
  }

  /**
   * 現在のデータベースの種類を取得
   * @returns データベースの種類
   */
  public static getDatabaseType(): DatabaseType {
    return this.currentType;
  }

  /**
   * XBRLデータをデータベースに保存
   * @param xbrlData 保存するXBRLデータ
   * @returns 保存が成功したかどうかのPromise
   */
  public static async saveXBRLData(xbrlData: XBRLData): Promise<boolean> {
    if (this.currentType === DatabaseType.IndexedDB) {
      return await IndexedDBService.saveXBRLData(xbrlData);
    } else {
      return LocalStorageDB.saveXBRLData(xbrlData);
    }
  }

  /**
   * 指定された会社のXBRLデータを取得
   * @param companyId 会社識別子
   * @returns XBRLデータ、存在しない場合はnull
   */
  public static async getXBRLData(companyId: string): Promise<XBRLData | null> {
    if (this.currentType === DatabaseType.IndexedDB) {
      return await IndexedDBService.getXBRLData(companyId);
    } else {
      return LocalStorageDB.getXBRLData(companyId);
    }
  }

  /**
   * 保存されているすべての会社のリストを取得
   * @returns 会社IDと名前のマップ
   */
  public static async getCompanyList(): Promise<Map<string, string>> {
    if (this.currentType === DatabaseType.IndexedDB) {
      return await IndexedDBService.getCompanyList();
    } else {
      return LocalStorageDB.getCompanyList();
    }
  }

  /**
   * 指定された会社のXBRLデータを削除
   * @param companyId 会社識別子
   * @returns 削除が成功したかどうかのPromise
   */
  public static async deleteXBRLData(companyId: string): Promise<boolean> {
    if (this.currentType === DatabaseType.IndexedDB) {
      return await IndexedDBService.deleteXBRLData(companyId);
    } else {
      return LocalStorageDB.deleteXBRLData(companyId);
    }
  }

  /**
   * データベースを初期化
   * @returns 初期化が成功したかどうかのPromise
   */
  public static async initDatabase(): Promise<boolean> {
    if (this.currentType === DatabaseType.IndexedDB) {
      const result = await IndexedDBService.initDatabase();
      
      if (result) {
        await this.migrateFromLocalStorage();
      }
      
      return result;
    } else {
      return true; // LocalStorageは初期化不要
    }
  }

  /**
   * データベース接続を閉じる
   * @returns 成功したかどうかのPromise
   */
  public static async closeDatabase(): Promise<boolean> {
    if (this.currentType === DatabaseType.IndexedDB) {
      return await IndexedDBService.closeDatabase();
    } else {
      return true; // LocalStorageは接続を閉じる必要なし
    }
  }

  /**
   * LocalStorageからIndexedDBへデータを移行
   * @returns 移行が成功したかどうかのPromise
   */
  public static async migrateFromLocalStorage(): Promise<boolean> {
    return await IndexedDBService.migrateFromLocalStorage();
  }
}
