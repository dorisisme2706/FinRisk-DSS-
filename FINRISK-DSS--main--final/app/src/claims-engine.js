(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CGClaimsEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /*
   * VR-019 legacy-claim scanner.
   *
   * This is a deterministic text guardrail for release surfaces. It does not
   * decide whether a claim is legally valid; every finding must be removed or
   * routed through the A6/F1 human claims audit before release.
   */
  const PATTERNS = Object.freeze([
    Object.freeze({
      code: "CLM-LEGACY-TRACKED",
      label: "Unapproved legacy traceability percentage",
      regex: /\b100\s*%\s*(?:tracked|traceable|traced)\b/gi
    }),
    Object.freeze({
      code: "CLM-LEGACY-EMISSION-METRIC",
      label: "Unapproved legacy emission metric",
      regex: /-\s*0[.,]85\s*(?:kg\s*)?co2e\b/gi
    }),
    Object.freeze({
      code: "CLM-CBAM-COMPLIANCE",
      label: "Unsupported CBAM compliance/certification claim",
      regex: /\bcbam[-\s]*(?:compliant|certified|approved)\b/gi
    }),
    Object.freeze({
      code: "CLM-VERIFIED-EMISSIONS",
      label: "Unsupported verification claim",
      regex: /\bverified\s+(?:embedded\s+)?emissions?\b/gi
    })
  ]);

  function lineNumberAt(text, index) {
    return text.slice(0, index).split("\n").length;
  }

  function excerpt(text, index, length) {
    const start = Math.max(0, index - 45);
    const end = Math.min(text.length, index + length + 45);
    return text.slice(start, end).replace(/\s+/g, " ").trim();
  }

  function scanText(value, options = {}) {
    const text = String(value ?? "");
    const surface = String(options.surface || "UNSPECIFIED_SURFACE");
    const findings = [];

    PATTERNS.forEach((pattern) => {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        findings.push({
          rule: "VR-019",
          code: pattern.code,
          label: pattern.label,
          surface,
          line: lineNumberAt(text, match.index),
          match: match[0],
          excerpt: excerpt(text, match.index, match[0].length),
          disposition: "BLOCK_RELEASE_AND_ROUTE_TO_F1"
        });
        if (match[0].length === 0) regex.lastIndex += 1;
      }
    });

    return findings.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
  }

  function scanSurfaces(surfaces) {
    if (!Array.isArray(surfaces)) throw new Error("surfaces must be an array.");
    const findings = surfaces.flatMap((surface) => scanText(surface?.content, { surface: surface?.name }));
    return {
      scanned: surfaces.length,
      findings,
      status: findings.length === 0 ? "PASS_TECHNICAL" : "BLOCKED_REVIEW_REQUIRED"
    };
  }

  return Object.freeze({ PATTERNS, scanText, scanSurfaces });
});
