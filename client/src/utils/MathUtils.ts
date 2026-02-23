/**
 * Math utilities for angles, vectors, and game calculations.
 */

/** Convert degrees to radians */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** Convert radians to degrees */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/** Get angle from point A to point B in radians */
export function angleBetween(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  return Math.atan2(by - ay, bx - ax);
}

/** Get distance between two points */
export function distanceBetween(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Normalize a vector to unit length */
export function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Random integer between min (inclusive) and max (inclusive) */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random float between min and max */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
