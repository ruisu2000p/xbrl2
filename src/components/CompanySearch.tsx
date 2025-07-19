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
  }, [companies, filters]);

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
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">企業検索・フィルタ</h3>
      
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
      
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {filteredAndSortedCompanies.length} / {companies.length} 社が表示されています
        </p>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        <div className="grid grid-cols-1 gap-3">
          {filteredAndSortedCompanies.map((company) => (
            <div
              key={company.id}
              onClick={() => onCompanySelect(company.id, company.xbrlData)}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">{company.name}</h4>
                  <p className="text-sm text-gray-500">
                    売上高: {formatCurrency(getFinancialValue(company, '売上高'))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    利益率: {getRatioValue(company, '売上高利益率').toFixed(2)}%
                  </p>
                  <p className="text-sm text-gray-600">
                    総資産: {formatCurrency(getFinancialValue(company, '総資産'))}
                  </p>
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
