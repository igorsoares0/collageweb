"use client";

import { useEditorStore } from "@/store/editorStore";
import { EDITOR_FONTS } from "@/lib/fonts";
import { FRAME_ASSETS, STICKER_ASSETS, frameAsset } from "@/lib/template/factory";
import type { Layer, TextAlignment } from "@/lib/template/types";

const inputCls =
  "w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs focus:border-indigo-600 focus:outline-none";
const labelCls = "block text-[10px] uppercase tracking-wide text-zinc-500 mb-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const beginHistory = useEditorStore((s) => s.beginHistory);
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onFocus={beginHistory}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onCommit(v);
        }}
        className={inputCls}
      />
    </Field>
  );
}

function ColorField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const beginHistory = useEditorStore((s) => s.beginHistory);
  return (
    <Field label={label}>
      <div className="flex gap-1.5">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onFocus={beginHistory}
          onChange={(e) => onCommit(e.target.value.toUpperCase())}
          className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-zinc-950"
        />
        <input
          value={value}
          onFocus={beginHistory}
          onChange={(e) => onCommit(e.target.value)}
          className={inputCls}
        />
      </div>
    </Field>
  );
}

function TextField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const beginHistory = useEditorStore((s) => s.beginHistory);
  return (
    <Field label={label}>
      <input
        value={value}
        onFocus={beginHistory}
        onChange={(e) => onCommit(e.target.value)}
        className={inputCls}
      />
    </Field>
  );
}

function SelectField({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onCommit: (v: string) => void;
}) {
  const beginHistory = useEditorStore((s) => s.beginHistory);
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => {
          beginHistory();
          onCommit(e.target.value);
        }}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

function LayerFields({ layer }: { layer: Layer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const beginHistory = useEditorStore((s) => s.beginHistory);
  const patch = (p: Partial<Layer>) => updateLayer(layer.id, p);

  const xy = (
    <div className="grid grid-cols-2 gap-2">
      <NumberField label="X" value={layer.x} onCommit={(x) => patch({ x })} />
      <NumberField label="Y" value={layer.y} onCommit={(y) => patch({ y })} />
    </div>
  );

  switch (layer.type) {
    case "image":
      return (
        <>
          <TextField
            label="Slot ID"
            value={layer.slotId}
            onCommit={(slotId) => patch({ slotId })}
          />
          {xy}
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={layer.width} onCommit={(width) => patch({ width })} min={1} />
            <NumberField label="Height" value={layer.height} onCommit={(height) => patch({ height })} min={1} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Rotation" value={layer.rotation} onCommit={(rotation) => patch({ rotation })} />
            <NumberField label="Border radius" value={layer.borderRadius} onCommit={(borderRadius) => patch({ borderRadius })} min={0} />
          </div>
          <Field label={`Opacity (${layer.opacity.toFixed(2)})`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={layer.opacity}
              onFocus={beginHistory}
              onChange={(e) => patch({ opacity: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
          <Field label="Frame">
            <select
              value={layer.frameAssetId ?? ""}
              onChange={(e) => {
                beginHistory();
                const id = e.target.value || undefined;
                const frame = frameAsset(id);
                // Snap height to the frame's aspect so it never stretches;
                // clearing the frame leaves the current dimensions alone.
                patch(
                  frame
                    ? {
                        frameAssetId: id,
                        height: Math.round(layer.width / frame.aspect),
                      }
                    : { frameAssetId: undefined }
                );
              }}
              className={inputCls}
            >
              <option value="">None</option>
              {FRAME_ASSETS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      );
    case "text":
      return (
        <>
          <TextField
            label="Slot ID"
            value={layer.slotId}
            onCommit={(slotId) => patch({ slotId })}
          />
          {xy}
          <NumberField label="Width" value={layer.width} onCommit={(width) => patch({ width })} min={1} />
          <SelectField
            label="Font family"
            value={layer.fontFamily}
            options={EDITOR_FONTS}
            onCommit={(fontFamily) => patch({ fontFamily })}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Font size" value={layer.fontSize} onCommit={(fontSize) => patch({ fontSize })} min={1} />
            <SelectField
              label="Weight"
              value={String(layer.fontWeight)}
              options={["400", "700"]}
              onCommit={(w) => patch({ fontWeight: Number(w) })}
            />
          </div>
          <ColorField label="Color" value={layer.color} onCommit={(color) => patch({ color })} />
          <Field label="Alignment">
            <div className="flex gap-1">
              {(["left", "center", "right"] as TextAlignment[]).map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    beginHistory();
                    patch({ alignment: a });
                  }}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${
                    layer.alignment === a
                      ? "border-indigo-600 bg-indigo-950 text-indigo-300"
                      : "border-zinc-700 hover:bg-zinc-800"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>
        </>
      );
    case "shape":
      return (
        <>
          {xy}
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={layer.width} onCommit={(width) => patch({ width })} min={1} />
            <NumberField label="Height" value={layer.height} onCommit={(height) => patch({ height })} min={1} />
          </div>
          <ColorField label="Fill" value={layer.fill} onCommit={(fill) => patch({ fill })} />
        </>
      );
    case "sticker":
      return (
        <>
          <SelectField
            label="Asset"
            value={layer.assetId}
            options={STICKER_ASSETS}
            onCommit={(assetId) => patch({ assetId })}
          />
          {xy}
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={layer.width} onCommit={(width) => patch({ width })} min={1} />
            <NumberField label="Height" value={layer.height} onCommit={(height) => patch({ height })} min={1} />
          </div>
        </>
      );
  }
}

function CanvasFields() {
  const template = useEditorStore((s) => s.template);
  const activePanelId = useEditorStore((s) => s.activePanelId);
  const setBackgroundColor = useEditorStore((s) => s.setBackgroundColor);
  if (!template) return null;
  const panel =
    template.panels.find((p) => p.id === activePanelId) ?? template.panels[0];
  const index = template.panels.findIndex((p) => p.id === panel.id);
  return (
    <>
      <p className="text-xs text-zinc-500">Panel {index + 1}</p>
      <ColorField
        label="Background"
        value={panel.backgroundColor ?? "#FFFFFF"}
        onCommit={setBackgroundColor}
      />
      <p className="pt-2 text-center text-[11px] text-zinc-600">
        Select a layer to edit its properties.
      </p>
    </>
  );
}

export default function PropertiesPanel() {
  const template = useEditorStore((s) => s.template);
  const activePanelId = useEditorStore((s) => s.activePanelId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const panel =
    template?.panels.find((p) => p.id === activePanelId) ?? template?.panels[0];
  const layer = panel?.layers.find((l) => l.id === selectedLayerId);

  const slots =
    panel?.layers.flatMap((l) => ("slotId" in l ? [l.slotId] : [])) ?? [];

  return (
    <aside className="flex min-h-0 flex-col border-l border-zinc-800 bg-zinc-900">
      <h2 className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Properties
      </h2>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {layer ? <LayerFields key={layer.id} layer={layer} /> : <CanvasFields />}
      </div>
      <div className="border-t border-zinc-800 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
          Slots
        </p>
        <p className="text-xs text-zinc-400 break-words">
          {slots.length > 0 ? slots.join(", ") : "No slots defined yet."}
        </p>
      </div>
    </aside>
  );
}
