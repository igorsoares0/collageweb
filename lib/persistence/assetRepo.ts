import type { AssetRepository } from "./AssetRepository";
import { ApiAssetRepository } from "./apiAssetRepository";
import { LocalStorageAssetRepository } from "./localAssetRepository";

let repository: AssetRepository | null = null;

// Mirrors getRepository(): NEXT_PUBLIC_USE_NEON=true routes the asset catalog
// through /api/assets (Neon); otherwise it lives in localStorage. (Named
// assetRepo, not assetRepository, to avoid a case-insensitive filename clash
// with AssetRepository.ts on the Windows/WSL filesystem.)
export function getAssetRepository(): AssetRepository {
  repository ??=
    process.env.NEXT_PUBLIC_USE_NEON === "true"
      ? new ApiAssetRepository()
      : new LocalStorageAssetRepository();
  return repository;
}
