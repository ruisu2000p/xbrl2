# TypeScript エラー修正のインストール手順

このドキュメントでは、XBRLアプリケーションのTypeScriptエラーを修正するための手順を説明します。

## 修正手順

### 1. インターフェースの修正ファイルをインストールする

```bash
# 既存のファイルとインターフェース修正ファイルを比較する
diff src/types/extractors/improved-xbrl-types.ts src/types/extractors/improved-xbrl-types-modified.ts

# 新しいインターフェースファイルを使用する
mv src/types/extractors/improved-xbrl-types.ts src/types/extractors/improved-xbrl-types.ts.bak
cp src/types/extractors/improved-xbrl-types-modified.ts src/types/extractors/improved-xbrl-types.ts
```

### 2. 実装ファイルの修正（オプション）

必要に応じて実装ファイルも修正します。ただし、インターフェースの修正だけで問題が解決する場合があります。

```bash
# 必要に応じて実装ファイルを修正する
cp src/utils/xbrl/improved-xbrl-extractor.ts src/utils/xbrl/improved-xbrl-extractor.ts.bak
cp src/utils/xbrl/fixed-improved-xbrl-extractor.ts src/utils/xbrl/improved-xbrl-extractor.ts
```

### 3. 再ビルドして確認

修正を適用した後、アプリケーションを再ビルドして、エラーが解消されたことを確認します。

```bash
yarn build
# または
npm run build
```

エラーが解消されていれば、修正は成功です。

## 修正内容

修正されたインターフェースでは、以下の変更が行われています：

1. `XBRLContextInfo` インターフェース：
   - `id` プロパティをオプションとして追加
   - `entity` と `scheme` を独立した文字列型として定義
   - `memberType` から `'individual'` を除去し `'non_consolidated'` のみ使用
   - `segment` プロパティを追加

2. `XBRLUnitInfo` インターフェース：
   - `id` プロパティをオプションとして追加
   - `symbol` と `name` プロパティを追加

3. `XBRLExtractionOptions` インターフェース：
   - `contextAware` プロパティを追加

これらの変更により、実装コードとインターフェース定義の間の型不一致が解消されます。

## 元に戻す方法

修正が問題を引き起こした場合は、バックアップファイルを使用して元の状態に戻します。

```bash
mv src/types/extractors/improved-xbrl-types.ts.bak src/types/extractors/improved-xbrl-types.ts
mv src/utils/xbrl/improved-xbrl-extractor.ts.bak src/utils/xbrl/improved-xbrl-extractor.ts
```
