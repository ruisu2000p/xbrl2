# XBRLアプリケーションの型エラー修正ガイド

このドキュメントは、XBRLファイルアプリケーションの TypeScript 型エラーを修正するためのガイドです。

## 検出されたエラー

以下のエラーがコンパイラから報告されています：

1. `entity` 型が不一致: `{ identifier: string; scheme: string; }` が `string` に割り当てられていません
2. `memberType` 型が不一致: `"individual"` が `"consolidated" | "unknown" | "non_consolidated"` に割り当てられていません
3. `XBRLUnitInfo` インターフェースに `id` プロパティが存在しません
4. `tableType` 型が不一致: `string` が `"unknown" | "balance_sheet" | "income_statement" | "cash_flow" | "shareholder"` に割り当てられていません

## 修正方法

修正方法は以下の2つのアプローチがあります：

### 1. インターフェースの修正

`src/types/extractors/improved-xbrl-types.ts` ファイルを修正します：

```typescript
/**
 * XBRLコンテキスト情報の型定義を修正
 */
export interface XBRLContextInfo {
  id?: string; // IDを追加
  periodType: 'instant' | 'duration' | 'unknown';
  instant: string | null;
  startDate: string | null;
  endDate: string | null;
  entity: string | null;  // schemeと分離
  scheme: string | null;  // entityと分離
  explicitMember: {
    dimension: string | null;
    value: string | null;
  } | null;
  fiscalYear: 'current' | 'previous' | 'unknown';
  isCurrentPeriod: boolean;
  isPreviousPeriod: boolean;
  memberType: 'consolidated' | 'non_consolidated' | 'unknown';  // 'individual'を'non_consolidated'に変更
  memberValue: string | null;
  segment?: Record<string, string>; // セグメント情報を追加
}

/**
 * XBRL単位情報の型定義を修正
 */
export interface XBRLUnitInfo {
  id?: string; // IDを追加
  type: 'simple' | 'fraction';
  measure?: string;
  numerator?: string;
  denominator?: string;
  displayLabel: string;
  symbol?: string; // 追加的な表示用シンボル
  name?: string; // 追加的な名称
}
```

### 2. 実装ファイルの修正

`src/utils/xbrl/improved-xbrl-extractor.ts` を修正します：

- `entity` オブジェクトの代わりに、`entity`と`scheme`を別々の文字列として保存します
- `'individual'` の代わりに `'non_consolidated'` を使用します
- `id` プロパティを削除するか、オプションとして扱います
- 文字列型の `tableType` を常に正しい列挙型として指定します

## 推奨アプローチ

インターフェースの修正が一番シンプルです。これにより、実装コードを変更する必要がなくなります。

コードベースの全体的な整合性を保つためには、両方のファイルを並行して変更することを検討してください。

## 修正後の確認

修正を適用した後、以下のコマンドを実行して、エラーが解消されたことを確認してください：

```bash
yarn build
# or
npm run build
```

エラーが解消されない場合は、より詳細なエラーメッセージを参照して追加の修正を行ってください。
