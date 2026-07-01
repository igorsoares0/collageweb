// Uploadable editor assets (frames, stickers) — the app-side catalog that used
// to be a hardcoded list. Stored in Neon as small base64 PNGs (like template
// thumbnails), so adding one is an upload, not a code change + app rebuild.

export type AssetType = "frame" | "sticker";

// The transparent window of a frame, in normalized (0..1) image coordinates —
// where the user's photo shows through. Auto-detected on upload from the PNG's
// alpha channel; null for stickers (no window).
export interface FrameWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AssetRecord {
  id: string;
  type: AssetType;
  name: string;
  // data:image/...;base64,… — served inline, no separate blob store yet.
  dataUrl: string;
  // Image width / height; a framed image layer's bounds follow it.
  aspect: number;
  // Frames only; null for stickers.
  window: FrameWindow | null;
  createdAt: string;
}

// What the client sends to create an asset (the server assigns id/createdAt).
export interface NewAsset {
  type: AssetType;
  name: string;
  dataUrl: string;
  aspect: number;
  window: FrameWindow | null;
}

// Async seam (mirrors TemplateRepository): Neon-backed in the app, localStorage
// when NEXT_PUBLIC_USE_NEON is off.
export interface AssetRepository {
  list(): Promise<AssetRecord[]>;
  create(asset: NewAsset): Promise<AssetRecord>;
  remove(id: string): Promise<void>;
}
