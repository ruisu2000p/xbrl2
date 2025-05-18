import fs from 'fs';
import { xml2js } from 'xml-js';
import Database from 'better-sqlite3';
import { XBRLData, StatementType, FinancialStatement, FinancialItem, FinancialValue, Context, Unit } from '../src/types/xbrl';

// Simple text extraction from xml-js element
const extractTextContent = (element: any): string => {
  if (!element) return '';
  if (typeof element === 'string') return element;
  if (typeof element === 'object') {
    if (element._text !== undefined) return String(element._text);
    if (Array.isArray(element) && element.length > 0 && element[0]._text !== undefined) {
      return String(element[0]._text);
    }
  }
  return '';
};

const processContexts = (xbrlRoot: any, xbrlData: XBRLData): void => {
  const contexts = xbrlRoot['xbrli:context'] || xbrlRoot['context'] || [];
  const contextArray = Array.isArray(contexts) ? contexts : [contexts];
  contextArray.forEach(ctx => {
    if (!ctx || !ctx._attributes) return;
    const contextId = ctx._attributes.id;
    const context: Context = { id: contextId };
    const period = ctx['xbrli:period'] || ctx['period'];
    if (period) {
      if (period['xbrli:instant'] || period['instant']) {
        context.instant = extractTextContent(period['xbrli:instant'] || period['instant']);
      } else if ((period['xbrli:startDate'] || period['startDate']) && (period['xbrli:endDate'] || period['endDate'])) {
        context.startDate = extractTextContent(period['xbrli:startDate'] || period['startDate']);
        context.endDate = extractTextContent(period['xbrli:endDate'] || period['endDate']);
      }
    }
    const scenario = ctx['xbrli:scenario'] || ctx['scenario'];
    if (scenario) {
      context.scenario = JSON.stringify(scenario);
    }
    xbrlData.contexts[contextId] = context;
  });
};

const processUnits = (xbrlRoot: any, xbrlData: XBRLData): void => {
  const units = xbrlRoot['xbrli:unit'] || xbrlRoot['unit'] || [];
  const unitArray = Array.isArray(units) ? units : [units];
  unitArray.forEach(unit => {
    if (!unit || !unit._attributes) return;
    const unitId = unit._attributes.id;
    let measure = '';
    if (unit['xbrli:measure'] || unit['measure']) {
      measure = extractTextContent(unit['xbrli:measure'] || unit['measure']);
    } else if ((unit['xbrli:divide'] || unit['divide'])) {
      const divide = unit['xbrli:divide'] || unit['divide'];
      const numerator = extractTextContent(divide['xbrli:unitNumerator'] || divide['unitNumerator']);
      const denominator = extractTextContent(divide['xbrli:unitDenominator'] || divide['unitDenominator']);
      measure = `${numerator}/${denominator}`;
    }
    xbrlData.units[unitId] = { id: unitId, measure };
  });
};

const processCompanyInfo = (xbrlRoot: any, xbrlData: XBRLData): void => {
  for (const key in xbrlRoot) {
    if (key.includes('CompanyName') && xbrlRoot[key]) {
      xbrlData.companyInfo.name = extractTextContent(xbrlRoot[key]);
      break;
    }
  }
  for (const key in xbrlRoot) {
    if ((key.includes('SecurityCode') || key.includes('TickerSymbol')) && xbrlRoot[key]) {
      xbrlData.companyInfo.ticker = extractTextContent(xbrlRoot[key]);
      break;
    }
  }
  for (const key in xbrlRoot) {
    if (key.includes('FiscalYear') || key.includes('AccountingPeriod')) {
      xbrlData.companyInfo.fiscalYear = extractTextContent(xbrlRoot[key]);
      break;
    }
  }
  for (const key in xbrlRoot) {
    if (key.includes('CurrentFiscalYearEndDate') || key.includes('AccountingPeriodEndDate')) {
      xbrlData.companyInfo.endDate = extractTextContent(xbrlRoot[key]);
      break;
    }
  }
};

const processFinancialData = (xbrlRoot: any, xbrlData: XBRLData): void => {
  const balanceSheetPatterns = ['Equity', 'Asset', 'Liability', 'NetAssets', 'BalanceSheet'];
  const incomeStatementPatterns = ['OperatingIncome', 'Revenue', 'Income', 'Loss', 'Expense', 'ProfitLoss', 'IncomeStatement'];
  const cashFlowPatterns = ['CashFlow', 'Cash'];

  for (const key in xbrlRoot) {
    if (key.startsWith('_') || key.includes('context') || key.includes('unit')) {
      continue;
    }
    const element = xbrlRoot[key];
    if (!element || typeof element !== 'object' || !element._attributes) {
      continue;
    }
    const itemId = key;
    const itemName = key.includes(':') ? key.split(':')[1] : key;
    const contextRef = element._attributes.contextRef;
    const unitRef = element._attributes.unitRef;
    const decimals = element._attributes.decimals;
    const value = extractTextContent(element);
    if (!value || !contextRef) {
      continue;
    }
    let statementType = StatementType.Other;
    if (balanceSheetPatterns.some(p => itemName.includes(p))) {
      statementType = StatementType.BalanceSheet;
    } else if (incomeStatementPatterns.some(p => itemName.includes(p))) {
      statementType = StatementType.IncomeStatement;
    } else if (cashFlowPatterns.some(p => itemName.includes(p))) {
      statementType = StatementType.CashFlow;
    }
    const financialValue: FinancialValue = { value, contextRef, unit: unitRef, decimals };
    const existingIndex = xbrlData.statements[statementType].items.findIndex(i => i.id === itemId);
    if (existingIndex !== -1) {
      xbrlData.statements[statementType].items[existingIndex].values.push(financialValue);
    } else {
      const financialItem: FinancialItem = { id: itemId, name: itemName, values: [financialValue] };
      xbrlData.statements[statementType].items.push(financialItem);
    }
  }
};

const processXBRLData = (data: any): XBRLData => {
  const xbrlData: XBRLData = {
    companyInfo: {},
    contexts: {},
    units: {},
    statements: {
      [StatementType.BalanceSheet]: { type: StatementType.BalanceSheet, items: [] },
      [StatementType.IncomeStatement]: { type: StatementType.IncomeStatement, items: [] },
      [StatementType.CashFlow]: { type: StatementType.CashFlow, items: [] },
      [StatementType.Other]: { type: StatementType.Other, items: [] }
    }
  };

  const xbrlRoot = data['xbrl'] || data['xbrli:xbrl'] || Object.values(data)[0];
  if (!xbrlRoot) {
    throw new Error('XBRL root element not found');
  }

  processContexts(xbrlRoot, xbrlData);
  processUnits(xbrlRoot, xbrlData);
  processCompanyInfo(xbrlRoot, xbrlData);
  processFinancialData(xbrlRoot, xbrlData);

  return xbrlData;
};

export const parseXBRLContent = (content: string): XBRLData => {
  const result = xml2js(content, { compact: true });
  return processXBRLData(result);
};

const getCompanyIdentifier = (xbrlData: XBRLData): string | null => {
  const companyName = xbrlData.companyInfo.name;
  const ticker = xbrlData.companyInfo.ticker;
  const fiscalYear = xbrlData.companyInfo.fiscalYear;
  if (!companyName && !ticker) return null;
  let id = '';
  if (ticker) id += ticker;
  if (companyName) id += (id ? '_' : '') + companyName;
  if (fiscalYear) id += (id ? '_' : '') + fiscalYear;
  return id;
};

const importXbrl = (filePath: string, dbPath: string) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const xbrl = parseXBRLContent(content);
  const companyId = getCompanyIdentifier(xbrl);
  if (!companyId) {
    throw new Error('Company identifier not found');
  }

  const db = new Database(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT,
    ticker TEXT,
    fiscalYear TEXT,
    endDate TEXT
  );`);
  db.exec(`CREATE TABLE IF NOT EXISTS xbrl_data (
    id TEXT PRIMARY KEY,
    data TEXT
  );`);

  const insertCompany = db.prepare('INSERT OR REPLACE INTO companies (id, name, ticker, fiscalYear, endDate) VALUES (?, ?, ?, ?, ?)');
  insertCompany.run(companyId, xbrl.companyInfo.name || '', xbrl.companyInfo.ticker || '', xbrl.companyInfo.fiscalYear || '', xbrl.companyInfo.endDate || '');

  const insertData = db.prepare('INSERT OR REPLACE INTO xbrl_data (id, data) VALUES (?, ?)');
  insertData.run(companyId, JSON.stringify(xbrl));

  console.log(`Imported ${filePath} as ${companyId}`);
};

const [filePath, dbPath = 'xbrl-data.db'] = process.argv.slice(2);
if (!filePath) {
  console.error('Usage: ts-node scripts/importXbrlToDb.ts <xbrl-file> [db-path]');
  process.exit(1);
}
importXbrl(filePath, dbPath);

