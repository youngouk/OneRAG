/**
 * 반응형 이미지 컴포넌트
 * WebP 포맷 지원 및 다양한 해상도 대응
 */
import React from 'react';
import { LazyImage } from './LazyImage';
import { cn } from '@/lib/utils';

export interface ImageSource {
  srcSet: string;
  type?: string;
  media?: string;
  sizes?: string;
}

export interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: string | number;
  height?: string | number;
  sources?: ImageSource[];
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

/**
 * 반응형 이미지 컴포넌트
 *
 * 사용 예시:
 * ```tsx
 * <ResponsiveImage
 *   src="/images/photo.jpg"
 *   alt="설명"
 *   sources={[
 *     { srcSet: "/images/photo.webp", type: "image/webp" },
 *     { srcSet: "/images/photo-mobile.jpg", media: "(max-width: 768px)" }
 *   ]}
 * />
 * ```
 */
export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  className,
  width,
  height,
  sources = [],
  loading = 'lazy',
  onLoad,
  onError,
  objectFit = 'cover',
}) => {
  // loading="lazy"인 경우 LazyImage 사용
  if (loading === 'lazy') {
    return (
      <picture
        style={{ width, height }}
        className={cn("block", className)}
      >
        {sources.map((source, index) => (
          <source
            key={index}
            srcSet={source.srcSet}
            type={source.type}
            media={source.media}
            sizes={source.sizes}
          />
        ))}
        <LazyImage
          src={src}
          alt={alt}
          width={width}
          height={height}
          onLoad={onLoad}
          onError={onError}
          className={cn(
            objectFit === 'cover' && "object-cover",
            objectFit === 'contain' && "object-contain",
            objectFit === 'fill' && "object-fill",
            objectFit === 'none' && "object-none",
            objectFit === 'scale-down' && "object-scale-down"
          )}
        />
      </picture>
    );
  }

  // eager loading
  return (
    <picture
      style={{ width, height }}
      className={cn("block overflow-hidden", className)}
    >
      {sources.map((source, index) => (
        <source
          key={index}
          srcSet={source.srcSet}
          type={source.type}
          media={source.media}
          sizes={source.sizes}
        />
      ))}
      <img
        src={src}
        alt={alt}
        loading="eager"
        onLoad={onLoad}
        onError={onError}
        className={cn(
          "w-full h-full",
          objectFit === 'cover' && "object-cover",
          objectFit === 'contain' && "object-contain",
          objectFit === 'fill' && "object-fill",
          objectFit === 'none' && "object-none",
          objectFit === 'scale-down' && "object-scale-down"
        )}
      />
    </picture>
  );
};


/**
 * WebP 이미지 생성 헬퍼
 * 기존 이미지 경로에서 WebP 버전 생성
 */
// eslint-disable-next-line react-refresh/only-export-components
export function createWebPSource(imagePath: string): ImageSource {
  const webpPath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  return {
    srcSet: webpPath,
    type: 'image/webp',
  };
}

/**
 * 반응형 srcSet 생성 헬퍼
 * 다양한 해상도 이미지 경로 생성
 */
// eslint-disable-next-line react-refresh/only-export-components
export function createResponsiveSrcSet(
  basePath: string,
  sizes: number[] = [320, 640, 960, 1280, 1920]
): string {
  return sizes
    .map((size) => {
      const path = basePath.replace(/(\.\w+)$/, `@${size}w$1`);
      return `${path} ${size}w`;
    })
    .join(', ');
}

/**
 * sizes 속성 생성 헬퍼
 * 반응형 이미지 크기 지정
 */
// eslint-disable-next-line react-refresh/only-export-components
export function createSizesAttribute(
  breakpoints: Array<{ maxWidth: string; size: string }>
): string {
  return breakpoints
    .map((bp) => `(max-width: ${bp.maxWidth}) ${bp.size}`)
    .concat(['100vw'])
    .join(', ');
}

/**
 * 사전 정의된 반응형 이미지 프리셋
 */
// eslint-disable-next-line react-refresh/only-export-components
export const imagePresets = {
  /**
   * 전체 너비 히어로 이미지
   */
  hero: (basePath: string): ImageSource[] => [
    createWebPSource(basePath),
    {
      srcSet: createResponsiveSrcSet(basePath),
      sizes: '100vw',
    },
  ],

  /**
   * 카드 썸네일 (최대 400px)
   */
  thumbnail: (basePath: string): ImageSource[] => [
    createWebPSource(basePath),
    {
      srcSet: createResponsiveSrcSet(basePath, [200, 400]),
      sizes: createSizesAttribute([
        { maxWidth: '768px', size: '50vw' },
        { maxWidth: '1024px', size: '33vw' },
      ]),
    },
  ],

  /**
   * 아바타 (고정 크기)
   */
  avatar: (basePath: string): ImageSource[] => [
    createWebPSource(basePath),
    {
      srcSet: `${basePath} 1x, ${basePath.replace(/(\.\w+)$/, '@2x$1')} 2x`,
    },
  ],

  /**
   * 모바일 우선 반응형
   */
  mobileFriendly: (basePath: string): ImageSource[] => [
    createWebPSource(basePath),
    {
      srcSet: createResponsiveSrcSet(basePath, [320, 640, 960]),
      media: '(max-width: 768px)',
    },
    {
      srcSet: createResponsiveSrcSet(basePath, [960, 1280, 1920]),
      media: '(min-width: 769px)',
    },
  ],
};
