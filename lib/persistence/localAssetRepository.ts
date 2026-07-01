import type {
  AssetRecord,
  AssetRepository,
  NewAsset,
} from "./AssetRepository";

const KEY = "collage.assets";

// localStorage fallback for offline/dev (NEXT_PUBLIC_USE_NEON off), mirroring
// LocalStorageTemplateRepository. Same catalog shape as the Neon backend.
export class LocalStorageAssetRepository implements AssetRepository {
  private read(): AssetRecord[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]") as AssetRecord[];
    } catch {
      return [];
    }
  }

  private write(assets: AssetRecord[]) {
    localStorage.setItem(KEY, JSON.stringify(assets));
  }

  async list(): Promise<AssetRecord[]> {
    return this.read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(asset: NewAsset): Promise<AssetRecord> {
    const record: AssetRecord = {
      ...asset,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.write([...this.read(), record]);
    return record;
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((a) => a.id !== id));
  }
}
