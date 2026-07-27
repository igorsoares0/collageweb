"use client";

import { useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useAssetStore } from "@/store/assetStore";
import { EDITOR_FONTS } from "@/lib/fonts";
import { STICKER_ASSETS } from "@/lib/template/factory";
import { GRID_PRESETS, collectSlotIds } from "@/lib/template/grid";
import { analyzeImage } from "@/lib/assets/detectWindow";
import { uploadPhotoAsset } from "@/lib/assets/photo";
import { uploadStickerAsset } from "@/lib/assets/sticker";
import { resolveFrame, resolveFrames } from "@/lib/assets/catalog";
import type { ResolvedFrame } from "@/lib/assets/catalog";
import type {
  GridLayer,
  ImageLayer,
  Layer,
  StickerLayer,
  TextAlignment,
} from "@/lib/template/types";

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

// The frame picker for an image layer: choose a frame from the catalog (bundled
// seeds + uploaded), or upload a new PNG. On upload the transparent window is
// auto-detected in the browser (analyzeImage) and the asset is saved to the
// catalog, so it's immediately reusable — no code change, no app rebuild.
function FrameField({
  layer,
  patch,
}: {
  layer: ImageLayer;
  patch: (p: Partial<Layer>) => void;
}) {
  const beginHistory = useEditorStore((s) => s.beginHistory);
  const assets = useAssetStore((s) => s.assets);
  const createAsset = useAssetStore((s) => s.create);
  const setAssetPremium = useAssetStore((s) => s.setPremium);
  const removeAsset = useAssetStore((s) => s.remove);
  const frames = resolveFrames(assets);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The premium/delete controls apply to catalog (uploaded) frames only —
  // bundled seeds have no DB row. So they show only when the selected frame
  // resolves to an asset in the catalog.
  const selectedAsset = assets.find(
    (a) => a.id === layer.frameAssetId && a.type === "frame"
  );

  // Deleting removes the frame from the shared catalog (every template loses
  // it), so it's gated behind a confirm and clears this layer's reference.
  const onDelete = async () => {
    if (!selectedAsset) return;
    if (
      !window.confirm(
        `Delete frame "${selectedAsset.name}" from the catalog? Any template using it loses it.`
      )
    ) {
      return;
    }
    beginHistory();
    patch({ frameAssetId: undefined });
    await removeAsset(selectedAsset.id);
  };

  // Snap the layer's height to the frame's aspect so it never stretches;
  // clearing the frame leaves the current dimensions alone.
  const apply = (frame: ResolvedFrame | undefined) => {
    beginHistory();
    patch(
      frame
        ? { frameAssetId: frame.id, height: Math.round(layer.width / frame.aspect) }
        : { frameAssetId: undefined }
    );
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { dataUrl, aspect, window: frameWindow } = await analyzeImage(file);
      if (!frameWindow) {
        setError("Sem área transparente — não dá pra usar como moldura.");
        return;
      }
      const name = file.name.replace(/\.[^.]+$/, "");
      const record = await createAsset({
        type: "frame",
        name,
        dataUrl,
        aspect,
        window: frameWindow,
      });
      apply({
        id: record.id,
        label: record.name,
        src: dataUrl,
        aspect,
        window: frameWindow,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label="Frame">
      <select
        value={layer.frameAssetId ?? ""}
        onChange={(e) => apply(resolveFrame(e.target.value || undefined, assets))}
        className={inputCls}
      >
        <option value="">None</option>
        {frames.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-1.5 w-full rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload frame…"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {selectedAsset && (
        <>
          <label
            className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-400"
            title="When on, this frame is locked to paid plans in the app"
          >
            <input
              type="checkbox"
              checked={selectedAsset.premium}
              onChange={(e) =>
                setAssetPremium(selectedAsset.id, e.target.checked)
              }
            />
            Premium (paid plans only)
          </label>
          <button
            type="button"
            onClick={onDelete}
            className="mt-1.5 w-full rounded border border-zinc-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 hover:border-red-900"
          >
            Delete from catalog
          </button>
        </>
      )}
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </Field>
  );
}

// The sticker picker: choose a bundled placeholder or an uploaded catalog
// sticker, or upload a new PNG. Like frames, the web canvas only draws a
// placeholder — the app renders the real art — so uploading a sticker is really
// "add it to the catalog". The Premium checkbox (catalog stickers only) marks
// it paid-plan-only; the app enforces the gate.
function StickerField({
  layer,
  patch,
}: {
  layer: StickerLayer;
  patch: (p: Partial<Layer>) => void;
}) {
  const beginHistory = useEditorStore((s) => s.beginHistory);
  const assets = useAssetStore((s) => s.assets);
  const createAsset = useAssetStore((s) => s.create);
  const setAssetPremium = useAssetStore((s) => s.setPremium);
  const removeAsset = useAssetStore((s) => s.remove);
  const catalogStickers = assets.filter((a) => a.type === "sticker");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Premium/delete apply to catalog (uploaded) stickers only — bundled
  // placeholders have no DB row.
  const selectedAsset = catalogStickers.find((a) => a.id === layer.assetId);

  // Deleting removes the sticker from the shared catalog, so it's confirmed and
  // the layer falls back to the first bundled placeholder (assetId can't be
  // left dangling — validate.ts requires a non-empty one).
  const onDelete = async () => {
    if (!selectedAsset) return;
    if (
      !window.confirm(
        `Delete sticker "${selectedAsset.name}" from the catalog? Any template using it loses it.`
      )
    ) {
      return;
    }
    beginHistory();
    patch({ assetId: STICKER_ASSETS[0] });
    await removeAsset(selectedAsset.id);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const record = await uploadStickerAsset(file, createAsset);
      beginHistory();
      patch({ assetId: record.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label="Asset">
      <select
        value={layer.assetId}
        onChange={(e) => {
          beginHistory();
          patch({ assetId: e.target.value });
        }}
        className={inputCls}
      >
        <optgroup label="Bundled">
          {STICKER_ASSETS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </optgroup>
        {catalogStickers.length > 0 && (
          <optgroup label="Uploaded">
            {catalogStickers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-1.5 w-full rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload sticker…"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {selectedAsset && (
        <>
          <label
            className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-400"
            title="When on, this sticker is locked to paid plans in the app"
          >
            <input
              type="checkbox"
              checked={selectedAsset.premium}
              onChange={(e) =>
                setAssetPremium(selectedAsset.id, e.target.checked)
              }
            />
            Premium (paid plans only)
          </label>
          <button
            type="button"
            onClick={onDelete}
            className="mt-1.5 w-full rounded border border-zinc-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 hover:border-red-900"
          >
            Delete from catalog
          </button>
        </>
      )}
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </Field>
  );
}

// A photo slot's content: pick an already-uploaded photo from the catalog, or
// upload a new one (downscaled + saved as a "photo" asset, so it's reusable
// across templates). Used by the image layer and by every grid cell; the
// canvas offers the same via double-click on the slot/cell.
function PhotoField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string | undefined;
  onCommit: (imageAssetId: string | undefined) => void;
}) {
  const beginHistory = useEditorStore((s) => s.beginHistory);
  const assets = useAssetStore((s) => s.assets);
  const createAsset = useAssetStore((s) => s.create);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = assets.filter((a) => a.type === "photo");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const record = await uploadPhotoAsset(file, createAsset);
      beginHistory();
      onCommit(record.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label={label}>
      <select
        value={value ?? ""}
        onChange={(e) => {
          beginHistory();
          onCommit(e.target.value || undefined);
        }}
        className={inputCls}
      >
        <option value="">None</option>
        {photos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-1.5 w-full rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload photo…"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </Field>
  );
}

// Grid-specific controls: pick a layout preset (regenerates the cells with
// fresh slotIds), and tune the shared gutter / corner radius / gutter colour.
function GridField({
  layer,
  patch,
}: {
  layer: GridLayer;
  patch: (p: Partial<Layer>) => void;
}) {
  const applyGridPreset = useEditorStore((s) => s.applyGridPreset);
  const beginHistory = useEditorStore((s) => s.beginHistory);
  return (
    <>
      <Field label="Layout">
        <select
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            beginHistory();
            applyGridPreset(layer.id, e.target.value);
            e.target.value = "";
          }}
          className={inputCls}
        >
          <option value="">
            {layer.cols}×{layer.rows} · trocar layout…
          </option>
          {GRID_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Gutter" value={layer.gutter} onCommit={(gutter) => patch({ gutter })} min={0} />
        <NumberField label="Corner radius" value={layer.cornerRadius} onCommit={(cornerRadius) => patch({ cornerRadius })} min={0} />
      </div>
      <Field label="Gutter color">
        <div className="flex gap-1.5">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(layer.gutterColor ?? "") ? layer.gutterColor : "#FFFFFF"}
            onFocus={beginHistory}
            onChange={(e) => patch({ gutterColor: e.target.value.toUpperCase() })}
            className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-zinc-950"
          />
          <button
            type="button"
            onClick={() => {
              beginHistory();
              patch({ gutterColor: undefined });
            }}
            className="flex-1 rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
          >
            {layer.gutterColor ? `${layer.gutterColor} · limpar` : "Transparente"}
          </button>
        </div>
      </Field>
      {layer.cells.map((cell) => (
        <PhotoField
          key={cell.slotId}
          label={`Photo · ${cell.slotId}`}
          value={cell.imageAssetId}
          onCommit={(imageAssetId) =>
            patch({
              cells: layer.cells.map((c) =>
                c.slotId === cell.slotId ? { ...c, imageAssetId } : c
              ),
            })
          }
        />
      ))}
    </>
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
          <FrameField layer={layer} patch={patch} />
          <PhotoField
            label="Photo"
            value={layer.imageAssetId}
            onCommit={(imageAssetId) => patch({ imageAssetId })}
          />
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
          <StickerField layer={layer} patch={patch} />
          {xy}
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={layer.width} onCommit={(width) => patch({ width })} min={1} />
            <NumberField label="Height" value={layer.height} onCommit={(height) => patch({ height })} min={1} />
          </div>
        </>
      );
    case "grid":
      return (
        <>
          <GridField layer={layer} patch={patch} />
          {xy}
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={layer.width} onCommit={(width) => patch({ width })} min={1} />
            <NumberField label="Height" value={layer.height} onCommit={(height) => patch({ height })} min={1} />
          </div>
          <NumberField label="Rotation" value={layer.rotation} onCommit={(rotation) => patch({ rotation })} />
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

  const slots = panel ? collectSlotIds(panel.layers) : [];

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
