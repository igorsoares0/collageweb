import type { FrameWindow } from "@/lib/persistence/AssetRepository";

export interface AnalyzedImage {
  dataUrl: string;
  // Image width / height.
  aspect: number;
  // The transparent region as a normalized rect, or null if the image has no
  // meaningful transparency (i.e. it's not a frame).
  window: FrameWindow | null;
}

const ALPHA_THRESHOLD = 12; // treat alpha <= this as "hole"
const MIN_HOLE_FRACTION = 0.02; // ignore stray transparent speckle

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

// Reads a PNG upload and finds its transparent window (the polaroid hole) by
// scanning the alpha channel for the bounding box of transparent pixels — the
// same measurement the catalog needs, done in the browser so upload is one step.
// Returns window=null when there's no real transparency (a sticker, or a frame
// with no hole — the caller rejects the latter).
export async function analyzeImage(file: File): Promise<AnalyzedImage> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const aspect = w / h;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { dataUrl, aspect, window: null };
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let holes = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha <= ALPHA_THRESHOLD) {
        holes++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || holes < w * h * MIN_HOLE_FRACTION) {
    return { dataUrl, aspect, window: null };
  }

  const window: FrameWindow = {
    x: minX / w,
    y: minY / h,
    w: (maxX - minX + 1) / w,
    h: (maxY - minY + 1) / h,
  };
  return { dataUrl, aspect, window };
}
