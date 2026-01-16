// 접근 제어 유틸리티 함수들

const SESSION_KEY = 'admin_access_granted';

// 접근 권한 확인 유틸리티
export function hasAdminAccess(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

// 접근 권한 제거 유틸리티
export function removeAdminAccess(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// 접근 권한 설정 유틸리티
export function setAdminAccess(): void {
  sessionStorage.setItem(SESSION_KEY, 'true');
}