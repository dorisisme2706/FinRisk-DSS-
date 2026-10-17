(function () {
  "use strict";

  const required = [
    "CG_BASELINE",
    "CGValidationRules",
    "CGValidationEngine",
    "CGGraphModel",
    "CGGraphEngine",
    "CGReleaseEngine",
    "CGReportEngine",
    "CGE2EEngine",
    "CGAcceptanceCatalog",
    "CGAcceptanceEngine",
    "CGPersistence",
    "CGState"
  ];

  const missing = required.filter((name) => !window[name]);
  if (missing.length > 0) {
    throw new Error(`CarbonGraph boot failed. Missing module(s): ${missing.join(", ")}`);
  }

  const $ = (selector) => document.querySelector(selector);
  const persistenceLoad = window.CGPersistence.load(window.CG_BASELINE, window.localStorage);
  let acceptanceRecords = window.CGAcceptanceEngine.load(window.CGAcceptanceCatalog, window.localStorage);
  let acceptanceReviewer = window.CGAcceptanceEngine.loadReviewer(window.localStorage);

  const store = window.CGState.createStore(persistenceLoad.seed, {
    validationEngine: window.CGValidationEngine,
    graphEngine: window.CGGraphEngine,
    releaseEngine: window.CGReleaseEngine
  });

  let persistenceMeta = {
    restored: persistenceLoad.restored,
    savedAt: persistenceLoad.savedAt,
    lastSaveOk: true
  };

  const screens = [
    ["overview", "Tổng quan", "Dashboard", "dashboard"],
    ["data", "Input Module", "Working data", "database"],
    ["evidence", "Evidence Queue", "Bằng chứng", "file-check"],
    ["validation", "Validation", "Rule & issue", "shield-check"],
    ["trace", "Trace Explorer", "Evidence graph", "network"],
    ["result", "Release Gate", "Blocked / masked", "lock"],
    ["export", "Working Export", "Working-only", "download"],
    ["e2e", "End-to-End", "Safety flow", "route"],
    ["acceptance", "Test Center", "Manual UAT", "flask"]
  ];

  const ICONS = Object.freeze({
    dashboard: '<path d="M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z"/>',
    database: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    'file-check': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>',
    'shield-check': '<path d="M12 3l7 3v5c0 4.8-2.8 8.1-7 10-4.2-1.9-7-5.2-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    network: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 7.2l4 8M17 7.2l-4 8M7 6h10"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 20h14"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 003-3V9a3 3 0 013-3h-1"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4A2 2 0 0019 18l-5-9V3"/><path d="M8 15h8"/>',
    check: '<path d="M5 12l4 4L19 6"/>',
    alert: '<path d="M12 3l9 17H3z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M18 12a6 6 0 00-10.8-3.6L4 12M6 12a6 6 0 0010.8 3.6L20 12"/>',
    save: '<path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/>',
    sparkles: '<path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7zM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>'
  });

  function icon(name, size = 18, extraClass = "") {
    const paths = ICONS[name] || ICONS.info;
    return `<svg class="ui-icon ${escapeHtml(extraClass)}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  }

  function showToast(message, type = "info", title = "CarbonGraph", duration = 3600) {
    const region = document.getElementById("toast-region");
    if (!region) return;
    const toast = document.createElement("div");
    const iconName = type === "success" ? "check" : type === "danger" ? "alert" : type === "warning" ? "alert" : "info";
    toast.className = `app-toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icon(iconName, 18)}</span><div class="toast-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div><button class="toast-close" type="button" title="Đóng">${icon("close", 15)}</button>`;
    region.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    const remove = () => {
      toast.classList.remove("show");
      window.setTimeout(() => toast.remove(), 180);
    };
    toast.querySelector(".toast-close").addEventListener("click", remove);
    window.setTimeout(remove, duration);
  }

  function emptyState(title, message, iconName = "info") {
    return `<div class="empty-state enhanced-empty-state"><span>${icon(iconName, 22)}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div></div>`;
  }

  function setButtonBusy(button, busy, busyLabel = "Đang xử lý…") {
    if (!button) return;
    if (busy) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.classList.add("is-busy");
      button.innerHTML = `<span class="button-spinner"></span>${escapeHtml(busyLabel)}`;
    } else {
      button.disabled = false;
      button.classList.remove("is-busy");
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function runBusyAction(button, busyLabel, action) {
    setButtonBusy(button, true, busyLabel);
    window.requestAnimationFrame(() => {
      try {
        action();
      } catch (error) {
        showToast(error.message || "Thao tác không hoàn tất.", "danger", "Action failed", 5200);
      } finally {
        setButtonBusy(button, false);
      }
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function valueOrDash(value) {
    return value === null || value === undefined || value === ""
      ? '<span class="muted">—</span>'
      : escapeHtml(value);
  }

  function statusClass(status) {
    if (["OPEN", "BLOCKED", "MISSING", "MASKED", "BLOCKER", "ERROR", "FAIL"].includes(status)) return "danger";
    if (["REVIEW", "REVIEW_SYNTHETIC_ONLY", "REQUIRES_REVALIDATION", "WARNING", "UNSUPPORTED_BRANCH"].includes(status)) return "warning";
    if (["ACCEPTED", "PASS", "RESOLVED", "ACTIVE", "REVIEW_COMPLETE"].includes(status)) return "success";
    return "info";
  }

  function pill(text, status = text) {
    return `<span class="pill ${statusClass(status)}">${escapeHtml(text)}</span>`;
  }

  function setHeader(title, subtitle) {
    $("#screen-title").textContent = title;
    $("#screen-subtitle").textContent = subtitle;
  }

  function activateNav(screenId) {
    const nav = document.getElementById("nav");
    if (!nav) return;
    let activeButton = null;
    nav.querySelectorAll("button").forEach((button) => {
      const isActive = button.dataset.screen === screenId;
      button.classList.toggle("active", isActive);
      if (isActive) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
      if (isActive) activeButton = button;
    });

    // #20: Keep the selected workspace tab visible within the horizontal
    // mobile nav, including direct hash navigation. Scroll this bar only;
    // scrollIntoView() would also move the page vertically on small devices.
    if (activeButton && nav.scrollWidth > nav.clientWidth) {
      const viewport = nav.getBoundingClientRect();
      const tab = activeButton.getBoundingClientRect();
      const edge = 6;
      if (tab.left < viewport.left + edge) {
        nav.scrollLeft -= viewport.left + edge - tab.left;
      } else if (tab.right > viewport.right - edge) {
        nav.scrollLeft += tab.right - (viewport.right - edge);
      }
    }
  }

  function renderOverview() {
    const state = store.getState();
    const issueCount = state.validationSummary?.total ?? 0;
    const blockerCount = state.validationSummary?.BLOCKER ?? 0;
    const missingEvidence = state.evidence.filter((item) => item.realStatus === "MISSING").length;
    const totalEvidence = state.evidence.length;
    const realCnReady = Boolean(state.precursor.realCn8.value);
    const seeReady = state.precursor.seeDirect.value !== null && state.precursor.seeDirect.value !== undefined && state.precursor.seeDirect.value !== "";
    const r006Closed = state.meta.r006Status === "CLOSED";
    const graphPass = state.graphSummary?.integrityStatus === "PASS";
    const releaseReady = state.release.numericReleaseStatus !== "BLOCKED" && state.release.resultVisibility !== "MASKED";

    setHeader("FinRisk DSS · Tổng quan", "Hero & KPI Dashboard · dữ liệu minh họa, chưa tích hợp backend.");

    $("#content").innerHTML = `
      <section class="product-hero" id="cg-product">
        <div class="product-hero-copy">
          <div class="hero-badge"><span class="hero-badge-dot"></span> FINRISK DSS · CREDIT RISK INTELLIGENCE</div>
          <h2>Hiểu rủi ro rõ hơn.<br><span>Ra quyết định tự tin hơn.</span></h2>
          <p class="product-hero-lead">FinRisk DSS hỗ trợ quy trình <strong>Hồ sơ → Đặc trưng → Dự báo ML → Đánh giá rủi ro → Quyết định</strong>. Minh bạch đầu vào, hỗ trợ giải thích kết quả và lưu vết quyết định khi tích hợp backend.</p>
          <div class="hero-actions">
            <button class="btn hero-primary" data-open-screen="data">${icon("database", 17)} Nhập hồ sơ vay <span>→</span></button>
            <button class="btn hero-secondary" data-open-screen="trace">${icon("network", 17)} Xem luồng đánh giá</button>
          </div>
          <div class="hero-proof-row">
            <span><b>01</b><small>Customer profile</small></span>
            <span><b>05</b><small>Decision pipeline stages</small></span>
            <span><b>DEMO</b><small>Chưa kết nối ML/PostgreSQL</small></span>
          </div>
        </div>
        <div class="app-preview-shell" aria-label="FinRisk DSS concept preview">
          <div class="preview-browser-bar"><div class="browser-dots"><i></i><i></i><i></i></div><span>FinRisk DSS · Concept Preview</span><span class="preview-live"><i></i> DEMO</span></div>
          <div class="preview-body">
            <div class="preview-title-row"><div><small>Credit assessment</small><strong>Decision workspace</strong></div><span class="finrisk-demo-tag">MOCK DATA</span></div>
            <div class="preview-metrics">
              <div class="preview-metric"><span>Hồ sơ</span><strong>1.248</strong><small>Minh họa</small></div>
              <div class="preview-metric"><span>Phê duyệt</span><strong>68,4%</strong><small>Minh họa</small></div>
              <div class="preview-metric"><span>Cần xem xét</span><strong>18,2%</strong><small>Minh họa</small></div>
            </div>
            <div class="preview-panel"><div class="preview-panel-head"><span>Decision pipeline</span><small>Concept UI · Chưa chạy mô hình</small></div>
              <div class="preview-flow-mini"><div class="mini-node ok">Customer<span>Profile</span></div><b>→</b><div class="mini-node ok">Features<span>Input</span></div><b>→</b><div class="mini-node warn">ML<span>Pending</span></div><b>→</b><div class="mini-node warn">Decision<span>Pending</span></div></div>
            </div>
            <div class="preview-status-line"><span class="finrisk-demo-tag">SYNTHETIC DEMO</span><span>Không phải quyết định tín dụng thật</span></div>
          </div>
        </div>
      </section>
      <section class="finrisk-dashboard" id="finrisk-kpi-dashboard" aria-label="FinRisk KPI Dashboard demo">
        <div class="finrisk-section-head"><div><span class="section-eyebrow">#06 · FINRISK KPI DASHBOARD</span><h2>Tổng quan danh mục hồ sơ</h2><p>Số liệu giả lập để kiểm tra giao diện. Chưa kết nối PostgreSQL, API hoặc mô hình ML.</p></div><span class="finrisk-demo-tag">DEMO / MOCK</span></div>
        <div class="finrisk-kpi-grid">
          <article class="finrisk-kpi"><span>Tổng hồ sơ</span><strong>1.248</strong><small>100% dữ liệu minh họa</small></article>
          <article class="finrisk-kpi"><span>Tỷ lệ phê duyệt</span><strong>68,4%</strong><small>854 hồ sơ (giả lập)</small></article>
          <article class="finrisk-kpi"><span>Chờ xem xét</span><strong>18,2%</strong><small>227 hồ sơ (giả lập)</small></article>
          <article class="finrisk-kpi"><span>Rủi ro cao</span><strong>13,4%</strong><small>167 hồ sơ (giả lập)</small></article>
        </div>
        <div class="finrisk-chart-grid">
          <article class="finrisk-chart"><h3>Phân bố trạng thái hồ sơ</h3><p>Giả lập · 1.248 hồ sơ</p><div class="finrisk-stacked" role="img" aria-label="Phê duyệt 68,4 phần trăm; chờ xem xét 18,2 phần trăm; rủi ro cao 13,4 phần trăm"><i style="width:68.4%;background:#16a36b"></i><i style="width:18.2%;background:#e5ad48"></i><i style="width:13.4%;background:#d46b61"></i></div><div class="finrisk-legend"><span>🟢 Phê duyệt 68,4%</span><span>🟡 Xem xét 18,2%</span><span>🔴 Rủi ro cao 13,4%</span></div></article>
          <article class="finrisk-chart"><h3>Xu hướng hồ sơ theo tháng</h3><p>Giả lập · Tháng 5–10/2026</p><div class="finrisk-bars" role="img" aria-label="Số hồ sơ giả lập: tháng 5 là 125, tháng 6 là 158, tháng 7 là 180, tháng 8 là 212, tháng 9 là 261, tháng 10 là 312">${[125,158,180,212,261,312].map((v,i)=>`<div><b style="height:${Math.round(v/312*100)}%" title="${v} hồ sơ"></b><small>T${i+5}</small></div>`).join("")}</div></article>
        </div>
      </section>

      <section class="proof-strip" aria-label="Trạng thái kỹ thuật">
        <div><span class="proof-icon">✓</span><strong>Fail-closed</strong><small>Thiếu dữ liệu → REVIEW/BLOCKED</small></div>
        <div><span class="proof-icon">↗</span><strong>Traceable</strong><small>Result nối tới rule, issue và gate</small></div>
        <div><span class="proof-icon">≠</span><strong>Candidate ≠ Real</strong><small>Không copy synthetic vào field real</small></div>
        <div><span class="proof-icon">∅</span><strong>Null stays null</strong><small>Không tự biến missing thành 0</small></div>
      </section>

      <section class="landing-section quick-check-section" id="cg-readiness">
        <div class="section-copy compact">
          <span class="section-eyebrow">QUICK READINESS SNAPSHOT</span>
          <h2>Hồ sơ hiện đã đủ để mở numeric release chưa?</h2>
          <p>Widget này chỉ đọc trạng thái runtime hiện tại. Nó không thay đổi dữ liệu, không đóng R-006 và không đánh giá compliance.</p>
        </div>
        <div class="readiness-card">
          <div class="readiness-row ${realCnReady ? "ready" : "missing"}">
            <span class="readiness-symbol">${realCnReady ? "✓" : "!"}</span>
            <div><strong>Real HRC CN8</strong><small>${realCnReady ? escapeHtml(state.precursor.realCn8.value) : "Chưa được khóa bằng real evidence"}</small></div>
            ${pill(realCnReady ? "READY" : "MISSING", realCnReady ? "PASS" : "MISSING")}
          </div>
          <div class="readiness-row ${seeReady ? "ready" : "missing"}">
            <span class="readiness-symbol">${seeReady ? "✓" : "!"}</span>
            <div><strong>HRC SEE path</strong><small>${seeReady ? "Working value present" : "SEE đang blank; không mặc định thành 0"}</small></div>
            ${pill(seeReady ? "READY" : "MISSING", seeReady ? "PASS" : "MISSING")}
          </div>
          <div class="readiness-row ${r006Closed ? "ready" : "missing"}">
            <span class="readiness-symbol">${r006Closed ? "✓" : "!"}</span>
            <div><strong>Risk gate R-006</strong><small>${r006Closed ? "CLOSED" : "OPEN — vẫn chặn numeric release"}</small></div>
            ${pill(r006Closed ? "CLOSED" : "OPEN", r006Closed ? "PASS" : "OPEN")}
          </div>
          <div class="readiness-result ${releaseReady ? "ready" : "blocked"}">
            <div><small>Kết luận runtime</small><strong>${releaseReady ? "READY FOR CONTROLLED RELEASE" : "CHƯA ĐỦ — GIỮ BLOCKED / MASKED"}</strong></div>
            <button class="btn ${releaseReady ? "primary" : "danger-outline"}" data-open-screen="result">Mở Release Gate</button>
          </div>
        </div>
      </section>

      <section class="landing-section product-suite-section" id="cg-suite">
        <div class="section-heading centered">
          <span class="section-eyebrow">PRODUCT ROADMAP · CONCEPT UI</span>
          <h2>Hướng mở rộng: kiểm kê, báo cáo và phân tích dữ liệu phát thải</h2>
          <p>Các card dưới đây mô tả hướng mở rộng sản phẩm, không phải module đã hoàn thiện trong RC1. Lõi đang chạy vẫn là data control, evidence trace, validation và release guardrail.</p>
        </div>
        <div class="suite-grid">
          <article class="suite-card">
            <div class="suite-preview">
              <div class="suite-mini-list">
                <span><i></i> Điện lưới <b>DATA</b></span>
                <span><i></i> Nhiên liệu <b>DATA</b></span>
                <span><i></i> Chuỗi giá trị <b>DATA</b></span>
                <strong>Kết quả phát thải <b>MASKED</b></strong>
              </div>
            </div>
            <div class="suite-body">
              <div class="suite-icon">⌘</div><span class="suite-roadmap-badge">ROADMAP</span>
              <h3>Kiểm kê</h3>
              <h4>Hệ thống kiểm kê toàn diện</h4>
              <ul>
                <li>Kiểm kê KNK cho tất cả chi nhánh, nhà máy</li>
                <li>Hệ thống nhập liệu thân thiện, dễ dùng</li>
                <li>Lưu trữ nhiều sổ phát thải, lâu dài</li>
                <li>Hệ số phát thải cập nhật liên tục</li>
              </ul>
            </div>
          </article>

          <article class="suite-card">
            <div class="suite-preview suite-preview-report">
              <div class="suite-report-card">
                <div class="suite-report-head"><span>Mẫu báo cáo KNK</span><em>ROADMAP</em></div>
                <div class="suite-report-checks">
                  <span>✓ Phạm vi Scope 1 · 2 · 3</span>
                  <span>✓ Template theo NĐ06 / ISO 14064</span>
                  <span>✓ Trường dữ liệu phục vụ review</span>
                </div>
                <div class="suite-file-chips"><b>PDF</b><b>Excel</b><b>XML</b></div>
              </div>
            </div>
            <div class="suite-body">
              <div class="suite-icon">▤</div><span class="suite-roadmap-badge">ROADMAP</span>
              <h3>Báo cáo</h3>
              <h4>Xuất báo cáo theo nhiều định dạng</h4>
              <ul>
                <li>Nghị định 06/2022/NĐ-CP</li>
                <li>Tiêu chuẩn ISO 14064-1:2018</li>
                <li>Báo cáo chuẩn quốc tế</li>
              </ul>
            </div>
          </article>

          <article class="suite-card">
            <div class="suite-preview suite-preview-ai">
              <div class="suite-line-chart">
                <div class="suite-chart-head"><span>Kịch bản phân tích</span><em>ROADMAP</em></div>
                <svg viewBox="0 0 260 90" aria-hidden="true">
                  <polyline fill="none" stroke="#0a3c33" stroke-width="3" points="8,24 72,30 132,26 190,40 250,48"></polyline>
                  <polyline fill="none" stroke="#84cc16" stroke-width="3" stroke-dasharray="8 6" points="132,26 190,36 250,48"></polyline>
                  <circle cx="8" cy="24" r="4" fill="#0a3c33"></circle>
                  <circle cx="250" cy="48" r="4" fill="#84cc16"></circle>
                </svg>
                <div class="suite-chart-scale"><span>Baseline <b>—</b></span><span>Scenario <b>—</b></span><span class="suite-trend">DEMO UI</span></div>
              </div>
            </div>
            <div class="suite-body">
              <div class="suite-icon">✦</div><span class="suite-roadmap-badge">ROADMAP</span>
              <h3>Dự báo</h3>
              <h4>Hệ thống AI tân tiến</h4>
              <ul>
                <li>Phân tích, báo cáo, dự báo hoạt động phát thải</li>
                <li>Tự động cập nhật quy định & tiêu chuẩn mới</li>
                <li>Phát hiện, cảnh báo bất thường trong dữ liệu</li>
                <li>Giải đáp mọi thắc mắc về kiểm kê KNK</li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section class="landing-section" id="cg-capabilities">
        <div class="section-heading centered">
          <span class="section-eyebrow">MỘT WORKSPACE — TRỌN LUỒNG KIỂM SOÁT DỮ LIỆU</span>
          <h2>Năm năng lực kỹ thuật cốt lõi của CarbonGraph</h2>
          <p>Không cố gắng làm mọi thứ. MVP tập trung vào đúng chuỗi giúp người duyệt biết dữ liệu nào đang có, thiếu gì và vì sao kết quả bị chặn.</p>
        </div>
        <div class="capability-grid">
          <article class="capability-card tone-green" data-open-screen="data">
            <div class="capability-number">01</div><div class="capability-icon">⌨</div>
            <h3>Input & Data Contract</h3>
            <p>Chuẩn hóa working fields theo schema, giữ null đúng nghĩa và tách synthetic khỏi real evidence.</p>
            <span class="capability-link">Mở Input Module →</span>
          </article>
          <article class="capability-card tone-blue" data-open-screen="validation">
            <div class="capability-number">02</div><div class="capability-icon">✓</div>
            <h3>Validation Engine</h3>
            <p>Map rule–field–issue; tự sinh blocker khi dữ liệu thiếu, sai scope hoặc rơi vào nhánh chưa hỗ trợ.</p>
            <span class="capability-link">Mở Validation →</span>
          </article>
          <article class="capability-card tone-mint" data-open-screen="trace">
            <div class="capability-number">03</div><div class="capability-icon">⌘</div>
            <h3>Evidence Graph</h3>
            <p>Truy vết batch, precursor, evidence, rule, issue và gate bằng node/edge có integrity check.</p>
            <span class="capability-link">Mở Trace Explorer →</span>
          </article>
          <article class="capability-card tone-amber" data-open-screen="result">
            <div class="capability-number">04</div><div class="capability-icon">⛔</div>
            <h3>Release Guardrail</h3>
            <p>Fail-closed: R-006 OPEN hoặc blocker còn tồn tại thì numeric result tiếp tục BLOCKED/MASKED.</p>
            <span class="capability-link">Mở Release Gate →</span>
          </article>
          <article class="capability-card tone-slate" data-open-screen="export">
            <div class="capability-number">05</div><div class="capability-icon">⇩</div>
            <h3>Working Export</h3>
            <p>Xuất working-only HTML/JSON với trace và trạng thái; không phát hành tCO₂e khi điều kiện chưa đủ.</p>
            <span class="capability-link">Mở Working Export →</span>
          </article>
        </div>
      </section>

      <section class="landing-section workflow-section" id="cg-workflow">
        <div class="section-heading">
          <span class="section-eyebrow">PROGRESSIVE WORKFLOW</span>
          <h2>Từ dữ liệu rời rạc đến quyết định có thể giải thích</h2>
          <p>Mỗi bước tạo ra một trạng thái có thể kiểm tra. Một bước thất bại không bị che đi bằng một con số mặc định.</p>
        </div>
        <div class="roadmap-flow">
          <div class="roadmap-step"><span>1</span><div><small>COLLECT</small><strong>Thu thập</strong><p>Sản phẩm · batch · HRC lot · source</p></div></div>
          <div class="roadmap-arrow">→</div>
          <div class="roadmap-step"><span>2</span><div><small>VALIDATE</small><strong>Kiểm tra</strong><p>Schema · scope · kỳ · field rules</p></div></div>
          <div class="roadmap-arrow">→</div>
          <div class="roadmap-step"><span>3</span><div><small>TRACE</small><strong>Truy vết</strong><p>Data → rule → issue → evidence</p></div></div>
          <div class="roadmap-arrow">→</div>
          <div class="roadmap-step"><span>4</span><div><small>GATE</small><strong>Chặn an toàn</strong><p>REVIEW / BLOCKED khi chưa đủ</p></div></div>
          <div class="roadmap-arrow">→</div>
          <div class="roadmap-step"><span>5</span><div><small>EXPORT</small><strong>Working output</strong><p>Traceable · working-only · no numeric</p></div></div>
        </div>
      </section>

      <section class="landing-section compare-section" id="cg-compare">
        <div class="section-heading centered">
          <span class="section-eyebrow">OPERATIONAL CLARITY</span>
          <h2>Từ quy trình rời rạc sang kiểm soát có trace</h2>
          <p>So sánh tập trung vào rủi ro vận hành dữ liệu, không nhằm khẳng định mọi bảng tính đều sai.</p>
        </div>
        <div class="comparison-table" role="table" aria-label="So sánh quy trình dữ liệu">
          <div class="comparison-row comparison-head" role="row">
            <div>Điểm kiểm soát</div><div>Quy trình rời rạc / spreadsheet</div><div>CarbonGraph MVP</div>
          </div>
          <div class="comparison-row" role="row">
            <div><strong>Missing numeric</strong></div><div>Có thể khó phân biệt blank và 0 nếu quy ước không chặt</div><div><b>null / MISSING</b> được giữ rõ và sinh blocker</div>
          </div>
          <div class="comparison-row" role="row">
            <div><strong>Candidate vs real</strong></div><div>Dễ nằm gần nhau trong cùng sheet</div><div><b>Tách field + source class</b>, không auto-copy</div>
          </div>
          <div class="comparison-row" role="row">
            <div><strong>Rule trace</strong></div><div>Logic có thể nằm rải ở nhiều công thức/tài liệu</div><div><b>Rule → issue → result</b> có relation rõ</div>
          </div>
          <div class="comparison-row" role="row">
            <div><strong>Release control</strong></div><div>Phụ thuộc checklist hoặc thao tác người dùng</div><div><b>Fail-closed gate</b> BLOCKED/MASKED theo state</div>
          </div>
          <div class="comparison-row" role="row">
            <div><strong>Audit trail</strong></div><div>Cần ghép nhiều file để lần nguồn</div><div><b>Evidence Graph</b> kiểm node, edge và orphan</div>
          </div>
        </div>
      </section>

      <section class="landing-section runtime-section">
        <div class="runtime-layout">
          <div class="runtime-copy">
            <span class="section-eyebrow">CURRENT RUNTIME</span>
            <h2>Minh bạch cả những thứ hệ thống chưa biết.</h2>
            <p>CarbonGraph không dùng trạng thái “xanh” để che những dependency còn mở. Real CN8, SEE và R-006 vẫn được hiển thị rõ như một phần của sản phẩm.</p>
            <button class="btn primary" data-open-screen="evidence">Xem Evidence Queue</button>
          </div>
          <div class="runtime-grid">
            <div class="runtime-item"><span>Dataset</span><strong class="code">${escapeHtml(state.meta.datasetId)}</strong><small>${escapeHtml(state.meta.dataOrigin)}</small></div>
            <div class="runtime-item"><span>Scenario</span><strong class="code">${escapeHtml(state.meta.scenarioId)}</strong><small>Local demo scope</small></div>
            <div class="runtime-item"><span>Working batch</span><strong class="code">${valueOrDash(state.batch.batchId)}</strong><small>revision ${state.runtime.revision}</small></div>
            <div class="runtime-item"><span>Persistence</span><strong>${persistenceMeta.restored ? "RESTORED" : "BASELINE"}</strong><small>${valueOrDash(persistenceMeta.savedAt)}</small></div>
            <div class="runtime-item"><span>Real evidence</span><strong>${totalEvidence - missingEvidence}/${totalEvidence}</strong><small>non-missing queue items</small></div>
            <div class="runtime-item"><span>Release</span><strong>${escapeHtml(state.release.numericReleaseStatus)}</strong><small>${escapeHtml(state.release.resultVisibility)}</small></div>
          </div>
        </div>
      </section>

      <section class="landing-section news-section" id="cg-news">
        <div class="news-heading-row">
          <div class="section-heading">
            <span class="section-eyebrow">TIN TỨC & KIẾN THỨC</span>
            <h2>CBAM, thuế carbon và những chuyển động của ngành thép</h2>
            <p>Các nguồn dưới đây giúp theo dõi thay đổi chính sách, áp lực chi phí carbon và những thách thức thương mại mà doanh nghiệp thép đang đối mặt tại Việt Nam và quốc tế.</p>
          </div>
          <a class="news-view-all" href="https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-communication-and-news_en" target="_blank" rel="noopener noreferrer">Xem tin CBAM chính thức <span aria-hidden="true">→</span></a>
        </div>

        <div class="news-grid">
          <article class="news-card">
            <a class="news-image-link" href="https://moit.gov.vn/bao-ve-moi-truong/cbam-doanh-nghiep-viet-can-chuan-bi-gi-truoc-yeu-cau-moi-cua-thi-truong-eu-.html" target="_blank" rel="noopener noreferrer" aria-label="Đọc bài Bộ Công Thương về doanh nghiệp Việt chuẩn bị cho CBAM">
              <img src="assets/news/vn-cbam.svg" alt="Minh họa doanh nghiệp Việt, dữ liệu carbon và CBAM" loading="lazy" />
              <span class="news-region vietnam">VIỆT NAM</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>BỘ CÔNG THƯƠNG</span><time datetime="2026-08-05">05/08/2026</time></div>
              <h3>CBAM: Doanh nghiệp Việt cần chuẩn bị gì trước yêu cầu mới của thị trường EU?</h3>
              <p>Bài viết nhấn mạnh nhu cầu hoàn thiện hệ thống đo lường, báo cáo và kiểm chứng phát thải khi CBAM bước vào giai đoạn chính thức.</p>
              <a class="news-read-more" href="https://moit.gov.vn/bao-ve-moi-truong/cbam-doanh-nghiep-viet-can-chuan-bi-gi-truoc-yeu-cau-moi-cua-thi-truong-eu-.html" target="_blank" rel="noopener noreferrer">Đọc tiếp <span aria-hidden="true">→</span></a>
            </div>
          </article>

          <article class="news-card">
            <a class="news-image-link" href="https://vnexpress.net/doanh-nghiep-nguy-co-mat-100-usd-moi-tan-thep-sang-eu-vi-phat-thai-5113827.html" target="_blank" rel="noopener noreferrer" aria-label="Đọc bài VnExpress về áp lực chi phí phát thải với thép xuất khẩu EU">
              <img src="assets/news/vn-steel-cost.svg" alt="Minh họa thép, CBAM và áp lực chi phí carbon" loading="lazy" />
              <span class="news-region vietnam">VIỆT NAM</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>VNEXPRESS</span><time datetime="2026-08-27">27/08/2026</time></div>
              <h3>Doanh nghiệp nguy cơ mất 100 USD mỗi tấn thép sang EU vì phát thải</h3>
              <p>Một góc nhìn thị trường về rủi ro chi phí carbon đối với hàng phát thải cao, đặc biệt là thép xuất khẩu vào EU.</p>
              <a class="news-read-more" href="https://vnexpress.net/doanh-nghiep-nguy-co-mat-100-usd-moi-tan-thep-sang-eu-vi-phat-thai-5113827.html" target="_blank" rel="noopener noreferrer">Đọc tiếp <span aria-hidden="true">→</span></a>
            </div>
          </article>

          <article class="news-card">
            <a class="news-image-link" href="https://vneconomy.vn/san-xuat-va-tieu-thu-thep-tang-truong-hai-con-so-xuat-khau-doi-mat-voi-rao-can-thuong-mai.htm" target="_blank" rel="noopener noreferrer" aria-label="Đọc bài VnEconomy về thị trường thép và rào cản xuất khẩu">
              <img src="assets/news/vn-steel-trade.svg" alt="Minh họa thép và rào cản thương mại xuất khẩu" loading="lazy" />
              <span class="news-region vietnam">VIỆT NAM</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>VNECONOMY</span><time datetime="2026-08-01">2026</time></div>
              <h3>Thị trường thép 2026: Sản lượng tăng, xuất khẩu đối mặt nhiều rào cản</h3>
              <p>Ngành thép Việt Nam tăng trưởng sản xuất nhưng tiếp tục chịu sức ép từ hạn ngạch, phòng vệ thương mại và các yêu cầu mới tại EU.</p>
              <a class="news-read-more" href="https://vneconomy.vn/san-xuat-va-tieu-thu-thep-tang-truong-hai-con-so-xuat-khau-doi-mat-voi-rao-can-thuong-mai.htm" target="_blank" rel="noopener noreferrer">Đọc tiếp <span aria-hidden="true">→</span></a>
            </div>
          </article>

          <article class="news-card">
            <a class="news-image-link" href="https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-definitive-regime_en" target="_blank" rel="noopener noreferrer" aria-label="Đọc thông tin chính thức của Ủy ban châu Âu về CBAM definitive regime">
              <img src="assets/news/eu-cbam.svg" alt="Minh họa CBAM definitive regime và dữ liệu phát thải" loading="lazy" />
              <span class="news-region international">QUỐC TẾ</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>EUROPEAN COMMISSION</span><time datetime="2026-01-01">2026</time></div>
              <h3>CBAM definitive regime: nghĩa vụ chính thức áp dụng từ năm 2026</h3>
              <p>Nguồn chính thức về cơ chế CBAM từ 2026, bao gồm khai báo phát thải hàm chứa và nghĩa vụ liên quan tới chứng chỉ CBAM.</p>
              <a class="news-read-more" href="https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-definitive-regime_en" target="_blank" rel="noopener noreferrer">Đọc tiếp <span aria-hidden="true">→</span></a>
            </div>
          </article>

          <article class="news-card">
            <a class="news-image-link" href="https://taxation-customs.ec.europa.eu/news/commission-welcomes-council-agreement-strengthening-cbam-2026-06-12_en" target="_blank" rel="noopener noreferrer" aria-label="Đọc bài European Commission về tăng cường CBAM">
              <img src="assets/news/eu-policy.svg" alt="Minh họa chính sách CBAM và bảo vệ công nghiệp xanh" loading="lazy" />
              <span class="news-region international">QUỐC TẾ</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>EUROPEAN COMMISSION</span><time datetime="2026-06-12">12/06/2026</time></div>
              <h3>EU tiếp tục tăng cường CBAM và mở rộng kiểm soát rò rỉ carbon</h3>
              <p>Ủy ban châu Âu cho biết các bước tăng cường CBAM nhằm củng cố quá trình chuyển đổi công nghiệp sạch và hạn chế carbon leakage.</p>
              <a class="news-read-more" href="https://taxation-customs.ec.europa.eu/news/commission-welcomes-council-agreement-strengthening-cbam-2026-06-12_en" target="_blank" rel="noopener noreferrer">Đọc tiếp <span aria-hidden="true">→</span></a>
            </div>
          </article>

          <article class="news-card">
            <a class="news-image-link" href="https://www.reuters.com/business/outokumpu-cfo-says-costs-eat-into-gains-eu-steel-measures-2026-07-30/" target="_blank" rel="noopener noreferrer" aria-label="Đọc bài Reuters về áp lực chi phí của ngành thép châu Âu">
              <img src="assets/news/global-steel.svg" alt="Minh họa ngành thép quốc tế và áp lực chi phí" loading="lazy" />
              <span class="news-region international">QUỐC TẾ</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>REUTERS</span><time datetime="2026-07-30">30/07/2026</time></div>
              <h3>Chi phí đầu vào tiếp tục gây sức ép lên ngành thép châu Âu</h3>
              <p>Reuters ghi nhận chi phí phế liệu, vận tải và nhiên liệu đang bào mòn lợi ích từ các biện pháp hỗ trợ ngành thép tại EU.</p>
              <a class="news-read-more" href="https://www.reuters.com/business/outokumpu-cfo-says-costs-eat-into-gains-eu-steel-measures-2026-07-30/" target="_blank" rel="noopener noreferrer">Đọc tiếp <span aria-hidden="true">→</span></a>
            </div>
          </article>
        </div>
      </section>

      <section class="landing-section faq-section" id="cg-faq">
        <div class="section-heading centered">
          <span class="section-eyebrow">FAQ</span>
          <h2>Những câu hỏi cần hiểu đúng trước khi demo</h2>
        </div>
        <div class="faq-list">
          <details open><summary>CarbonGraph có phải công cụ khai báo CBAM chính thức không?</summary><p>Không. Bản hiện tại là local MVP dùng dữ liệu giả lập để minh họa chuẩn hóa, validation, evidence trace và release guardrail.</p></details>
          <details><summary>Tại sao không hiển thị một con số phát thải demo?</summary><p>R-006 còn OPEN và HRC SEE chưa được khóa. Thiết kế fail-closed cố ý giữ numeric result BLOCKED/MASKED thay vì dùng factor giả để tạo con số đẹp.</p></details>
          <details><summary>Candidate CN8 72083800 có phải CN thật của precursor không?</summary><p>Không. Đây là synthetic candidate của fixture hiện tại. Real CN8 là field riêng và vẫn ở trạng thái REVIEW/MISSING cho tới khi có evidence phù hợp.</p></details>
          <details><summary>75/75 automated assertions PASS chứng minh điều gì?</summary><p>Nó chứng minh hành vi phần mềm trong phạm vi test hiện tại, không chứng minh độ chính xác phát thải, verification hay compliance.</p></details>
        </div>
      </section>

      <section class="final-cta">
        <div>
          <span class="section-eyebrow light">LOCAL MVP · RC1_CANDIDATE</span>
          <h2>Đi từ dữ liệu đến bằng chứng — rồi mới đến kết quả.</h2>
          <p>Mở workspace để thử Input, Validation, Evidence Graph, Release Gate và Working Export trên cùng một state local.</p>
        </div>
        <div class="final-cta-actions">
          <button class="btn hero-primary" data-open-screen="data">${icon("database", 17)} Bắt đầu với Input Module →</button>
          <button class="btn hero-secondary" data-open-screen="acceptance">Mở Test Center</button>
        </div>
      </section>
    `;

    document.querySelectorAll("[data-open-screen]").forEach((element) => {
      element.addEventListener("click", () => render(element.dataset.openScreen));
    });
  }

  function inputValue(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function surfaceOptions(currentValue) {
    const options = [
      "MILL_FINISH|NOT_PICKLED|NOT_CLAD_PLATED_COATED|NO_RELIEF",
      "PICKLED|NOT_CLAD_PLATED_COATED|NO_RELIEF",
      "MILL_FINISH|NOT_PICKLED|COATED|NO_RELIEF",
      "OTHER_REVIEW"
    ];
    return options.map((option) => `<option value="${escapeHtml(option)}" ${option === currentValue ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
  }

  function routeOptions(currentValue) {
    return ["BF_BOF", "EAF", "OTHER_REVIEW"]
      .map((option) => `<option value="${option}" ${option === currentValue ? "selected" : ""}>${option}</option>`)
      .join("");
  }

  function renderHistory(history) {
    if (!history || history.length === 0) return '<div class="change-item muted">Chưa có thay đổi trong phiên.</div>';
    return history.map((entry) => `
      <div class="change-item">
        <strong>revision ${entry.revision}</strong> ${pill(entry.reason, "INFO")}
        <div style="margin-top:7px">
          ${entry.changes.length ? entry.changes.map((change) => `
            <div><span class="code">${escapeHtml(change.field)}</span>: <span class="muted">${valueOrDash(change.oldValue)}</span> → <strong>${valueOrDash(change.newValue)}</strong></div>
          `).join("") : '<span class="muted">Reset/recompute; không có field diff.</span>'}
        </div>
      </div>
    `).join("");
  }

  function renderInputModule() {
    const state = store.getState();
    const blockerCount = state.validationSummary?.BLOCKER ?? 0;
    const persistenceLabel = persistenceMeta.restored ? "RESTORED" : "BASELINE";
    setHeader("Input Module", "Nhập working data theo từng nhóm; Apply sẽ validate, rebuild graph và cập nhật release state ngay trên localhost.");

    $("#content").innerHTML = `
      <div class="workspace-screen input-screen">
        <div class="screen-summary-grid">
          <div class="screen-summary-card"><span>Dataset</span><strong class="code">${escapeHtml(state.meta.datasetId)}</strong><small>${escapeHtml(state.meta.dataOrigin)}</small></div>
          <div class="screen-summary-card"><span>Working revision</span><strong>${state.runtime.revision}</strong><small>${escapeHtml(persistenceLabel)} local state</small></div>
          <div class="screen-summary-card"><span>Validation blockers</span><strong>${blockerCount}</strong><small>${blockerCount ? "Cần xử lý trước release" : "Không có blocker"}</small></div>
          <div class="screen-summary-card"><span>Release</span><strong>${escapeHtml(state.release.numericReleaseStatus)}</strong><small>${escapeHtml(state.release.resultVisibility)}</small></div>
        </div>

        <div class="input-workspace-layout">
          <form id="input-form" class="workspace-panel input-builder" novalidate>
            <div class="panel-heading">
              <div><span class="panel-eyebrow">WORKING DATA BUILDER</span><h2>Tạo bộ dữ liệu làm việc</h2><p>Mỗi nhóm dữ liệu tương ứng một lớp kiểm soát. Trường real evidence vẫn bị khóa khỏi synthetic input.</p></div>
              <span class="panel-status">Local autosave</span>
            </div>

            <div class="input-stepper" aria-hidden="true">
              <span class="active"><b>1</b> Định danh</span><i></i><span class="active"><b>2</b> HRC</span><i></i><span class="active"><b>3</b> Giả định</span><i></i><span><b>4</b> Derived state</span>
            </div>

            <section class="form-section">
              <div class="form-section-head"><span class="form-section-index">01</span><div><h3>Định danh & phạm vi</h3><p>Khóa dataset synthetic và nhận diện batch/HRC lot đang thao tác.</p></div></div>
              <div class="form-grid">
                <div class="field full locked-field"><label>Data origin <span class="field-tag">LOCKED</span></label><input value="${escapeHtml(state.meta.dataOrigin)}" readonly disabled /><div class="field-help">Không thể chuyển synthetic thành real evidence bằng giao diện này.</div></div>
                <div class="field"><label for="batch-id">Batch ID</label><input id="batch-id" value="${escapeHtml(inputValue(state.batch.batchId))}" /><div class="field-help">Định danh lô thành phẩm trong working trace.</div></div>
                <div class="field"><label for="hrc-lot-id">HRC lot ID</label><input id="hrc-lot-id" value="${escapeHtml(inputValue(state.batch.hrcLotId))}" /><div class="field-help">Liên kết batch với lô tiền chất HRC.</div></div>
              </div>
            </section>

            <section class="form-section">
              <div class="form-section-head"><span class="form-section-index">02</span><div><h3>Đặc tính tiền chất HRC</h3><p>Thông số hình học và bề mặt dùng cho candidate classification trong phạm vi MVP.</p></div></div>
              <div class="form-grid">
                <div class="field"><label for="width-mm">Width <span class="unit-chip">mm</span></label><input id="width-mm" type="number" step="0.1" value="${escapeHtml(inputValue(state.precursor.widthMm))}" /><div class="field-help">Blank được giữ là null/MISSING, không đổi thành 0.</div></div>
                <div class="field"><label for="thickness-mm">Thickness <span class="unit-chip">mm</span></label><input id="thickness-mm" type="number" step="0.1" value="${escapeHtml(inputValue(state.precursor.thicknessMm))}" /></div>
                <div class="field full"><label for="surface-state">Surface state</label><select id="surface-state">${surfaceOptions(state.precursor.surfaceState)}</select><div class="field-help">Nhánh ngoài phạm vi classifier sẽ giữ REVIEW thay vì đoán CN8.</div></div>
              </div>
            </section>

            <section class="form-section">
              <div class="form-section-head"><span class="form-section-index">03</span><div><h3>Working assumptions</h3><p>Thông tin phục vụ demo kỹ thuật; không thay thế chứng từ nguồn gốc/route thực tế.</p></div></div>
              <div class="form-grid">
                <div class="field"><label for="origin">Origin <span class="unit-chip">ISO2</span></label><input id="origin" maxlength="2" value="${escapeHtml(inputValue(state.precursor.origin))}" /></div>
                <div class="field"><label for="route">Production route</label><select id="route">${routeOptions(state.precursor.route)}</select></div>
              </div>
            </section>

            <div class="input-action-bar">
              <div><strong>Sẵn sàng chạy pipeline</strong><small>Apply → Validation → Graph → Release state</small></div>
              <div class="actions compact-actions">
                <button type="button" id="reset-demo" class="btn danger-outline">${icon("refresh", 16)} Reset baseline</button>
                <button type="submit" class="btn primary">${icon("play", 16)} Apply working data <span>→</span></button>
              </div>
            </div>
          </form>

          <aside class="workspace-panel derived-sidebar">
            <div class="panel-heading compact-heading"><div><span class="panel-eyebrow">DERIVED STATE</span><h2>Kết quả kiểm soát</h2></div></div>
            <div class="derived-hero ${blockerCount ? "is-blocked" : "is-ready"}">
              <span>Candidate CN8</span>
              <strong class="code">${valueOrDash(state.precursor.candidateCn8.value)}</strong>
              ${pill(state.precursor.candidateCn8.label)}
            </div>
            <div class="derived-list">
              <div><span>Validation</span><strong>${blockerCount} blocker(s)</strong></div>
              <div><span>Graph integrity</span><strong>${pill(state.graphSummary?.integrityStatus || "REVIEW")}</strong></div>
              <div><span>Numeric release</span><strong>${pill(state.release.numericReleaseStatus)}</strong></div>
              <div><span>Visibility</span><strong>${pill(state.release.resultVisibility)}</strong></div>
            </div>
            <div class="evidence-separation-card">
              <span class="panel-eyebrow">REAL EVIDENCE BOUNDARY</span>
              <div><span>Real HRC CN8</span><strong>${valueOrDash(state.precursor.realCn8.value)}</strong>${pill(state.precursor.realCn8.status)}</div>
              <div><span>HRC SEE</span><strong>${valueOrDash(state.precursor.seeDirect.value)}</strong>${pill(state.precursor.seeDirect.status)}</div>
              <p>Candidate classification không được tự ghi vào field real; SEE không được suy ra từ dữ liệu demo.</p>
            </div>
          </aside>
        </div>

        <section class="workspace-panel change-timeline-panel">
          <div class="panel-heading compact-heading"><div><span class="panel-eyebrow">AUDIT TRAIL</span><h2>Working change log</h2></div><span class="panel-status">revision ${state.runtime.revision}</span></div>
          <div class="change-list timeline-list">${renderHistory(state.runtime.history)}</div>
        </section>
      </div>
    `;

    $("#input-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const submitButton = event.submitter || $("#input-form button[type=submit]");
      setButtonBusy(submitButton, true, "Đang chạy pipeline…");
      try {
        store.applyInput({
          batchId: $("#batch-id").value,
          hrcLotId: $("#hrc-lot-id").value,
          widthMm: $("#width-mm").value,
          thicknessMm: $("#thickness-mm").value,
          surfaceState: $("#surface-state").value,
          origin: $("#origin").value,
          route: $("#route").value
        });
        showToast("Working data đã được lưu và pipeline derived-state đã chạy lại.", "success", "Input updated");
      } catch (error) {
        setButtonBusy(submitButton, false);
        showToast(`Không thể Apply: ${error.message}`, "danger", "Input rejected", 5200);
      }
    });

    $("#reset-demo").addEventListener("click", () => {
      window.CGPersistence.clear(window.localStorage);
      persistenceMeta = { restored: false, savedAt: null, lastSaveOk: true };
      store.reset();
      showToast("Working state đã trở về synthetic baseline.", "warning", "Baseline restored");
    });
  }

  function renderEvidence() {
    const state = store.getState();
    const total = state.evidence.length;
    const missing = state.evidence.filter((item) => item.realStatus === "MISSING").length;
    const ready = total - missing;
    const demoAvailable = state.evidence.filter((item) => item.demo).length;
    const readiness = total ? Math.round((ready / total) * 100) : 0;
    setHeader("Evidence Queue", "Theo dõi khoảng trống bằng chứng HRC và giữ synthetic substitute tách biệt khỏi REAL_REQUIRED evidence.");

    $("#content").innerHTML = `
      <div class="workspace-screen evidence-screen">
        <div class="screen-summary-grid">
          <div class="screen-summary-card"><span>Required evidence</span><strong>${total}</strong><small>HRC evidence items</small></div>
          <div class="screen-summary-card danger-accent"><span>Missing real evidence</span><strong>${missing}</strong><small>Đang giữ R-006 OPEN</small></div>
          <div class="screen-summary-card"><span>Demo substitutes</span><strong>${demoAvailable}</strong><small>Chỉ phục vụ synthetic flow</small></div>
          <div class="screen-summary-card"><span>Real readiness</span><strong>${readiness}%</strong><small>Không đồng nghĩa compliance</small></div>
        </div>

        <div class="workspace-panel evidence-overview-panel">
          <div class="panel-heading">
            <div><span class="panel-eyebrow">EVIDENCE READINESS</span><h2>HRC evidence control board</h2><p>Mỗi yêu cầu được theo dõi riêng; synthetic evidence không được dùng để chuyển realStatus sang ACCEPTED.</p></div>
            ${pill(`R-006 ${state.meta.r006Status}`)}
          </div>
          <div class="readiness-meter"><div class="readiness-meter-bar" style="width:${readiness}%"></div></div>
          <div class="readiness-meter-labels"><span>${ready}/${total} real evidence item(s) non-missing</span><strong>${missing} gap(s) cần xử lý</strong></div>
        </div>

        <div class="evidence-board">
          ${state.evidence.map((item, index) => `
            <article class="evidence-work-card ${item.realStatus === "MISSING" ? "is-missing" : "is-ready"}">
              <div class="evidence-work-index">${String(index + 1).padStart(2, "0")}</div>
              <div class="evidence-work-main">
                <div class="evidence-work-title"><strong class="code">${escapeHtml(item.id)}</strong>${pill(item.realStatus)}</div>
                <h3>${escapeHtml(item.need)}</h3>
                <div class="evidence-work-meta">
                  <span><b>Required class</b> REAL_EVIDENCE</span>
                  <span><b>Reviewer</b> ${valueOrDash(item.reviewer)}</span>
                  <span><b>Reviewed at</b> ${valueOrDash(item.reviewedAt)}</span>
                </div>
              </div>
              <div class="evidence-demo-slot">
                <span>Demo substitute</span>
                <strong class="code">${valueOrDash(item.demo)}</strong>
                <small>${item.demo ? "SYNTHETIC_ONLY · không đóng real gap" : "Không có demo substitute"}</small>
              </div>
            </article>
          `).join("")}
        </div>

        <div class="notice danger evidence-rule-note"><strong>VR-017:</strong> Synthetic evidence không thể thỏa mãn yêu cầu REAL_REQUIRED. Việc thêm chứng từ thật phải đi qua quy trình evidence review riêng, không qua Input Module.</div>
      </div>
    `;
  }

  function renderValidation() {
    const state = store.getState();
    const total = state.validationSummary?.total ?? state.validation.length;
    const blocker = state.validationSummary?.BLOCKER ?? 0;
    const error = state.validationSummary?.ERROR ?? 0;
    const warning = state.validationSummary?.WARNING ?? 0;
    const resolved = state.validation.filter((item) => item.status === "RESOLVED").length;
    setHeader("Validation", "Issue management dashboard cho C3; mỗi Apply sẽ chạy lại rule engine và cập nhật candidate classification.");

    $("#content").innerHTML = `
      <div class="workspace-screen validation-screen">
        <div class="screen-summary-grid validation-summary-grid">
          <div class="screen-summary-card"><span>Total issues</span><strong>${total}</strong><small>Dynamic runtime issues</small></div>
          <div class="screen-summary-card danger-accent"><span>Blockers</span><strong>${blocker}</strong><small>Chặn release path</small></div>
          <div class="screen-summary-card warning-accent"><span>Errors / warnings</span><strong>${error + warning}</strong><small>${error} error · ${warning} warning</small></div>
          <div class="screen-summary-card success-accent"><span>Resolved</span><strong>${resolved}</strong><small>Technical control passed</small></div>
        </div>

        <div class="validation-control-layout">
          <section class="workspace-panel validation-board-panel">
            <div class="panel-heading">
              <div><span class="panel-eyebrow">ISSUE MANAGEMENT</span><h2>Validation Queue</h2><p>Lọc theo severity để tìm nhanh field/rule đang chặn working flow.</p></div>
              <button id="run-validation" class="btn primary">${icon("refresh", 16)} Run pipeline again</button>
            </div>
            <div class="validation-toolbar">
              ${["ALL", "BLOCKER", "ERROR", "WARNING", "INFO"].map((level) => `<button type="button" class="filter-chip ${level === "ALL" ? "active" : ""}" data-validation-filter="${level}">${level}</button>`).join("")}
              <span class="validation-toolbar-count">${total} issue(s)</span>
            </div>
            <div class="issue-list" id="validation-issue-list">
              ${state.validation.map((item) => `
                <article class="issue-card severity-${escapeHtml(item.severity).toLowerCase()}" data-issue-severity="${escapeHtml(item.severity)}">
                  <div class="issue-status-rail"></div>
                  <div class="issue-main">
                    <div class="issue-topline"><span class="code">${escapeHtml(item.issueId)}</span>${pill(item.severity)}${pill(item.status)}</div>
                    <h3>${escapeHtml(item.message)}</h3>
                    <div class="issue-meta"><span><b>Rule</b> <code>${escapeHtml(item.rule)}</code></span><span><b>Field</b> <code>${escapeHtml(item.field || "—")}</code></span></div>
                  </div>
                </article>
              `).join("") || emptyState("Không có validation issue", "Working state hiện không sinh issue nào.", "check")}
              <div id="validation-filter-empty" hidden>${emptyState("Không có issue phù hợp bộ lọc", "Chọn ALL hoặc một severity khác để tiếp tục.", "search")}</div>
            </div>
          </section>

          <aside class="workspace-panel classification-panel">
            <div class="panel-heading compact-heading"><div><span class="panel-eyebrow">CLASSIFICATION STATE</span><h2>Candidate CN8</h2></div></div>
            <div class="classification-hero"><strong class="code">${valueOrDash(state.precursor.candidateCn8.value)}</strong>${pill(state.precursor.candidateCn8.label)}</div>
            <div class="derived-list">
              <div><span>Reason</span><strong>${escapeHtml(state.precursor.candidateCn8.reason || "—")}</strong></div>
              <div><span>Source class</span><strong>${escapeHtml(state.precursor.candidateCn8.sourceClass)}</strong></div>
              <div><span>Real CN8</span><strong>${valueOrDash(state.precursor.realCn8.value)} ${pill(state.precursor.realCn8.status)}</strong></div>
              <div><span>Numeric release</span><strong>${pill(state.release.numericReleaseStatus)}</strong></div>
            </div>
            <div class="notice warning compact-notice"><strong>Candidate ≠ Real:</strong> classifier chỉ hỗ trợ nhánh đã unit-test; nhánh ngoài phạm vi giữ REVIEW.</div>
          </aside>
        </div>
      </div>
    `;

    $("#run-validation").addEventListener("click", () => {
      store.validate();
      showToast("Validation, graph và release state đã được tính lại.", "success", "Pipeline refreshed");
    });
    document.querySelectorAll("[data-validation-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        const level = button.dataset.validationFilter;
        document.querySelectorAll("[data-validation-filter]").forEach((item) => item.classList.toggle("active", item === button));
        const issues = [...document.querySelectorAll("[data-issue-severity]")];
        issues.forEach((item) => {
          item.hidden = level !== "ALL" && item.dataset.issueSeverity !== level;
        });
        const filterEmpty = document.getElementById("validation-filter-empty");
        if (filterEmpty) filterEmpty.hidden = issues.some((item) => !item.hidden);
      });
    });
  }

  function renderTrace() {
    const state = store.getState();
    const groups = [
      ["Scope", ["DATASET", "FACILITY", "PRODUCT"]],
      ["Material flow", ["BATCH", "PRECURSOR_LOT", "PRECURSOR"]],
      ["Evidence & rules", ["EVIDENCE", "VALIDATION_ISSUE", "RULE", "RISK"]],
      ["Result trace", ["TRACE", "RESULT"]]
    ];
    const renderGraphGroup = ([label, types]) => {
      const nodes = state.graph.nodes.filter((node) => types.includes(node.type));
      return `<div class="graph-lane"><div class="graph-lane-title">${escapeHtml(label)}</div><div class="graph-lane-nodes">${nodes.map((node) => `<button type="button" class="graph-node-card type-${escapeHtml(node.type).toLowerCase()}" data-graph-node="${escapeHtml(node.id)}"><span>${escapeHtml(node.type)}</span><strong class="code">${escapeHtml(node.id)}</strong>${pill(node.status)}<small>Click để inspect</small></button>`).join("") || emptyState("No node", "Lane này chưa có entity tương ứng trong working graph.", "network")}</div></div>`;
    };
    setHeader("Trace Explorer", "Evidence Graph workspace: xem node, relation, integrity và đường trace từ batch tới result/gate.");

    $("#content").innerHTML = `
      <div class="workspace-screen trace-screen">
        <div class="screen-summary-grid">
          <div class="screen-summary-card success-accent"><span>Graph integrity</span><strong>${escapeHtml(state.graphSummary.integrityStatus)}</strong><small>${state.graphSummary.orphanCount} orphan(s)</small></div>
          <div class="screen-summary-card"><span>Nodes</span><strong>${state.graphSummary.nodeCount}</strong><small>Dynamic entities</small></div>
          <div class="screen-summary-card"><span>Edges</span><strong>${state.graphSummary.edgeCount}</strong><small>Trace relations</small></div>
          <div class="screen-summary-card"><span>Trace ID</span><strong class="code compact-code">${escapeHtml(state.release.traceId)}</strong><small>Working trace</small></div>
        </div>

        ${state.graphSummary.missingCoreRelations.length ? `<div class="notice warning"><strong>Missing core relations:</strong> ${escapeHtml(state.graphSummary.missingCoreRelations.join(", "))}</div>` : ""}

        <section class="workspace-panel graph-canvas-panel">
          <div class="panel-heading"><div><span class="panel-eyebrow">DYNAMIC EVIDENCE GRAPH</span><h2>Trace map</h2><p>Node được build từ working state; validation issues cũng trở thành một phần của evidence graph.</p></div><span class="panel-status">${state.graphSummary.integrityStatus}</span></div>
          <div class="graph-canvas">
            ${groups.map(renderGraphGroup).join('<div class="graph-lane-arrow">→</div>')}
          </div>
          <div id="graph-node-inspector" class="graph-node-inspector">
            <span class="inspector-icon">${icon("network", 20)}</span>
            <div><strong>Node inspector</strong><p>Chọn một node trên Trace map để xem type, status và các relation kết nối.</p></div>
          </div>
        </section>

        <section class="workspace-panel trace-relations-panel">
          <details open>
            <summary><span>Relation registry</span><strong>${state.graph.edges.length} edge(s)</strong></summary>
            <div class="table-shell">
              <table><thead><tr><th>Edge</th><th>From</th><th>Relation</th><th>To</th><th>Status</th></tr></thead><tbody>
                ${state.graph.edges.map((item) => `<tr><td class="code">${escapeHtml(item.id)}</td><td class="code">${escapeHtml(item.from)}</td><td><span class="relation-chip">${escapeHtml(item.relation)}</span></td><td class="code">${escapeHtml(item.to)}</td><td>${pill(item.status)}</td></tr>`).join("")}
              </tbody></table>
            </div>
          </details>
        </section>
      </div>
    `;

    document.querySelectorAll("[data-graph-node]").forEach((button) => {
      button.addEventListener("click", () => {
        const nodeId = button.dataset.graphNode;
        const node = state.graph.nodes.find((item) => item.id === nodeId);
        if (!node) return;
        document.querySelectorAll("[data-graph-node]").forEach((item) => item.classList.toggle("selected", item === button));
        const connected = state.graph.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId);
        const inspector = document.getElementById("graph-node-inspector");
        if (!inspector) return;
        inspector.innerHTML = `<span class="inspector-icon">${icon("network", 20)}</span><div class="inspector-copy"><div class="inspector-title"><strong class="code">${escapeHtml(node.id)}</strong>${pill(node.status)}</div><p>${escapeHtml(node.type)} · ${connected.length} connected relation(s)</p><div class="inspector-relations">${connected.map((edge) => `<span><code>${escapeHtml(edge.relation)}</code> ${escapeHtml(edge.from === nodeId ? "→ " + edge.to : edge.from + " →")}</span>`).join("") || '<span>No connected edge</span>'}</div></div>`;
      });
    });
  }

  function renderResult() {
    const state = store.getState();
    const releaseReasons = state.release.reasons || [];
    const checks = [
      ["Data origin", state.meta.dataOrigin === "SYNTHETIC_DEMO" ? "BLOCKED" : "PASS", `Current = ${state.meta.dataOrigin}`],
      ["R-006", state.meta.r006Status === "CLOSED" ? "PASS" : "BLOCKED", `Current = ${state.meta.r006Status}`],
      ["Validation blockers", (state.validationSummary?.BLOCKER ?? 0) === 0 ? "PASS" : "BLOCKED", `${state.validationSummary?.BLOCKER ?? 0} blocker(s)`],
      ["Graph integrity", state.graphSummary?.integrityStatus === "PASS" ? "PASS" : "REVIEW", `Current = ${state.graphSummary?.integrityStatus || "REVIEW"}`]
    ];
    const passCount = checks.filter((item) => item[1] === "PASS").length;
    setHeader("Release Gate", "Readiness/gate dashboard cho C6; giải thích rõ điều kiện nào đang giữ numeric result ở BLOCKED/MASKED.");

    $("#content").innerHTML = `
      <div class="workspace-screen release-screen">
        <section class="release-hero ${state.release.numericReleaseStatus === "BLOCKED" ? "blocked" : "ready"}">
          <div class="release-hero-copy"><span class="panel-eyebrow">WORKING RELEASE DECISION</span><h2>${state.release.numericReleaseStatus === "BLOCKED" ? "Chưa đủ điều kiện phát hành kết quả số" : "Ready for controlled review"}</h2><p>Gate state được derive từ data origin, R-006, validation và graph integrity. C6 không tính phát thải.</p></div>
          <div class="release-state-stack"><span>Numeric release</span><strong>${escapeHtml(state.release.numericReleaseStatus)}</strong><span>Visibility</span><strong>${escapeHtml(state.release.resultVisibility)}</strong></div>
        </section>

        <div class="release-layout">
          <section class="workspace-panel gate-checklist-panel">
            <div class="panel-heading"><div><span class="panel-eyebrow">READINESS CHECKLIST</span><h2>${passCount}/${checks.length} control(s) pass</h2></div><span class="panel-status">${state.release.resultStatus}</span></div>
            <div class="gate-check-list">
              ${checks.map(([name, status, detail]) => `<div class="gate-check-row ${status.toLowerCase()}"><span class="gate-check-icon">${status === "PASS" ? "✓" : status === "REVIEW" ? "!" : "×"}</span><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div>${pill(status)}</div>`).join("")}
            </div>
          </section>

          <aside class="workspace-panel masked-result-panel">
            <span class="panel-eyebrow">EMBEDDED EMISSIONS</span>
            <div class="masked-result-visual"><span>Result value</span><strong>${state.release.resultVisibility === "MASKED" ? "MASKED" : "NOT CALCULATED"}</strong><small>Không có tCO₂e/SEE numeric output trong C6.</small></div>
            <div class="derived-list"><div><span>Result ID</span><strong class="code">${escapeHtml(state.release.resultId)}</strong></div><div><span>Trace ID</span><strong class="code">${escapeHtml(state.release.traceId)}</strong></div><div><span>Result status</span><strong>${pill(state.release.resultStatus)}</strong></div></div>
          </aside>
        </div>

        <section class="workspace-panel release-reasons-panel">
          <div class="panel-heading compact-heading"><div><span class="panel-eyebrow">WHY BLOCKED?</span><h2>Release reasons</h2></div><span class="panel-status">${releaseReasons.length} reason(s)</span></div>
          <div class="release-reason-grid">${releaseReasons.map((item) => `<article class="release-reason-card"><span class="code">${escapeHtml(item.code)}</span><p>${escapeHtml(item.message)}</p></article>`).join("") || emptyState("Không có release blocker", "Release engine hiện không trả về reason chặn nào.", "check")}</div>
        </section>
      </div>
    `;
  }

  function triggerDownload(filename, type, content) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`${filename} đã được tạo trong trình duyệt local.`, "success", "Download ready");
  }

  function renderExport() {
    const state = store.getState();
    setHeader("Working Export", "Report Center cho C7: tạo working-only HTML và trace JSON trực tiếp trên localhost, không phát hành numeric emission result.");

    let report;
    try {
      report = window.CGReportEngine.buildReport(state);
    } catch (error) {
      $("#content").innerHTML = `<div class="workspace-screen">${emptyState("Export refused", error.message, "alert")}</div>`;
      showToast(error.message, "danger", "Export refused", 5200);
      return;
    }

    $("#content").innerHTML = `
      <div class="workspace-screen export-screen">
        <div class="screen-summary-grid">
          <div class="screen-summary-card"><span>Report type</span><strong>WORKING</strong><small>Internal review only</small></div>
          <div class="screen-summary-card"><span>Dataset</span><strong class="code compact-code">${escapeHtml(report.guardrails.dataOrigin)}</strong><small>${escapeHtml(report.scope.datasetId)}</small></div>
          <div class="screen-summary-card danger-accent"><span>Numeric</span><strong>${escapeHtml(report.guardrails.embeddedEmissionNumeric)}</strong><small>${escapeHtml(report.release.resultVisibility)}</small></div>
          <div class="screen-summary-card"><span>Trace</span><strong>${escapeHtml(report.graph.integrityStatus)}</strong><small class="code">${escapeHtml(report.graph.traceId)}</small></div>
        </div>

        <div class="export-center-layout">
          <section class="workspace-panel export-products-panel">
            <div class="panel-heading"><div><span class="panel-eyebrow">EXPORT CENTER</span><h2>Chọn định dạng làm việc</h2><p>Cả hai file đều được tạo hoàn toàn trong browser local.</p></div>${pill(report.reportStatus, "WARNING")}</div>
            <div class="export-product-grid">
              <article class="export-product-card html-product"><div class="export-file-icon">HTML</div><h3>Working Report</h3><p>Bản đọc dành cho review nội bộ: scope, candidate/real state, validation, trace và release guardrail.</p><button id="download-working-html" class="btn primary">${icon("download", 16)} Download .html</button></article>
              <article class="export-product-card json-product"><div class="export-file-icon">JSON</div><h3>Trace Package</h3><p>Gói kỹ thuật machine-readable cho node/edge, validation relation và release state.</p><button id="download-trace-json" class="btn">${icon("download", 16)} Download .json</button></article>
            </div>
            <div class="notice danger compact-notice"><strong>WORKING_ONLY:</strong> ${escapeHtml(report.guardrails.disclaimer)}</div>
          </section>

          <aside class="workspace-panel report-preview-panel">
            <div class="panel-heading compact-heading"><div><span class="panel-eyebrow">LIVE PREVIEW</span><h2>Report summary</h2></div></div>
            <div class="report-preview-list">
              <div><span>Scenario</span><strong class="code">${escapeHtml(report.scope.scenarioId)}</strong></div>
              <div><span>Batch</span><strong class="code">${valueOrDash(report.workingInput.batchId)}</strong></div>
              <div><span>HRC lot</span><strong class="code">${valueOrDash(report.workingInput.hrcLotId)}</strong></div>
              <div><span>Candidate CN8</span><strong>${valueOrDash(report.classification.candidateCn8)} ${pill(report.classification.candidateLabel)}</strong></div>
              <div><span>Real CN8</span><strong>${valueOrDash(report.classification.realCn8)} ${pill(report.classification.realCn8Status)}</strong></div>
              <div><span>SEE</span><strong>${pill(report.precursorEmissionData.seeStatus)}</strong></div>
              <div><span>Validation issues</span><strong>${report.validation.summary.total ?? report.validation.issues.length}</strong></div>
              <div><span>Release</span><strong>${pill(report.release.numericReleaseStatus)} ${pill(report.release.resultVisibility)}</strong></div>
            </div>
          </aside>
        </div>
      </div>
    `;

    $("#download-working-html").addEventListener("click", (event) => {
      runBusyAction(event.currentTarget, "Đang tạo HTML…", () => {
        triggerDownload(window.CGReportEngine.fileName(report, "html"), "text/html;charset=utf-8", window.CGReportEngine.renderHtml(report));
      });
    });
    $("#download-trace-json").addEventListener("click", (event) => {
      runBusyAction(event.currentTarget, "Đang tạo JSON…", () => {
        triggerDownload(window.CGReportEngine.fileName(report, "json"), "application/json;charset=utf-8", window.CGReportEngine.renderJson(report));
      });
    });
  }

  function renderE2E() {
    const state = store.getState();
    const result = window.CGE2EEngine.evaluate(state);
    const passCount = result.checks.filter((item) => item.status === "PASS").length;
    const percent = result.checks.length ? Math.round((passCount / result.checks.length) * 100) : 0;
    setHeader("End-to-End", "C8 pipeline console: quan sát toàn luồng Input → Validation → Graph → Gate → Working Export và các technical safety checks.");

    $("#content").innerHTML = `
      <div class="workspace-screen e2e-screen">
        <section class="e2e-hero ${result.pipelineStatus === "SAFE_WORKING_FLOW_PASS" ? "pass" : "review"}">
          <div><span class="panel-eyebrow">LOCAL END-TO-END PIPELINE</span><h2>${escapeHtml(result.pipelineStatus)}</h2><p>Technical safety flow; không phải compliance decision.</p></div>
          <div class="e2e-score"><strong>${percent}%</strong><span>${passCount}/${result.checks.length} check(s) PASS</span></div>
        </section>

        <section class="workspace-panel pipeline-panel">
          <div class="panel-heading"><div><span class="panel-eyebrow">PIPELINE</span><h2>Working flow</h2></div><button id="rerun-e2e" class="btn primary">${icon("refresh", 16)} Recompute pipeline</button></div>
          <div class="pipeline-steps">
            <div class="pipeline-step done"><span>01</span><strong>Input</strong><small>Working state</small></div><i>→</i>
            <div class="pipeline-step ${state.validationSummary?.BLOCKER ? "review" : "done"}"><span>02</span><strong>Validation</strong><small>${state.validationSummary?.BLOCKER ?? 0} blocker(s)</small></div><i>→</i>
            <div class="pipeline-step ${state.graphSummary?.integrityStatus === "PASS" ? "done" : "review"}"><span>03</span><strong>Graph</strong><small>${escapeHtml(state.graphSummary?.integrityStatus || "REVIEW")}</small></div><i>→</i>
            <div class="pipeline-step blocked"><span>04</span><strong>Release Gate</strong><small>${escapeHtml(state.release.resultVisibility)}</small></div><i>→</i>
            <div class="pipeline-step done"><span>05</span><strong>Working Export</strong><small>HTML / JSON</small></div>
          </div>
        </section>

        <section class="workspace-panel e2e-checks-panel">
          <div class="panel-heading compact-heading"><div><span class="panel-eyebrow">TECHNICAL SAFETY CHECKS</span><h2>Evidence by checkpoint</h2></div></div>
          <div class="e2e-check-grid">${result.checks.map((item) => `<article class="e2e-check-card ${item.status.toLowerCase()}"><div class="e2e-check-top"><span class="code">${escapeHtml(item.id)}</span>${pill(item.status)}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.evidence)}</p></article>`).join("")}</div>
        </section>

        <div class="notice warning"><strong>Diễn giải đúng:</strong> SAFE_WORKING_FLOW_PASS chỉ chứng minh các module local nối đúng và guardrail hoạt động; Compliance = ${escapeHtml(result.complianceStatus)}, Numeric = ${escapeHtml(result.numericEmissionStatus)}, R-006 = ${escapeHtml(result.r006Status)}.</div>
      </div>
    `;
    $("#rerun-e2e").addEventListener("click", () => {
      store.validate();
      showToast("End-to-End technical safety checks đã được recompute.", "success", "E2E refreshed");
    });
  }

  function renderGuidanceList(items, cssClass = "") {
    return `<ul class="guidance-list ${cssClass}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function saveAcceptanceResult(caseId, status) {
    const note = document.querySelector(`[data-note-for="${caseId}"]`)?.value || "";
    acceptanceRecords = window.CGAcceptanceEngine.setResult(
      window.CGAcceptanceCatalog,
      acceptanceRecords,
      caseId,
      status,
      note
    );
    window.CGAcceptanceEngine.save(window.CGAcceptanceCatalog, acceptanceRecords, window.localStorage);
    renderAcceptance();
    showToast(`${caseId} đã được ghi ${status}.`, status === "PASS" ? "success" : status === "FAIL" ? "danger" : "info", "UAT updated");
  }

  function renderAcceptance() {
    const catalog = window.CGAcceptanceCatalog;
    const summary = window.CGAcceptanceEngine.summary(catalog, acceptanceRecords);
    const exportReady = window.CGAcceptanceEngine.isExportReady(catalog, acceptanceRecords, acceptanceReviewer);
    const progress = summary.total ? Math.round((summary.PASS / summary.total) * 100) : 0;
    setHeader("Test Center", "QA console cho D1/D3/D4/D5 manual acceptance; UAT record tách biệt hoàn toàn khỏi runtime release/compliance state.");

    $("#content").innerHTML = `
      <div class="workspace-screen test-center-screen">
        <div class="test-center-hero">
          <div><span class="panel-eyebrow">MANUAL ACCEPTANCE</span><h2>${summary.PASS}/${summary.total} case(s) PASS</h2><p>Hoàn tất manual evidence, định danh reviewer thật và chỉ export UAT JSON khi toàn bộ case đạt.</p></div>
          <div class="uat-progress-ring" style="--progress:${progress * 3.6}deg"><div><strong>${progress}%</strong><span>${escapeHtml(summary.reviewStatus)}</span></div></div>
        </div>

        <div class="screen-summary-grid test-summary-grid">
          <div class="screen-summary-card success-accent"><span>PASS</span><strong>${summary.PASS}</strong><small>Manual cases</small></div>
          <div class="screen-summary-card danger-accent"><span>FAIL</span><strong>${summary.FAIL}</strong><small>Cần điều tra/sửa</small></div>
          <div class="screen-summary-card warning-accent"><span>NOT RUN</span><strong>${summary.NOT_RUN}</strong><small>Chưa có bằng chứng</small></div>
          <div class="screen-summary-card"><span>Export readiness</span><strong>${exportReady ? "READY" : "PENDING"}</strong><small>${acceptanceReviewer ? "Reviewer identified" : "Missing reviewer"}</small></div>
        </div>

        <div class="test-center-layout">
          <section class="workspace-panel reviewer-panel">
            <div class="panel-heading"><div><span class="panel-eyebrow">REVIEWER IDENTITY</span><h2>Người duyệt UAT</h2><p>Tên này đi vào UAT JSON và phải là người thực sự review.</p></div>${pill(exportReady ? "SẴN SÀNG XUẤT" : "CHƯA ĐỦ ĐIỀU KIỆN", exportReady ? "PASS" : "WARNING")}</div>
            <div class="reviewer-form-row">
              <div class="field"><label for="uat-reviewer">Họ và tên reviewer</label><input id="uat-reviewer" maxlength="120" value="${escapeHtml(acceptanceReviewer)}" placeholder="Nhập họ và tên người thực sự duyệt" /><div class="field-help">Không dùng placeholder/UNSPECIFIED_REVIEWER.</div></div>
              <button id="save-uat-reviewer" class="btn">${icon("save", 16)} Lưu reviewer</button>
            </div>
            <div class="guardrail-grid compact-guardrail-grid"><span>Dataset ${pill(summary.dataset, "WARNING")}</span><span>R-006 ${pill(summary.r006Status)}</span><span>Numeric ${pill(summary.numericEmissionStatus)}</span><span>Compliance ${pill(summary.complianceStatus, "WARNING")}</span></div>
          </section>

          <section class="workspace-panel test-catalog-panel">
            <div class="panel-heading compact-heading"><div><span class="panel-eyebrow">TEST CATALOG</span><h2>10 manual acceptance scenarios</h2></div><span class="panel-status">Catalog v${escapeHtml(catalog.version)}</span></div>
            <div class="test-cases modern-test-cases">
              ${catalog.cases.map((testCase, index) => {
                const record = acceptanceRecords[testCase.id];
                return `
                  <details class="test-case modern-test-case" ${record.status === "FAIL" ? "open" : ""}>
                    <summary>
                      <span class="test-order">${String(index + 1).padStart(2, "0")}</span>
                      <span class="code">${escapeHtml(testCase.id)}</span>
                      <strong>${escapeHtml(testCase.title)}</strong>
                      <span class="test-work-item">${escapeHtml(testCase.workItem)}</span>
                      ${pill(record.status)}
                    </summary>
                    <div class="test-body">
                      <p class="test-purpose"><strong>Mục đích:</strong> ${escapeHtml(testCase.purpose)}</p>
                      <div class="test-grid">
                        <section><h4>Dữ liệu/mẫu cần test</h4>${renderGuidanceList(testCase.sampleInput, "sample")}</section>
                        <section><h4>Các bước</h4>${renderGuidanceList(testCase.steps)}</section>
                        <section class="pass-box"><h4>Đạt khi hiện</h4>${renderGuidanceList(testCase.expected)}</section>
                        <section class="fail-box"><h4>Không đạt nếu</h4>${renderGuidanceList(testCase.failSymptoms)}</section>
                        <section class="fix-box"><h4>Cách sửa/điều tra</h4>${renderGuidanceList(testCase.fixes)}</section>
                        <section><h4>Bằng chứng cần lưu</h4><p>${escapeHtml(testCase.evidence)}</p></section>
                      </div>
                      <div class="field test-note-field"><label for="note-${escapeHtml(testCase.id)}">Ghi chú người test</label><textarea id="note-${escapeHtml(testCase.id)}" data-note-for="${escapeHtml(testCase.id)}" rows="3" placeholder="Máy/trình duyệt, kết quả quan sát, link/filename bằng chứng...">${escapeHtml(record.note)}</textarea><div class="field-help">Lần kiểm tra gần nhất: ${valueOrDash(record.checkedAt)}</div></div>
                      <div class="actions test-actions"><button class="btn pass-action" data-case-id="${escapeHtml(testCase.id)}" data-status="PASS">Mark PASS</button><button class="btn fail-action" data-case-id="${escapeHtml(testCase.id)}" data-status="FAIL">Mark FAIL</button><button class="btn" data-case-id="${escapeHtml(testCase.id)}" data-status="NOT_RUN">Reset case</button></div>
                    </div>
                  </details>`;
              }).join("")}
            </div>
          </section>
        </div>

        <div class="uat-export-bar"><div><strong>UAT evidence package</strong><small>Export chỉ mở khi 10/10 PASS + reviewer đã định danh.</small></div><div class="actions compact-actions"><button id="reset-uat-record" class="btn danger-outline">${icon("refresh", 16)} Reset manual result</button><button id="export-uat-record" class="btn primary" ${exportReady ? "" : "disabled"}>${icon("download", 16)} Export UAT record (.json)</button></div></div>
        <div class="notice danger"><strong>Biên an toàn:</strong> Manual UAT không thay đổi runtime, không đóng R-006, không đánh giá compliance và không quyết định Gate 3.</div>
      </div>
    `;

    document.querySelectorAll("[data-case-id][data-status]").forEach((button) => {
      button.addEventListener("click", () => saveAcceptanceResult(button.dataset.caseId, button.dataset.status));
    });

    $("#save-uat-reviewer").addEventListener("click", () => {
      acceptanceReviewer = window.CGAcceptanceEngine.normalizeReviewer($("#uat-reviewer").value);
      window.CGAcceptanceEngine.saveReviewer(acceptanceReviewer, window.localStorage);
      renderAcceptance();
      showToast(acceptanceReviewer ? `Reviewer đã lưu: ${acceptanceReviewer}` : "Reviewer đang để trống.", acceptanceReviewer ? "success" : "warning", "Reviewer identity");
    });

    $("#export-uat-record").addEventListener("click", () => {
      if (!window.CGAcceptanceEngine.isExportReady(catalog, acceptanceRecords, acceptanceReviewer)) {
        showToast("Cần đủ 10/10 PASS và họ tên reviewer thực tế trước khi xuất UAT.", "warning", "UAT chưa sẵn sàng", 5200);
        return;
      }
      runBusyAction($("#export-uat-record"), "Đang tạo UAT JSON…", () => {
        const record = window.CGAcceptanceEngine.buildRecord(catalog, acceptanceRecords, { reviewer: acceptanceReviewer });
        const stamp = record.generatedAt.replace(/[:.]/g, "-");
        triggerDownload(`CG_UAT_Record_${stamp}.json`, "application/json;charset=utf-8", JSON.stringify(record, null, 2));
      });
    });

    $("#reset-uat-record").addEventListener("click", () => {
      acceptanceRecords = window.CGAcceptanceEngine.clear(catalog, window.localStorage);
      acceptanceReviewer = "";
      renderAcceptance();
      showToast("Manual UAT result và reviewer đã được reset.", "warning", "UAT reset");
    });
  }

  const renderers = {
    overview: renderOverview,
    data: renderInputModule,
    evidence: renderEvidence,
    validation: renderValidation,
    trace: renderTrace,
    result: renderResult,
    export: renderExport,
    e2e: renderE2E,
    acceptance: renderAcceptance
  };

  function render(screenId, updateHash = true) {
    const safeScreen = renderers[screenId] ? screenId : "overview";
    const screenChanged = Boolean(document.body.dataset.screen) && document.body.dataset.screen !== safeScreen;
    document.body.classList.toggle("screen-overview", safeScreen === "overview");
    document.body.dataset.screen = safeScreen;
    activateNav(safeScreen);
    renderers[safeScreen]();

    // #03: Animate only real screen changes, not validation/state re-renders.
    // The animation is CSS-only; reduced-motion automatically disables it.
    if (screenChanged) {
      const mobileMenu = document.getElementById("product-nav");
      const menuToggle = document.getElementById("product-menu-toggle");
      if (safeScreen !== "overview") {
        document.querySelectorAll(".product-nav [data-overview-target]").forEach((button) => {
          button.classList.remove("is-active");
          button.removeAttribute("aria-current");
        });
        if (mobileMenu && menuToggle) {
          mobileMenu.classList.remove("is-open");
          menuToggle.setAttribute("aria-expanded", "false");
        }
      }
      const content = document.getElementById("content");
      content.classList.remove("screen-enter");
      void content.offsetWidth;
      content.classList.add("screen-enter");
      content.onanimationend = (event) => {
        if (event.target === content) content.classList.remove("screen-enter");
      };
      // Workspace navigation should always reveal the new page heading rather
      // than leave the user at the scroll position of the previous screen.
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (updateHash && window.location.hash !== `#${safeScreen}`) window.location.hash = safeScreen;
  }

  function bindMotionControl() {
    const button = document.getElementById("motion-toggle");
    if (!button) return;

    const sync = () => {
      const api = window.CGAmbientGraph;
      const enabled = api ? api.isEnabled() : false;
      button.setAttribute("aria-pressed", String(enabled));
      button.classList.toggle("is-paused", !enabled);
      button.innerHTML = `${icon(enabled ? "pause" : "play", 14)} ${enabled ? "Motion" : "Paused"}`;
      if (api?.prefersReducedMotion()) {
        button.title = "Thiết bị đang ưu tiên reduced motion";
      } else {
        button.title = enabled ? "Tạm dừng chuyển động nền" : "Bật chuyển động nền";
      }
    };

    button.addEventListener("click", () => {
      if (!window.CGAmbientGraph) return;
      const enabled = window.CGAmbientGraph.toggle();
      sync();
      showToast(enabled ? "Graph background animation đã bật." : "Graph background animation đã tạm dừng.", "info", "Motion preference");
    });
    document.addEventListener("cg:motionchange", sync);
    sync();
  }

  function buildNav() {
    const nav = $("#nav");
    screens.forEach(([id, label, description, key]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.screen = id;
      button.innerHTML = `
        <span class="nav-key" aria-hidden="true">${icon(key, 16)}</span>
        <span class="nav-copy">
          <span class="nav-label">${escapeHtml(label)}</span>
          <span class="nav-desc">${escapeHtml(description)}</span>
        </span>
      `;
      button.addEventListener("click", () => render(id));
      nav.appendChild(button);
    });
  }

  store.subscribe((current) => {
    try {
      persistenceMeta.lastSaveOk = window.CGPersistence.save(current, window.localStorage);
      persistenceMeta.restored = true;
      persistenceMeta.savedAt = new Date().toISOString();
    } catch (_) {
      persistenceMeta.lastSaveOk = false;
    }
    const currentScreen = window.location.hash.replace("#", "") || "overview";
    if (renderers[currentScreen]) render(currentScreen, false);
  });

  function bindMarketingNavigation() {
    const marketingNav = document.getElementById("product-nav");
    const menuButton = document.getElementById("product-menu-toggle");
    const narrowHeader = window.matchMedia("(max-width: 1120px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function closeMarketingMenu(returnFocus = false) {
      if (!marketingNav || !menuButton) return;
      const wasOpen = marketingNav.classList.contains("is-open");
      marketingNav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Mở menu giới thiệu");
      if (returnFocus && wasOpen) menuButton.focus();
    }

    function setMarketingMenu(open) {
      marketingNav.classList.toggle("is-open", open);
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Đóng menu giới thiệu" : "Mở menu giới thiệu");
    }

    function setActiveMarketingTarget(targetId) {
      marketingNav?.querySelectorAll("[data-overview-target]").forEach((button) => {
        const active = button.dataset.overviewTarget === targetId;
        button.classList.toggle("is-active", active);
        if (active) button.setAttribute("aria-current", "location");
        else button.removeAttribute("aria-current");
      });
    }

    // #04: Restore the five marketing sections on tablets/phones through an
    // accessible expandable menu, rather than hiding them completely.
    menuButton?.addEventListener("click", () => {
      setMarketingMenu(!marketingNav.classList.contains("is-open"));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && marketingNav?.classList.contains("is-open")) {
        closeMarketingMenu(true);
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (marketingNav?.classList.contains("is-open") &&
          !marketingNav.contains(event.target) && !menuButton.contains(event.target)) {
        closeMarketingMenu();
      }
    });
    narrowHeader.addEventListener("change", () => closeMarketingMenu());

    document.querySelectorAll("[data-overview-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const targetId = button.dataset.overviewTarget;
        const alreadyOverview = document.body.dataset.screen === "overview";
        closeMarketingMenu();
        setActiveMarketingTarget(targetId);
        // Do not re-create the whole Overview just to scroll to an existing
        // section; that used to cause an unnecessary jump/reflow.
        if (!alreadyOverview) render("overview");
        window.requestAnimationFrame(() => {
          const target = document.getElementById(targetId);
          if (!target) return;
          // Cancel any previous smooth scroll before calculating a fresh
          // target (important after resizing or fast repeated menu clicks).
          window.scrollTo({ top: window.scrollY, behavior: "instant" });
          const header = document.querySelector(".app-header");
          const offset = (header?.getBoundingClientRect().height || 0) + 16;
          const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset);
          window.scrollTo({ top, behavior: reducedMotion.matches ? "instant" : "smooth" });
        });
      });
    });

    window.addEventListener("hashchange", () => {
      const requested = window.location.hash.replace("#", "") || "overview";
      if (renderers[requested] && document.body.dataset.screen !== requested) {
        closeMarketingMenu();
        setActiveMarketingTarget(null);
        render(requested, false);
      }
    });
  }

  buildNav();
  bindMarketingNavigation();
  bindMotionControl();
  render(window.location.hash.replace("#", "") || "overview", false);
})();
