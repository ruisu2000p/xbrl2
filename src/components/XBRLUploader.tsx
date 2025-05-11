import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface XBRLUploaderProps {
  onFileUpload: (file: File) => void;
}

/**
 * XBRLファイルをアップロードするためのドロップゾーンコンポーネント
 * react-dropzoneを使用してドラッグ＆ドロップによるファイルアップロードをサポート
 */
const XBRLUploader: React.FC<XBRLUploaderProps> = ({ onFileUpload }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ファイルがドロップされたときのコールバック
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // 最初のファイルのみを処理
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  // react-dropzoneのフック
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/xml': ['.xml', '.xbrl'],
      'text/xml': ['.xml', '.xbrl']
    },
    multiple: false
  });

  // アップロードボタンのハンドラー
  const handleUpload = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* ファイルドロップゾーン */}
      <div 
        {...getRootProps()} 
        className={`w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}`}
      >
        <input {...getInputProps()} />
        
        {isDragActive ? (
          <p className="text-primary-700">ファイルをここにドロップ...</p>
        ) : (
          <div>
            <p className="text-gray-700 mb-2">
              XBRLファイルをここにドラッグ＆ドロップするか、クリックして選択してください
            </p>
            <p className="text-sm text-gray-500">
              .xml, .xbrl形式に対応しています
            </p>
          </div>
        )}
      </div>
      
      {/* 選択されたファイル情報 */}
      {selectedFile && (
        <div className="mt-4 w-full">
          <div className="flex items-center justify-between bg-gray-100 p-3 rounded">
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <button
              onClick={handleUpload}
              className="bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors"
            >
              アップロード
            </button>
          </div>
        </div>
      )}
      
      {/* ファイルが選択されていない場合のアップロードボタン */}
      {!selectedFile && (
        <div className="mt-4">
          <p className="text-gray-500 text-sm">ファイルが選択されていません</p>
        </div>
      )}
    </div>
  );
};

export default XBRLUploader;