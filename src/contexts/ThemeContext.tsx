import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// テーマコンテキストの型定義
interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

// デフォルト値を設定
const defaultContextValue: ThemeContextType = {
  isDarkMode: false,
  toggleDarkMode: () => {},
};

// コンテキスト作成
const ThemeContext = createContext<ThemeContextType>(defaultContextValue);

// カスタムフックの作成
export const useTheme = () => useContext(ThemeContext);

// プロバイダーコンポーネント
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // ローカルストレージから初期値を取得するか、デフォルトでライトモード
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('darkMode');
    return savedTheme ? JSON.parse(savedTheme) : false;
  });

  // ダークモード切り替え関数
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // ダークモード状態が変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    
    // HTMLタグのクラスを更新（tailwindのダークモードサポート用）
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // コンテキスト値
  const contextValue: ThemeContextType = {
    isDarkMode,
    toggleDarkMode,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
