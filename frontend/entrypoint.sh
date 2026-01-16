#!/bin/sh
# Railway 런타임 환경변수를 config.js로 생성하는 스크립트

# 환경변수에서 값 가져오기 (기본값 설정)
API_BASE_URL="${VITE_API_BASE_URL:-}"
WS_BASE_URL="${VITE_WS_BASE_URL:-}"
ACCESS_CODE="${VITE_ACCESS_CODE:-1127}"
API_KEY="${VITE_API_KEY:-}"
NODE_ENV="${NODE_ENV:-production}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

# config.js 생성
cat > /usr/share/nginx/html/config.js << EOF
// Railway 런타임 설정 (자동 생성됨)
window.RUNTIME_CONFIG = {
  "API_BASE_URL": "${API_BASE_URL}",
  "WS_BASE_URL": "${WS_BASE_URL}",
  "NODE_ENV": "${NODE_ENV}",
  "TIMESTAMP": "${TIMESTAMP}",
  "RAILWAY_ENVIRONMENT": "${RAILWAY_ENVIRONMENT}",
  "ACCESS_CODE": "${ACCESS_CODE}",
  "API_KEY": "${API_KEY}"
};

// 런타임 설정 로드 확인 (보안을 위해 API Key 마스킹)
const maskedConfig = {
  ...window.RUNTIME_CONFIG,
  API_KEY: window.RUNTIME_CONFIG.API_KEY
    ? window.RUNTIME_CONFIG.API_KEY.substring(0, 8) + '...' + window.RUNTIME_CONFIG.API_KEY.substring(window.RUNTIME_CONFIG.API_KEY.length - 4)
    : 'NOT_SET'
};
console.log('🚀 Railway Runtime Config Loaded:', maskedConfig);
console.log('🔐 API Key Status:', window.RUNTIME_CONFIG.API_KEY ? '✅ Loaded' : '❌ NOT SET');
EOF

# API Key 마스킹 처리
if [ -n "$API_KEY" ]; then
  MASKED_API_KEY="${API_KEY:0:8}...${API_KEY: -4}"
  API_KEY_STATUS="✅ Loaded ($MASKED_API_KEY)"
else
  API_KEY_STATUS="❌ NOT SET"
fi

echo "========================================="
echo "✅ Railway Runtime Config Generated"
echo "========================================="
echo "📋 ACCESS_CODE: ${ACCESS_CODE}"
echo "🔐 API_KEY: ${API_KEY_STATUS}"
echo "🌐 API_BASE_URL: ${API_BASE_URL}"
echo "========================================="

# nginx 설정 파일 생성 (포트 치환)
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# nginx 실행
exec nginx -g 'daemon off;'