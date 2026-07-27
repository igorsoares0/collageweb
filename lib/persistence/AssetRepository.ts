// Uploadable editor assets (frames, stickers, designer photos) — the app-side
// catalog that used to be a hardcoded list. Stored in Neon as small base64
// images (like template thumbnails), so adding one is an upload, not a code
// change + app rebuild. "photo" assets are template content: layers/grid cells
// reference them by imageAssetId.

export type AssetType = "frame" | "sticker" | "photo";

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
  // Whether the app gates this asset behind a paid plan. Defaults to false
  // (free) for new assets; the app enforces the lock, the editor just marks it.
  premium: boolean;
  createdAt: string;
}

// What the client sends to create an asset (the server assigns id/createdAt).
export interface NewAsset {
  type: AssetType;
  name: string;
  dataUrl: string;
  aspect: number;
  window: FrameWindow | null;
  // Optional at creation; omitted means free (the server defaults it to false).
  premium?: boolean;
}

// Async seam (mirrors TemplateRepository): Neon-backed in the app, localStorage
// when NEXT_PUBLIC_USE_NEON is off.
export interface AssetRepository {
  list(): Promise<AssetRecord[]>;
  create(asset: NewAsset): Promise<AssetRecord>;
  // Flips the paid-plan gate on an existing asset; returns the updated record.
  setPremium(id: string, premium: boolean): Promise<AssetRecord>;
  remove(id: string): Promise<void>;
}
