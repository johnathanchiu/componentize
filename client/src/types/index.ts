// Client-only UI types (shared types import directly from @/shared/types)

export type StreamStatus = 'idle' | 'thinking' | 'acting' | 'success' | 'error';

export type PageWidthPreset = 'desktop' | 'tablet' | 'mobile';

export const PAGE_WIDTHS: Record<PageWidthPreset, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 375,
};

export interface PageStyle {
  width: number | PageWidthPreset;
  background?: string;
  padding?: number;
}
