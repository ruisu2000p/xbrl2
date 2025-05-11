import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface DisplayModeContextType {
  isHtmlMode: boolean;
  toggleDisplayMode: () => void;
}

const defaultContextValue: DisplayModeContextType = {
  isHtmlMode: true,
  toggleDisplayMode: () => {},
};

const DisplayModeContext = createContext<DisplayModeContextType>(defaultContextValue);

export const useDisplayMode = () => useContext(DisplayModeContext);

interface DisplayModeProviderProps {
  children: ReactNode;
}

export const DisplayModeProvider: React.FC<DisplayModeProviderProps> = ({ children }) => {
  const [isHtmlMode, setIsHtmlMode] = useState<boolean>(() => {
    const savedMode = localStorage.getItem('htmlMode');
    return savedMode ? JSON.parse(savedMode) : true;
  });

  const toggleDisplayMode = () => {
    setIsHtmlMode(!isHtmlMode);
  };

  useEffect(() => {
    localStorage.setItem('htmlMode', JSON.stringify(isHtmlMode));
  }, [isHtmlMode]);

  const contextValue: DisplayModeContextType = {
    isHtmlMode,
    toggleDisplayMode,
  };

  return (
    <DisplayModeContext.Provider value={contextValue}>
      {children}
    </DisplayModeContext.Provider>
  );
};

export default DisplayModeContext;
