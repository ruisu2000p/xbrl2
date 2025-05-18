import { sanitizeHtml, sanitizeHtmlPreserveTables, sanitizeHtmlEnhanced } from '../htmlSanitizer';

const testHtmlWithTables = `
<div>
  <h1>Test HTML with Tables</h1>
  <p>This is a test paragraph</p>
  <table>
    <tr>
      <th style="vertical-align:middle;background-color:#cceeff;">Header 1</th>
      <th style="vertical-align:middle;background-color:#cceeff;">Header 2</th>
    </tr>
    <tr>
      <td style="vertical-align:middle;border-top-color:#a9a9a9;">Cell 1</td>
      <td style="vertical-align:middle;border-top-color:#a9a9a9;">Cell 2</td>
    </tr>
  </table>
  <ix:nonfraction contextRef="Prior1YearInstant_NonConsolidatedMember" decimals="-3" scale="3" format="ixt:numdotdecimal" name="jppfs_cor:LegalRetainedEarnings" unitRef="JPY">120,197</ix:nonfraction>
  <script>alert('dangerous');</script>
</div>
`;

describe('htmlSanitizer utilities', () => {
  test('sanitizeHtml strips tags', () => {
    const result = sanitizeHtml(testHtmlWithTables);
    expect(result).toContain('Test HTML with Tables');
    expect(result).toContain('Cell 1');
    expect(result).not.toMatch(/<[^>]*>/);
  });

  test('sanitizeHtmlPreserveTables keeps table elements', () => {
    const result = sanitizeHtmlPreserveTables(testHtmlWithTables);
    expect(result).toContain('<table>');
    expect(result).toContain('<tr>');
    expect(result).not.toContain('<h1>');
  });

  test('sanitizeHtmlEnhanced removes the <script> tag', () => {
    const result = sanitizeHtmlEnhanced(testHtmlWithTables);
    expect(result).not.toContain('<script>');
    expect(result).toContain("alert('dangerous');");
  });
});
