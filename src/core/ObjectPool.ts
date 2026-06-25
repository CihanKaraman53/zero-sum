/**
 * Generic Object Pool - zero GC allocations during gameplay.
 * Pre-allocates objects at scene boot, recycles them during play.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private resetFn: (obj: T) => void;

  constructor(factory: () => T, resetFn: (obj: T) => void, initialSize: number = 0) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.preAllocate(initialSize);
  }

  preAllocate(count: number): void {
    for (let i = 0; i < count; i++) {
      const obj = this.factory();
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  acquire(): T | null {
    let obj: T;
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      // Emergency: create one more (shouldn't happen with proper pre-allocation)
      obj = this.factory();
    }
    this.active.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.active.has(obj)) return;
    this.active.delete(obj);
    this.resetFn(obj);
    this.pool.push(obj);
  }

  releaseAll(): void {
    this.active.forEach(obj => {
      this.resetFn(obj);
      this.pool.push(obj);
    });
    this.active.clear();
  }

  getActiveCount(): number {
    return this.active.size;
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  getActiveItems(): Set<T> {
    return this.active;
  }
}
