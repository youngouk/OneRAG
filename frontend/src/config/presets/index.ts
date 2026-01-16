/* eslint-disable no-restricted-syntax */
/**
 * 테마 프리셋 시스템
 *
 * 다양한 브랜드 색상 조합을 미리 정의하여 쉽게 적용할 수 있도록 합니다.
 * 고객사별로 적합한 프리셋을 선택하거나 커스터마이징할 수 있습니다.
 *
 * 이 파일은 색상 프리셋 정의를 위해 hex/rgba 색상을 사용합니다.
 */

import type { ColorConfig } from '../colors';

/**
 * 테마 프리셋 인터페이스
 */
export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: Partial<ColorConfig>;
  preview: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
}

/**
 * 테마 프리셋 목록
 */
export const THEME_PRESETS: Record<string, ThemePreset> = {
  // 기본 모노톤 (현재 설정)
  monotone: {
    id: 'monotone',
    name: '모노톤',
    description: '깔끔한 흑백 디자인으로 전문적인 느낌',
    colors: {
      brand: {
        primary: {
          light: 'rgba(0, 0, 0, 0.8)',
          dark: 'rgba(255, 255, 255, 0.9)',
        },
        secondary: {
          light: 'rgba(0, 0, 0, 0.6)',
          dark: 'rgba(255, 255, 255, 0.7)',
        },
        accent: {
          light: 'rgba(0, 0, 0, 0.4)',
          dark: 'rgba(255, 255, 255, 0.5)',
        },
      },
    },
    preview: {
      primaryColor: '#000000',
      secondaryColor: '#666666',
      accentColor: '#999999',
    },
  },

  // 모던 블루
  modernBlue: {
    id: 'modernBlue',
    name: '모던 블루',
    description: '신뢰감 있는 블루 톤으로 기업 이미지에 적합',
    colors: {
      brand: {
        primary: {
          light: '#2196f3',
          dark: '#42a5f5',
        },
        secondary: {
          light: '#1976d2',
          dark: '#1e88e5',
        },
        accent: {
          light: '#03a9f4',
          dark: '#29b6f6',
        },
      },
      interactive: {
        default: {
          light: 'rgba(33, 150, 243, 0.08)',
          dark: 'rgba(66, 165, 245, 0.12)',
        },
        hover: {
          light: 'rgba(33, 150, 243, 0.12)',
          dark: 'rgba(66, 165, 245, 0.16)',
        },
        active: {
          light: 'rgba(33, 150, 243, 0.16)',
          dark: 'rgba(66, 165, 245, 0.24)',
        },
      },
    },
    preview: {
      primaryColor: '#2196f3',
      secondaryColor: '#1976d2',
      accentColor: '#03a9f4',
    },
  },

  // 코퍼레이트 그린
  corporateGreen: {
    id: 'corporateGreen',
    name: '코퍼레이트 그린',
    description: '친환경적이고 안정적인 그린 톤',
    colors: {
      brand: {
        primary: {
          light: '#4caf50',
          dark: '#66bb6a',
        },
        secondary: {
          light: '#388e3c',
          dark: '#43a047',
        },
        accent: {
          light: '#8bc34a',
          dark: '#9ccc65',
        },
      },
      interactive: {
        default: {
          light: 'rgba(76, 175, 80, 0.08)',
          dark: 'rgba(102, 187, 106, 0.12)',
        },
        hover: {
          light: 'rgba(76, 175, 80, 0.12)',
          dark: 'rgba(102, 187, 106, 0.16)',
        },
        active: {
          light: 'rgba(76, 175, 80, 0.16)',
          dark: 'rgba(102, 187, 106, 0.24)',
        },
      },
    },
    preview: {
      primaryColor: '#4caf50',
      secondaryColor: '#388e3c',
      accentColor: '#8bc34a',
    },
  },

  // 엘레강트 퍼플
  elegantPurple: {
    id: 'elegantPurple',
    name: '엘레강트 퍼플',
    description: '고급스럽고 창의적인 퍼플 톤',
    colors: {
      brand: {
        primary: {
          light: '#9c27b0',
          dark: '#ab47bc',
        },
        secondary: {
          light: '#7b1fa2',
          dark: '#8e24aa',
        },
        accent: {
          light: '#ba68c8',
          dark: '#ce93d8',
        },
      },
      interactive: {
        default: {
          light: 'rgba(156, 39, 176, 0.08)',
          dark: 'rgba(171, 71, 188, 0.12)',
        },
        hover: {
          light: 'rgba(156, 39, 176, 0.12)',
          dark: 'rgba(171, 71, 188, 0.16)',
        },
        active: {
          light: 'rgba(156, 39, 176, 0.16)',
          dark: 'rgba(171, 71, 188, 0.24)',
        },
      },
    },
    preview: {
      primaryColor: '#9c27b0',
      secondaryColor: '#7b1fa2',
      accentColor: '#ba68c8',
    },
  },

  // 웜 오렌지
  warmOrange: {
    id: 'warmOrange',
    name: '웜 오렌지',
    description: '따뜻하고 활기찬 오렌지 톤',
    colors: {
      brand: {
        primary: {
          light: '#ff9800',
          dark: '#ffa726',
        },
        secondary: {
          light: '#f57c00',
          dark: '#fb8c00',
        },
        accent: {
          light: '#ffb74d',
          dark: '#ffcc80',
        },
      },
      interactive: {
        default: {
          light: 'rgba(255, 152, 0, 0.08)',
          dark: 'rgba(255, 167, 38, 0.12)',
        },
        hover: {
          light: 'rgba(255, 152, 0, 0.12)',
          dark: 'rgba(255, 167, 38, 0.16)',
        },
        active: {
          light: 'rgba(255, 152, 0, 0.16)',
          dark: 'rgba(255, 167, 38, 0.24)',
        },
      },
    },
    preview: {
      primaryColor: '#ff9800',
      secondaryColor: '#f57c00',
      accentColor: '#ffb74d',
    },
  },

  // 프로페셔널 그레이
  professionalGray: {
    id: 'professionalGray',
    name: '프로페셔널 그레이',
    description: '차분하고 전문적인 그레이 톤',
    colors: {
      brand: {
        primary: {
          light: '#607d8b',
          dark: '#78909c',
        },
        secondary: {
          light: '#455a64',
          dark: '#546e7a',
        },
        accent: {
          light: '#90a4ae',
          dark: '#b0bec5',
        },
      },
      interactive: {
        default: {
          light: 'rgba(96, 125, 139, 0.08)',
          dark: 'rgba(120, 144, 156, 0.12)',
        },
        hover: {
          light: 'rgba(96, 125, 139, 0.12)',
          dark: 'rgba(120, 144, 156, 0.16)',
        },
        active: {
          light: 'rgba(96, 125, 139, 0.16)',
          dark: 'rgba(120, 144, 156, 0.24)',
        },
      },
    },
    preview: {
      primaryColor: '#607d8b',
      secondaryColor: '#455a64',
      accentColor: '#90a4ae',
    },
  },

  // 바이브런트 레드
  vibrantRed: {
    id: 'vibrantRed',
    name: '바이브런트 레드',
    description: '강렬하고 열정적인 레드 톤',
    colors: {
      brand: {
        primary: {
          light: '#f44336',
          dark: '#ef5350',
        },
        secondary: {
          light: '#d32f2f',
          dark: '#e53935',
        },
        accent: {
          light: '#ff5252',
          dark: '#ff6659',
        },
      },
      interactive: {
        default: {
          light: 'rgba(244, 67, 54, 0.08)',
          dark: 'rgba(239, 83, 80, 0.12)',
        },
        hover: {
          light: 'rgba(244, 67, 54, 0.12)',
          dark: 'rgba(239, 83, 80, 0.16)',
        },
        active: {
          light: 'rgba(244, 67, 54, 0.16)',
          dark: 'rgba(239, 83, 80, 0.24)',
        },
      },
    },
    preview: {
      primaryColor: '#f44336',
      secondaryColor: '#d32f2f',
      accentColor: '#ff5252',
    },
  },

  // 틸 시안
  tealCyan: {
    id: 'tealCyan',
    name: '틸 시안',
    description: '시원하고 현대적인 틸 톤',
    colors: {
      brand: {
        primary: {
          light: '#009688',
          dark: '#26a69a',
        },
        secondary: {
          light: '#00796b',
          dark: '#00897b',
        },
        accent: {
          light: '#4db6ac',
          dark: '#80cbc4',
        },
      },
      interactive: {
        default: {
          light: 'rgba(0, 150, 136, 0.08)',
          dark: 'rgba(38, 166, 154, 0.12)',
        },
        hover: {
          light: 'rgba(0, 150, 136, 0.12)',
          dark: 'rgba(38, 166, 154, 0.16)',
        },
        active: {
          light: 'rgba(0, 150, 136, 0.16)',
          dark: 'rgba(38, 166, 154, 0.24)',
        },
      },
    },
    preview: {
      primaryColor: '#009688',
      secondaryColor: '#00796b',
      accentColor: '#4db6ac',
    },
  },
};

/**
 * 프리셋 ID 목록
 */
export const PRESET_IDS = Object.keys(THEME_PRESETS);

/**
 * 프리셋 조회
 */
export function getPreset(presetId: string): ThemePreset | undefined {
  return THEME_PRESETS[presetId];
}

/**
 * 모든 프리셋 목록 조회
 */
export function getAllPresets(): ThemePreset[] {
  return Object.values(THEME_PRESETS);
}

/**
 * 프리셋 적용
 *
 * 주의: 이 함수는 색상 설정만 반환합니다.
 * 실제 적용은 APP_CONFIG를 업데이트하거나 런타임 설정 로드를 통해 이루어집니다.
 */
export function applyPreset(presetId: string): Partial<ColorConfig> | null {
  console.log(`🎨 [applyPreset] 프리셋 "${presetId}" 조회 중...`);
  const preset = getPreset(presetId);

  if (!preset) {
    console.error(`❌ [applyPreset] 프리셋을 찾을 수 없습니다: ${presetId}`);
    console.log('📋 [applyPreset] 사용 가능한 프리셋:', PRESET_IDS);
    return null;
  }

  console.log(`✅ [applyPreset] 프리셋 "${presetId}" 찾음:`, preset);
  console.log(`🎨 [applyPreset] 반환할 색상:`, preset.colors);

  return preset.colors;
}

/**
 * 프리셋을 JSON 형식으로 내보내기
 *
 * public/config/ 폴더에 저장할 수 있는 JSON 형식으로 변환합니다.
 */
export function exportPresetAsJSON(presetId: string): string | null {
  const colors = applyPreset(presetId);
  if (!colors) {
    return null;
  }

  const config = {
    colors,
  };

  return JSON.stringify(config, null, 2);
}
