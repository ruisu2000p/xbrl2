const webpack = require('webpack');
const path = require('path');

module.exports = function override(config) {
  // webpack 5用のポリフィル設定
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": false,
    "fs": false,
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer/"),
    "util": require.resolve("util/"),
    "process": require.resolve("process/browser"),
    "path": require.resolve("path-browserify")
  };

  // バッファ用のプラグイン追加
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  );

  // Nodeモジュールの含めるパッケージのための設定
  config.module.rules.push({
    test: /\.m?js/,
    resolve: {
      fullySpecified: false
    }
  });

  return config;
};