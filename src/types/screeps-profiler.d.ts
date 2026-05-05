declare module "screeps-profiler" {
  type ScreepsProfilerClassConstructor = new (...args: never[]) => object;
  type ScreepsProfilerFunction = (...args: never[]) => unknown;

  export function enable(): void;
  export function wrap<T extends (...args: never[]) => unknown>(fn: T): T;
  // Plan 02-02 contract wording: registerClass(constructor: Function, label: string): void
  export function registerClass(constructor: ScreepsProfilerClassConstructor, label: string): void;
  export function registerObject(object: object, label: string): void;
  // Plan 02-02 contract wording: registerFN(fn: Function): void
  export function registerFN(fn: ScreepsProfilerFunction): void;
}
