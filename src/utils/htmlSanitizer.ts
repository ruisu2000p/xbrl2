/**
 * HTML sanitization utilities
 * XBRLデータ内のHTML要素を適切に処理するためのユーティリティ関数
 */
import * as cheerio from 'cheerio';

/**
 * HTMLタグを除去し、テキストのみを抽出します
 * @param htmlContent HTML文字列またはプレーンテキスト
 * @returns サニタイズされたテキスト
 */
export const sanitizeHtml = (htmlContent: string): string => {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return '';
  }

  if (/<[a-z][\s\S]*>/i.test(htmlContent)) {
    try {
      const $ = cheerio.load(htmlContent);
      return $.root().text().trim();
    } catch (error) {
      console.warn('HTML sanitization error:', error);
      return htmlContent.replace(/<[^>]*>/g, '');
    }
  }

  return htmlContent;
};

/**
 * テキスト内の改行やスペースを適切に整形します
 * @param text 整形するテキスト
 * @returns 整形されたテキスト
 */
export const formatText = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let formatted = text.replace(/\s+/g, ' ');
  formatted = formatted.trim();

  return formatted;
};
