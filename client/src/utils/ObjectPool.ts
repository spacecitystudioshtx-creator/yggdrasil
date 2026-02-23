/**
 * Generic object pool to avoid GC pressure from frequent allocation/deallocation.
 * Used for projectiles, damage numbers, particles, etc.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 0,
  ) {
    this.factory = factory;
    this.reset = reset;

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /** Get an object from the pool (or create a new one if empty) */
  acquire(): T {
    const obj = this.pool.pop() ?? this.factory();
    this.active.add(obj);
    return obj;
  }

  /** Return an object to the pool */
  release(obj: T): void {
    if (!this.active.has(obj)) return;
    this.active.delete(obj);
    this.reset(obj);
    this.pool.push(obj);
  }

  /** Number of objects currently in use */
  get activeCount(): number {
    return this.active.size;
  }

  /** Number of objects available in pool */
  get availableCount(): number {
    return this.pool.length;
  }

  /** Iterate over all active objects */
  forEachActive(callback: (obj: T) => void): void {
    this.active.forEach(callback);
  }

  /** Release all active objects back to pool */
  releaseAll(): void {
    this.active.forEach((obj) => {
      this.reset(obj);
      this.pool.push(obj);
    });
    this.active.clear();
  }
}
