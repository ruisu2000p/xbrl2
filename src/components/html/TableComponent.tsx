import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDisplayMode } from '../../contexts/DisplayModeContext';
import { sanitizeHtml, sanitizeHtmlEnhanced } from '../../utils/htmlSanitizer';

interface TableComponentProps {
  htmlContent: string;
  className?: string;
}

const TableComponent: React.FC<TableComponentProps> = ({ htmlContent, className = '' }) => {
  const { isDarkMode } = useTheme();
  const { isHtmlMode } = useDisplayMode();

  const processedContent = isHtmlMode 
    ? sanitizeHtmlEnhanced(htmlContent) 
    : sanitizeHtml(htmlContent);

  return (
    <div 
      className={`${className} ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
    >
      {isHtmlMode ? (
        <div dangerouslySetInnerHTML={{ __html: processedContent }} />
      ) : (
        <span className="whitespace-pre-line">{processedContent}</span>
      )}
    </div>
  );
};

export default TableComponent;
