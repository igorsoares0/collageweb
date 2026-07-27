import type {
  AssetRecord,
  NewAsset,
} from "@/lib/persistence/AssetRepository";

// Stickers are decorative cutouts placed on their own layer; unlike frames they
// have no photo window, and unlike photos they must keep their transparency — so
// they are re-encoded as PNG (not JPEG) and carry a null window. Downscaled to
// the same edge cap so a huge upload never blows the API's row size.
const MAX_EDGE = 1600;

export function resolveSticker(
  id: string | undefined,
  assets: AssetRecord[]
): AssetRecord | undefined {
  if (!id) return undefined;
  return assets.find((a) => a.type === "sticker" && a.id === id);
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

// Uploads a sticker PNG into the asset catalog (downscaled, transparency kept)
// and returns the created record; `create` is the asset store's create so the
// catalog updates in place. `premium` tags it as paid-plan-only up front.
export async function uploadStickerAsset(
  file: File,
  create: (asset: NewAsset) => Promise<AssetRecord>,
  premium = false
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
    type: "sticker",
    name: file.name.replace(/\.[^.]+$/, ""),
    dataUrl: canvas.toDataURL("image/png"),
    aspect: canvas.width / canvas.height,
    window: null,
    premium,
  });
}
