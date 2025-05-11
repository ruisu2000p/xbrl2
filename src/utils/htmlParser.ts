/**
 * HTML解析モジュール
 * 財務諸表のHTMLファイルから注記やコメントを抽出
 */

import * as cheerio from 'cheerio';
import { CommentSection } from '../types/xbrl';

/**
 * HTMLファイルから財務関連の注記やコメントを抽出
 * @param htmlContent HTML文字列
 * @returns 抽出された注記情報
 */
export const extractCommentsFromHTML = (htmlContent: string): CommentSection[] => {
  const comments: CommentSection[] = [];
  const $ = cheerio.load(htmlContent);
  
  $('h2, h3, h4').each((index: number, element: any) => {
    const title = $(element).text().trim();
    
    if (title.includes('注記') || 
        title.includes('重要な会計方針') ||
        title.includes('注釈') || 
        title.includes('備考') ||
        title.includes('事業') || 
        title.includes('セグメント')) {
      
      let content = '';
      let currentNode = $(element).next();
      
      while (currentNode.length && !currentNode.is('h2, h3, h4')) {
        content += currentNode.text().trim() + '\n';
        currentNode = currentNode.next();
      }
      
      const relatedItems = findRelatedFinancialItems(content);
      
      comments.push({
        id: `comment-${index}`,
        title,
        content: content.trim(),
        relatedItems
      });
    }
  });
  
  return comments;
};

/**
 * 注記コンテンツから関連する可能性のある財務項目を抽出
 * @param content 注記のテキストコンテンツ
 * @returns 関連する財務項目の配列
 */
const findRelatedFinancialItems = (content: string): string[] => {
  const relatedItems: string[] = [];
  
  const commonFinancialTerms = [
    '売上高', '売上総利益', '営業利益', '経常利益', '当期純利益',
    '資産', '負債', '純資産', '現金', '減価償却',
    '有形固定資産', '無形固定資産', '投資有価証券', '長期借入金',
    '資本金', '資本剰余金', '利益剰余金', '自己株式'
  ];
  
  commonFinancialTerms.forEach(term => {
    if (content.includes(term)) {
      relatedItems.push(term);
    }
  });
  
  return relatedItems;
};
