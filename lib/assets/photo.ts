import type {
  AssetRecord,
  NewAsset,
} from "@/lib/persistence/AssetRepository";

// Designer photos live in the same catalog as frames/stickers (small base64
// rows in Neon); layers/cells reference them by imageAssetId. Uploads are
// downscaled and re-encoded as JPEG so a camera-roll original never blows the
// API's row cap.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export function resolvePhoto(
  id: string | undefined,
  assets: AssetRecord[]
): AssetRecord | undefined {
  if (!id) return undefined;
  return assets.find((a) => a.type === "photo" && a.id === id);
}

// Programmatic file picker, so the canvas can offer "double-click to place a
// photo" without keeping a hidden <input> in the tree.
export function pickPhotoFile(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? undefined));
    input.addEventListener("cancel", () => resolve(undefined));
    input.click();
  });
}

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

// Uploads a photo into the asset catalog (downscaled, JPEG) and returns the
// created record; `create` is the asset store's create so the catalog updates
// in place.
export async function uploadPhotoAsset(
  file: File,
  create: (asset: NewAsset) => Promise<AssetRecord>
): Promise<AssetRecord> {
  const img = await loadImage(await readAsDataUrl(file));
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return create({
    type: "photo",
    name: file.name.replace(/\.[^.]+$/, ""),
    dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    aspect: canvas.width / canvas.height,
    window: null,
  });
}

// object-fit: cover — the centered crop rect, in the image's natural pixels,
// that fills a width×height box without stretching.
export function coverCrop(
  img: HTMLImageElement,
  width: number,
  height: number
) {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  return {
    x: (img.naturalWidth - cropWidth) / 2,
    y: (img.naturalHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}
