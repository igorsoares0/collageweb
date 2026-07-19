// Verifies lib/template/continuous.ts against the shared contract in
// lib/template/continuous-parity.json. The Dart mirror
// (collageapp/lib/src/model/slide_aware.dart) checks itself against a
// byte-identical copy of that JSON, so the two renderers cannot drift on where
// a slide begins and ends without one of the two checks going red.
//
// Run: npm run parity
//
// No test framework on purpose — this repo has none, and the contract is worth
// guarding today rather than after a runner is chosen.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  contentWidth,
  layersInSlide,
  slideIndexAtX,
  slideOf,
  slideRect,
  spansSlides,
} from "../lib/template/continuous";
import type { ContinuousCanvas, Layer } from "../lib/template/types";

interface StubLayer {
  id: string;
  x: number;
  width: number;
}

interface Contract {
  canvases: Record<string, ContinuousCanvas>;
  contentWidth: { name: string; canvas: string; expected: number }[];
  slideRect: { name: string; canvas: string; i: number; expected: unknown }[];
  slideIndexAtX: { name: string; canvas: string; x: number; expected: number }[];
  slideOf: { name: string; canvas: string; layer: StubLayer; expected: number }[];
  spansSlides: { name: string; canvas: string; layer: StubLayer; expected: boolean }[];
  layersInSlide: {
    name: string;
    canvas: string;
    layers: StubLayer[];
    expected: Record<string, string[]>;
  }[];
}

const contract = JSON.parse(
  readFileSync(join(import.meta.dirname, "../lib/template/continuous-parity.json"), "utf8")
) as Contract;

// These derivations read only id/x/width; the rest of the shape is irrelevant,
// so the stub is widened rather than fully populated.
const asLayer = (s: StubLayer): Layer =>
  ({ id: s.id, type: "shape", shape: "rectangle", x: s.x, y: 0, width: s.width, height: 100, fill: "#000000" }) as Layer;

let failures = 0;
const eq = (group: string, name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`  FAIL  ${group}: ${name}\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
  } else {
    console.log(`  PASS  ${group}: ${name}`);
  }
};

const canvasOf = (key: string): ContinuousCanvas => {
  const c = contract.canvases[key];
  if (!c) throw new Error(`unknown canvas "${key}" in the parity contract`);
  return c;
};

for (const c of contract.contentWidth) {
  eq("contentWidth", c.name, contentWidth(canvasOf(c.canvas)), c.expected);
}
for (const c of contract.slideRect) {
  eq("slideRect", c.name, slideRect(canvasOf(c.canvas), c.i), c.expected);
}
for (const c of contract.slideIndexAtX) {
  eq("slideIndexAtX", c.name, slideIndexAtX(canvasOf(c.canvas), c.x), c.expected);
}
for (const c of contract.slideOf) {
  eq("slideOf", c.name, slideOf(canvasOf(c.canvas), asLayer(c.layer)), c.expected);
}
for (const c of contract.spansSlides) {
  eq("spansSlides", c.name, spansSlides(canvasOf(c.canvas), asLayer(c.layer)), c.expected);
}
for (const c of contract.layersInSlide) {
  const canvas = canvasOf(c.canvas);
  const layers = c.layers.map(asLayer);
  const actual: Record<string, string[]> = {};
  for (const key of Object.keys(c.expected)) {
    actual[key] = layersInSlide(canvas, layers, Number(key)).map((l) => l.id);
  }
  eq("layersInSlide", c.name, actual, c.expected);
}

console.log(
  failures === 0
    ? "\nPARITY OK — continuous.ts matches the shared contract"
    : `\n${failures} PARITY FAILURE(S) — continuous.ts drifted from the contract`
);
process.exit(failures === 0 ? 0 : 1);
