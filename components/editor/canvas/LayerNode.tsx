"use client";

import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import { useEditorStore } from "@/store/editorStore";
import type {
  ImageLayer,
  Layer,
  ShapeLayer,
  StickerLayer,
  TextLayer,
} from "@/lib/template/types";

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
        width={layer.width}
        height={layer.height}
        fill="#E4E4E7"
        stroke="#A1A1AA"
        strokeWidth={4}
        dash={[16, 12]}
        cornerRadius={layer.borderRadius}
      />
      <Text
        width={layer.width}
        height={layer.height}
        text={`▨\n${layer.slotId}`}
        align="center"
        verticalAlign="middle"
        fontSize={placeholderLabelSize(layer.width, layer.height)}
        lineHeight={1.4}
        fill="#71717A"
        fontFamily="Inter"
      />
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
