/**
 * ConfigProvider
 *
 * 런타임 설정을 관리하고 적용하는 Provider
 * localStorage에서 사용자 설정을 로드하여 앱에 적용합니다.
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { APP_CONFIG, mergeConfig } from '../config';
import { applyPreset } from '../config/presets';
import { ConfigContext, type RuntimeConfig } from './ConfigContext';

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  console.log('🚀 [ConfigProvider] 컴포넌트 마운트됨!');
  const [config, setConfig] = useState<AppConfig>(APP_CONFIG);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);

  useEffect(() => {
    console.log('⚡ [ConfigProvider] useEffect 실행됨!');

    // localStorage에서 사용자 설정 로드
    const loadRuntimeConfig = () => {
      try {
        console.log('🔧 [ConfigProvider] localStorage에서 설정 로드 시작...');
        const saved = localStorage.getItem('customSettings');

        if (!saved) {
          console.log('⚠️ [ConfigProvider] localStorage에 저장된 설정이 없습니다.');
          return;
        }

        console.log('📦 [ConfigProvider] 저장된 설정:', saved);
        const parsed: RuntimeConfig = JSON.parse(saved);
        console.log('✅ [ConfigProvider] 파싱된 설정:', parsed);

        setRuntimeConfig(parsed);

        // 설정 적용
        applyRuntimeConfig(parsed);
      } catch (error) {
        console.error('❌ [ConfigProvider] 런타임 설정 로드 실패:', error);
      }
    };

    loadRuntimeConfig();
  }, []);

  const applyRuntimeConfig = (runtime: RuntimeConfig) => {
    console.log('🎨 [ConfigProvider] 런타임 설정 적용 시작:', runtime);
    let updatedConfig = { ...APP_CONFIG };

    // 색상 프리셋 적용
    if (runtime.preset) {
      console.log(`🎨 [ConfigProvider] 프리셋 "${runtime.preset}" 적용 중...`);
      const presetColors = applyPreset(runtime.preset);

      if (presetColors) {
        console.log('✅ [ConfigProvider] 프리셋 색상 가져오기 성공:', presetColors);
        // presetColors는 이미 Partial<ColorConfig> 형태이므로, 전체 객체를 재생성하여 colors를 머지
        const mergedColors = mergeConfig(updatedConfig.colors, presetColors);
        updatedConfig = { ...updatedConfig, colors: mergedColors };
        console.log('✅ [ConfigProvider] 색상 머지 완료:', updatedConfig.colors);
      } else {
        console.error(`❌ [ConfigProvider] 프리셋 "${runtime.preset}" 찾을 수 없음`);
      }
    }

    // 레이아웃 설정 적용
    if (runtime.layout) {
      console.log('📐 [ConfigProvider] 레이아웃 설정 적용:', runtime.layout);
      updatedConfig = mergeConfig(updatedConfig, { layout: runtime.layout });
      console.log('✅ [ConfigProvider] 레이아웃 머지 완료');
    }

    // 기능 플래그 적용
    if (runtime.features) {
      console.log('🚩 [ConfigProvider] 기능 플래그 적용:', runtime.features);
      updatedConfig = mergeConfig(updatedConfig, { features: runtime.features });
      console.log('✅ [ConfigProvider] 기능 플래그 머지 완료');

      // ⭐ window.RUNTIME_CONFIG 업데이트 (FeatureProvider와 연동)
      if (typeof window !== 'undefined') {
        window.RUNTIME_CONFIG = window.RUNTIME_CONFIG || {};
        window.RUNTIME_CONFIG.FEATURES = runtime.features;
        console.log('🌐 [ConfigProvider] window.RUNTIME_CONFIG.FEATURES 업데이트:', window.RUNTIME_CONFIG.FEATURES);
      }
    }

    console.log('🎉 [ConfigProvider] 최종 설정:', updatedConfig);
    setConfig(updatedConfig);
  };

  const updateConfig = (newConfig: RuntimeConfig) => {
    try {
      console.log('💾 [ConfigProvider] 설정 저장 시작:', newConfig);

      // localStorage에 저장
      const jsonString = JSON.stringify(newConfig);
      console.log('📦 [ConfigProvider] JSON 직렬화:', jsonString);
      localStorage.setItem('customSettings', jsonString);
      console.log('✅ [ConfigProvider] localStorage 저장 완료');

      setRuntimeConfig(newConfig);

      // 설정 적용
      applyRuntimeConfig(newConfig);

      console.log('🎉 [ConfigProvider] 설정 업데이트 완료!');
    } catch (error) {
      console.error('❌ [ConfigProvider] 설정 업데이트 실패:', error);
    }
  };

  const resetConfig = () => {
    try {
      console.log('🔄 [ConfigProvider] 설정 초기화 시작...');
      localStorage.removeItem('customSettings');
      setRuntimeConfig(null);
      setConfig(APP_CONFIG);
      console.log('✅ [ConfigProvider] 설정 초기화 완료');
    } catch (error) {
      console.error('❌ [ConfigProvider] 설정 초기화 실패:', error);
    }
  };

  // 현재 config 상태를 콘솔에 로그
  useEffect(() => {
    console.log('🔍 [ConfigProvider] 현재 config 상태:', config);
    console.log('🎨 [ConfigProvider] 현재 colors:', config.colors);
    console.log('📐 [ConfigProvider] 현재 layout:', config.layout);
  }, [config]);

  return (
    <ConfigContext.Provider value={{ config, runtimeConfig, updateConfig, resetConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export default ConfigProvider;
