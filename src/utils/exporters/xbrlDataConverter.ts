import { XBRLData, FinancialData, CommentSection, StatementType } from '../../types/xbrl';

/**
 * XBRLData を FinancialData 形式に変換するユーティリティ
 * @param xbrlData XBRL 解析結果
 * @param comments 注記情報
 * @returns FinancialData オブジェクト
 */
export const convertXBRLDataToFinancialData = (
  xbrlData: XBRLData,
  comments: CommentSection[] = []
): FinancialData => {
  const financialItems: FinancialData['financialItems'] = [];

  (Object.keys(xbrlData.statements) as StatementType[]).forEach(type => {
    const statement = xbrlData.statements[type];
    statement.items.forEach(item => {
      const first = item.values[0];
      if (!first) return;
      const namespace = item.id.includes(':') ? item.id.split(':')[0] : '';
      financialItems.push({
        name: item.nameJa || item.name,
        namespace,
        contextRef: first.contextRef || '',
        unitRef: first.unit || null,
        decimals: first.decimals || null,
        value: first.value,
        taxonomyElement: {
          id: item.id,
          name: item.name,
          namespace,
          label: item.nameJa || item.name,
          definition: ''
        }
      });
    });
  });

  return {
    contexts: xbrlData.contexts,
    units: xbrlData.units,
    financialItems,
    taxonomyReferences: [],
    comments
  };
};
