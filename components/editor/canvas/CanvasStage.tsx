"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Stage, Layer as KonvaLayer, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import { useEditorStore } from "@/store/editorStore";
import LayerNode, { SNAP_SCREEN_PX } from "./LayerNode";

const MIN_LAYER_SIZE = 20;

// Gap between side-by-side panels, as a fraction of the canvas width.
const PANEL_GAP_FRACTION = 0.06;

interface Props {
  registerThumbnail: (fn: () => string) => void;
}

export default function CanvasStage({ registerThumbnail }: Props) {
  const template = useEditorStore((s) => s.template);
  const activePanelId = useEditorStore((s) => s.activePanelId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const selectPanel = useEditorStore((s) => s.selectPanel);

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
      // Read the template from the store (not the render closure): this
      // callback outlives renders and the canvas size can change (setFormat).
      const t = useEditorStore.getState().template;
      if (!layer || !stage || !t || stage.width() === 0) return "";
      const s = stage.scaleX() || 1;
      const w = t.canvas.width * s;
      const h = t.canvas.height * s;
      // Selection chrome that lives in the content layer (the grid's divider
      // handles) must not leak into the saved thumbnail.
      const chrome = layer.find(".selection-chrome");
      chrome.forEach((n) => n.visible(false));
      try {
        // First panel only — the stage now spans every panel side by side,
        // and the gallery card shows a single page.
        return layer.toDataURL({
          x: 0,
          y: 0,
          width: w,
          height: h,
          mimeType: "image/jpeg",
          quality: 0.7,
          pixelRatio: 240 / w,
        });
      } finally {
        chrome.forEach((n) => n.visible(true));
      }
    });
  }, [registerThumbnail]);

  const panels = template?.panels ?? [];
  const activeId = activePanelId ?? panels[0]?.id;
  const activeIndex = Math.max(0, panels.findIndex((p) => p.id === activeId));
  const panel = panels[activeIndex];
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

  const { width: cw, height: ch } = template.canvas;
  const gap = cw * PANEL_GAP_FRACTION;

  // Scale fits ONE panel in the viewport (unchanged from the single-panel
  // days); with several panels the stage grows sideways and the container
  // scrolls horizontally, like the app's panel strip.
  const scale =
    viewport.width > 0 && viewport.height > 0
      ? Math.min(viewport.width / cw, viewport.height / ch) * 0.95
      : 0;
  const totalWidth = panels.length * cw + (panels.length - 1) * gap;
  const panelX = (i: number) => i * (cw + gap);

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
      // Clicking the dark area around the canvas deselects too — the Stage's
      // own deselect only sees clicks inside it.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) selectLayer(null);
      }}
      className="flex h-full w-full overflow-auto bg-zinc-950"
    >
      {scale > 0 && (
        // m-auto centers when everything fits and still lets the container
        // scroll when the panel row overflows (justify-center would clip it).
        <div className="m-auto">
          <Stage
            ref={stageRef}
            width={Math.round(totalWidth * scale)}
            height={Math.round(ch * scale)}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={deselectOnEmpty}
            onTouchStart={deselectOnEmpty}
          >
            <KonvaLayer ref={contentLayerRef}>
              {panels.map((p, i) => {
                const active = p.id === activeId;
                // mousedown (not click) so activation happens before the
                // pressed layer's own click/dragstart selects it.
                const activate = () => {
                  if (!active) selectPanel(p.id);
                };
                // Empty clicks on the active panel's background deselect;
                // selectPanel already clears the selection for the others.
                const clearOnActive = () => {
                  if (active) selectLayer(null);
                };
                // Any press inside the panel bubbles to the Group and
                // activates it; the background Rect additionally clears the
                // selection when the panel is already the active one.
                return (
                  <Group
                    key={p.id}
                    x={panelX(i)}
                    onMouseDown={activate}
                    onTouchStart={activate}
                  >
                    <Rect
                      x={0}
                      y={0}
                      width={cw}
                      height={ch}
                      fill={p.backgroundColor || "#FFFFFF"}
                      onMouseDown={clearOnActive}
                      onTouchStart={clearOnActive}
                    />
                    {p.layers.map((layer) => (
                      <LayerNode key={layer.id} layer={layer} />
                    ))}
                  </Group>
                );
              })}
            </KonvaLayer>
            <KonvaLayer>
              {panels.length > 1 && (
                // Active-panel outline; overlay layer, so never in thumbnails.
                <Rect
                  x={panelX(activeIndex)}
                  y={0}
                  width={cw}
                  height={ch}
                  stroke="#6366F1"
                  strokeWidth={2 / scale}
                  listening={false}
                />
              )}
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
                  // active panel's bounds, but only within the threshold —
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
                    const left = panelX(activeIndex) * scale;
                    const right0 = left + cw * scale;
                    const canvasH = ch * scale;
                    if (
                      box.x !== oldBox.x &&
                      Math.abs(box.x - left) <= SNAP_SCREEN_PX
                    ) {
                      box.width += box.x - left;
                      box.x = left;
                    }
                    const right = box.x + box.width;
                    if (
                      right !== oldBox.x + oldBox.width &&
                      Math.abs(right - right0) <= SNAP_SCREEN_PX
                    ) {
                      box.width = right0 - box.x;
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
