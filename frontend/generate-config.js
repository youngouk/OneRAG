#!/usr/bin/env node
// Railway에서 런타임 설정을 동적으로 생성하는 스크립트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Railway 환경 변수에서 URL 가져오기
const getAPIBaseURL = () => {
  if (process.env.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }
  
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }
  
  // Railway 환경에서 같은 서비스라면
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  
  return '';
};

const getWSBaseURL = () => {
  if (process.env.VITE_WS_BASE_URL) {
    return process.env.VITE_WS_BASE_URL;
  }
  
  if (process.env.WS_BASE_URL) {
    return process.env.WS_BASE_URL;
  }
  
  // Railway 환경에서 WebSocket URL 생성
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `wss://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  
  return '';
};

// Feature Flag 로드 함수
const loadFeatureFlags = () => {
  const parseBool = (val) => {
    if (val === undefined || val === null) return undefined;
    return val.toLowerCase() === 'true';
  };

  return {
    chatbot: {
      enabled: parseBool(process.env.VITE_FEATURE_CHATBOT) ?? true,
      streaming: parseBool(process.env.VITE_FEATURE_CHATBOT_STREAMING) ?? true,
      history: parseBool(process.env.VITE_FEATURE_CHATBOT_HISTORY) ?? true,
      sessionManagement: parseBool(process.env.VITE_FEATURE_CHATBOT_SESSION) ?? true,
      markdown: parseBool(process.env.VITE_FEATURE_CHATBOT_MARKDOWN) ?? true,
    },
    documentManagement: {
      enabled: parseBool(process.env.VITE_FEATURE_DOCUMENTS) ?? true,
      upload: parseBool(process.env.VITE_FEATURE_DOCUMENTS_UPLOAD) ?? true,
      bulkDelete: parseBool(process.env.VITE_FEATURE_DOCUMENTS_BULK_DELETE) ?? true,
      search: parseBool(process.env.VITE_FEATURE_DOCUMENTS_SEARCH) ?? true,
      pagination: parseBool(process.env.VITE_FEATURE_DOCUMENTS_PAGINATION) ?? true,
      dragAndDrop: parseBool(process.env.VITE_FEATURE_DOCUMENTS_DND) ?? true,
      preview: parseBool(process.env.VITE_FEATURE_DOCUMENTS_PREVIEW) ?? true,
    },
    admin: {
      enabled: parseBool(process.env.VITE_FEATURE_ADMIN) ?? true,
      userManagement: parseBool(process.env.VITE_FEATURE_ADMIN_USERS) ?? true,
      systemStats: parseBool(process.env.VITE_FEATURE_ADMIN_STATS) ?? true,
      qdrantManagement: parseBool(process.env.VITE_FEATURE_ADMIN_QDRANT) ?? true,
      accessControl: parseBool(process.env.VITE_FEATURE_ADMIN_ACCESS) ?? true,
    },
    prompts: {
      enabled: parseBool(process.env.VITE_FEATURE_PROMPTS) ?? true,
      templates: parseBool(process.env.VITE_FEATURE_PROMPTS_TEMPLATES) ?? true,
      history: parseBool(process.env.VITE_FEATURE_PROMPTS_HISTORY) ?? true,
    },
    analysis: {
      enabled: parseBool(process.env.VITE_FEATURE_ANALYSIS) ?? true,
      realtime: parseBool(process.env.VITE_FEATURE_ANALYSIS_REALTIME) ?? true,
      export: parseBool(process.env.VITE_FEATURE_ANALYSIS_EXPORT) ?? true,
      visualization: parseBool(process.env.VITE_FEATURE_ANALYSIS_VIZ) ?? true,
    },
  };
};

// API Key 로드 (보안을 위해 마스킹하여 로그 출력)
const apiKey = process.env.VITE_API_KEY || process.env.API_KEY || '';
const maskedApiKey = apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT_SET';

console.log('🔐 API Key Status:', apiKey ? `✅ Loaded (${maskedApiKey})` : '❌ NOT SET');
console.log('📋 Environment Variables:', {
  VITE_API_KEY: process.env.VITE_API_KEY ? `${process.env.VITE_API_KEY.substring(0, 8)}...` : 'undefined',
  API_KEY: process.env.API_KEY ? `${process.env.API_KEY.substring(0, 8)}...` : 'undefined',
});

const config = {
  API_BASE_URL: getAPIBaseURL(),
  WS_BASE_URL: getWSBaseURL(),
  NODE_ENV: process.env.NODE_ENV || 'production',
  TIMESTAMP: new Date().toISOString(),
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || null,
  // Railway 환경변수에서 접근코드 가져오기
  ACCESS_CODE: process.env.VITE_ACCESS_CODE || process.env.ACCESS_CODE || '1127',
  // 백엔드 API 인증 키
  API_KEY: apiKey,
  // Feature Flag 설정 추가
  FEATURES: loadFeatureFlags(),
};

// config.js 파일 생성
const configContent = `// Railway 런타임 설정 (자동 생성됨)
window.RUNTIME_CONFIG = ${JSON.stringify(config, null, 2)};

// 런타임 설정 로드 확인 (보안을 위해 API Key 마스킹)
const maskedConfig = {
  ...window.RUNTIME_CONFIG,
  API_KEY: window.RUNTIME_CONFIG.API_KEY
    ? window.RUNTIME_CONFIG.API_KEY.substring(0, 8) + '...' + window.RUNTIME_CONFIG.API_KEY.substring(window.RUNTIME_CONFIG.API_KEY.length - 4)
    : 'NOT_SET'
};
console.log('🚀 Railway Runtime Config Loaded:', maskedConfig);
console.log('🔐 API Key Status:', window.RUNTIME_CONFIG.API_KEY ? '✅ Loaded' : '❌ NOT SET');`;

// public/config.js에 쓰기
const outputPath = path.join(__dirname, 'dist', 'config.js');
fs.writeFileSync(outputPath, configContent, 'utf8');

console.log('✅ Runtime config generated:', outputPath);
console.log('📋 Config:', config);