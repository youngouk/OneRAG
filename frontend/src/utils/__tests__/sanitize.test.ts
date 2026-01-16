/**
 * sanitize 유틸리티 테스트
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHTML, sanitizeText, sanitizeURL } from '../sanitize';

describe('sanitize utilities', () => {
  describe('sanitizeHTML', () => {
    it('허용된 HTML 태그를 유지해야 함', () => {
      const input = '<p>안녕하세요 <strong>볼드</strong> 텍스트</p>';
      const result = sanitizeHTML(input);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('안녕하세요');
    });

    it('위험한 스크립트 태그를 제거해야 함', () => {
      const input = '<p>안전한 텍스트</p><script>alert("XSS")</script>';
      const result = sanitizeHTML(input);
      expect(result).toContain('안전한 텍스트');
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('이벤트 핸들러를 제거해야 함', () => {
      const input = '<p onclick="alert(\'XSS\')">클릭</p>';
      const result = sanitizeHTML(input);
      expect(result).not.toContain('onclick');
      expect(result).toContain('클릭');
    });
  });

  describe('sanitizeText', () => {
    it('모든 HTML 태그를 제거해야 함', () => {
      const input = '<p>텍스트 <strong>볼드</strong></p>';
      const result = sanitizeText(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('텍스트');
      expect(result).toContain('볼드');
    });

    it('스크립트를 완전히 제거해야 함', () => {
      const input = '안전한 텍스트<script>alert("XSS")</script>';
      const result = sanitizeText(input);
      expect(result).toBe('안전한 텍스트');
    });
  });

  describe('sanitizeURL', () => {
    it('HTTPS URL을 허용해야 함', () => {
      const input = 'https://example.com';
      const result = sanitizeURL(input);
      expect(result).toBe(input);
    });

    it('HTTP URL을 허용해야 함', () => {
      const input = 'http://example.com';
      const result = sanitizeURL(input);
      expect(result).toBe(input);
    });

    it('javascript: 프로토콜을 차단해야 함', () => {
      const input = 'javascript:alert("XSS")';
      const result = sanitizeURL(input);
      expect(result).toBe('');
    });

    it('data: 프로토콜을 차단해야 함', () => {
      const input = 'data:text/html,<script>alert("XSS")</script>';
      const result = sanitizeURL(input);
      expect(result).toBe('');
    });

    it('잘못된 URL을 빈 문자열로 반환해야 함', () => {
      const input = 'not-a-valid-url';
      const result = sanitizeURL(input);
      expect(result).toBe('');
    });
  });
});
