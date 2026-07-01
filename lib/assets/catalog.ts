import { FRAME_ASSETS } from "@/lib/template/factory";
import type { AssetRecord } from "@/lib/persistence/AssetRepository";

// A frame ready to render/apply, whatever its source. Seeds (bundled in
// /public) and uploaded assets (base64 data URLs from the catalog) collapse to
// the same shape so the canvas and the properties panel don't care which it is.
export interface ResolvedFrame {
  id: string;
  label: string;
  src: string;
  aspect: number;
  window: { x: number; y: number; w: number; h: number };
}

// Bundled seeds first, then uploaded frames. The seeds keep older templates
// (which reference frame_polaroid_* ids) rendering even before the catalog
// loads; uploads add to the list without a code change.
export function resolveFrames(assets: AssetRecord[]): ResolvedFrame[] {
  const seeds: ResolvedFrame[] = FRAME_ASSETS.map((f) => ({
    id: f.id,
    label: f.label,
    src: f.src,
    aspect: f.aspect,
    window: f.window,
  }));
  const uploaded: ResolvedFrame[] = assets
    .filter((a): a is AssetRecord & { window: NonNullable<AssetRecord["window"]> } =>
      a.type === "frame" && a.window !== null
    )
    .map((a) => ({
      id: a.id,
      label: a.name,
      src: a.dataUrl,
      aspect: a.aspect,
      window: a.window,
    }));
  return [...seeds, ...uploaded];
}

export function resolveFrame(
  id: string | undefined,
  assets: AssetRecord[]
): ResolvedFrame | undefined {
  if (!id) return undefined;
  return resolveFrames(assets).find((f) => f.id === id);
}
