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
    ["data", "Hồ sơ vay", "Nhập hồ sơ", "database"],
    ["evidence", "Evidence Queue", "Bằng chứng", "file-check"],
    ["validation", "Kiểm tra tài chính", "Kiểm tra hồ sơ", "shield-check"],
    ["trace", "Giải thích quyết định", "Luồng đánh giá", "network"],
    ["result", "Đánh giá tín dụng", "Kết quả MOCK", "lock"],
    ["export", "Báo cáo tín dụng", "HTML / JSON", "download"],
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

  function showToast(message, type = "info", title = "FinRisk DSS", duration = 3600) {
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
            <button class="btn ${releaseReady ? "primary" : "danger-outline"}" data-open-screen="result">Mở Đánh giá tín dụng</button>
          </div>
        </div>
      </section>

      <section class="landing-section product-suite-section" id="cg-suite" aria-label="FinRisk Product Roadmap">
        <div class="section-heading centered">
          <span class="section-eyebrow">PRODUCT ROADMAP · CONCEPT UI</span>
          <h2>Lộ trình phát triển hệ thống hỗ trợ quyết định tín dụng FinRisk DSS</h2>
          <p>Ba định hướng sản phẩm dưới đây là concept UI, chưa phải tính năng nghiệp vụ đã triển khai. Kết quả đánh giá cần được kiểm chứng với schema, mô hình ML và policy đã thống nhất.</p>
        </div>
        <div class="suite-grid">
          <article class="suite-card">
            <div class="suite-preview"><div class="suite-mini-list">
              <span><i></i> Hồ sơ khách hàng <b>INPUT</b></span>
              <span><i></i> Thu nhập & khoản vay <b>DATA</b></span>
              <span><i></i> Kiểm tra trường dữ liệu <b>CHECK</b></span>
              <strong>Trạng thái hồ sơ <b>CONCEPT</b></strong>
            </div></div>
            <div class="suite-body"><div class="suite-icon">⌘</div><span class="suite-roadmap-badge">ROADMAP</span>
              <h3>Hồ sơ tín dụng</h3><h4>Chuẩn hóa dữ liệu khách hàng và khoản vay</h4>
              <ul><li>Form hồ sơ theo schema đã được nhóm phê duyệt</li><li>Kiểm tra trường bắt buộc và định dạng tài chính</li><li>Lưu, truy xuất và theo dõi phiên bản hồ sơ khi có backend</li><li>Phân biệt dữ liệu demo và dữ liệu thực</li></ul>
            </div>
          </article>
          <article class="suite-card">
            <div class="suite-preview suite-preview-report"><div class="suite-report-card">
              <div class="suite-report-head"><span>Credit Assessment Report</span><em>ROADMAP</em></div>
              <div class="suite-report-checks"><span>✓ Thông tin hồ sơ và chỉ số đầu vào</span><span>✓ Risk · Decision · Recommendation</span><span>✓ Lịch sử & dấu vết quyết định</span></div>
              <div class="suite-file-chips"><b>HTML</b><b>JSON</b><b>TRACE</b></div>
            </div></div>
            <div class="suite-body"><div class="suite-icon">▤</div><span class="suite-roadmap-badge">ROADMAP</span>
              <h3>Báo cáo tín dụng</h3><h4>Giải thích và xuất kết quả đánh giá</h4>
              <ul><li>Trình bày mức rủi ro và lý do đề xuất</li><li>Truy vết Customer → Features → ML → Decision</li><li>Xuất báo cáo HTML/JSON theo dữ liệu hợp lệ</li><li>Hỗ trợ người duyệt, không thay thế phê duyệt thực tế</li></ul>
            </div>
          </article>
          <article class="suite-card">
            <div class="suite-preview suite-preview-ai"><div class="suite-line-chart">
              <div class="suite-chart-head"><span>Minh họa phân tầng rủi ro</span><em>ROADMAP</em></div>
              <svg viewBox="0 0 260 90" aria-hidden="true"><polyline fill="none" stroke="#0a3c33" stroke-width="3" points="8,60 72,52 132,44 190,35 250,24"></polyline><polyline fill="none" stroke="#84cc16" stroke-width="3" stroke-dasharray="8 6" points="132,44 190,40 250,30"></polyline><circle cx="8" cy="60" r="4" fill="#0a3c33"></circle><circle cx="250" cy="24" r="4" fill="#84cc16"></circle></svg>
              <div class="suite-chart-scale"><span>Risk <b>—</b></span><span>Scenario <b>—</b></span><span class="suite-trend">MOCK UI</span></div>
            </div></div>
            <div class="suite-body"><div class="suite-icon">✦</div><span class="suite-roadmap-badge">ROADMAP</span>
              <h3>AI & Decision Engine</h3><h4>Hỗ trợ phân tích và ra quyết định có giải thích</h4>
              <ul><li>Nhận điểm rủi ro từ mô hình ML được xác thực</li><li>Áp dụng policy phê duyệt do nhóm thống nhất</li><li>Giải thích khuyến nghị và cảnh báo bất thường</li><li>Không tự động phê duyệt khoản vay từ dữ liệu mock</li></ul>
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
            <span class="capability-link">Mở Đánh giá tín dụng →</span>
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

      <section class="landing-section news-section" id="cg-news" aria-label="Tin tức tài chính và vay vốn">
        <div class="news-heading-row">
          <div class="section-heading">
            <span class="section-eyebrow">FINRISK INSIGHTS · TÀI CHÍNH & VAY VỐN</span>
            <h2>Tin tức tài chính, tín dụng và quản trị rủi ro</h2>
            <p>Nguồn tham khảo từ cơ quan quản lý và tổ chức quốc tế. Nội dung được biên tập tóm tắt, không phải dữ liệu đánh giá khoản vay thời gian thực.</p>
          </div>
          <a class="news-view-all" href="https://www.sbv.gov.vn/" target="_blank" rel="noopener noreferrer">Nguồn Ngân hàng Nhà nước <span aria-hidden="true">→</span></a>
        </div>
        <div class="news-grid">
          <article class="news-card">
            <a class="news-image-link" href="https://www.sbv.gov.vn/vi/web/sbv_portal/w/sbv596408" target="_blank" rel="noopener noreferrer" aria-label="Xem nguồn NGÂN HÀNG NHÀ NƯỚC: Giới hạn cấp tín dụng theo Luật Các tổ chức tín dụng 2024">
              <img src="assets/news/credit-policy.svg" alt="Minh họa chủ đề chính sách tín dụng" loading="lazy" />
              <span class="news-region vietnam">VIỆT NAM</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>NGÂN HÀNG NHÀ NƯỚC</span><span>Chính sách tín dụng</span></div>
              <h3>Giới hạn cấp tín dụng theo Luật Các tổ chức tín dụng 2024</h3>
              <p>Tìm hiểu lộ trình giới hạn cấp tín dụng và mục tiêu kiểm soát rủi ro tập trung.</p>
              <a class="news-read-more" href="https://www.sbv.gov.vn/vi/web/sbv_portal/w/sbv596408" target="_blank" rel="noopener noreferrer">Xem nguồn gốc <span aria-hidden="true">→</span></a>
            </div>
          </article>
          <article class="news-card">
            <a class="news-image-link" href="https://www.sbv.gov.vn/vi/w/sbv637542" target="_blank" rel="noopener noreferrer" aria-label="Xem nguồn NGÂN HÀNG NHÀ NƯỚC: Quản lý nợ xấu và các cơ chế bảo vệ hệ thống ngân hàng">
              <img src="assets/news/risk-management.svg" alt="Minh họa chủ đề quản trị rủi ro" loading="lazy" />
              <span class="news-region vietnam">VIỆT NAM</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>NGÂN HÀNG NHÀ NƯỚC</span><span>Quản trị rủi ro</span></div>
              <h3>Quản lý nợ xấu và các cơ chế bảo vệ hệ thống ngân hàng</h3>
              <p>Thông tin về quản lý rủi ro, xử lý nợ xấu và các biện pháp can thiệp đặc biệt.</p>
              <a class="news-read-more" href="https://www.sbv.gov.vn/vi/w/sbv637542" target="_blank" rel="noopener noreferrer">Xem nguồn gốc <span aria-hidden="true">→</span></a>
            </div>
          </article>
          <article class="news-card">
            <a class="news-image-link" href="https://www.worldbank.org/ext/en/topic/financial-sector" target="_blank" rel="noopener noreferrer" aria-label="Xem nguồn WORLD BANK: Phát triển dịch vụ tài chính và tiếp cận vốn bền vững">
              <img src="assets/news/financial-access.svg" alt="Minh họa chủ đề tiếp cận tài chính" loading="lazy" />
              <span class="news-region international">QUỐC TẾ</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>WORLD BANK</span><span>Tiếp cận tài chính</span></div>
              <h3>Phát triển dịch vụ tài chính và tiếp cận vốn bền vững</h3>
              <p>Tổng quan các ưu tiên về tiếp cận tài chính, hạ tầng tài chính và cho vay bền vững.</p>
              <a class="news-read-more" href="https://www.worldbank.org/ext/en/topic/financial-sector" target="_blank" rel="noopener noreferrer">Xem nguồn gốc <span aria-hidden="true">→</span></a>
            </div>
          </article>
          <article class="news-card">
            <a class="news-image-link" href="https://databank.worldbank.org/embed/Vietnam--Financial-Sector/id/2c1430e" target="_blank" rel="noopener noreferrer" aria-label="Xem nguồn WORLD BANK: Các chỉ số tài chính và tín dụng của Việt Nam">
              <img src="assets/news/credit-data.svg" alt="Minh họa chủ đề dữ liệu tín dụng" loading="lazy" />
              <span class="news-region vietnam">VIỆT NAM</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>WORLD BANK</span><span>Dữ liệu tín dụng</span></div>
              <h3>Các chỉ số tài chính và tín dụng của Việt Nam</h3>
              <p>Khám phá nguồn dữ liệu thống kê về tín dụng, ngân hàng và các chỉ tiêu tài chính.</p>
              <a class="news-read-more" href="https://databank.worldbank.org/embed/Vietnam--Financial-Sector/id/2c1430e" target="_blank" rel="noopener noreferrer">Xem nguồn gốc <span aria-hidden="true">→</span></a>
            </div>
          </article>
          <article class="news-card">
            <a class="news-image-link" href="https://www.worldbank.org/en/news/press-release/2025/07/16/mobile-phone-technology-powers-saving-surge-in-developing-economies" target="_blank" rel="noopener noreferrer" aria-label="Xem nguồn World Bank về tiết kiệm số và tài chính toàn diện">
              <img src="assets/news/digital-savings.svg" alt="Minh họa tiết kiệm và giao dịch tài chính trên điện thoại" loading="lazy" />
              <span class="news-region international">QUỐC TẾ</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>WORLD BANK</span><span>16/07/2025 · Tài chính số</span></div>
              <h3>Điện thoại thúc đẩy tiết kiệm và tiếp cận dịch vụ tài chính</h3>
              <p>Global Findex 2025 ghi nhận vai trò của điện thoại trong mở rộng tài khoản, tiết kiệm và thanh toán tại các nền kinh tế đang phát triển.</p>
              <a class="news-read-more" href="https://www.worldbank.org/en/news/press-release/2025/07/16/mobile-phone-technology-powers-saving-surge-in-developing-economies" target="_blank" rel="noopener noreferrer">Xem nguồn gốc <span aria-hidden="true">→</span></a>
            </div>
          </article>
          <article class="news-card">
            <a class="news-image-link" href="https://microdata.worldbank.org/index.php/catalog/7998" target="_blank" rel="noopener noreferrer" aria-label="Xem dữ liệu Global Findex 2025 cho Việt Nam">
              <img src="assets/news/vietnam-findex.svg" alt="Minh họa khảo sát tiếp cận tín dụng và thanh toán số tại Việt Nam" loading="lazy" />
              <span class="news-region vietnam">VIỆT NAM</span>
            </a>
            <div class="news-card-body">
              <div class="news-meta"><span>WORLD BANK</span><span>Global Findex 2025</span></div>
              <h3>Global Findex 2025: Dữ liệu về vay vốn và tài chính số tại Việt Nam</h3>
              <p>Bộ dữ liệu khảo sát tại Việt Nam giúp tham khảo hành vi sử dụng tài khoản, thanh toán, tiết kiệm và vay vốn của người trưởng thành.</p>
              <a class="news-read-more" href="https://microdata.worldbank.org/index.php/catalog/7998" target="_blank" rel="noopener noreferrer">Xem nguồn gốc <span aria-hidden="true">→</span></a>
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
          <p>Mở workspace để thử Input, Validation, Evidence Graph, Đánh giá tín dụng và Working Export trên cùng một state local.</p>
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
    const loan = window.FinRiskLoan;
    const data = loan.load();
    const fields = [
      ["customer_id","Mã khách hàng","text","VD: KH001"],
      ["full_name","Họ và tên","text","Nguyễn Văn A"],
      ["age","Tuổi","number","25"],
      ["monthly_income","Thu nhập hàng tháng (VNĐ)","number","15000000"],
      ["monthly_expenses","Chi phí hàng tháng (VNĐ)","number","5000000"],
      ["existing_monthly_debt","Khoản trả nợ hiện tại/tháng (VNĐ)","number","1000000"],
      ["loan_amount","Số tiền đề nghị vay (VNĐ)","number","200000000"],
      ["loan_term_months","Thời hạn vay (tháng)","number","24"]
    ];
    setHeader("Input Module · FinRisk", "Nhập hồ sơ vay MOCK. Dữ liệu chỉ lưu trên trình duyệt, chưa gửi PostgreSQL hoặc ML.");
    $("#content").innerHTML = `
      <div class="workspace-screen input-screen finrisk-loan-screen">
        <div class="screen-summary-grid">
          <div class="screen-summary-card"><span>Data source</span><strong>MOCK</strong><small>Browser localStorage</small></div>
          <div class="screen-summary-card"><span>Customer</span><strong>${escapeHtml(data.customer_id || "—")}</strong><small>Mã hồ sơ khách hàng</small></div>
          <div class="screen-summary-card"><span>Validation</span><strong>${loan.validate(data).valid ? "PASS" : "PENDING"}</strong><small>Quy tắc mẫu, chưa duyệt policy</small></div>
          <div class="screen-summary-card"><span>Backend</span><strong>OFFLINE</strong><small>Chưa kết nối API / ML</small></div>
        </div>
        <div class="input-workspace-layout">
          <form id="finrisk-loan-form" class="workspace-panel input-builder" novalidate>
            <div class="panel-heading"><div><span class="panel-eyebrow">#09 · LOAN APPLICATION · MOCK</span><h2>Hồ sơ đề nghị vay</h2><p>Nhập và chỉnh sửa thông tin. Bấm Kiểm tra để xem lỗi theo #10; Lưu MOCK để giữ dữ liệu trên thiết bị này.</p></div><span class="panel-status">MOCK · Local only</span></div>
            <div class="input-stepper" aria-hidden="true"><span class="active"><b>1</b> Khách hàng</span><i></i><span class="active"><b>2</b> Tài chính</span><i></i><span><b>3</b> Kiểm tra</span><i></i><span><b>4</b> Lưu MOCK</span></div>
            <section class="form-section"><div class="form-section-head"><span class="form-section-index">01</span><div><h3>Thông tin khách hàng & khoản vay</h3><p>Schema MOCK tạm thời, có thể chuyển sang API adapter khi nhóm thống nhất hợp đồng dữ liệu.</p></div></div>
            <div class="form-grid">
              ${fields.map(([key,label,type,placeholder])=>`<div class="field"><label for="loan-${key}">${label}</label><input id="loan-${key}" name="${key}" type="${type}" ${type==="number"?'min="0" step="1"':''} placeholder="${placeholder}" value="${escapeHtml(data[key])}" aria-describedby="loan-error-${key}"/><div class="field-help finrisk-field-error" id="loan-error-${key}" role="alert"></div></div>`).join("")}
              <div class="field full"><label for="loan-purpose">Mục đích vay</label><select id="loan-purpose" name="loan_purpose">${[["","Chọn mục đích"],["personal","Tiêu dùng cá nhân"],["business","Kinh doanh"],["education","Giáo dục"],["housing","Nhà ở"],["other","Khác"]].map(([value,label])=>`<option value="${value}" ${data.loan_purpose===value?"selected":""}>${label}</option>`).join("")}</select><div class="field-help finrisk-field-error" id="loan-error-loan_purpose" role="alert"></div></div>
            </div></section>
            <div class="finrisk-loan-actions"><button class="btn primary" type="submit">${icon("check",16)} Kiểm tra & lưu MOCK</button><button class="btn" type="button" id="loan-validate">${icon("shield-check",16)} Kiểm tra dữ liệu</button><button class="btn" type="button" id="loan-reset">${icon("refresh",16)} Reset hồ sơ</button></div>
            <div id="loan-form-feedback" aria-live="polite" class="notice warning">Dữ liệu giả lập, không phải hồ sơ tín dụng được phê duyệt.</div>
          </form>
          <aside class="workspace-panel classification-panel"><div class="panel-heading compact-heading"><div><span class="panel-eyebrow">DATA CONTRACT · DRAFT</span><h2>Trạng thái hồ sơ</h2></div></div><div class="derived-list"><div><span>Schema</span><strong>finrisk.loan.v1-mock</strong></div><div><span>Persistence</span><strong>localStorage</strong></div><div><span>ML / Decision</span><strong>Not connected</strong></div><div><span>PostgreSQL</span><strong>Not connected</strong></div></div><div class="notice warning compact-notice">Các giới hạn kiểm tra hiện chỉ là quy tắc nhập liệu minh họa, không phải chính sách xét duyệt tín dụng.</div></aside>
        </div>
      </div>`;
    const form = $("#finrisk-loan-form");
    const read = () => Object.fromEntries([...form.querySelectorAll("[name]")].map(el=>[el.name,el.value.trim()]));
    const showErrors = (result) => {
      form.querySelectorAll(".finrisk-field-error").forEach(el=>el.textContent="");
      form.querySelectorAll("[name]").forEach(el=>el.removeAttribute("aria-invalid"));
      Object.entries(result.errors).forEach(([key,message])=>{
        const el=document.getElementById("loan-error-"+key);
        const field=form.elements.namedItem(key);
        if(el) el.textContent=message;
        if(field) field.setAttribute("aria-invalid","true");
      });
      $("#loan-form-feedback").textContent=result.valid?"Dữ liệu hợp lệ theo bộ quy tắc MOCK. Chưa đánh giá tín dụng.":`Có ${Object.keys(result.errors).length} trường cần sửa.`;
      return result.valid;
    };
    $("#loan-validate").addEventListener("click",()=>{const ok=showErrors(loan.validate(read()));showToast(ok?"Kiểm tra MOCK thành công.":"Vui lòng sửa các trường chưa hợp lệ.",ok?"success":"warning");});
    form.addEventListener("submit",event=>{
      event.preventDefault();
      const values=read();
      if(!showErrors(loan.validate(values))) {showToast("Hồ sơ chưa hợp lệ, chưa lưu.","warning");return;}
      loan.save(values);
      showToast("Đã lưu hồ sơ MOCK trong trình duyệt.","success");
    });
    $("#loan-reset").addEventListener("click",()=>{loan.reset();renderInputModule();showToast("Đã reset hồ sơ MOCK.","warning");});
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
    const loan=window.FinRiskLoan;
    const data=loan.load();
    const result=loan.validate(data);
    const entries=Object.entries(result.errors);
    setHeader("Validation · FinRisk", "Kiểm tra dữ liệu tài chính của hồ sơ vay MOCK; không áp dụng chính sách phê duyệt tín dụng.");
    $("#content").innerHTML=`
      <div class="workspace-screen validation-screen finrisk-loan-screen">
        <div class="screen-summary-grid validation-summary-grid">
          <div class="screen-summary-card"><span>Input fields</span><strong>${loan.fields.length}</strong><small>Schema MOCK</small></div>
          <div class="screen-summary-card danger-accent"><span>Errors</span><strong>${entries.length}</strong><small>Trường không hợp lệ</small></div>
          <div class="screen-summary-card success-accent"><span>Valid</span><strong>${result.valid?"YES":"NO"}</strong><small>Kiểm tra nhập liệu</small></div>
          <div class="screen-summary-card"><span>Source</span><strong>MOCK</strong><small>Browser localStorage</small></div>
        </div>
        <div class="validation-control-layout">
          <section class="workspace-panel validation-board-panel">
            <div class="panel-heading"><div><span class="panel-eyebrow">#10 · FINANCIAL VALIDATION</span><h2>Kiểm tra hồ sơ vay</h2><p>Kết quả dựa trên hồ sơ MOCK đã lưu tại Input Module. Các giới hạn là giả định để kiểm thử UI.</p></div><button id="loan-validation-refresh" class="btn primary">${icon("refresh",16)} Kiểm tra lại</button></div>
            <div class="issue-list">${entries.length?entries.map(([key,message],i)=>`<article class="issue-card severity-error"><div class="issue-status-rail"></div><div class="issue-main"><div class="issue-topline"><span class="code">FIN-${String(i+1).padStart(3,"0")}</span>${pill("ERROR")}</div><h3>${escapeHtml(message)}</h3><div class="issue-meta"><span><b>Field</b> <code>${escapeHtml(key)}</code></span></div></div></article>`).join(""):emptyState("Không có lỗi nhập liệu","Hồ sơ MOCK hiện tại vượt qua các quy tắc kiểm tra dữ liệu mẫu.","check")}</div>
          </section>
          <aside class="workspace-panel classification-panel"><div class="panel-heading compact-heading"><div><span class="panel-eyebrow">FINANCIAL INPUT</span><h2>Tóm tắt hồ sơ</h2></div></div>
            <div class="derived-list"><div><span>Customer ID</span><strong>${escapeHtml(data.customer_id||"—")}</strong></div><div><span>Monthly income</span><strong>${escapeHtml(data.monthly_income||"—")} VND</strong></div><div><span>Loan amount</span><strong>${escapeHtml(data.loan_amount||"—")} VND</strong></div><div><span>Loan term</span><strong>${escapeHtml(data.loan_term_months||"—")} months</strong></div></div>
            <div class="notice warning compact-notice">Validation PASS không có nghĩa khoản vay được chấp thuận. Chưa kết nối ML, Decision Engine hay PostgreSQL.</div>
            <button id="loan-edit-from-validation" class="btn" type="button">Chỉnh sửa tại Input Module</button>
          </aside>
        </div>
      </div>`;
    $("#loan-validation-refresh").addEventListener("click",()=>{renderValidation();showToast("Đã kiểm tra lại dữ liệu MOCK.","info");});
    $("#loan-edit-from-validation").addEventListener("click",()=>{window.location.hash="data";});
  }

  function renderTrace() {
    const trace = window.FinRiskDecisionTrace.build(
      window.FinRiskLoan.load(),
      window.FinRiskDecisionMock.getScenario()
    );
    setHeader("Giải thích quyết định · FinRisk", "#11 · Decision Trace: truy vết Customer → Features → ML → Risk → Decision → Recommendation bằng dữ liệu MOCK.");
    const statusText = {PASS:"Sẵn sàng",MOCK:"Giả lập",BLOCKED:"Bị chặn",UNAVAILABLE:"Chưa có dữ liệu"};
    const nodes = trace.steps;
    $("#content").innerHTML = `
      <div class="workspace-screen trace-screen finrisk-trace-screen">
        <div class="screen-summary-grid">
          <div class="screen-summary-card"><span>Customer ID</span><strong>${escapeHtml(trace.customerId)}</strong><small>Hồ sơ #09</small></div>
          <div class="screen-summary-card"><span>Validation</span><strong>${trace.validation.valid?"PASS":"BLOCKED"}</strong><small>Kiểm tra #10</small></div>
          <div class="screen-summary-card"><span>Risk score</span><strong>${trace.assessment.score===null?"N/A":escapeHtml(trace.assessment.score+"/100")}</strong><small>Điểm MOCK #12</small></div>
          <div class="screen-summary-card"><span>Decision</span><strong>${escapeHtml(trace.assessment.status)}</strong><small>Không phải phê duyệt thật</small></div>
        </div>
        <div class="notice warning"><strong>MOCK ONLY:</strong> Truy vết mô phỏng dựa trên #09, #10 và kịch bản #12. Chưa có ML output, policy hoặc lịch sử quyết định từ backend.</div>
        <section class="workspace-panel graph-canvas-panel">
          <div class="panel-heading"><div><span class="panel-eyebrow">#11 · DECISION TRACE · MOCK</span><h2>Luồng giải thích quyết định</h2><p>Chọn từng bước để xem đầu vào, trạng thái và giải thích. Thay đổi kịch bản ở tab Đánh giá tín dụng để cập nhật luồng.</p></div><span class="panel-status">MOCK · Local only</span></div>
          <div class="graph-canvas finrisk-trace-canvas">
            ${nodes.map((node,index)=>`${index?'<div class="graph-lane-arrow">→</div>':""}<div class="graph-lane"><div class="graph-lane-title">${String(index+1).padStart(2,"0")} · ${escapeHtml(node.label)}</div><div class="graph-lane-nodes"><button type="button" class="graph-node-card type-${escapeHtml(node.status.toLowerCase())}" data-trace-step="${escapeHtml(node.id)}" aria-pressed="false"><span>${escapeHtml(node.label)}</span><strong>${escapeHtml(node.value)}</strong>${pill(node.status)}<small>Chọn để xem chi tiết</small></button></div></div>`).join("")}
          </div>
          <div id="finrisk-trace-inspector" class="graph-node-inspector" aria-live="polite"><span class="inspector-icon">${icon("network",20)}</span><div><strong>Chi tiết bước xử lý</strong><p>Chọn một bước trong luồng để xem giải thích.</p></div></div>
        </section>
        <section class="workspace-panel trace-relations-panel">
          <details open><summary><span>Danh sách bước và trạng thái</span><strong>${nodes.length} bước</strong></summary>
          <div class="table-shell"><table><thead><tr><th>Bước</th><th>Giá trị</th><th>Trạng thái</th><th>Giải thích</th></tr></thead><tbody>
            ${nodes.map(node=>`<tr><td>${escapeHtml(node.label)}</td><td>${escapeHtml(node.value)}</td><td>${pill(node.status)}</td><td>${escapeHtml(node.description)}</td></tr>`).join("")}
          </tbody></table></div></details>
        </section>
      </div>`;
    document.querySelectorAll("[data-trace-step]").forEach(button=>button.addEventListener("click",()=>{
      const node=nodes.find(item=>item.id===button.dataset.traceStep);
      if(!node)return;
      document.querySelectorAll("[data-trace-step]").forEach(item=>{
        item.classList.toggle("selected",item===button);
        item.setAttribute("aria-pressed",String(item===button));
      });
      $("#finrisk-trace-inspector").innerHTML=`<span class="inspector-icon">${icon("network",20)}</span><div class="inspector-copy"><div class="inspector-title"><strong>${escapeHtml(node.label)}</strong>${pill(node.status)}</div><p>${escapeHtml(node.description)}</p><div class="inspector-relations"><span>${escapeHtml(node.value)}</span><span>${escapeHtml(statusText[node.status]||node.status)}</span></div></div>`;
    }));
  }

  function renderResult() {
    const engine = window.FinRiskDecisionMock;
    const application = window.FinRiskLoan.load();
    const validation = window.FinRiskLoan.validate(application);
    const scenario = engine.getScenario();
    const assessment = engine.assess(application, scenario);
    const statusLabel = {
      APPROVE: "Đề xuất chấp thuận (MOCK)",
      REVIEW: "Cần xem xét (MOCK)",
      REJECT: "Đề xuất từ chối (MOCK)",
      INVALID_INPUT: "Dữ liệu chưa hợp lệ",
      UNAVAILABLE: "Chưa có kết quả ML thật"
    };
    const checks = [
      ["Hồ sơ nhập liệu", validation.valid ? "PASS" : "BLOCKED", validation.valid ? "Dữ liệu qua kiểm tra #10" : `${Object.keys(validation.errors).length} trường cần sửa`],
      ["Nguồn dữ liệu", "REVIEW", "MOCK · localStorage, chưa có API/PostgreSQL"],
      ["Kết quả ML", "REVIEW", "Điểm rủi ro là kịch bản giả lập, không phải mô hình thật"],
      ["Chính sách tín dụng", "REVIEW", "Ngưỡng chỉ phục vụ trình diễn, chưa được leader duyệt"]
    ];
    const passCount = checks.filter((item) => item[1] === "PASS").length;
    setHeader("Đánh giá tín dụng · FinRisk", "#12 · Loan Decision Engine UI: kết quả MOCK minh họa, chưa phải quyết định cấp tín dụng thật.");
    $("#content").innerHTML = `
      <div class="workspace-screen release-screen finrisk-decision-screen">
        <div class="screen-summary-grid release-summary-grid">
          <div class="screen-summary-card"><span>Application</span><strong>${escapeHtml(application.customer_id || "—")}</strong><small>Hồ sơ MOCK từ #09</small></div>
          <div class="screen-summary-card"><span>Financial validation</span><strong>${validation.valid ? "PASS" : "BLOCKED"}</strong><small>Kiểm tra #10</small></div>
          <div class="screen-summary-card"><span>Decision source</span><strong>MOCK</strong><small>Không chạy ML thật</small></div>
          <div class="screen-summary-card"><span>Approval authority</span><strong>NONE</strong><small>Không phát hành quyết định thật</small></div>
        </div>
        <section class="workspace-panel release-hero-panel">
          <div class="release-hero-copy"><span class="panel-eyebrow">#12 · LOAN DECISION ENGINE · MOCK ONLY</span><h2>${escapeHtml(statusLabel[assessment.status] || assessment.status)}</h2><p>${escapeHtml(assessment.message)} Mọi kết quả chỉ dùng để thử giao diện, không có giá trị phê duyệt.</p></div>
          <div class="release-state-stack"><span>Risk score</span><strong>${assessment.score === null ? "N/A" : escapeHtml(assessment.score + "/100")}</strong><span>Result</span><strong>${escapeHtml(assessment.status)}</strong></div>
        </section>
        <div class="release-layout">
          <section class="workspace-panel gate-checklist-panel">
            <div class="panel-heading"><div><span class="panel-eyebrow">MOCK ASSESSMENT INPUT</span><h2>Kịch bản đánh giá tín dụng</h2><p>Thay đổi kịch bản để xem các trạng thái giao diện; không thay đổi dữ liệu hồ sơ.</p></div><span class="panel-status">MOCK · Not approved policy</span></div>
            <div class="field"><label for="finrisk-risk-scenario">Điểm rủi ro giả lập</label><select id="finrisk-risk-scenario">
              <option value="low" ${scenario === "low" ? "selected" : ""}>Rủi ro thấp · 20/100</option>
              <option value="medium" ${scenario === "medium" ? "selected" : ""}>Rủi ro trung bình · 55/100</option>
              <option value="high" ${scenario === "high" ? "selected" : ""}>Rủi ro cao · 85/100</option>
              <option value="missing" ${scenario === "missing" ? "selected" : ""}>Không có điểm ML</option>
            </select></div>
            <div class="gate-check-list">${checks.map(([name,status,detail]) => `<div class="gate-check-row ${status.toLowerCase()}"><span class="gate-check-icon">${status === "PASS" ? "✓" : status === "REVIEW" ? "!" : "×"}</span><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div>${pill(status)}</div>`).join("")}</div>
            <div class="notice warning compact-notice">Chỉ có ${passCount}/${checks.length} điều kiện dữ liệu đạt; các mục REVIEW là phụ thuộc chưa có thật. Không được dùng màn hình này để ra quyết định cho khách hàng.</div>
          </section>
          <aside class="workspace-panel masked-result-panel">
            <span class="panel-eyebrow">ASSESSMENT RESULT · MOCK</span>
            <div class="masked-result-visual"><span>Gợi ý trạng thái (MOCK)</span><strong>${escapeHtml(assessment.status)}</strong><small>${escapeHtml(assessment.reason)}</small></div>
            <div class="derived-list"><div><span>Customer ID</span><strong>${escapeHtml(application.customer_id || "—")}</strong></div><div><span>Monthly income</span><strong>${escapeHtml(application.monthly_income || "—")} VND</strong></div><div><span>Loan amount</span><strong>${escapeHtml(application.loan_amount || "—")} VND</strong></div><div><span>Loan term</span><strong>${escapeHtml(application.loan_term_months || "—")} months</strong></div></div>
            <button class="btn" type="button" id="finrisk-decision-edit">Chỉnh sửa hồ sơ vay</button>
          </aside>
        </div>
        <section class="workspace-panel release-reasons-panel"><div class="panel-heading compact-heading"><div><span class="panel-eyebrow">WHY THIS STATUS?</span><h2>Giải thích kết quả minh họa</h2></div><span class="panel-status">${assessment.reasons.length} reason(s)</span></div><div class="release-reason-grid">${assessment.reasons.map((reason,i) => `<article class="release-reason-card"><span class="code">MOCK-${String(i+1).padStart(2,"0")}</span><p>${escapeHtml(reason)}</p></article>`).join("")}</div></section>
      </div>`;
    $("#finrisk-risk-scenario").addEventListener("change", event => {
      engine.setScenario(event.target.value);
      renderResult();
      showToast("Đã đổi kịch bản đánh giá MOCK.", "info");
    });
    $("#finrisk-decision-edit").addEventListener("click", () => {window.location.hash = "data";});
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
    setHeader("Báo cáo tín dụng · FinRisk", "#13 · Xem trước và xuất báo cáo HTML / JSON từ dữ liệu MOCK; không phải quyết định cho vay thật.");
    const engine = window.FinRiskCreditReport;
    if (!engine || !window.FinRiskLoan || !window.FinRiskDecisionMock) {
      $("#content").innerHTML = `<div class="workspace-screen">${emptyState("Không thể tạo báo cáo", "Thiếu module báo cáo tín dụng FinRisk.", "alert")}</div>`;
      return;
    }
    let report;
    try { report = engine.build(window.FinRiskLoan.load(), window.FinRiskDecisionMock.getScenario()); }
    catch (error) {
      $("#content").innerHTML = `<div class="workspace-screen">${emptyState("Không thể tạo báo cáo", error.message, "alert")}</div>`;
      return;
    }
    const data = report.application;
    const validation = report.validation;
    const assessment = report.assessment;
    const formatMoney = (value) => Number.isFinite(Number(value)) && String(value).trim() ? `${Number(value).toLocaleString("vi-VN")} VND` : "—";
    $("#content").innerHTML = `
      <div class="workspace-screen export-screen finrisk-credit-report-screen">
        <div class="screen-summary-grid">
          <div class="screen-summary-card"><span>Report</span><strong>CREDIT</strong><small>MOCK · INTERNAL ONLY</small></div>
          <div class="screen-summary-card"><span>Customer ID</span><strong class="code compact-code">${escapeHtml(data.customer_id || "—")}</strong><small>Hồ sơ #09</small></div>
          <div class="screen-summary-card"><span>Validation #10</span><strong>${validation.valid ? "PASS" : "INVALID"}</strong><small>${Object.keys(validation.errors).length} lỗi dữ liệu</small></div>
          <div class="screen-summary-card"><span>Decision #12</span><strong>${escapeHtml(assessment.status)}</strong><small>${assessment.score === null ? "Không có điểm ML" : `${assessment.score}/100 · MOCK`}</small></div>
        </div>
        <div class="export-center-layout">
          <section class="workspace-panel export-products-panel">
            <div class="panel-heading"><div><span class="panel-eyebrow">CREDIT REPORT · #13</span><h2>Xuất báo cáo tín dụng</h2><p>Dữ liệu lấy từ hồ sơ #09, validation #10 và kịch bản #12 hiện tại. Tất cả xử lý trong trình duyệt.</p></div>${pill("MOCK", "WARNING")}</div>
            <div class="export-product-grid">
              <article class="export-product-card html-product"><div class="export-file-icon">HTML</div><h3>Báo cáo HTML</h3><p>Bản đọc độc lập gồm hồ sơ, kiểm tra dữ liệu, đánh giá, lý do và lưu ý MOCK.</p><button id="finrisk-report-html" class="btn primary">${icon("download", 16)} Xuất HTML</button></article>
              <article class="export-product-card json-product"><div class="export-file-icon">JSON</div><h3>Báo cáo JSON</h3><p>Dữ liệu có cấu trúc phục vụ kiểm thử và tích hợp API trong tương lai.</p><button id="finrisk-report-json" class="btn">${icon("download", 16)} Xuất JSON</button></article>
            </div>
            <div class="notice danger compact-notice"><strong>MOCK / NOT A CREDIT DECISION:</strong> Dữ liệu lưu localStorage, điểm và ngưỡng đánh giá là giả lập. Chưa tích hợp ML, policy được duyệt hoặc PostgreSQL. Không sử dụng để phê duyệt khoản vay.</div>
          </section>
          <aside class="workspace-panel report-preview-panel">
            <div class="panel-heading compact-heading"><div><span class="panel-eyebrow">LIVE PREVIEW</span><h2>Xem trước báo cáo</h2></div></div>
            <div class="report-preview-list">
              <div><span>Khách hàng</span><strong>${escapeHtml(data.full_name || "—")}</strong></div>
              <div><span>Mã hồ sơ</span><strong class="code">${escapeHtml(data.customer_id || "—")}</strong></div>
              <div><span>Thu nhập tháng</span><strong>${escapeHtml(formatMoney(data.monthly_income))}</strong></div>
              <div><span>Số tiền vay</span><strong>${escapeHtml(formatMoney(data.loan_amount))}</strong></div>
              <div><span>Thời hạn</span><strong>${escapeHtml(data.loan_term_months || "—")} tháng</strong></div>
              <div><span>Validation</span><strong>${validation.valid ? "PASS" : "INVALID"}</strong></div>
              <div><span>Điểm rủi ro</span><strong>${assessment.score === null ? "N/A" : `${assessment.score}/100 (MOCK)`}</strong></div>
              <div><span>Gợi ý</span><strong>${escapeHtml(assessment.status)} (MOCK)</strong></div>
            </div>
          </aside>
        </div>
      </div>`;
    $("#finrisk-report-html").addEventListener("click", event => runBusyAction(event.currentTarget, "Đang tạo HTML…", () => triggerDownload(engine.fileName(report, "html"), "text/html;charset=utf-8", engine.renderHtml(report))));
    $("#finrisk-report-json").addEventListener("click", event => runBusyAction(event.currentTarget, "Đang tạo JSON…", () => triggerDownload(engine.fileName(report, "json"), "application/json;charset=utf-8", engine.renderJson(report))));
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
            <div class="pipeline-step blocked"><span>04</span><strong>Đánh giá tín dụng</strong><small>${escapeHtml(state.release.resultVisibility)}</small></div><i>→</i>
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
