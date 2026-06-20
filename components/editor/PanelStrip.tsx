"use client";

import { useEditorStore } from "@/store/editorStore";

// Filmstrip of carousel panels below the canvas: click a tile to edit it,
// and add / duplicate / reorder / delete panels. The active panel is what
// CanvasStage, LayerTree and PropertiesPanel operate on.
export default function PanelStrip() {
  const template = useEditorStore((s) => s.template);
  const activePanelId = useEditorStore((s) => s.activePanelId);
  const selectPanel = useEditorStore((s) => s.selectPanel);
  const addPanel = useEditorStore((s) => s.addPanel);
  const duplicatePanel = useEditorStore((s) => s.duplicatePanel);
  const removePanel = useEditorStore((s) => s.removePanel);
  const reorderPanel = useEditorStore((s) => s.reorderPanel);

  if (!template) return null;
  const panels = template.panels;
  const activeId = activePanelId ?? panels[0]?.id;
  const single = panels.length <= 1;

  const ctrl =
    "rounded px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900 px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">
        Panels
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {panels.map((panel, i) => {
          const active = panel.id === activeId;
          return (
            <div
              key={panel.id}
              className={`flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-1 ${
                active
                  ? "border-indigo-600 bg-indigo-950"
                  : "border-zinc-700 hover:bg-zinc-800"
              }`}
            >
              <button
                onClick={() => selectPanel(panel.id)}
                className="flex items-center gap-1.5"
                title={`Edit panel ${i + 1}`}
              >
                <span
                  className="h-6 w-6 rounded-sm border border-zinc-600"
                  style={{ backgroundColor: panel.backgroundColor || "#FFFFFF" }}
                />
                <span className="text-xs font-medium">{i + 1}</span>
              </button>
              {active && (
                <span className="flex items-center">
                  <button
                    className={ctrl}
                    title="Move panel left"
                    disabled={i === 0}
                    onClick={() => reorderPanel(panel.id, "left")}
                  >
                    ←
                  </button>
                  <button
                    className={ctrl}
                    title="Move panel right"
                    disabled={i === panels.length - 1}
                    onClick={() => reorderPanel(panel.id, "right")}
                  >
                    →
                  </button>
                  <button
                    className={ctrl}
                    title="Duplicate panel"
                    onClick={() => duplicatePanel(panel.id)}
                  >
                    ⧉
                  </button>
                  <button
                    className={ctrl}
                    title={single ? "Can't delete the only panel" : "Delete panel"}
                    disabled={single}
                    onClick={() => removePanel(panel.id)}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={addPanel}
        className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
      >
        + Panel
      </button>
    </div>
  );
}
