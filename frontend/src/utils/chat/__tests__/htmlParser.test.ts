import { describe, it, expect } from 'vitest';
import { parseHtmlContent } from '../htmlParser';

describe('htmlParser', () => {
    describe('parseHtmlContent', () => {
        it('should return original text if it contains no HTML tags', () => {
            const input = 'Simple text content';
            expect(parseHtmlContent(input)).toBe(input);
        });

        it('should return empty string if input is empty', () => {
            expect(parseHtmlContent('')).toBe('');
        });

        it('should strip style, class, id, and data- attributes', () => {
            const input = '<div id="test" class="foo" style="color: red" data-value="123">Content</div>';
            const result = parseHtmlContent(input);
            expect(result).not.toContain('id=');
            expect(result).not.toContain('class=');
            expect(result).not.toContain('style=');
            expect(result).not.toContain('data-value=');
            // The parser adds newlines for divs
            expect(result.trim()).toBe('Content');
        });

        it('should format tables correctly', () => {
            const input = `
                <table>
                    <tr><td>Header 1</td><td>Header 2</td></tr>
                    <tr><td>Cell 1</td><td>Cell 2</td></tr>
                </table>
            `;
            const result = parseHtmlContent(input);
            expect(result).toContain('📊 테이블');
            expect(result).toContain('Header 1 | Header 2');
            expect(result).toContain('Cell 1 | Cell 2');
        });

        it('should convert block elements to newlines', () => {
            const input = '<p>Paragraph 1</p><br><p>Paragraph 2</p>';
            const result = parseHtmlContent(input);
            expect(result).toContain('Paragraph 1');
            expect(result).toContain('Paragraph 2');
            // Check that there is spacing
            expect(result.split('\n').length).toBeGreaterThan(1);
        });

        it('should format bold and italic text', () => {
            const input = '<b>Bold</b> and <i>Italic</i>';
            const result = parseHtmlContent(input);
            expect(result).toContain('**Bold**');
            expect(result).toContain('*Italic*');
        });

        it('should handle nested structures gracefully', () => {
            const input = '<div><h1>Title</h1><p>Body</p></div>';
            const result = parseHtmlContent(input);
            expect(result).toContain('📋 Title');
            expect(result).toContain('Body');
        });

        it('should clean up excessive newlines and spaces', () => {
            const input = '  <p>  Text  </p>  <br>  <br>  <br>  <p>  Text 2  </p>  ';
            const result = parseHtmlContent(input);
            // Replaces 3+ newlines with 2
            expect(result).not.toMatch(/\n{3,}/);
            // Trims
            expect(result.trim()).toBe(result);
            // Collapses spaces
            expect(result).not.toContain('  ');
        });
    });
});
