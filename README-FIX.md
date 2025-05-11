# XBRL アプリケーションの型エラー修正

## 概要

このプロジェクトには、TypeScript の型エラーがいくつか存在します。これらのエラーは、実装コードとインターフェース定義の間の不一致によるものです。このドキュメントでは、エラーの内容とその修正方法について説明します。

## 検出されたエラー

現在のコードベースには次のようなエラーがあります：

1. `entity` 型の不一致:
   - インターフェース: `string`
   - 実装: `{ identifier: string; scheme: string; }`

2. `memberType` 型の不一致:
   - インターフェース: `'consolidated' | 'unknown' | 'non_consolidated'`
   - 実装: `'consolidated' | 'individual' | 'unknown'`

3. `XBRLUnitInfo` インターフェースの不足:
   - インターフェースに `id` プロパティがないが、実装で使用されている

4. `tableType` 型の不一致:
   - インターフェース: 列挙型 (`'unknown' | 'balance_sheet' | 'income_statement' | 'cash_flow' | 'shareholder'`)
   - 実装: 文字列型 (`string`)

## 修正ファイル

このリポジトリには、以下の修正ファイルが含まれています：

- `src/fixes/TypeFixes.md`: エラーの詳細と修正アプローチの説明
- `src/fixes/InstallFixes.md`: 修正を適用するための手順
- `src/types/extractors/improved-xbrl-types-modified.ts`: 修正されたインターフェース定義

## 修正の適用方法

修正を適用するには、以下の手順に従ってください：

1. `src/types/extractors/improved-xbrl-types.ts` を修正版のファイルで置き換える:

```bash
cp src/types/extractors/improved-xbrl-types-modified.ts src/types/extractors/improved-xbrl-types.ts
```

2. アプリケーションを再ビルドする:

```bash
yarn build
# または
npm run build
```

より詳細な手順については、`src/fixes/InstallFixes.md` を参照してください。

## 修正のアプローチ

この修正では、以下のアプローチを採用しています：

1. インターフェース定義を実装コードに合わせる
2. オプションのプロパティを追加してインターフェースを拡張する
3. 型の互換性を維持するための変更を最小限に抑える

これにより、既存のコードの変更を最小限に抑えながら、型エラーを解消することができます。

## 注意点

この修正は、現在のコードベースに合わせたものであり、将来的なコード変更によっては再度調整が必要になる可能性があります。長期的には、インターフェースと実装の間で一貫した型定義を維持することをお勧めします。
