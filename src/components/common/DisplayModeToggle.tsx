import React from 'react';
import { useDisplayMode } from '../../contexts/DisplayModeContext';
import { useTheme } from '../../contexts/ThemeContext';

interface DisplayModeToggleProps {
  className?: string;
}

const DisplayModeToggle: React.FC<DisplayModeToggleProps> = ({ className = '' }) => {
  const { isHtmlMode, toggleDisplayMode } = useDisplayMode();
  const { isDarkMode } = useTheme();

  return (
    <button
      onClick={toggleDisplayMode}
      className={`px-3 py-1 text-sm rounded flex items-center ${
        isDarkMode 
        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
      } ${className}`}
      title={isHtmlMode ? 'テキストモードに切り替え' : 'HTMLモードに切り替え'}
    >
      <span className="mr-2">
        {isHtmlMode ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        )}
      </span>
      {isHtmlMode ? 'テキストモード' : 'HTMLモード'}
    </button>
  );
};

export default DisplayModeToggle;
