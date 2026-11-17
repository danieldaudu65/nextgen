// Types for scene.js (the 3D island)
export interface WorldLevelInfo { key: string; color: string; short: string }
export interface WorldIslandInfo { name: string; sub: string; locked?: boolean }
export interface WorldOptions {
  teaser?: boolean;                      // homepage preview: slow spin, no controls, a tap calls onEnter
  levels: WorldLevelInfo[];              // the 7 levels, in road order
  islands?: WorldIslandInfo[];           // up to 3 other editions (the locked one = the next island)
  callout?: HTMLElement | null;          // the HTML "▶ Play" tag the scene keeps over the current level
  hideCallout?: () => boolean;
  onLevel?: (index: number) => void;
  onIsland?: (island: WorldIslandInfo) => void;
  onEnter?: () => void;
  onInput?: () => void;
}
export interface World {
  setProgress(stars: number[], opts?: { hopFrom?: number; onHopped?: () => void }): void;
  focusLevel(index: number, close?: boolean): void;
  focusCurrent(): void;
  zoomOut(): void;
  overview(): void;
  shake(index: number): void;
  unlockNext(): void;
  setNight(night: boolean): void;
  pause(paused: boolean): void;
  dispose(): void;
}
export function createWorld(canvas: HTMLCanvasElement, opts: WorldOptions): World;
