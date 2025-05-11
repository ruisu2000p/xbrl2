import React, { useState } from 'react';
import { CommentSection } from '../types/xbrl';
import { useTheme } from '../contexts/ThemeContext';
import { useDisplayMode } from '../contexts/DisplayModeContext';
import TextComponent from './html/TextComponent';
import DisplayModeToggle from './common/DisplayModeToggle';

interface CommentsViewerProps {
  comments: CommentSection[];
  onSelectItem?: (item: string) => void;
}

/**
 * 財務諸表の注記・コメント表示コンポーネント
 */
const CommentsViewer: React.FC<CommentsViewerProps> = ({ comments, onSelectItem }) => {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<string>(comments.length > 0 ? comments[0].id : '');

  const handleTabClick = (id: string) => {
    setActiveTab(id);
  };

  const handleRelatedItemClick = (item: string) => {
    if (onSelectItem) {
      onSelectItem(item);
    }
  };

  return (
    <div className={`${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'} rounded-lg shadow-md transition-colors duration-300`}>
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          注記・コメント情報
        </h2>
        <DisplayModeToggle />
      </div>

      {comments.length === 0 ? (
        <div className="p-6 text-center">
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            注記情報が見つかりませんでした。HTMLファイルを追加でアップロードすると、より詳細な情報が表示されます。
          </p>
        </div>
      ) : (
        <div>
          {/* タブヘッダー */}
          <div className={`flex overflow-x-auto border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {comments.map((comment) => (
              <button
                key={comment.id}
                onClick={() => handleTabClick(comment.id)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap
                  ${activeTab === comment.id 
                    ? `${isDarkMode ? 'bg-gray-700 text-white' : 'bg-blue-50 text-blue-600'} border-b-2 ${isDarkMode ? 'border-blue-500' : 'border-blue-500'}` 
                    : `${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`
                  }
                `}
              >
                {comment.title}
              </button>
            ))}
          </div>
          
          {/* タブコンテンツ */}
          <div className="p-4">
            {comments.map((comment) => (
              <div 
                key={comment.id} 
                className={`${activeTab === comment.id ? 'block' : 'hidden'}`}
              >
                <TextComponent
                  htmlContent={comment.content}
                  className={`whitespace-pre-line text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                />
                
                {comment.relatedItems.length > 0 && (
                  <div className="mt-4">
                    <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>関連する財務項目:</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {comment.relatedItems.map((item, idx) => (
                        <button
                          key={idx}
                          className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-blue-900 hover:bg-blue-800 text-blue-200' : 'bg-blue-100 hover:bg-blue-200 text-blue-800'}`}
                          onClick={() => handleRelatedItemClick(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentsViewer;
