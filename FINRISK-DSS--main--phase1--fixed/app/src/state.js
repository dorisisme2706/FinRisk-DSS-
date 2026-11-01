(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CGState = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EDITABLE_FIELDS = Object.freeze({
    batchId: "batch.batchId",
    hrcLotId: "batch.hrcLotId",
    widthMm: "precursor.widthMm",
    thicknessMm: "precursor.thicknessMm",
    surfaceState: "precursor.surfaceState",
    origin: "precursor.origin",
    route: "precursor.route"
  });

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getByPath(object, path) {
    return path.split(".").reduce((current, key) => current[key], object);
  }

  function setByPath(object, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const parent = keys.reduce((current, key) => current[key], object);
    parent[last] = value;
  }

  function normalizeId(raw) {
    if (raw === null || raw === undefined) return "";
    return String(raw)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9_-]/g, "");
  }

  function normalizeNullableNumber(raw) {
    if (raw === "" || raw === null || raw === undefined) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function normalizeIso2(raw) {
    if (raw === null || raw === undefined) return "";
    return String(raw).trim().toUpperCase().slice(0, 2);
  }

  function normalizeValue(field, raw) {
    switch (field) {
      case "batchId":
      case "hrcLotId":
        return normalizeId(raw);
      case "widthMm":
      case "thicknessMm":
        return normalizeNullableNumber(raw);
      case "origin":
        return normalizeIso2(raw);
      case "surfaceState":
      case "route":
        return raw === null || raw === undefined ? "" : String(raw).trim();
      default:
        throw new Error(`Unsupported editable field: ${field}`);
    }
  }

  function createStore(seed, options = {}) {
    const baseline = deepClone(seed);
    const validationEngine = options.validationEngine || null;
    const graphEngine = options.graphEngine || null;
    const releaseEngine = options.releaseEngine || null;
    let state = deepClone(seed);
    let revision = 0;
    let history = [];
    const listeners = new Set();

    function recompute(reason = "DERIVED_STATE_RECOMPUTE") {
      if (validationEngine && typeof validationEngine.evaluate === "function") {
        const validationResult = validationEngine.evaluate(state);
        state.validation = deepClone(validationResult.issues);
        state.validationSummary = deepClone(validationResult.summary);
        state.precursor.candidateCn8 = deepClone(validationResult.candidateCn8);
        state.validationRuntime = {
          reason,
          evaluatedAtRevision: revision
        };
      }

      if (graphEngine && typeof graphEngine.build === "function") {
        const graphResult = graphEngine.build(state);
        state.graph = deepClone({
          nodes: graphResult.nodes,
          edges: graphResult.edges
        });
        state.graphSummary = deepClone(graphResult.summary);
        state.graphRuntime = {
          reason,
          evaluatedAtRevision: revision
        };
      }

      if (releaseEngine && typeof releaseEngine.evaluate === "function") {
        const releaseResult = releaseEngine.evaluate(state);
        state.release = deepClone(releaseResult);
        state.meta.numericReleaseStatus = releaseResult.numericReleaseStatus;
        state.meta.resultVisibility = releaseResult.resultVisibility;
        state.releaseRuntime = {
          reason,
          evaluatedAtRevision: revision
        };
      }

      // Rebuild graph after release derivation so RESULT node carries the current release state.
      if (graphEngine && typeof graphEngine.build === "function") {
        const finalGraph = graphEngine.build(state);
        state.graph = deepClone({
          nodes: finalGraph.nodes,
          edges: finalGraph.edges
        });
        state.graphSummary = deepClone(finalGraph.summary);
      }
    }

    // Baseline/restored seed chạy qua cùng derived-state pipeline.
    recompute("V04_INITIAL_RECOMPUTE");

    function snapshot() {
      return {
        ...deepClone(state),
        runtime: {
          revision,
          history: deepClone(history),
          dirty: history.length > 0
        }
      };
    }

    function notify() {
      const current = snapshot();
      listeners.forEach((listener) => listener(current));
    }

    function getState() {
      return snapshot();
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function applyInput(patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        throw new Error("Input patch must be an object.");
      }

      const incomingFields = Object.keys(patch);
      const unknownFields = incomingFields.filter((field) => !(field in EDITABLE_FIELDS));
      if (unknownFields.length > 0) {
        throw new Error(`Locked or unsupported field(s): ${unknownFields.join(", ")}`);
      }

      const changes = [];

      incomingFields.forEach((field) => {
        const path = EDITABLE_FIELDS[field];
        const oldValue = getByPath(state, path);
        const newValue = normalizeValue(field, patch[field]);

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          setByPath(state, path, newValue);
          changes.push({ field, path, oldValue, newValue });
        }
      });

      if (changes.length === 0) {
        // Cho phép manual revalidation nếu form không đổi.
        recompute("V04_RECOMPUTE_NO_INPUT_DIFF");
        notify();
        return getState();
      }

      revision += 1;
      const revisionEntry = {
        revision,
        reason: "C2_INPUT_APPLIED_AND_C3_REVALIDATED",
        changes
      };
      history.unshift(revisionEntry);
      history = history.slice(0, 20);

      recompute("V04_AFTER_INPUT");
      notify();
      return getState();
    }

    function validate() {
      recompute("V04_MANUAL_RECOMPUTE");
      notify();
      return getState();
    }

    function reset() {
      state = deepClone(baseline);
      revision += 1;
      history = [{
        revision,
        reason: "RESET_TO_SYNTHETIC_BASELINE",
        changes: []
      }];
      recompute("V04_AFTER_RESET");
      notify();
      return getState();
    }

    return {
      getState,
      subscribe,
      applyInput,
      validate,
      reset,
      editableFields: EDITABLE_FIELDS
    };
  }

  return {
    createStore,
    normalizeId,
    normalizeNullableNumber,
    normalizeIso2,
    EDITABLE_FIELDS
  };
});
