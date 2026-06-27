/** True in Vite production builds — gates dev-only logging and profilers. */
export const IS_PRODUCTION = import.meta.env.PROD;

export function devWarn(...args: unknown[]): void {
  if (!IS_PRODUCTION) {
    console.warn(...args);
  }
}

export function devLog(...args: unknown[]): void {
  if (!IS_PRODUCTION) {
    console.log(...args);
  }
}
