"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const contentLayerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  // Set when a zoom wants a screen point to stay put; consumed after the
  // rescaled stage lays out, by adjusting the container's scroll.
  const pendingAnchorRef = useRef<{
    contentX: number;
    contentY: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  // Render-fresh values for the once-registered native wheel listener and the
  // post-render scroll adjustment.
  const zoomToRef = useRef<
    ((next: number, clientX?: number, clientY?: number) => void) | null
  >(null);

  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [, setFontsTick] = useState(0);

  // Ctrl/Cmd + wheel (including trackpad pinch, which reports as ctrl+wheel)
  // zooms anchored at the pointer. Native non-passive listener — React's
  // synthetic wheel can't preventDefault the browser's own page zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomToRef.current?.(
        useEditorStore.getState().zoom * Math.exp(-e.deltaY * 0.002),
        e.clientX,
        e.clientY
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

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
        //
        // Sized for what still consumes this: the template list on this site,
        // and on the phone the placeholder before the live canvas appears and
        // the fallback when a template cannot be loaded at all. The app card
        // itself renders the real document now, so this no longer has to hold
        // up at ~540 physical pixels — 240 did not, and that soft, blocky card
        // next to a sharp preview is what sent us looking.
        //
        // It rides inside the templates list JSON as base64, and every
        // template in the catalog is in one response, so the width is a real
        // cost: measured on the published art, 360px/0.8 is ~46KB per
        // template against ~17KB at 240px/0.7, while 480px/0.85 would be
        // ~99KB. Serving thumbnails as their own URLs is what would lift this
        // ceiling; until then it stays a thumbnail.
        return layer.toDataURL({
          x: 0,
          y: 0,
          width: w,
          height: h,
          mimeType: "image/jpeg",
          quality: 0.8,
          pixelRatio: 360 / w,
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

  const cw = template?.canvas.width ?? 1;
  const ch = template?.canvas.height ?? 1;
  const gap = cw * PANEL_GAP_FRACTION;

  // Scale fits ONE panel in the viewport (unchanged from the single-panel
  // days), multiplied by the user zoom (1 = fit); whatever overflows — extra
  // panels sideways or zoomed-in content — the container scrolls.
  const scale =
    viewport.width > 0 && viewport.height > 0
      ? Math.min(viewport.width / cw, viewport.height / ch) * 0.95 * zoom
      : 0;
  const totalWidth = panels.length * cw + (panels.length - 1) * gap;
  const panelX = (i: number) => i * (cw + gap);

  // Zoom keeping a screen point anchored — the pointer for wheel zooms, the
  // viewport centre for the buttons.
  const zoomTo = (next: number, clientX?: number, clientY?: number) => {
    const container = containerRef.current;
    const wrap = wrapRef.current;
    if (container && wrap && scale > 0) {
      const box = container.getBoundingClientRect();
      const cx = clientX ?? box.left + box.width / 2;
      const cy = clientY ?? box.top + box.height / 2;
      const rect = wrap.getBoundingClientRect();
      pendingAnchorRef.current = {
        contentX: (cx - rect.left) / scale,
        contentY: (cy - rect.top) / scale,
        clientX: cx,
        clientY: cy,
      };
    }
    setZoom(next);
  };

  // Publishes the render-fresh zoomTo for the native wheel listener, then
  // consumes any pending anchor: after a zoom renders, shift the scroll so the
  // anchored screen point keeps the same content under it (best-effort; the
  // browser clamps the scroll).
  useLayoutEffect(() => {
    zoomToRef.current = zoomTo;
    const anchor = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    if (!anchor) return;
    const container = containerRef.current;
    const wrap = wrapRef.current;
    if (!container || !wrap || scale <= 0) return;
    const rect = wrap.getBoundingClientRect();
    container.scrollLeft += rect.left + anchor.contentX * scale - anchor.clientX;
    container.scrollTop += rect.top + anchor.contentY * scale - anchor.clientY;
  });

  if (!template || !panel) return null;

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

  const zoomBtn = "px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800";

  return (
    <div className="relative h-full w-full">
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
        <div ref={wrapRef} className="m-auto">
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
                    // Panels clip to the canvas: what you see is exactly the
                    // exported slide, and whatever a layer spills past an edge
                    // reappears on the neighbour as a ghost (below).
                    clipX={0}
                    clipY={0}
                    clipWidth={cw}
                    clipHeight={ch}
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
                    {/* Carousel bleed: in the design the panels are contiguous
                        (the gap is cosmetic), so a neighbour's layers continue
                        here offset by exactly one canvas width. Ghosts are
                        inert visuals; editing happens on the owner panel.
                        BOTH neighbour ghosts render UNDER this panel's own
                        layers: they're cosmetic echoes for swipe continuity, so
                        a local element (text, sticker…) always sits above an
                        image spilling in from an adjacent panel — and stays
                        reorderable against the panel's real layers. (Mirrors
                        PanelCanvas in the mobile app.) */}
                    {panels[i - 1] && (
                      <Group x={-cw} listening={false}>
                        {panels[i - 1].layers.map((layer) => (
                          <LayerNode key={layer.id} layer={layer} ghost />
                        ))}
                      </Group>
                    )}
                    {panels[i + 1] && (
                      <Group x={cw} listening={false}>
                        {panels[i + 1].layers.map((layer) => (
                          <LayerNode key={layer.id} layer={layer} ghost />
                        ))}
                      </Group>
                    )}
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
      <div className="absolute bottom-3 right-3 z-10 flex items-center overflow-hidden rounded-md border border-zinc-700 bg-zinc-900/90">
        <button
          type="button"
          className={zoomBtn}
          title="Zoom out (Ctrl+-)"
          onClick={() => zoomTo(zoom / 1.25)}
        >
          −
        </button>
        <button
          type="button"
          className="w-12 py-1 text-center text-[11px] text-zinc-300 hover:bg-zinc-800"
          title="Reset zoom (Ctrl+0)"
          onClick={() => zoomTo(1)}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className={zoomBtn}
          title="Zoom in (Ctrl+=)"
          onClick={() => zoomTo(zoom * 1.25)}
        >
          +
        </button>
      </div>
    </div>
  );
}
