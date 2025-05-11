import React, { useState } from 'react';

interface XBRLUploaderProps {
  onFileUpload: (xbrlFile: File, htmlFile?: File) => void;
  isLoading?: boolean;
  isDarkMode?: boolean;
  useEnhancedMode?: boolean;
  onToggleEnhancedMode?: () => void;
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
  onToggleEnhancedMode
}) => {
  const [xbrlFile, setXbrlFile] = useState<File | null>(null);
  const [htmlFile, setHtmlFile] = useState<File | null>(null);

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
          XBRLファイル（必須）:
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
              {xbrlFile ? xbrlFile.name : 'XBRLファイルを選択してください'}
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              .xml, .xbrl形式に対応しています
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
            選択済み: {xbrlFile.name} ({(xbrlFile.size / 1024).toFixed(2)} KB)
          </div>
        )}
      </div>

      {/* HTMLファイル選択（オプション） */}
      <div>
        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
          HTMLファイル（オプション）:
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
              {htmlFile ? htmlFile.name : 'HTMLファイルを選択（オプション）'}
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              注記情報を抽出するためのHTMLファイル
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
            選択済み: {htmlFile.name} ({(htmlFile.size / 1024).toFixed(2)} KB)
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
          <span className="ml-3 text-sm font-medium">拡張解析モード</span>
        </label>
        <div className="ml-2">
          <button 
            className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
            onClick={() => alert('拡張解析モード: より詳細なXBRLデータ解析と階層表示を提供します。複雑な財務諸表の構造を正確に抽出します。')}
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
              処理中...
            </span>
          ) : (
            `ファイルを${useEnhancedMode ? '拡張' : '基本'}モードで解析`
          )}
        </button>
      </div>
    </div>
  );
};

export default XBRLUploader;
