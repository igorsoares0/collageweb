"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import type Konva from "konva";
import { useEditorStore } from "@/store/editorStore";
import { useAssetStore } from "@/store/assetStore";
import { resolveFrame } from "@/lib/assets/catalog";
import { cellRect } from "@/lib/template/grid";
import type {
  GridLayer,
  ImageLayer,
  Layer,
  ShapeLayer,
  StickerLayer,
  TextLayer,
} from "@/lib/template/types";

// Loads an <img> for a Konva.Image (we avoid the use-image dependency). Returns
// undefined until it decodes (the frame pops in once ready) and while the src is
// mid-swap — we tag the loaded element with its src and only hand it back when it
// still matches, so state is only ever set from the load callback (no cascading
// render from a synchronous setState in the effect body).
function useHtmlImage(src?: string): HTMLImageElement | undefined {
  const [loaded, setLoaded] = useState<{ src: string; el: HTMLImageElement }>();
  useEffect(() => {
    if (!src) return;
    const el = new window.Image();
    const onLoad = () => setLoaded({ src, el });
    el.addEventListener("load", onLoad);
    el.src = src;
    return () => el.removeEventListener("load", onLoad);
  }, [src]);
  return loaded?.src === src ? loaded?.el : undefined;
}

function useLayerInteraction(layer: Layer) {
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const beginHistory = useEditorStore((s) => s.beginHistory);

  const locked = !!layer.editor?.locked;
  const hidden = !!layer.editor?.hidden;

  // History is pushed once at gesture start; drag/transform then stream
  // updateLayer (no history) so undo reverts the whole gesture.
  const handlers = {
    id: layer.id,
    draggable: !locked,
    visible: !hidden,
    listening: !locked,
    onClick: () => selectLayer(layer.id),
    onTap: () => selectLayer(layer.id),
    onDragStart: () => {
      selectLayer(layer.id);
      beginHistory();
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      updateLayer(layer.id, {
        x: Math.round(e.target.x()),
        y: Math.round(e.target.y()),
      }),
    onTransformStart: () => beginHistory(),
  };

  return { handlers, updateLayer };
}

// The Transformer changes scale, never width/height. The template JSON must
// not carry Konva scale, so on transformend we bake scale into width/height
// and reset it to 1.
function normalizedSize(node: Konva.Node, layer: { width: number; height?: number }) {
  const width = Math.max(20, Math.round(layer.width * node.scaleX()));
  const height =
    layer.height !== undefined
      ? Math.max(20, Math.round(layer.height * node.scaleY()))
      : undefined;
  node.scale({ x: 1, y: 1 });
  return {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
    width,
    ...(height !== undefined ? { height } : {}),
  };
}

function placeholderLabelSize(width: number, height: number) {
  return Math.max(28, Math.round(Math.min(width, height) * 0.08));
}

function ImageSlotNode({ layer }: { layer: ImageLayer }) {
  const { handlers, updateLayer } = useLayerInteraction(layer);
  const assets = useAssetStore((s) => s.assets);
  const frame = resolveFrame(layer.frameAssetId, assets);
  const frameImg = useHtmlImage(frame?.src);

  // The photo (here a placeholder) lives inside the frame's transparent window;
  // without a frame it fills the whole layer. The frame paints over the top and
  // ignores pointer events so clicks/drags still hit the photo group.
  const win = frame
    ? {
        x: frame.window.x * layer.width,
        y: frame.window.y * layer.height,
        width: frame.window.w * layer.width,
        height: frame.window.h * layer.height,
      }
    : { x: 0, y: 0, width: layer.width, height: layer.height };

  return (
    <Group
      {...handlers}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      opacity={layer.opacity}
      onTransformEnd={(e) =>
        updateLayer(layer.id, {
          ...normalizedSize(e.target, layer),
          rotation: Math.round(e.target.rotation() * 10) / 10,
        })
      }
    >
      <Rect
        x={win.x}
        y={win.y}
        width={win.width}
        height={win.height}
        fill="#E4E4E7"
        stroke="#A1A1AA"
        strokeWidth={4}
        dash={[16, 12]}
        cornerRadius={frame ? 0 : layer.borderRadius}
      />
      <Text
        x={win.x}
        y={win.y}
        width={win.width}
        height={win.height}
        text={`▨\n${layer.slotId}`}
        align="center"
        verticalAlign="middle"
        fontSize={placeholderLabelSize(win.width, win.height)}
        lineHeight={1.4}
        fill="#71717A"
        fontFamily="Inter"
      />
      {frame && frameImg && (
        <KonvaImage
          image={frameImg}
          width={layer.width}
          height={layer.height}
          listening={false}
        />
      )}
    </Group>
  );
}

function TextNode({ layer }: { layer: TextLayer }) {
  const { handlers, updateLayer } = useLayerInteraction(layer);
  return (
    <Text
      {...handlers}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      text={layer.slotId}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      // Konva has no numeric weights; Flutter will interpret fontWeight itself.
      fontStyle={layer.fontWeight >= 600 ? "bold" : "normal"}
      fill={layer.color}
      align={layer.alignment}
      onTransformEnd={(e) =>
        updateLayer(layer.id, normalizedSize(e.target, { width: layer.width }))
      }
    />
  );
}

function ShapeNode({ layer }: { layer: ShapeLayer }) {
  const { handlers, updateLayer } = useLayerInteraction(layer);
  return (
    <Rect
      {...handlers}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      fill={layer.fill}
      onTransformEnd={(e) =>
        updateLayer(layer.id, normalizedSize(e.target, layer))
      }
    />
  );
}

function StickerNode({ layer }: { layer: StickerLayer }) {
  const { handlers, updateLayer } = useLayerInteraction(layer);
  return (
    <Group
      {...handlers}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      onTransformEnd={(e) =>
        updateLayer(layer.id, normalizedSize(e.target, layer))
      }
    >
      <Rect
        width={layer.width}
        height={layer.height}
        fill="#DDD6FE"
        stroke="#8B5CF6"
        strokeWidth={4}
        dash={[16, 12]}
        cornerRadius={16}
      />
      <Text
        width={layer.width}
        height={layer.height}
        text={`★\n${layer.assetId}`}
        align="center"
        verticalAlign="middle"
        fontSize={placeholderLabelSize(layer.width, layer.height)}
        lineHeight={1.4}
        fill="#6D28D9"
        fontFamily="Inter"
      />
    </Group>
  );
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// Draggable line between two tracks; moving it shifts the split of the two
// adjacent fractions (nothing else). Local coords stay pre-rotation, so this
// works unchanged when the whole grid is rotated. `offset*` centres the handle
// on the gutter so node.x()/y() reads back as the divider centre.
function DividerHandle({
  axis,
  center,
  length,
  thickness,
  onDrag,
  onDragStart,
}: {
  axis: "col" | "row";
  center: number;
  length: number;
  thickness: number;
  onDrag: (centerLocal: number) => void;
  onDragStart: () => void;
}) {
  const vertical = axis === "col";
  return (
    <Rect
      x={vertical ? center : 0}
      y={vertical ? 0 : center}
      offsetX={vertical ? thickness / 2 : 0}
      offsetY={vertical ? 0 : thickness / 2}
      width={vertical ? thickness : length}
      height={vertical ? length : thickness}
      fill="rgba(99,102,241,0.45)"
      cornerRadius={thickness / 2}
      draggable
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = vertical ? "ew-resize" : "ns-resize";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "default";
      }}
      onDragStart={onDragStart}
      onDragMove={(e) => {
        // Lock the perpendicular axis; report the moved axis' local centre.
        if (vertical) e.target.y(0);
        else e.target.x(0);
        onDrag(vertical ? e.target.x() : e.target.y());
      }}
    />
  );
}

function GridNode({ layer }: { layer: GridLayer }) {
  const { handlers, updateLayer } = useLayerInteraction(layer);
  const beginHistory = useEditorStore((s) => s.beginHistory);
  const selected = useEditorStore((s) => s.selectedLayerId === layer.id);
  const showHandles = selected && !layer.editor?.locked;

  const g = layer.gutter;
  const handleW = Math.max(g, Math.max(layer.width, layer.height) * 0.02, 18);

  // Shift two adjacent track fractions so their split follows the divider.
  const dragDivider = (axis: "col" | "row", i: number, centerLocal: number) => {
    const fractions = axis === "col" ? layer.colFractions : layer.rowFractions;
    const tracks = axis === "col" ? layer.cols : layer.rows;
    const box = axis === "col" ? layer.width : layer.height;
    const usable = Math.max(1, box - g * (tracks + 1));
    const s = sum(fractions) || 1;
    const start = g * (i + 1) + usable * (sum(fractions.slice(0, i)) / s);
    const pairFrac = fractions[i] + fractions[i + 1];
    const pairPx = usable * (pairFrac / s);
    const wi = Math.min(pairPx * 0.9, Math.max(pairPx * 0.1, centerLocal - start - g / 2));
    const fi = (wi / pairPx) * pairFrac;
    const next = [...fractions];
    next[i] = fi;
    next[i + 1] = pairFrac - fi;
    updateLayer(
      layer.id,
      axis === "col" ? { colFractions: next } : { rowFractions: next }
    );
  };

  const colCenter = (i: number) => {
    const r = cellRect(layer, { slotId: "", col: i, row: 0 });
    return r.x + r.width + g / 2;
  };
  const rowCenter = (j: number) => {
    const r = cellRect(layer, { slotId: "", col: 0, row: j });
    return r.y + r.height + g / 2;
  };

  return (
    <Group
      {...handlers}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      onTransformEnd={(e) =>
        updateLayer(layer.id, {
          ...normalizedSize(e.target, layer),
          rotation: Math.round(e.target.rotation() * 10) / 10,
        })
      }
    >
      {/* Full-box hit target (also paints the gutter colour when set). Invisible
          but still hittable at opacity 0, so the whole grid selects on click. */}
      <Rect
        width={layer.width}
        height={layer.height}
        fill={layer.gutterColor ?? "#000000"}
        opacity={layer.gutterColor ? 1 : 0}
        cornerRadius={layer.cornerRadius}
      />
      {layer.cells.map((cell) => {
        const r = cellRect(layer, cell);
        const radius = cell.borderRadius ?? layer.cornerRadius;
        return (
          <Group key={cell.slotId} x={r.x} y={r.y}>
            <Rect
              width={r.width}
              height={r.height}
              fill="#E4E4E7"
              stroke="#A1A1AA"
              strokeWidth={3}
              dash={[14, 10]}
              cornerRadius={radius}
            />
            <Text
              width={r.width}
              height={r.height}
              text={`▨\n${cell.slotId}`}
              align="center"
              verticalAlign="middle"
              fontSize={placeholderLabelSize(r.width, r.height)}
              lineHeight={1.4}
              fill="#71717A"
              fontFamily="Inter"
            />
          </Group>
        );
      })}
      {showHandles &&
        Array.from({ length: layer.cols - 1 }, (_, i) => (
          <DividerHandle
            key={`c${i}`}
            axis="col"
            center={colCenter(i)}
            length={layer.height}
            thickness={handleW}
            onDragStart={beginHistory}
            onDrag={(c) => dragDivider("col", i, c)}
          />
        ))}
      {showHandles &&
        Array.from({ length: layer.rows - 1 }, (_, j) => (
          <DividerHandle
            key={`r${j}`}
            axis="row"
            center={rowCenter(j)}
            length={layer.width}
            thickness={handleW}
            onDragStart={beginHistory}
            onDrag={(c) => dragDivider("row", j, c)}
          />
        ))}
    </Group>
  );
}

export default function LayerNode({ layer }: { layer: Layer }) {
  switch (layer.type) {
    case "image":
      return <ImageSlotNode layer={layer} />;
    case "text":
      return <TextNode layer={layer} />;
    case "shape":
      return <ShapeNode layer={layer} />;
    case "sticker":
      return <StickerNode layer={layer} />;
    case "grid":
      return <GridNode layer={layer} />;
  }
}
