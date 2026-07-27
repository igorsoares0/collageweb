import type {
  AssetRecord,
  AssetRepository,
  NewAsset,
} from "./AssetRepository";

async function expectOk(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed with ${res.status}`);
  }
  return res;
}

// Talks to the Neon-backed route handlers under /api/assets.
export class ApiAssetRepository implements AssetRepository {
  async list(): Promise<AssetRecord[]> {
    const res = await expectOk(await fetch("/api/assets"));
    return res.json();
  }

  async create(asset: NewAsset): Promise<AssetRecord> {
    const res = await expectOk(
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset),
      })
    );
    return res.json();
  }

  async setPremium(id: string, premium: boolean): Promise<AssetRecord> {
    const res = await expectOk(
      await fetch(`/api/assets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premium }),
      })
    );
    return res.json();
  }

  async remove(id: string): Promise<void> {
    await expectOk(
      await fetch(`/api/assets/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    );
  }
}
