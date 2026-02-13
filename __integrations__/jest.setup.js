// Polyfill for the global `fail` function removed in jest-circus (Jest 27+).
// This avoids depending on jest-jasmine2 as test runner.
globalThis.fail = (reason) => {
  throw new Error(typeof reason === "string" ? reason : JSON.stringify(reason));
};
