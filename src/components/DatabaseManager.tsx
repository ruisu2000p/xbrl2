import React, { useState, useEffect } from 'react';
import { XBRLData } from '../types/xbrl';
import { DatabaseService } from '../services/database/DatabaseService';

interface DatabaseManagerProps {
  xbrlData: XBRLData | null;
  onLoadData: (data: XBRLData) => void;
  isDarkMode?: boolean;
}

/**
 * データベース操作のためのコンポーネント
 * XBRLデータの保存、読み込み、削除などの機能を提供します
 */
const DatabaseManager: React.FC<DatabaseManagerProps> = ({ 
  xbrlData, 
  onLoadData,
  isDarkMode = false 
}) => {
  const [companies, setCompanies] = useState<Map<string, string>>(new Map());
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [loadSuccess, setLoadSuccess] = useState<boolean | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    loadCompanyList();
  }, []);

  const loadCompanyList = () => {
    const list = DatabaseService.getCompanyList();
    setCompanies(list);
  };

  const handleSaveData = () => {
    if (!xbrlData) {
      setSaveSuccess(false);
      return;
    }

    const success = DatabaseService.saveXBRLData(xbrlData);
    setSaveSuccess(success);
    
    if (success) {
      loadCompanyList();
      
      setTimeout(() => {
        setSaveSuccess(null);
      }, 3000);
    }
  };

  const handleLoadData = () => {
    if (!selectedCompany) {
      setLoadSuccess(false);
      return;
    }

    const data = DatabaseService.getXBRLData(selectedCompany);
    if (data) {
      onLoadData(data);
      setLoadSuccess(true);
      
      setTimeout(() => {
        setLoadSuccess(null);
      }, 3000);
    } else {
      setLoadSuccess(false);
    }
  };

  const handleDeleteData = () => {
    if (!selectedCompany) {
      setDeleteSuccess(false);
      return;
    }

    const success = DatabaseService.deleteXBRLData(selectedCompany);
    setDeleteSuccess(success);
    
    if (success) {
      loadCompanyList();
      setSelectedCompany('');
      
      setTimeout(() => {
        setDeleteSuccess(null);
      }, 3000);
    }
  };

  return (
    <div className={`p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'}`}>
      <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
        データベース管理
      </h2>
      
      <div className="space-y-6">
        {/* 現在のデータを保存 */}
        <div>
          <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            現在のデータを保存
          </h3>
          <button
            onClick={handleSaveData}
            disabled={!xbrlData}
            className={`px-4 py-2 rounded-md transition-colors ${
              !xbrlData
                ? `${isDarkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-300 text-gray-500'} cursor-not-allowed`
                : `${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`
            }`}
          >
            データベースに保存
          </button>
          
          {saveSuccess !== null && (
            <div className={`mt-2 ${
              saveSuccess 
                ? isDarkMode ? 'text-green-400' : 'text-green-600'
                : isDarkMode ? 'text-red-400' : 'text-red-600'
            }`}>
              {saveSuccess 
                ? 'データを保存しました'
                : 'データの保存に失敗しました'}
            </div>
          )}
        </div>
        
        {/* 保存済みデータの読み込み */}
        <div>
          <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            保存済みデータの読み込み
          </h3>
          
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className={`block w-full sm:w-64 pl-3 pr-10 py-2 text-base border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-700'
              } focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md`}
            >
              <option value="">会社を選択してください</option>
              {Array.from(companies.entries()).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            
            <button
              onClick={handleLoadData}
              disabled={!selectedCompany}
              className={`px-4 py-2 rounded-md transition-colors ${
                !selectedCompany
                  ? `${isDarkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-300 text-gray-500'} cursor-not-allowed`
                  : `${isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'} text-white`
              }`}
            >
              読み込み
            </button>
            
            <button
              onClick={handleDeleteData}
              disabled={!selectedCompany}
              className={`px-4 py-2 rounded-md transition-colors ${
                !selectedCompany
                  ? `${isDarkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-300 text-gray-500'} cursor-not-allowed`
                  : `${isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'} text-white`
              }`}
            >
              削除
            </button>
          </div>
          
          {loadSuccess !== null && (
            <div className={`mt-2 ${
              loadSuccess 
                ? isDarkMode ? 'text-green-400' : 'text-green-600'
                : isDarkMode ? 'text-red-400' : 'text-red-600'
            }`}>
              {loadSuccess 
                ? 'データを読み込みました'
                : 'データの読み込みに失敗しました'}
            </div>
          )}
          
          {deleteSuccess !== null && (
            <div className={`mt-2 ${
              deleteSuccess 
                ? isDarkMode ? 'text-green-400' : 'text-green-600'
                : isDarkMode ? 'text-red-400' : 'text-red-600'
            }`}>
              {deleteSuccess 
                ? 'データを削除しました'
                : 'データの削除に失敗しました'}
            </div>
          )}
        </div>
      </div>
      
      <div className={`mt-4 p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <strong>注意:</strong> 現在のデータはブラウザのローカルストレージに保存されます。
          実際の運用では、サーバーサイドのデータベース（MySQL、PostgreSQL、MongoDBなど）を使用することをお勧めします。
        </p>
      </div>
    </div>
  );
};

export default DatabaseManager;
