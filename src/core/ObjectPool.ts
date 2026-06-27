/**
 * Fixed-capacity object pool — zero allocations during gameplay.
 * Pre-allocates once at construction; never calls factory() after that.
 */
export class ObjectPool<T> {
  private readonly items: T[];
  private readonly freeStack: number[];
  private freeTop: number;
  private readonly activeList: T[];
  private activeCount = 0;
  private readonly resetFn: (obj: T) => void;

  constructor(factory: () => T, resetFn: (obj: T) => void, capacity: number) {
    this.resetFn = resetFn;
    this.items = new Array(capacity);
    this.freeStack = new Array(capacity);
    this.activeList = new Array(capacity);
    this.freeTop = capacity - 1;

    for (let i = 0; i < capacity; i++) {
      const obj = factory();
      resetFn(obj);
      this.items[i] = obj;
      this.freeStack[i] = i;
      (obj as PoolSlot).poolSlot = i;
      (obj as PoolSlot).activeIdx = -1;
    }
  }

  acquire(): T | null {
    if (this.freeTop < 0) return null;

    const slot = this.freeStack[this.freeTop--];
    const obj = this.items[slot];
    const idx = this.activeCount++;
    (obj as PoolSlot).activeIdx = idx;
    this.activeList[idx] = obj;
    return obj;
  }

  release(obj: T): void {
    const slot = (obj as PoolSlot).poolSlot;
    const activeIdx = (obj as PoolSlot).activeIdx;
    if (slot === undefined || activeIdx < 0) return;

    this.resetFn(obj);
    (obj as PoolSlot).activeIdx = -1;

    const last = --this.activeCount;
    if (activeIdx !== last) {
      const moved = this.activeList[last];
      this.activeList[activeIdx] = moved;
      (moved as PoolSlot).activeIdx = activeIdx;
    }

    this.freeStack[++this.freeTop] = slot;
  }

  releaseAll(): void {
    for (let i = 0; i < this.activeCount; i++) {
      const obj = this.activeList[i];
      this.resetFn(obj);
      (obj as PoolSlot).activeIdx = -1;
      this.freeStack[++this.freeTop] = (obj as PoolSlot).poolSlot!;
    }
    this.activeCount = 0;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  /** Iterate live objects — zero allocation. */
  forEachActive(fn: (item: T) => void): void {
    for (let i = 0; i < this.activeCount; i++) {
      fn(this.activeList[i]);
    }
  }

  /** Iterate every pre-allocated slot (for scene rebind after shutdown). */
  forEachAll(fn: (item: T) => void): void {
    for (let i = 0; i < this.items.length; i++) {
      fn(this.items[i]);
    }
  }

  getPoolSize(): number {
    return this.freeTop + 1;
  }
}

interface PoolSlot {
  poolSlot?: number;
  activeIdx: number;
}
