function setTimeoutPromise(
  duration: number,
  value?: any,
  options?: {
    signal: AbortSignal;
  }
) {
  return new Promise((r) => {
    const timeout = setTimeout(() => r(value), duration);
    options?.signal?.addEventListener("abort", () => clearTimeout(timeout));
  });
}

export function setImmediatePromised(
  value?: any,
  options?: {
    signal: AbortSignal;
  }
) {
  return new Promise((r) => {
    const timeout = setImmediate(() => r(value));
    options?.signal?.addEventListener("abort", () => clearImmediate(timeout));
  });
}

export { setTimeoutPromise as setTimeout };
export { setImmediatePromised as setImmediate };
export default {
  setTimeout: setTimeoutPromise,
  setImmediate: setImmediatePromised,
};
