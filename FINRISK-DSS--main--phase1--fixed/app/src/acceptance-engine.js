(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  root.CGAcceptanceEngine = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "carbongraph.acceptance.v0.6";
  const REVIEWER_STORAGE_KEY = "carbongraph.acceptance.reviewer.v0.6";
  const ALLOWED = new Set(["NOT_RUN", "PASS", "FAIL"]);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function empty(catalog) {
    const records = {};
    catalog.cases.forEach((item) => {
      records[item.id] = { status: "NOT_RUN", note: "", checkedAt: null };
    });
    return records;
  }

  function normalize(catalog, raw) {
    const base = empty(catalog);
    if (!raw || typeof raw !== "object") return base;
    catalog.cases.forEach((item) => {
      const candidate = raw[item.id];
      if (!candidate || !ALLOWED.has(candidate.status)) return;
      base[item.id] = {
        status: candidate.status,
        note: typeof candidate.note === "string" ? candidate.note.slice(0, 2000) : "",
        checkedAt: typeof candidate.checkedAt === "string" ? candidate.checkedAt : null
      };
    });
    return base;
  }

  function load(catalog, storage) {
    if (!storage || typeof storage.getItem !== "function") return empty(catalog);
    try {
      const payload = JSON.parse(storage.getItem(STORAGE_KEY));
      if (!payload || payload.catalogVersion !== catalog.version) return empty(catalog);
      return normalize(catalog, payload.records);
    } catch (_) {
      return empty(catalog);
    }
  }

  function save(catalog, records, storage) {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: "1.0",
      catalogVersion: catalog.version,
      savedAt: new Date().toISOString(),
      records: normalize(catalog, records)
    }));
    return true;
  }

  function normalizeReviewer(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/\s+/g, " ").slice(0, 120);
  }

  function loadReviewer(storage) {
    if (!storage || typeof storage.getItem !== "function") return "";
    try {
      return normalizeReviewer(storage.getItem(REVIEWER_STORAGE_KEY));
    } catch (_) {
      return "";
    }
  }

  function saveReviewer(reviewer, storage) {
    if (!storage || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") return false;
    const normalized = normalizeReviewer(reviewer);
    if (!normalized) storage.removeItem(REVIEWER_STORAGE_KEY);
    else storage.setItem(REVIEWER_STORAGE_KEY, normalized);
    return true;
  }

  function setResult(catalog, records, id, status, note, now) {
    if (!catalog.cases.some((item) => item.id === id)) throw new Error(`Unknown acceptance case: ${id}`);
    if (!ALLOWED.has(status)) throw new Error(`Unsupported acceptance status: ${status}`);
    const next = normalize(catalog, records);
    next[id] = {
      status,
      note: typeof note === "string" ? note.trim().slice(0, 2000) : "",
      checkedAt: status === "NOT_RUN" ? null : (now || new Date().toISOString())
    };
    return next;
  }

  function summary(catalog, records) {
    const normalized = normalize(catalog, records);
    const counts = { PASS: 0, FAIL: 0, NOT_RUN: 0 };
    Object.values(normalized).forEach((item) => { counts[item.status] += 1; });
    return {
      total: catalog.cases.length,
      ...counts,
      reviewStatus: counts.PASS === catalog.cases.length ? "REVIEW_COMPLETE" : "REVIEW_INCOMPLETE",
      complianceStatus: "NOT_EVALUATED",
      dataset: "SYNTHETIC_DEMO",
      r006Status: "OPEN",
      numericEmissionStatus: "BLOCKED"
    };
  }

  function buildRecord(catalog, records, options = {}) {
    const normalized = normalize(catalog, records);
    const resultSummary = summary(catalog, normalized);
    const reviewer = normalizeReviewer(options.reviewer);
    return {
      recordType: "FINRISK_LEGACY_MANUAL_UAT_RECORD",
      recordVersion: "1.0",
      generatedAt: options.generatedAt || new Date().toISOString(),
      reviewer: reviewer || "UNSPECIFIED_REVIEWER",
      guardrails: {
        dataOrigin: "SYNTHETIC_DEMO",
        r006Status: "OPEN",
        numericEmissionStatus: "BLOCKED",
        complianceStatus: "NOT_EVALUATED",
        gateDecision: "NOT_MADE_BY_THIS_RECORD"
      },
      summary: resultSummary,
      cases: catalog.cases.map((item) => ({
        id: item.id,
        workItem: item.workItem,
        title: item.title,
        result: clone(normalized[item.id])
      }))
    };
  }

  function isExportReady(catalog, records, reviewer) {
    return summary(catalog, records).reviewStatus === "REVIEW_COMPLETE" && normalizeReviewer(reviewer) !== "";
  }

  function clear(catalog, storage) {
    if (storage && typeof storage.removeItem === "function") {
      storage.removeItem(STORAGE_KEY);
      storage.removeItem(REVIEWER_STORAGE_KEY);
    }
    return empty(catalog);
  }

  return Object.freeze({
    STORAGE_KEY,
    REVIEWER_STORAGE_KEY,
    empty,
    normalize,
    load,
    save,
    normalizeReviewer,
    loadReviewer,
    saveReviewer,
    setResult,
    summary,
    buildRecord,
    isExportReady,
    clear
  });
});
