"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer as KonvaLayer, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import { useEditorStore } from "@/store/editorStore";
import LayerNode, { SNAP_SCREEN_PX } from "./LayerNode";

const MIN_LAYER_SIZE = 20;

interface Props {
  registerThumbnail: (fn: () => string) => void;
}

export default function CanvasStage({ registerThumbnail }: Props) {
  const template = useEditorStore((s) => s.template);
  const activePanelId = useEditorStore((s) => s.activePanelId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const contentLayerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [, setFontsTick] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Konva measures text when nodes mount; force a re-render once webfonts
  // are loaded so text stops using fallback font metrics.
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setFontsTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    registerThumbnail(() => {
      const layer = contentLayerRef.current;
      const stage = stageRef.current;
      if (!layer || !stage || stage.width() === 0) return "";
      return layer.toDataURL({
        mimeType: "image/jpeg",
        quality: 0.7,
        pixelRatio: 240 / stage.width(),
      });
    });
  }, [registerThumbnail]);

  const panel =
    template?.panels.find((p) => p.id === activePanelId) ?? template?.panels[0];
  const selectedLayer = panel?.layers.find((l) => l.id === selectedLayerId);
  const transformable =
    !!selectedLayer &&
    !selectedLayer.editor?.locked &&
    !selectedLayer.editor?.hidden;

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    if (!transformable || !selectedLayerId) {
      transformer.nodes([]);
      return;
    }
    const node = stage.findOne("#" + selectedLayerId);
    transformer.nodes(node ? [node] : []);
  }, [selectedLayerId, transformable, template]);

  if (!template || !panel) return null;

  const scale =
    viewport.width > 0 && viewport.height > 0
      ? Math.min(
          viewport.width / template.canvas.width,
          viewport.height / template.canvas.height
        ) * 0.95
      : 0;

  // Per-type transform abilities: rotation exists for image and grid; text has
  // no height (auto), so only horizontal resizing.
  const rotateEnabled =
    selectedLayer?.type === "image" || selectedLayer?.type === "grid";
  const enabledAnchors =
    selectedLayer?.type === "text"
      ? ["middle-left", "middle-right"]
      : [
          "top-left",
          "top-center",
          "top-right",
          "middle-left",
          "middle-right",
          "bottom-left",
          "bottom-center",
          "bottom-right",
        ];

  const deselectOnEmpty = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (e.target === e.target.getStage()) selectLayer(null);
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-zinc-950"
    >
      {scale > 0 && (
        <div className="shadow-2xl shadow-black/60">
          <Stage
            ref={stageRef}
            width={Math.round(template.canvas.width * scale)}
            height={Math.round(template.canvas.height * scale)}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={deselectOnEmpty}
            onTouchStart={deselectOnEmpty}
          >
            <KonvaLayer ref={contentLayerRef}>
              {/* Canvas background; listening=false so empty clicks hit the
                  stage and deselect. Also keeps JPEG thumbnails non-black. */}
              <Rect
                x={0}
                y={0}
                width={template.canvas.width}
                height={template.canvas.height}
                fill={panel.backgroundColor || "#FFFFFF"}
                listening={false}
              />
              {panel.layers.map((layer) => (
                <LayerNode key={layer.id} layer={layer} />
              ))}
            </KonvaLayer>
            <KonvaLayer>
              <Transformer
                ref={transformerRef}
                keepRatio={false}
                rotateEnabled={rotateEnabled}
                enabledAnchors={enabledAnchors}
                anchorSize={10}
                anchorCornerRadius={2}
                borderStroke="#6366F1"
                anchorStroke="#6366F1"
                boundBoxFunc={(oldBox, newBox) => {
                  const min = MIN_LAYER_SIZE * scale;
                  if (Math.abs(newBox.width) < min || Math.abs(newBox.height) < min) {
                    return oldBox;
                  }
                  // Resizing: the edges this gesture moves magnet onto the
                  // canvas bounds, but only within the threshold —
                  // overshooting past the canvas stays free. Skipped when the
                  // layer is rotated (the box no longer lines up with the
                  // canvas). Boxes here are in screen pixels.
                  const rot = selectedLayer
                    ? "rotation" in selectedLayer
                      ? Math.abs(selectedLayer.rotation) % 360
                      : 0
                    : NaN;
                  if (rot < 0.5 || rot > 359.5) {
                    const box = { ...newBox };
                    const canvasW = template.canvas.width * scale;
                    const canvasH = template.canvas.height * scale;
                    if (box.x !== oldBox.x && Math.abs(box.x) <= SNAP_SCREEN_PX) {
                      box.width += box.x;
                      box.x = 0;
                    }
                    const right = box.x + box.width;
                    if (
                      right !== oldBox.x + oldBox.width &&
                      Math.abs(right - canvasW) <= SNAP_SCREEN_PX
                    ) {
                      box.width = canvasW - box.x;
                    }
                    if (box.y !== oldBox.y && Math.abs(box.y) <= SNAP_SCREEN_PX) {
                      box.height += box.y;
                      box.y = 0;
                    }
                    const bottom = box.y + box.height;
                    if (
                      bottom !== oldBox.y + oldBox.height &&
                      Math.abs(bottom - canvasH) <= SNAP_SCREEN_PX
                    ) {
                      box.height = canvasH - box.y;
                    }
                    return box;
                  }
                  return newBox;
                }}
              />
            </KonvaLayer>
          </Stage>
        </div>
      )}
    </div>
  );
}
