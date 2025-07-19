import React, { useState, useRef } from 'react';
import { XBRLData, StatementType } from '../types/xbrl';
import { parseXBRLFile } from '../utils/xbrlParser';
import { UnifiedDatabaseService } from '../services/database/UnifiedDatabaseService';

interface BatchImporterProps {
  onImportComplete: (importedCount: number) => void;
  onProgress?: (current: number, total: number) => void;
}

interface ImportProgress {
  current: number;
  total: number;
  currentFile: string;
  errors: string[];
}

const BatchImporter: React.FC<BatchImporterProps> = ({ onImportComplete, onProgress }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    currentFile: '',
    errors: []
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    await processFiles(Array.from(files));
  };

  const processFiles = async (files: File[]) => {
    setIsImporting(true);
    abortControllerRef.current = new AbortController();
    
    const initialProgress: ImportProgress = {
      current: 0,
      total: files.length,
      currentFile: '',
      errors: []
    };
    setProgress(initialProgress);

    let successCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        const file = files[i];
        const currentProgress = {
          current: i + 1,
          total: files.length,
          currentFile: file.name,
          errors: [...errors]
        };
        setProgress(currentProgress);
        onProgress?.(i + 1, files.length);

        try {
          let xbrlData: XBRLData;
          
          if (file.name.toLowerCase().endsWith('.md')) {
            xbrlData = await parseMarkdownFile(file);
          } else {
            xbrlData = await parseXBRLFile(file);
          }

          const saved = await UnifiedDatabaseService.saveXBRLData(xbrlData);
          if (saved) {
            successCount++;
          } else {
            errors.push(`${file.name}: データベース保存に失敗`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー';
          errors.push(`${file.name}: ${errorMessage}`);
        }

        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error('バッチインポート中にエラーが発生しました:', error);
    }

    setProgress(prev => ({ ...prev, errors }));
    setIsImporting(false);
    onImportComplete(successCount);
  };

  const parseMarkdownFile = async (file: File): Promise<XBRLData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const xbrlData = parseMarkdownToXBRL(content, file.name);
          resolve(xbrlData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
      reader.readAsText(file);
    });
  };

  const parseMarkdownToXBRL = (content: string, fileName: string): XBRLData => {
    const lines = content.split('\n');
    
    let companyName = '';
    let fiscalYear = '';
    let businessOverview = '';
    
    for (const line of lines) {
      if (line.includes('【会社名】')) {
        const match = line.match(/【会社名】\s*\|\s*(.+?)\s*\|/);
        if (match) companyName = match[1].trim();
      }
      if (line.includes('【事業年度】')) {
        const match = line.match(/第(\d+)期/);
        if (match) fiscalYear = `第${match[1]}期`;
      }
      if (line.includes('株式会社') && !companyName && line.length < 100) {
        const match = line.match(/([^\|]*株式会社[^\|]*)/);
        if (match) {
          const name = match[1].trim();
          if (name.length < 50 && !name.includes('。') && !name.includes('、')) {
            companyName = name;
          }
        }
      }
      if (!companyName && line.includes('会社名') && line.includes('|')) {
        const match = line.match(/\|\s*([^|]+株式会社[^|]*)\s*\|/);
        if (match) {
          const name = match[1].trim();
          if (name.length < 50) {
            companyName = name;
          }
        }
      }
    }

    const overviewSections = [
      '事業の内容',
      '経営方針',
      '事業概要',
      '主要な事業',
      'ビジネスモデル'
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const section of overviewSections) {
        if (line.includes(section) && !businessOverview) {
          const overviewLines = [];
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const nextLine = lines[j].trim();
            if (nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('|')) {
              overviewLines.push(nextLine);
              if (overviewLines.length >= 3) break;
            }
          }
          businessOverview = overviewLines.join(' ').substring(0, 200) + '...';
          break;
        }
      }
      if (businessOverview) break;
    }

    if (!companyName) {
      const fileBaseName = fileName.replace(/\.(md|MD)$/, '');
      if (fileBaseName.length < 20) {
        companyName = fileBaseName;
      } else {
        companyName = `企業_${fileBaseName.substring(0, 10)}`;
      }
    }

    const financialData = extractFinancialDataFromMarkdown(content);

    const contexts = {
      'current': {
        id: 'current',
        period: { startDate: '', endDate: new Date().toISOString().split('T')[0] },
        entity: { identifier: companyName }
      }
    };

    const units = {
      'JPY': { id: 'JPY', measure: 'iso4217:JPY' },
      'shares': { id: 'shares', measure: 'shares' }
    };

    return {
      companyInfo: {
        name: companyName,
        fiscalYear: fiscalYear || '不明',
        endDate: new Date().toISOString().split('T')[0],
        businessOverview: businessOverview || '事業概要情報が見つかりませんでした'
      },
      contexts,
      units,
      statements: {
        bs: { 
          type: StatementType.BalanceSheet, 
          items: financialData.balanceSheetItems 
        },
        pl: { 
          type: StatementType.IncomeStatement, 
          items: financialData.incomeStatementItems 
        },
        cf: { 
          type: StatementType.CashFlow, 
          items: financialData.cashFlowItems 
        },
        other: { 
          type: StatementType.Other, 
          items: financialData.otherItems 
        }
      }
    };
  };

  const extractFinancialDataFromMarkdown = (content: string) => {
    const lines = content.split('\n');
    const balanceSheetItems: any[] = [];
    const incomeStatementItems: any[] = [];
    const cashFlowItems: any[] = [];
    const otherItems: any[] = [];

    const financialPatterns = [
      { pattern: /売上高[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '売上高', nameJa: '売上高', type: 'income', priority: 1 },
      { pattern: /営業利益[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '営業利益', nameJa: '営業利益', type: 'income', priority: 2 },
      { pattern: /経常利益[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '経常利益', nameJa: '経常利益', type: 'income', priority: 3 },
      { pattern: /当期純利益[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '当期純利益', nameJa: '当期純利益', type: 'income', priority: 4 },
      { pattern: /親会社株主に帰属する当期純利益[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '親会社株主に帰属する当期純利益', nameJa: '親会社株主に帰属する当期純利益', type: 'income', priority: 5 },
      { pattern: /総資産[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '総資産', nameJa: '総資産', type: 'balance', priority: 1 },
      { pattern: /純資産[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '純資産', nameJa: '純資産', type: 'balance', priority: 2 },
      { pattern: /自己資本[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '自己資本', nameJa: '自己資本', type: 'balance', priority: 3 },
      { pattern: /営業キャッシュ[^\d]*?フロー[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '営業キャッシュフロー', nameJa: '営業キャッシュフロー', type: 'cashflow', priority: 1 },
      { pattern: /\|\s*売上高\s*\|[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '売上高', nameJa: '売上高', type: 'income', priority: 1 },
      { pattern: /\|\s*営業利益\s*\|[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '営業利益', nameJa: '営業利益', type: 'income', priority: 2 },
      { pattern: /\|\s*総資産\s*\|[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '総資産', nameJa: '総資産', type: 'balance', priority: 1 },
      { pattern: /\|\s*純資産\s*\|[^\d]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, name: '純資産', nameJa: '純資産', type: 'balance', priority: 2 }
    ];

    const foundItems = new Map<string, { item: any, priority: number }>();

    for (const line of lines) {
      for (const { pattern, name, nameJa, type, priority } of financialPatterns) {
        const matches = Array.from(line.matchAll(pattern));
        for (const match of matches) {
          if (match[1]) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(value) && value > 0) {
              const item = {
                name,
                nameJa,
                values: [{
                  value: value * 1000000, // Convert from millions to actual yen
                  contextRef: 'current',
                  unitRef: 'JPY',
                  decimals: 0
                }],
                isHighlighted: priority <= 2 // Highlight top priority items
              };

              const existing = foundItems.get(name);
              if (!existing || priority < existing.priority) {
                foundItems.set(name, { item, priority });
              }
            }
          }
        }
      }
    }

    for (const { item } of Array.from(foundItems.values())) {
      const { name } = item;
      if (name.includes('売上') || name.includes('利益')) {
        incomeStatementItems.push(item);
      } else if (name.includes('資産') || name.includes('資本')) {
        balanceSheetItems.push(item);
      } else if (name.includes('キャッシュ')) {
        cashFlowItems.push(item);
      } else {
        otherItems.push(item);
      }
    }

    const deduplicateItems = (items: any[]) => {
      const seen = new Set();
      return items.filter(item => {
        if (seen.has(item.name)) {
          return false;
        }
        seen.add(item.name);
        return true;
      });
    };

    return {
      balanceSheetItems: deduplicateItems(balanceSheetItems),
      incomeStatementItems: deduplicateItems(incomeStatementItems),
      cashFlowItems: deduplicateItems(cashFlowItems),
      otherItems: deduplicateItems(otherItems)
    };
  };

  const cancelImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const resetImport = () => {
    setProgress({
      current: 0,
      total: 0,
      currentFile: '',
      errors: []
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-center mb-6">
        <div className="bg-blue-100 p-3 rounded-full mr-4">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">一括インポート</h3>
          <p className="text-gray-600">有価証券報告書を一括で処理し、財務データを抽出します</p>
        </div>
      </div>
      
      {!isImporting ? (
        <div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              有価証券報告書ファイル（複数選択可能）
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.xml,.xbrl,.htm,.html"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer cursor-pointer"
              />
              <div className="mt-2">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-blue-600">ファイルを選択</span> またはドラッグ&ドロップ
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  対応形式: Markdown (.md), XBRL (.xml, .xbrl), HTML (.htm, .html)
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-gray-800">
                処理進捗: {progress.current} / {progress.total} ファイル
              </span>
              <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            {progress.currentFile && (
              <div className="flex items-center text-sm text-gray-600">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                現在処理中: <span className="font-medium ml-1">{progress.currentFile}</span>
              </div>
            )}
          </div>
          
          <button
            onClick={cancelImport}
            className="flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            キャンセル
          </button>
        </div>
      )}
      
      {progress.errors.length > 0 && (
        <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-md">
          <div className="flex items-center mb-2">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h4 className="text-sm font-semibold text-red-800">処理エラー ({progress.errors.length}件)</h4>
          </div>
          <div className="max-h-32 overflow-y-auto">
            <ul className="text-sm text-red-700 space-y-1">
              {progress.errors.map((error, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {!isImporting && progress.total > 0 && (
        <div className="mt-6">
          <button
            onClick={resetImport}
            className="flex items-center px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            リセット
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchImporter;
