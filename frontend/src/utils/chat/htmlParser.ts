/**
 * HTML 콘텐츠 파싱 유틸리티
 * 기존 Regex 기반 파싱의 보안 취약점과 불완전성을 해결하기 위해 DOMParser를 사용합니다.
 */

export const parseHtmlContent = (text: string): string => {
  if (!text) return text;

  // HTML 태그가 없으면 바로 반환 (성능 최적화)
  if (!/<[^>]+>/.test(text)) return text;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    // 1. 불필요한 속성 제거 (보안 및 데이터 정제)
    const allElements = doc.body.querySelectorAll('*');
    allElements.forEach((el) => {
      el.removeAttribute('style');
      el.removeAttribute('class');
      el.removeAttribute('id');
      // data- 속성 제거
      const attributes = Array.from(el.attributes);
      attributes.forEach((attr) => {
        if (attr.name.startsWith('data-')) {
          el.removeAttribute(attr.name);
        }
      });
    });

    // 2. 테이블 처리
    const tables = doc.querySelectorAll('table');
    tables.forEach((table) => {
      let tableText = '\n📊 테이블\n────────────────────\n';
      const rows = table.querySelectorAll('tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td, th');
        const cellTexts: string[] = [];
        cells.forEach((cell) => {
          cellTexts.push(cell.textContent?.trim() || '');
        });
        tableText += cellTexts.join(' | ') + '\n';
      });
      tableText += '────────────────────\n';

      // 테이블 요소를 텍스트 노드로 교체
      const textNode = doc.createTextNode(tableText);
      table.parentNode?.replaceChild(textNode, table);
    });

    // 3. 블록 레벨 요소 처리 (줄바꿈)
    const blockElements = doc.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, br, hr');
    blockElements.forEach((el) => {
      // p, div, h 태그 등은 앞뒤로 줄바꿈 추가
      // 단순히 replaceWith를 하면 구조가 깨질 수 있으므로, 
      // 텍스트 내용은 유지하되 줄바꿈을 문맥에 맞게 추가하는 로직이 필요함.
      // 하지만 간단한 텍스트 추출을 위해 textContent를 활용하는 방식이 더 안전함.

      if (el.tagName === 'BR') {
        el.replaceWith('\n');
      } else if (el.tagName === 'HR') {
        el.replaceWith('\n────────────────────\n');
      } else if (el.tagName === 'LI') {
        el.prepend('• ');
        el.append('\n');
      } else if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
        el.prepend('\n\n📋 ');
        el.append('\n');
      } else if (el.tagName === 'P' || el.tagName === 'DIV') {
        el.append('\n\n');
      }
    });

    // 강조 태그 처리
    const boldElements = doc.querySelectorAll('strong, b');
    boldElements.forEach(el => {
      el.textContent = `**${el.textContent}**`;
    });

    const italicElements = doc.querySelectorAll('em, i');
    italicElements.forEach(el => {
      el.textContent = `*${el.textContent}*`;
    });

    // 4. 최종 텍스트 추출
    let parsedText = doc.body.textContent || '';

    // 5. 텍스트 정리
    parsedText = parsedText
      .replace(/^[ \t]+|[ \t]+$/gm, '') // 줄별 앞뒤 공백 제거
      .replace(/\n{3,}/g, '\n\n') // 3개 이상 연속 줄바꿈 -> 2개로
      .replace(/[ \t]{2,}/g, ' ') // 연속 공백 제거
      .trim();

    return parsedText;

  } catch (error) {
    console.error('HTML parsing failed:', error);
    return text.replace(/<[^>]+>/g, ''); // Fallback to basic stripping
  }
};
