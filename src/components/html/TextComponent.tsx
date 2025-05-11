import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useDisplayMode } from '../../contexts/DisplayModeContext';
import { sanitizeHtml, sanitizeHtmlEnhanced } from '../../utils/htmlSanitizer';

interface TextComponentProps {
  htmlContent: string | null | undefined;
  className?: string;
}

const TextComponent: React.FC<TextComponentProps> = ({ htmlContent, className = '' }) => {
  const { isDarkMode } = useTheme();
  const { isHtmlMode } = useDisplayMode();

  if (htmlContent === null || htmlContent === undefined) {
    return <div className={`${className} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>-</div>;
  }

  const processedContent = isHtmlMode 
    ? sanitizeHtmlEnhanced(htmlContent || '') 
    : sanitizeHtml(htmlContent || '');

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

export default TextComponent;
