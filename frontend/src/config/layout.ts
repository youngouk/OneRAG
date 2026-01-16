/**
 * 레이아웃 설정 파일
 *
 * 모든 레이아웃 관련 하드코딩 값을 중앙 집중 관리
 * 고객사별 UI 커스터마이징이 용이하도록 설계
 */

export interface LayoutConfig {
  // 사이드바 설정
  sidebar: {
    width: number; // 펼쳐진 상태 너비 (px)
    collapsedWidth: number; // 접힌 상태 너비 (px)
    position: 'left' | 'right'; // 사이드바 위치
    showOnMobile: boolean; // 모바일에서 사이드바 표시 여부
    collapseBreakpoint: number; // 자동 접힘 breakpoint (px)
  };

  // 헤더 설정
  header: {
    height: number; // 헤더 높이 (px)
    showLogo: boolean; // 로고 표시 여부
    showTitle: boolean; // 타이틀 표시 여부
    showSearch: boolean; // 검색바 표시 여부
    sticky: boolean; // 고정 헤더 여부
  };

  // 콘텐츠 영역 설정
  content: {
    maxWidth: number; // 최대 너비 (px, 0 = 무제한)
    padding: number; // 패딩 (px)
    paddingMobile: number; // 모바일 패딩 (px)
    gap: number; // 요소 간 간격 (px)
  };

  // 반응형 breakpoints
  breakpoints: {
    xs: number; // Extra small (모바일)
    sm: number; // Small (태블릿)
    md: number; // Medium (작은 데스크톱)
    lg: number; // Large (데스크톱)
    xl: number; // Extra large (큰 화면)
  };

  // 간격 시스템
  spacing: {
    unit: number; // 기본 단위 (px)
    xs: number; // 4px
    sm: number; // 8px
    md: number; // 16px
    lg: number; // 24px
    xl: number; // 32px
    xxl: number; // 48px
  };

  // 애니메이션 설정
  animation: {
    duration: {
      shortest: number; // 150ms
      shorter: number; // 200ms
      short: number; // 250ms
      standard: number; // 300ms
      complex: number; // 375ms
      enteringScreen: number; // 225ms
      leavingScreen: number; // 195ms
    };
    easing: {
      easeInOut: string;
      easeOut: string;
      easeIn: string;
      sharp: string;
    };
  };

  // Z-index 계층
  zIndex: {
    mobileStepper: number; // 1000
    appBar: number; // 1100
    drawer: number; // 1200
    modal: number; // 1300
    snackbar: number; // 1400
    tooltip: number; // 1500
  };

  // 그림자 설정
  shadow: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };

  // 테두리 반경
  borderRadius: {
    xs: number; // 2px
    sm: number; // 4px
    md: number; // 8px
    lg: number; // 12px
    xl: number; // 16px
    round: string; // 50%
  };
}

/**
 * 기본 레이아웃 설정
 * 고객사별 커스터마이징 시 이 값들을 변경하세요.
 */
export const LAYOUT_CONFIG: LayoutConfig = {
  sidebar: {
    width: 240,
    collapsedWidth: 60,
    position: 'left',
    showOnMobile: false,
    collapseBreakpoint: 960, // md breakpoint
  },

  header: {
    height: 64,
    showLogo: true,
    showTitle: true,
    showSearch: false,
    sticky: true,
  },

  content: {
    maxWidth: 1440,
    padding: 24,
    paddingMobile: 16,
    gap: 16,
  },

  breakpoints: {
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1920,
  },

  spacing: {
    unit: 8,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  animation: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },

  zIndex: {
    mobileStepper: 1000,
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500,
  },

  /* eslint-disable no-restricted-syntax */
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  /* eslint-enable no-restricted-syntax */

  borderRadius: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: '50%',
  },
} as const;

/**
 * 헬퍼 함수: spacing 값 계산
 * @param multiplier spacing unit의 배수
 * @returns px 값
 */
export const getSpacing = (multiplier: number): number => {
  return LAYOUT_CONFIG.spacing.unit * multiplier;
};

/**
 * 헬퍼 함수: 반응형 여부 확인
 * @param windowWidth 현재 윈도우 너비
 * @param breakpoint breakpoint 이름
 * @returns boolean
 */
export const isBreakpoint = (windowWidth: number, breakpoint: keyof LayoutConfig['breakpoints']): boolean => {
  return windowWidth >= LAYOUT_CONFIG.breakpoints[breakpoint];
};

/**
 * 헬퍼 함수: 사이드바 자동 접힘 여부
 * @param windowWidth 현재 윈도우 너비
 * @returns boolean
 */
export const shouldCollapseSidebar = (windowWidth: number): boolean => {
  return windowWidth < LAYOUT_CONFIG.sidebar.collapseBreakpoint;
};

export default LAYOUT_CONFIG;
