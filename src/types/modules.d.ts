declare module 'worker:scan' {
  /** Bundled source of src/workers/scan.worker.ts, injected by tools/build.mjs. */
  const source: string;
  export default source;
}

declare const __SYNAPSE_VERSION__: string;
/** Extra origins allowed in connect-src, from SYNAPSE_INTEL_HOST at build time (comma-separated). */
declare const __SYNAPSE_INTEL_HOSTS__: readonly string[];
