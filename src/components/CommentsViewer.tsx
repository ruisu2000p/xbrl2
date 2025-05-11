import React, { useState } from 'react';
import { CommentSection } from '../types/xbrl';
import { useTheme } from '../contexts/ThemeContext';

interface CommentsViewerProps {
  comments: CommentSection[];
  onSelectItem?: (item: string) => void;
}

/**
 * 財務諸表の注記・コメント表示コンポーネント
 */
const CommentsViewer: React.FC<CommentsViewerProps> = ({ comments, onSelectItem }) => {
  const { isDarkMode } = useTheme();
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  const toggleComment = (id: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleRelatedItemClick = (item: string) => {
    if (onSelectItem) {
      onSelectItem(item);
    }
  };

  return (
    <div className={`${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'} rounded-lg shadow-md transition-colors duration-300`}>
      <h2 className={`text-xl font-semibold p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        注記・コメント情報
      </h2>

      {comments.length === 0 ? (
        <div className="p-6 text-center">
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            注記情報が見つかりませんでした。HTMLファイルを追加でアップロードすると、より詳細な情報が表示されます。
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {comments.map((comment) => (
            <div key={comment.id} className={`p-4 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
              <div
                className={`flex justify-between items-center cursor-pointer`}
                onClick={() => toggleComment(comment.id)}
              >
                <h3 className="text-lg font-medium">{comment.title}</h3>
                <button className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {expandedComments[comment.id] ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    )}
                  </svg>
                </button>
              </div>

              {expandedComments[comment.id] && (
                <div className="mt-3">
                  <div className={`whitespace-pre-line text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {comment.content}
                  </div>

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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentsViewer;
