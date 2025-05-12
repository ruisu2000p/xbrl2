import { XBRLData, FinancialStatement, FinancialItem, Context, Unit } from '../../types/xbrl';

/**
 * データベース接続とXBRLデータの保存を管理するサービス
 * 現在はローカルストレージを使用していますが、実際のデータベースに置き換えることができます
 */
export class DatabaseService {
  private static DB_KEY_PREFIX = 'xbrl_data_';
  private static COMPANY_LIST_KEY = 'xbrl_company_list';

  /**
   * XBRLデータをデータベースに保存します
   * @param xbrlData 保存するXBRLデータ
   * @returns 保存が成功したかどうか
   */
  public static saveXBRLData(xbrlData: XBRLData): boolean {
    try {
      const companyId = this.getCompanyIdentifier(xbrlData);
      if (!companyId) {
        console.error('会社識別子が見つかりません。データを保存できません。');
        return false;
      }

      const dataString = JSON.stringify(xbrlData);
      
      localStorage.setItem(`${this.DB_KEY_PREFIX}${companyId}`, dataString);
      
      this.updateCompanyList(companyId, xbrlData.companyInfo.name || '名称不明');
      
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
  public static getXBRLData(companyId: string): XBRLData | null {
    try {
      const dataString = localStorage.getItem(`${this.DB_KEY_PREFIX}${companyId}`);
      if (!dataString) {
        return null;
      }
      
      return JSON.parse(dataString) as XBRLData;
    } catch (error) {
      console.error('XBRLデータの取得中にエラーが発生しました:', error);
      return null;
    }
  }

  /**
   * 保存されているすべての会社のリストを取得します
   * @returns 会社IDと名前のマップ
   */
  public static getCompanyList(): Map<string, string> {
    try {
      const listString = localStorage.getItem(this.COMPANY_LIST_KEY);
      if (!listString) {
        return new Map<string, string>();
      }
      
      return new Map<string, string>(JSON.parse(listString));
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
  public static deleteXBRLData(companyId: string): boolean {
    try {
      localStorage.removeItem(`${this.DB_KEY_PREFIX}${companyId}`);
      
      const companyList = this.getCompanyList();
      companyList.delete(companyId);
      localStorage.setItem(this.COMPANY_LIST_KEY, JSON.stringify(Array.from(companyList.entries())));
      
      console.log(`XBRLデータを削除しました: ${companyId}`);
      return true;
    } catch (error) {
      console.error('XBRLデータの削除中にエラーが発生しました:', error);
      return false;
    }
  }

  /**
   * 会社リストを更新します
   * @param companyId 会社識別子
   * @param companyName 会社名
   */
  private static updateCompanyList(companyId: string, companyName: string): void {
    const companyList = this.getCompanyList();
    companyList.set(companyId, companyName);
    localStorage.setItem(this.COMPANY_LIST_KEY, JSON.stringify(Array.from(companyList.entries())));
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
   * データベースの初期化（実際のデータベースを使用する場合に実装）
   */
  public static initDatabase(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('データベース接続を初期化しました（ローカルストレージ使用中）');
      resolve(true);
    });
  }

  /**
   * データベースの接続を閉じる（実際のデータベースを使用する場合に実装）
   */
  public static closeDatabase(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('データベース接続を閉じました（ローカルストレージ使用中）');
      resolve(true);
    });
  }
}

/**
 * 実際のデータベースを使用する場合のスキーマ設計（参考）
 * 
 * テーブル: companies
 * - id: 主キー
 * - name: 会社名
 * - ticker: 証券コード
 * - fiscal_year: 会計年度
 * - end_date: 決算日
 * - created_at: 作成日時
 * - updated_at: 更新日時
 * 
 * テーブル: contexts
 * - id: 主キー
 * - company_id: 外部キー（companies.id）
 * - context_id: XBRLコンテキストID
 * - instant: 特定時点
 * - start_date: 期間開始日
 * - end_date: 期間終了日
 * - scenario: シナリオ情報
 * 
 * テーブル: units
 * - id: 主キー
 * - company_id: 外部キー（companies.id）
 * - unit_id: XBRL単位ID
 * - measure: 単位
 * 
 * テーブル: financial_statements
 * - id: 主キー
 * - company_id: 外部キー（companies.id）
 * - type: 財務諸表の種類（bs, pl, cf, other）
 * 
 * テーブル: financial_items
 * - id: 主キー
 * - statement_id: 外部キー（financial_statements.id）
 * - item_id: 項目ID
 * - name: 項目名
 * - name_ja: 項目名（日本語）
 * - is_total: 合計行かどうか
 * 
 * テーブル: financial_values
 * - id: 主キー
 * - item_id: 外部キー（financial_items.id）
 * - value: 値
 * - context_id: 外部キー（contexts.id）
 * - unit_id: 外部キー（units.id）
 * - decimals: 小数点以下桁数
 */
