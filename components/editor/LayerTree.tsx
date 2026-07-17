"use client";

import { useEditorStore } from "@/store/editorStore";
import type { Layer } from "@/lib/template/types";

const TYPE_BADGES: Record<Layer["type"], { label: string; className: string }> = {
  image: { label: "IMG", className: "bg-sky-900 text-sky-300" },
  text: { label: "TXT", className: "bg-amber-900 text-amber-300" },
  shape: { label: "SHP", className: "bg-emerald-900 text-emerald-300" },
  sticker: { label: "STK", className: "bg-violet-900 text-violet-300" },
  grid: { label: "GRD", className: "bg-rose-900 text-rose-300" },
};

function layerLabel(layer: Layer): string {
  switch (layer.type) {
    case "image":
    case "text":
      return layer.slotId;
    case "shape":
      return layer.fill;
    case "sticker":
      return layer.assetId;
    case "grid":
      return `${layer.cols}×${layer.rows} grid`;
  }
}

export default function LayerTree() {
  const template = useEditorStore((s) => s.template);
  const activePanelId = useEditorStore((s) => s.activePanelId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const reorderLayer = useEditorStore((s) => s.reorderLayer);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const toggleHide = useEditorStore((s) => s.toggleHide);

  const panel =
    template?.panels.find((p) => p.id === activePanelId) ?? template?.panels[0];
  // Array index 0 = bottom of the stack; display reversed so top row = frontmost.
  const layers = panel ? [...panel.layers].reverse() : [];

  const iconBtn =
    "rounded p-0.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700";

  return (
    <aside className="flex min-h-0 flex-col border-r border-zinc-800 bg-zinc-900">
      <h2 className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Layers
      </h2>
      <ul className="flex-1 overflow-y-auto p-1">
        {layers.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-zinc-600">
            No layers. Add one from the toolbar.
          </li>
        )}
        {layers.map((layer) => {
          const badge = TYPE_BADGES[layer.type];
          const selected = layer.id === selectedLayerId;
          const hidden = layer.editor?.hidden;
          const locked = layer.editor?.locked;
          return (
            <li
              key={layer.id}
              className={`group flex items-center gap-1.5 rounded px-2 py-1.5 cursor-pointer ${
                selected ? "bg-indigo-950 ring-1 ring-indigo-700" : "hover:bg-zinc-800"
              } ${hidden ? "opacity-50" : ""}`}
              onClick={() => selectLayer(layer.id)}
            >
              <span
                className={`rounded px-1 py-0.5 text-[9px] font-bold ${badge.className}`}
              >
                {badge.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">
                {layerLabel(layer)}
              </span>
              <span className="hidden items-center gap-0.5 group-hover:flex">
                <button
                  className={iconBtn}
                  title="Bring forward"
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderLayer(layer.id, "up");
                  }}
                >
                  ↑
                </button>
                <button
                  className={iconBtn}
                  title="Send backward"
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderLayer(layer.id, "down");
                  }}
                >
                  ↓
                </button>
                <button
                  className={iconBtn}
                  title="Duplicate layer (Ctrl+D)"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateLayer(layer.id);
                  }}
                >
                  ⧉
                </button>
                <button
                  className={iconBtn}
                  title="Delete layer"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(layer.id);
                  }}
                >
                  ✕
                </button>
              </span>
              <button
                className={`${iconBtn} ${hidden ? "text-indigo-400" : ""}`}
                title={hidden ? "Show layer" : "Hide layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleHide(layer.id);
                }}
              >
                {hidden ? "○" : "●"}
              </button>
              <button
                className={`${iconBtn} ${locked ? "text-indigo-400" : ""}`}
                title={locked ? "Unlock layer" : "Lock layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLock(layer.id);
                }}
              >
                {locked ? "🔒" : "🔓"}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
