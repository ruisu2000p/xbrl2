import React, { useState } from 'react';

interface XBRLUploaderProps {
  onFileUpload: (xbrlFile: File, htmlFile?: File) => void;
  isLoading?: boolean;
  isDarkMode?: boolean;
  useEnhancedMode?: boolean;
  onToggleEnhancedMode?: () => void;
  language?: 'ja' | 'en';
}

/**
 * XBRLファイルとHTMLファイルをアップロードするためのコンポーネント
 * XBRLファイルは必須、HTMLファイルはオプション
 */
const XBRLUploader: React.FC<XBRLUploaderProps> = ({ 
  onFileUpload, 
  isLoading = false,
  isDarkMode = false,
  useEnhancedMode = true,
  onToggleEnhancedMode,
  language = 'ja'
}) => {
  const [xbrlFile, setXbrlFile] = useState<File | null>(null);
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  
  const labels = {
    xbrlFileRequired: language === 'ja' ? 'XBRLファイル（必須）:' : 'XBRL File (required):',
    selectXbrlFile: language === 'ja' ? 'XBRLファイルを選択してください' : 'Select XBRL file',
    fileFormatSupport: language === 'ja' ? '.xml, .xbrl形式に対応しています' : 'Supports .xml, .xbrl formats',
    htmlFileOptional: language === 'ja' ? 'HTMLファイル（オプション）:' : 'HTML File (optional):',
    selectHtmlFile: language === 'ja' ? 'HTMLファイルを選択（オプション）' : 'Select HTML file (optional)',
    htmlFileDescription: language === 'ja' ? '注記情報を抽出するためのHTMLファイル' : 'HTML file for extracting notes information',
    selectedFile: language === 'ja' ? '選択済み:' : 'Selected:',
    enhancedMode: language === 'ja' ? '拡張解析モード' : 'Enhanced Analysis Mode',
    enhancedModeDescription: language === 'ja' 
      ? '拡張解析モード: より詳細なXBRLデータ解析と階層表示を提供します。複雑な財務諸表の構造を正確に抽出します。' 
      : 'Enhanced Analysis Mode: Provides more detailed XBRL data analysis and hierarchical display. Accurately extracts complex financial statement structures.',
    processing: language === 'ja' ? '処理中...' : 'Processing...',
    analyzeWithMode: (mode: string) => language === 'ja' 
      ? `ファイルを${mode}モードで解析` 
      : `Analyze file with ${mode === '拡張' ? 'enhanced' : 'basic'} mode`
  };

  const handleXbrlFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setXbrlFile(event.target.files[0]);
    }
  };

  const handleHtmlFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setHtmlFile(event.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (xbrlFile) {
      onFileUpload(xbrlFile, htmlFile || undefined);
    }
  };

  return (
    <div className={`flex flex-col space-y-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
      {/* XBRLファイル選択（必須） */}
      <div>
        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
          {labels.xbrlFileRequired}
        </label>
        <div 
          className={`relative flex items-center justify-center w-full h-32 px-4 transition ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'} border-2 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none`}
          onClick={() => document.getElementById('xbrl-file-input')?.click()}
        >
          <div className="flex flex-col items-center justify-center">
            <svg className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <p className={`pt-1 text-sm tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {xbrlFile ? xbrlFile.name : labels.selectXbrlFile}
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {labels.fileFormatSupport}
            </p>
          </div>
          <input 
            id="xbrl-file-input"
            type="file" 
            className="hidden" 
            accept=".xml,.xbrl" 
            onChange={handleXbrlFileChange} 
          />
        </div>
        {xbrlFile && (
          <div className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {labels.selectedFile} {xbrlFile.name} ({(xbrlFile.size / 1024).toFixed(2)} KB)
          </div>
        )}
      </div>

      {/* HTMLファイル選択（オプション） */}
      <div>
        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
          {labels.htmlFileOptional}
        </label>
        <div 
          className={`relative flex items-center justify-center w-full h-32 px-4 transition ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'} border-2 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none`}
          onClick={() => document.getElementById('html-file-input')?.click()}
        >
          <div className="flex flex-col items-center justify-center">
            <svg className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p className={`pt-1 text-sm tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {htmlFile ? htmlFile.name : labels.selectHtmlFile}
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {labels.htmlFileDescription}
            </p>
          </div>
          <input 
            id="html-file-input"
            type="file" 
            className="hidden" 
            accept=".html,.htm" 
            onChange={handleHtmlFileChange} 
          />
        </div>
        {htmlFile && (
          <div className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {labels.selectedFile} {htmlFile.name} ({(htmlFile.size / 1024).toFixed(2)} KB)
          </div>
        )}
      </div>

      {/* 拡張モード切り替え */}
      <div className={`flex items-center mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        <label className="inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={useEnhancedMode} 
            onChange={onToggleEnhancedMode}
            className="sr-only peer"
          />
          <div className={`relative w-11 h-6 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} peer-focus:outline-none peer-focus:ring-4 ${isDarkMode ? 'peer-focus:ring-blue-800' : 'peer-focus:ring-blue-300'} rounded-full peer ${useEnhancedMode ? (isDarkMode ? 'peer-checked:bg-blue-600' : 'peer-checked:bg-blue-600') : ''} peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
          <span className="ml-3 text-sm font-medium">{labels.enhancedMode}</span>
        </label>
        <div className="ml-2">
          <button 
            className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
            onClick={() => alert(labels.enhancedModeDescription)}
          >
            ?
          </button>
        </div>
      </div>

      {/* アップロードボタン */}
      <div className="flex justify-center mt-4">
        <button
          onClick={handleUpload}
          disabled={!xbrlFile || isLoading}
          className={`px-6 py-3 rounded-md transition-colors ${
            !xbrlFile || isLoading
              ? `${isDarkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-300 text-gray-500'} cursor-not-allowed`
              : `${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`
          }`}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {labels.processing}
            </span>
          ) : (
            labels.analyzeWithMode(useEnhancedMode ? '拡張' : '基本')
          )}
        </button>
      </div>
    </div>
  );
};

export default XBRLUploader;
