"use client";

import { create } from "zustand";
import { getAssetRepository } from "@/lib/persistence/assetRepo";
import type { AssetRecord, NewAsset } from "@/lib/persistence/AssetRepository";

interface AssetState {
  assets: AssetRecord[];
  loaded: boolean;
  // Loads the catalog once (idempotent); safe to call from every mount.
  load: () => Promise<void>;
  // Uploads an asset and prepends it to the in-memory catalog.
  create: (asset: NewAsset) => Promise<AssetRecord>;
  remove: (id: string) => Promise<void>;
}

export const useAssetStore = create<AssetState>((set, get) => ({
  assets: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    // Mark loaded up front so concurrent mounts don't double-fetch.
    set({ loaded: true });
    try {
      set({ assets: await getAssetRepository().list() });
    } catch {
      set({ loaded: false });
    }
  },

  create: async (asset) => {
    const record = await getAssetRepository().create(asset);
    set({ assets: [record, ...get().assets] });
    return record;
  },

  remove: async (id) => {
    await getAssetRepository().remove(id);
    set({ assets: get().assets.filter((a) => a.id !== id) });
  },
}));
