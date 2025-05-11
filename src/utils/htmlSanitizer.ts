/**
 * HTML sanitization utilities
 * XBRLデータ内のHTML要素を適切に処理するためのユーティリティ関数
 */
import * as cheerio from 'cheerio';

const ALLOWED_TAGS = ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'p', 'br', 'span', 'div', 'ul', 'ol', 'li', 'ix:nonfraction', 'ix:nonnumeric'];

const SAFE_STYLE_PROPS = [
  'vertical-align', 'text-align', 
  'background-color', 
  'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
  'border-top-style', 'border-bottom-style', 'border-left-style', 'border-right-style',
  'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
  'padding-left', 'padding-right', 'padding-top', 'padding-bottom'
];

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

/**
 * 名前空間付き要素を処理する関数
 * cheerioのcss-selectが名前空間をサポートしていないため、代替手段で処理
 * @param htmlContent HTML文字列
 * @returns 処理後のHTML
 */
const processNamespacedElements = (htmlContent: string): string => {
  try {
    const $ = cheerio.load(htmlContent, { xmlMode: true });
    
    $('*').each(function() {
      const el = $(this);
      const element = this as any;
      const tagName = element.tagName || element.name;
      
      if (tagName && tagName.includes(':')) {
        const safeAttrs = ['contextRef', 'decimals', 'scale', 'format', 'name', 'unitRef'];
        
        Object.keys(element.attribs || {}).forEach(attr => {
          if (!safeAttrs.includes(attr)) {
            el.removeAttr(attr);
          }
        });
      }
    });
    
    return $.html();
  } catch (error) {
    console.error('名前空間付き要素の処理中にエラーが発生しました:', error);
    return htmlContent;
  }
};

/**
 * HTMLの表構造とスタイル属性を保持しながら、安全でないタグと属性を除去します
 * @param htmlContent HTML文字列またはプレーンテキスト
 * @returns 安全なHTMLタグと属性のみを含むサニタイズされたHTML
 */
export const sanitizeHtmlEnhanced = (htmlContent: string): string => {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return '';
  }

  if (!/<[a-z][\s\S]*>/i.test(htmlContent)) {
    return htmlContent;
  }

  try {
    const processedHtml = processNamespacedElements(htmlContent);
    const $ = cheerio.load(processedHtml);
    
    $('*').each(function() {
      const el = this as any;
      const tagName = (el.tagName || el.name || '').toLowerCase();
      if (tagName && !ALLOWED_TAGS.includes(tagName)) {
        $(this).replaceWith($(this).text());
      }
    });
    
    $('[style]').each(function() {
      const style = $(this).attr('style');
      if (style) {
        const safeStyles = style.split(';')
          .filter(part => {
            const [prop] = part.split(':').map(s => s.trim());
            return prop && SAFE_STYLE_PROPS.some(safeProp => 
              prop.toLowerCase() === safeProp.toLowerCase());
          })
          .join(';');
        
        if (safeStyles) {
          $(this).attr('style', safeStyles);
        } else {
          $(this).removeAttr('style');
        }
      }
    });
    
    return $.html();
  } catch (error) {
    console.warn('HTML sanitization error:', error);
    return htmlContent;
  }
};
