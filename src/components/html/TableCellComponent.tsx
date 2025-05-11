import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDisplayMode } from '../../contexts/DisplayModeContext';
import { sanitizeHtml, sanitizeHtmlEnhanced } from '../../utils/htmlSanitizer';

interface TableCellComponentProps {
  content: string | number | null;
  className?: string;
  isHtml?: boolean;
}

const TableCellComponent: React.FC<TableCellComponentProps> = ({ 
  content, 
  className = '',
  isHtml = true
}) => {
  const { isDarkMode } = useTheme();
  const { isHtmlMode } = useDisplayMode();

  if (typeof content === 'number' || content === null) {
    return <span className={className}>{content === null ? '-' : content}</span>;
  }

  const processedContent = isHtml && isHtmlMode 
    ? sanitizeHtmlEnhanced(String(content)) 
    : sanitizeHtml(String(content));

  return (
    <span className={`${className} ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
      {isHtml && isHtmlMode ? (
        <span dangerouslySetInnerHTML={{ __html: processedContent }} />
      ) : (
        <span>{processedContent}</span>
      )}
    </span>
  );
};

export default TableCellComponent;
