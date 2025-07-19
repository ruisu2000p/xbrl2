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
    
    for (const line of lines) {
      if (line.includes('【会社名】')) {
        const match = line.match(/【会社名】\s*\|\s*(.+?)\s*\|/);
        if (match) companyName = match[1].trim();
      }
      if (line.includes('【事業年度】')) {
        const match = line.match(/第(\d+)期/);
        if (match) fiscalYear = `第${match[1]}期`;
      }
    }

    if (!companyName) {
      companyName = fileName.replace(/\.(md|MD)$/, '');
    }

    return {
      companyInfo: {
        name: companyName,
        fiscalYear: fiscalYear || '不明',
        endDate: new Date().toISOString().split('T')[0]
      },
      contexts: {},
      units: {},
      statements: {
        bs: { type: StatementType.BalanceSheet, items: [] },
        pl: { type: StatementType.IncomeStatement, items: [] },
        cf: { type: StatementType.CashFlow, items: [] },
        other: { type: StatementType.Other, items: [] }
      }
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
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">一括インポート</h3>
      
      {!isImporting ? (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              有価証券報告書ファイル（複数選択可能）
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,.xml,.xbrl,.htm,.html"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <p className="text-sm text-gray-600">
            対応形式: Markdown (.md), XBRL (.xml, .xbrl), HTML (.htm, .html)
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                進捗: {progress.current} / {progress.total}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
          
          {progress.currentFile && (
            <p className="text-sm text-gray-600 mb-4">
              処理中: {progress.currentFile}
            </p>
          )}
          
          <button
            onClick={cancelImport}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            キャンセル
          </button>
        </div>
      )}
      
      {progress.errors.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-red-700 mb-2">
            エラー ({progress.errors.length}件)
          </h4>
          <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded text-xs">
            {progress.errors.map((error, index) => (
              <div key={index} className="text-red-700 mb-1">
                {error}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {!isImporting && progress.total > 0 && (
        <div className="mt-4">
          <button
            onClick={resetImport}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            リセット
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchImporter;
