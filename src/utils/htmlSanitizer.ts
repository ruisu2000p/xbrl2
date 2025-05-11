/**
 * HTML sanitization utilities
 * XBRLデータ内のHTML要素を適切に処理するためのユーティリティ関数
 */
import * as cheerio from 'cheerio';

const ALLOWED_TAGS = ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'p', 'br', 'span', 'div', 'ul', 'ol', 'li'];

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
 * HTMLの表構造を保持しながら、安全でないタグを除去します
 * @param htmlContent HTML文字列またはプレーンテキスト
 * @returns 安全なHTMLタグのみを含むサニタイズされたHTML
 */
export const sanitizeHtmlPreserveTables = (htmlContent: string): string => {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return '';
  }

  if (!/<[a-z][\s\S]*>/i.test(htmlContent)) {
    return htmlContent;
  }

  try {
    let sanitized = htmlContent;
    
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    
    sanitized = sanitized.replace(tagRegex, (match, tagName) => {
      if (ALLOWED_TAGS.includes(tagName.toLowerCase())) {
        const closingBracketPos = match.indexOf('>');
        const openingTagWithoutAttrs = match.startsWith('</') 
          ? match // 閉じタグはそのまま保持
          : `<${tagName}>`; // 開始タグは属性を削除
        
        return openingTagWithoutAttrs;
      } else {
        return '';
      }
    });
    
    return sanitized;
  } catch (error) {
    console.warn('HTML sanitization error:', error);
    return sanitizeHtml(htmlContent); // エラーが発生した場合はテキストのみを抽出
  }
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
