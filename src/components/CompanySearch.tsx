import React, { useState, useEffect, useMemo } from 'react';
import { XBRLData, FinancialRatio, RatioCategory } from '../types/xbrl';
import { UnifiedDatabaseService } from '../services/database/UnifiedDatabaseService';
import { calculateFinancialRatios } from '../utils/ratioCalculator';

interface CompanySearchProps {
  onCompanySelect: (companyId: string, xbrlData: XBRLData) => void;
}

interface CompanyData {
  id: string;
  name: string;
  xbrlData: XBRLData;
  ratios: FinancialRatio[];
}

interface SearchFilters {
  nameQuery: string;
  industry: string;
  minRevenue: number | null;
  maxRevenue: number | null;
  minProfitMargin: number | null;
  maxProfitMargin: number | null;
  sortBy: 'name' | 'revenue' | 'profitMargin' | 'totalAssets';
  sortOrder: 'asc' | 'desc';
}

const CompanySearch: React.FC<CompanySearchProps> = ({ onCompanySelect }) => {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>({
    nameQuery: '',
    industry: '',
    minRevenue: null,
    maxRevenue: null,
    minProfitMargin: null,
    maxProfitMargin: null,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const getFinancialValue = (company: CompanyData, itemName: string): number => {
    for (const statement of Object.values(company.xbrlData.statements)) {
      for (const item of statement.items) {
        if ((item.nameJa || item.name).includes(itemName) && item.values.length > 0) {
          const value = item.values[0].value;
          return typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) || 0 : value;
        }
      }
    }
    return 0;
  };

  const getRatioValue = (company: CompanyData, ratioName: string): number => {
    const ratio = company.ratios.find(r => r.name.includes(ratioName));
    return ratio ? ratio.value : 0;
  };

  const formatCurrency = (value: number): string => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B円`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M円`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K円`;
    }
    return `${value.toLocaleString()}円`;
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const companyList = await UnifiedDatabaseService.getCompanyList();
      const companiesData: CompanyData[] = [];

      for (const [companyId, companyName] of Array.from(companyList.entries())) {
        try {
          const xbrlData = await UnifiedDatabaseService.getXBRLData(companyId);
          if (xbrlData) {
            const ratios = calculateFinancialRatios(xbrlData);
            companiesData.push({
              id: companyId,
              name: companyName,
              xbrlData,
              ratios
            });
          }
        } catch (error) {
          console.warn(`企業データの読み込みに失敗: ${companyId}`, error);
        }
      }

      setCompanies(companiesData);
    } catch (error) {
      console.error('企業リストの読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedCompanies = useMemo(() => {
    let filtered = companies.filter(company => {
      if (filters.nameQuery && !company.name.toLowerCase().includes(filters.nameQuery.toLowerCase())) {
        return false;
      }

      const revenue = getFinancialValue(company, '売上高');
      if (filters.minRevenue !== null && revenue < filters.minRevenue) return false;
      if (filters.maxRevenue !== null && revenue > filters.maxRevenue) return false;

      const profitMargin = getRatioValue(company, '売上高利益率');
      if (filters.minProfitMargin !== null && profitMargin < filters.minProfitMargin) return false;
      if (filters.maxProfitMargin !== null && profitMargin > filters.maxProfitMargin) return false;

      return true;
    });

    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (filters.sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'revenue':
          aValue = getFinancialValue(a, '売上高');
          bValue = getFinancialValue(b, '売上高');
          break;
        case 'profitMargin':
          aValue = getRatioValue(a, '売上高利益率');
          bValue = getRatioValue(b, '売上高利益率');
          break;
        case 'totalAssets':
          aValue = getFinancialValue(a, '総資産');
          bValue = getFinancialValue(b, '総資産');
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return filters.sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      const numA = typeof aValue === 'number' ? aValue : 0;
      const numB = typeof bValue === 'number' ? bValue : 0;
      
      return filters.sortOrder === 'asc' ? numA - numB : numB - numA;
    });

    return filtered;
  }, [companies, filters, getFinancialValue, getRatioValue]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">企業データを読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-center mb-6">
        <div className="bg-green-100 p-3 rounded-full mr-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">企業検索・フィルタ</h3>
          <p className="text-gray-600">インポートされた企業の財務データを検索・比較できます</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">企業名</label>
          <input
            type="text"
            value={filters.nameQuery}
            onChange={(e) => setFilters(prev => ({ ...prev, nameQuery: e.target.value }))}
            placeholder="企業名で検索"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">最小売上高</label>
          <input
            type="number"
            value={filters.minRevenue || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, minRevenue: e.target.value ? Number(e.target.value) : null }))}
            placeholder="最小売上高"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">並び順</label>
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">企業名</option>
            <option value="revenue">売上高</option>
            <option value="profitMargin">利益率</option>
            <option value="totalAssets">総資産</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">順序</label>
          <select
            value={filters.sortOrder}
            onChange={(e) => setFilters(prev => ({ ...prev, sortOrder: e.target.value as 'asc' | 'desc' }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">昇順</option>
            <option value="desc">降順</option>
          </select>
        </div>
      </div>
      
      <div className="mb-6 flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            検索結果: <span className="text-blue-600 font-semibold">{filteredAndSortedCompanies.length}</span> / {companies.length} 社
          </span>
        </div>
        {companies.length > 0 && (
          <div className="text-xs text-gray-500">
            最終更新: {new Date().toLocaleString('ja-JP')}
          </div>
        )}
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        <div className="grid grid-cols-1 gap-4">
          {filteredAndSortedCompanies.map((company) => (
            <div
              key={company.id}
              onClick={() => onCompanySelect(company.id, company.xbrlData)}
              className="p-5 border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-300 group"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 group-hover:bg-blue-600 transition-colors"></div>
                    <h4 className="font-semibold text-gray-900 truncate group-hover:text-blue-900 transition-colors">
                      {company.name.length > 50 ? `${company.name.substring(0, 50)}...` : company.name}
                    </h4>
                  </div>
                  {company.xbrlData.companyInfo?.businessOverview && (
                    <div className="mb-3 p-2 bg-blue-50 group-hover:bg-blue-100 rounded text-xs text-gray-700 group-hover:text-blue-800 transition-colors">
                      <span className="font-medium">事業概要: </span>
                      {company.xbrlData.companyInfo.businessOverview.length > 100 
                        ? `${company.xbrlData.companyInfo.businessOverview.substring(0, 100)}...`
                        : company.xbrlData.companyInfo.businessOverview
                      }
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <span className="text-gray-600">売上高: </span>
                      <span className="font-medium text-gray-900 ml-1">
                        {formatCurrency(getFinancialValue(company, '売上高'))}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-gray-600">総資産: </span>
                      <span className="font-medium text-gray-900 ml-1">
                        {formatCurrency(getFinancialValue(company, '総資産'))}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="bg-gray-100 group-hover:bg-blue-100 px-3 py-1 rounded-full transition-colors">
                    <span className="text-xs text-gray-600 group-hover:text-blue-700">利益率</span>
                    <div className="font-bold text-lg text-gray-900 group-hover:text-blue-900">
                      {getRatioValue(company, '売上高利益率').toFixed(2)}%
                    </div>
                  </div>
                  <div className="mt-2">
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {filteredAndSortedCompanies.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          検索条件に一致する企業が見つかりませんでした
        </div>
      )}
    </div>
  );
};

export default CompanySearch;
