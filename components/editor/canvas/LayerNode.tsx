"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import type Konva from "konva";
import { useEditorStore } from "@/store/editorStore";
import { useAssetStore } from "@/store/assetStore";
import { resolveFrame } from "@/lib/assets/catalog";
import type {
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
  }
}
