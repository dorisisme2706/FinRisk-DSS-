(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CGPersistence = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "carbongraph.mvp.v0.6.working-state";
  const LEGACY_STORAGE_KEY = "carbongraph.mvp.v0.5.working-state";
  const LEGACY_STORAGE_KEYS = [LEGACY_STORAGE_KEY, "carbongraph.mvp.v0.4.working-state"];
  const SCHEMA_VERSION = 1;

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function extractPatch(state) {
    return {
      batchId: state.batch.batchId,
      hrcLotId: state.batch.hrcLotId,
      widthMm: state.precursor.widthMm,
      thicknessMm: state.precursor.thicknessMm,
      surfaceState: state.precursor.surfaceState,
      origin: state.precursor.origin,
      route: state.precursor.route
    };
  }

  function applyPatch(seed, patch) {
    const next = deepClone(seed);
    if (!patch || typeof patch !== "object") return next;

    if ("batchId" in patch) next.batch.batchId = patch.batchId;
    if ("hrcLotId" in patch) next.batch.hrcLotId = patch.hrcLotId;
    if ("widthMm" in patch) next.precursor.widthMm = patch.widthMm;
    if ("thicknessMm" in patch) next.precursor.thicknessMm = patch.thicknessMm;
    if ("surfaceState" in patch) next.precursor.surfaceState = patch.surfaceState;
    if ("origin" in patch) next.precursor.origin = patch.origin;
    if ("route" in patch) next.precursor.route = patch.route;

    return next;
  }

  function save(state, storage) {
    if (!storage || typeof storage.setItem !== "function") return false;
    const envelope = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      patch: extractPatch(state)
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  }

  function load(seed, storage) {
    if (!storage || typeof storage.getItem !== "function") {
      return { seed: deepClone(seed), restored: false, savedAt: null };
    }

    try {
      const raw = storage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => storage.getItem(key)).find(Boolean);
      if (!raw) return { seed: deepClone(seed), restored: false, savedAt: null };
      const envelope = JSON.parse(raw);
      if (envelope.schemaVersion !== SCHEMA_VERSION || !envelope.patch) {
        return { seed: deepClone(seed), restored: false, savedAt: null };
      }
      return {
        seed: applyPatch(seed, envelope.patch),
        restored: true,
        savedAt: envelope.savedAt || null
      };
    } catch (_) {
      return { seed: deepClone(seed), restored: false, savedAt: null };
    }
  }

  function clear(storage) {
    if (!storage || typeof storage.removeItem !== "function") return false;
    storage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
    return true;
  }

  return {
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    LEGACY_STORAGE_KEYS,
    SCHEMA_VERSION,
    extractPatch,
    applyPatch,
    save,
    load,
    clear
  };
});
