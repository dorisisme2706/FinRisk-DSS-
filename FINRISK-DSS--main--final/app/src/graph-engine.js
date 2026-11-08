(function (root, factory) {
  let model;
  if (typeof module !== "undefined" && module.exports) {
    model = require("./graph-model.js");
    module.exports = factory(model);
  } else {
    model = root.CGGraphModel;
    root.CGGraphEngine = factory(model);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (model) {
  "use strict";

  if (!model || !model.NODE_TYPES || !model.RELATIONS) {
    throw new Error("Graph Engine boot failed: graph-model.js is missing.");
  }

  const { NODE_TYPES, RELATIONS, CORE_RELATIONS } = model;

  function isBlank(value) {
    return value === null || value === undefined || String(value).trim() === "";
  }

  function node(id, type, status, sourceClass = "PROJECT_CONTROL", meta = {}) {
    return { id, type, status, sourceClass, meta };
  }

  function edge(id, from, relation, to, status = "READY_FOR_REVIEW", meta = {}) {
    return { id, from, relation, to, status, meta };
  }

  function addNode(nodes, value) {
    if (!value || isBlank(value.id)) return;
    nodes.push(value);
  }

  function addEdge(edges, value) {
    if (!value || isBlank(value.from) || isBlank(value.to)) return;
    edges.push(value);
  }

  function build(state) {
    const nodes = [];
    const edges = [];
    const resultId = state.result?.resultId || "RESULT-DEMO-001";
    const evidencePackId = "CG-DAT-004";

    addNode(nodes, node(state.meta.datasetId, NODE_TYPES.DATASET, "REVIEW"));
    addNode(nodes, node(state.scope.facilityId, NODE_TYPES.FACILITY, "ACCEPTED"));
    addNode(nodes, node(state.scope.productId, NODE_TYPES.PRODUCT, "ACCEPTED"));
    addNode(nodes, node(state.batch.batchId, NODE_TYPES.BATCH, "REVIEW", "SYNTHETIC"));
    addNode(nodes, node(state.batch.hrcLotId, NODE_TYPES.PRECURSOR_LOT, "REVIEW", "SYNTHETIC"));
    addNode(nodes, node(state.batch.precursorId, NODE_TYPES.PRECURSOR, "ACCEPTED_ID_ONLY"));
    addNode(nodes, node(evidencePackId, NODE_TYPES.EVIDENCE, "REVIEW_SYNTHETIC_ONLY", "SYNTHETIC"));
    addNode(nodes, node(state.meta.traceId, NODE_TYPES.TRACE, "REVIEW", "SYNTHETIC"));
    addNode(nodes, node(resultId, NODE_TYPES.RESULT, state.release?.resultVisibility || "MASKED", "SYNTHETIC"));
    addNode(nodes, node("R-006", NODE_TYPES.RISK, state.meta.r006Status || "OPEN"));

    addEdge(edges, edge("GE-DYN-001", state.meta.datasetId, RELATIONS.HAS_SCOPE, state.scope.facilityId));
    addEdge(edges, edge("GE-DYN-002", state.meta.datasetId, RELATIONS.DESCRIBES, state.scope.productId));
    addEdge(edges, edge("GE-DYN-003", state.batch.batchId, RELATIONS.INSTANCE_OF, state.scope.productId));
    addEdge(edges, edge("GE-DYN-004", state.batch.batchId, RELATIONS.PRODUCED_AT, state.scope.facilityId));
    addEdge(edges, edge("GE-DYN-005", state.batch.batchId, RELATIONS.CONSUMES, state.batch.hrcLotId));
    addEdge(edges, edge("GE-DYN-006", state.batch.hrcLotId, RELATIONS.IS_LOT_OF, state.batch.precursorId));
    addEdge(edges, edge("GE-DYN-007", state.batch.precursorId, RELATIONS.SUPPORTED_BY, evidencePackId, "REVIEW_SYNTHETIC_ONLY"));
    addEdge(edges, edge("GE-DYN-008", resultId, RELATIONS.DERIVED_FROM, state.batch.batchId));
    addEdge(edges, edge("GE-DYN-009", resultId, RELATIONS.HAS_TRACE, state.meta.traceId));
    addEdge(edges, edge("GE-DYN-010", resultId, RELATIONS.GATED_BY, "R-006", "BLOCKED_BY_R006"));

    const ruleNodeIds = new Set();
    (state.validation || []).forEach((validationIssue, index) => {
      const issueId = validationIssue.issueId;
      const ruleId = validationIssue.rule;
      if (!isBlank(issueId)) {
        addNode(nodes, node(issueId, NODE_TYPES.VALIDATION_ISSUE, validationIssue.status || "OPEN", "PROJECT_CONTROL", {
          severity: validationIssue.severity,
          field: validationIssue.field,
          message: validationIssue.message
        }));
        addEdge(edges, edge(`GE-DYN-V-${String(index + 1).padStart(3, "0")}`, resultId, RELATIONS.HAS_VALIDATION_ISSUE, issueId,
          validationIssue.status === "OPEN" ? "OPEN" : "RESOLVED"));
      }
      if (!isBlank(ruleId) && !ruleNodeIds.has(ruleId)) {
        ruleNodeIds.add(ruleId);
        addNode(nodes, node(ruleId, NODE_TYPES.RULE, "ACTIVE"));
        addEdge(edges, edge(`GE-DYN-RULE-${String(ruleNodeIds.size).padStart(3, "0")}`, resultId, RELATIONS.VALIDATED_BY, ruleId));
      }
      if (!isBlank(issueId) && !isBlank(ruleId)) {
        addEdge(edges, edge(`GE-DYN-R-${String(index + 1).padStart(3, "0")}`, issueId, RELATIONS.VIOLATES_RULE, ruleId));
      }
    });

    const summary = checkIntegrity(nodes, edges);
    return { nodes, edges, summary };
  }

  function checkIntegrity(nodes, edges) {
    const ids = nodes.map((item) => item.id);
    const uniqueNodeIds = new Set(ids).size === ids.length;
    const idSet = new Set(ids);
    const orphanEdges = edges.filter((item) => !idSet.has(item.from) || !idSet.has(item.to));
    const presentRelations = new Set(edges.map((item) => item.relation));
    const missingCoreRelations = CORE_RELATIONS.filter((relation) => !presentRelations.has(relation));
    const integrityStatus = uniqueNodeIds && orphanEdges.length === 0 && missingCoreRelations.length === 0
      ? "PASS"
      : "REVIEW";

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      uniqueNodeIds,
      orphanCount: orphanEdges.length,
      orphanEdges,
      missingCoreRelations,
      integrityStatus
    };
  }

  return {
    build,
    checkIntegrity
  };
});
