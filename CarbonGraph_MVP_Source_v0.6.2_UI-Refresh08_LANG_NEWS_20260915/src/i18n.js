(function () {
  "use strict";

  const STORAGE_KEY = "cg-language";
  const DEFAULT_LANGUAGE = "vi";
  const VIETNAMESE_RE = /[À-ỹĐđ]/;

  const exact = new Map(Object.entries({
    "Giải pháp": "Solutions",
    "Quy trình": "Workflow",
    "So sánh": "Compare",
    "Hỏi đáp": "FAQ",
    "Mở workspace": "Open workspace",
    "Tổng quan": "Overview",
    "Bằng chứng": "Evidence",
    "Tổng quan sản phẩm": "Product overview",
    "Trạng thái kỹ thuật": "Technical status",
    "Sản phẩm của TerraMetric": "A TerraMetric product",
    "Ghi chú vận hành": "Operational notes",
    "Dự án": "Project",
    "Đóng": "Close",
    "Đang xử lý…": "Processing…",
    "Thao tác không hoàn tất.": "The action could not be completed.",
    "Mở dữ liệu demo": "Open demo data",
    "Xem Evidence Graph": "View Evidence Graph",
    "Hồ sơ hiện đã đủ để mở numeric release chưa?": "Is the current evidence set ready for numeric release?",
    "Kết luận runtime": "Runtime conclusion",
    "Mở Release Gate": "Open Release Gate",
    "Hướng mở rộng: kiểm kê, báo cáo và phân tích dữ liệu phát thải": "Roadmap: inventory, reporting and emissions-data analytics",
    "Kiểm kê": "Inventory",
    "Báo cáo": "Reporting",
    "Dự báo": "Forecasting",
    "So sánh quy trình dữ liệu": "Compare data workflows",
    "Cần xử lý trước release": "Requires action before release",
    "Không có blocker": "No blockers",
    "Không có validation issue": "No validation issues",
    "Không có issue phù hợp bộ lọc": "No issues match this filter",
    "Không có release blocker": "No release blockers",
    "Chưa đủ điều kiện phát hành kết quả số": "Not ready to release numeric results",
    "Người duyệt UAT": "UAT reviewer",
    "Họ và tên reviewer": "Reviewer full name",
    "Ghi chú người test": "Tester notes",
    "Mục đích:": "Purpose:",
    "Dữ liệu/mẫu cần test": "Test data / sample",
    "Các bước": "Steps",
    "Đạt khi hiện": "Pass criteria",
    "Không đạt nếu": "Fail if",
    "Cách sửa/điều tra": "Fix / investigate",
    "Bằng chứng cần lưu": "Evidence to retain",
    "Lưu reviewer": "Save reviewer",
    "SẴN SÀNG XUẤT": "READY TO EXPORT",
    "CHƯA ĐỦ ĐIỀU KIỆN": "NOT READY",
    "Đang tạo HTML…": "Generating HTML…",
    "Đang tạo JSON…": "Generating JSON…",
    "Đang tạo UAT JSON…": "Generating UAT JSON…",
    "Sản phẩm": "Product",
    "Quy trình xử lý dữ liệu": "Data processing workflow",
    "Tính năng": "Capabilities",
    "Lợi ích": "Benefits",
    "Tin tức": "News",
    "TIN TỨC & KIẾN THỨC": "NEWS & INSIGHTS",
    "CBAM, thuế carbon và những chuyển động của ngành thép": "CBAM, carbon pricing and shifts across the steel industry",
    "Các nguồn dưới đây giúp theo dõi thay đổi chính sách, áp lực chi phí carbon và những thách thức thương mại mà doanh nghiệp thép đang đối mặt tại Việt Nam và quốc tế.": "These sources track policy changes, carbon-cost pressure, and trade challenges facing steel companies in Vietnam and internationally.",
    "Xem tin CBAM chính thức": "View official CBAM news",
    "VIỆT NAM": "VIETNAM",
    "QUỐC TẾ": "INTERNATIONAL",
    "Đọc tiếp": "Read more",
    "CBAM: Doanh nghiệp Việt cần chuẩn bị gì trước yêu cầu mới của thị trường EU?": "CBAM: What should Vietnamese businesses prepare for new EU market requirements?",
    "Bài viết nhấn mạnh nhu cầu hoàn thiện hệ thống đo lường, báo cáo và kiểm chứng phát thải khi CBAM bước vào giai đoạn chính thức.": "The article highlights the need to strengthen emissions measurement, reporting and verification as CBAM enters its definitive phase.",
    "Doanh nghiệp nguy cơ mất 100 USD mỗi tấn thép sang EU vì phát thải": "Businesses risk losing USD 100 per tonne of steel exported to the EU due to emissions",
    "Một góc nhìn thị trường về rủi ro chi phí carbon đối với hàng phát thải cao, đặc biệt là thép xuất khẩu vào EU.": "A market perspective on carbon-cost exposure for emissions-intensive goods, especially steel exported to the EU.",
    "Thị trường thép 2026: Sản lượng tăng, xuất khẩu đối mặt nhiều rào cản": "Steel market 2026: output rises while exports face multiple barriers",
    "Ngành thép Việt Nam tăng trưởng sản xuất nhưng tiếp tục chịu sức ép từ hạn ngạch, phòng vệ thương mại và các yêu cầu mới tại EU.": "Vietnam's steel sector is expanding production while continuing to face quotas, trade-defense measures and new EU requirements.",
    "CBAM definitive regime: nghĩa vụ chính thức áp dụng từ năm 2026": "CBAM definitive regime: formal obligations apply from 2026",
    "Nguồn chính thức về cơ chế CBAM từ 2026, bao gồm khai báo phát thải hàm chứa và nghĩa vụ liên quan tới chứng chỉ CBAM.": "Official information on CBAM from 2026, including embedded-emissions declarations and CBAM certificate obligations.",
    "EU tiếp tục tăng cường CBAM và mở rộng kiểm soát rò rỉ carbon": "EU continues strengthening CBAM and carbon-leakage controls",
    "Ủy ban châu Âu cho biết các bước tăng cường CBAM nhằm củng cố quá trình chuyển đổi công nghiệp sạch và hạn chế carbon leakage.": "The European Commission says stronger CBAM measures support the clean industrial transition and address carbon leakage.",
    "Chi phí đầu vào tiếp tục gây sức ép lên ngành thép châu Âu": "Input costs continue to pressure Europe's steel industry",
    "Reuters ghi nhận chi phí phế liệu, vận tải và nhiên liệu đang bào mòn lợi ích từ các biện pháp hỗ trợ ngành thép tại EU.": "Reuters reports that scrap, freight and fuel costs are eroding gains from measures supporting the EU steel sector."
  }));

  // Ordered longest-first. These replacements cover dynamic strings produced by app.js,
  // validation rules, demo data and the UAT catalog without changing business logic.
  const phrases = [
    ["CarbonGraph hiện là MVP nghiên cứu. Hệ thống hỗ trợ cấu trúc hóa và kiểm soát dữ liệu, không thay thế đơn vị verifier và chưa phát hành numeric emissions khi evidence thực tế chưa đủ.", "CarbonGraph is currently a research MVP. It supports data structuring and control, does not replace an independent verifier, and does not release numeric emissions while real-world evidence remains insufficient."],
    ["CarbonGraph là workspace dữ liệu CBAM cho ngành thép, tập trung vào chuẩn hóa dữ liệu, quản lý bằng chứng, truy vết evidence graph và kiểm soát working release theo cơ chế fail-closed.", "CarbonGraph is a CBAM data workspace for steel, focused on data standardization, evidence management, Evidence Graph traceability, and fail-closed working-release control."],
    ["Landing + product narrative ở phía trên, operational workspace ở các module bên dưới.", "Landing page and product narrative above; operational workspace modules below."],
    ["CarbonGraph là workspace local giúp chuẩn hóa dữ liệu, phát hiện thiếu sót và truy vết", "CarbonGraph is a local workspace that standardizes data, detects gaps, and traces"],
    ["trước khi một working result được phép đi xa hơn.", "before a working result is allowed to proceed further."],
    ["Widget này chỉ đọc trạng thái runtime hiện tại. Nó không thay đổi dữ liệu, không đóng R-006 và không đánh giá compliance.", "This widget only reads the current runtime state. It does not change data, close R-006, or evaluate compliance."],
    ["Các card dưới đây mô tả hướng mở rộng sản phẩm, không phải module đã hoàn thiện trong RC1. Lõi đang chạy vẫn là data control, evidence trace, validation và release guardrail.", "The cards below describe product-roadmap directions, not completed RC1 modules. The running core remains data control, evidence traceability, validation, and release guardrails."],
    ["Theo dõi khoảng trống bằng chứng HRC và giữ synthetic substitute tách biệt khỏi REAL_REQUIRED evidence.", "Track HRC evidence gaps while keeping synthetic substitutes separate from REAL_REQUIRED evidence."],
    ["Issue management dashboard cho C3; mỗi Apply sẽ chạy lại rule engine và cập nhật candidate classification.", "C3 issue-management dashboard; every Apply reruns the rule engine and updates candidate classification."],
    ["Evidence Graph workspace: xem node, relation, integrity và đường trace từ batch tới result/gate.", "Evidence Graph workspace: inspect nodes, relations, integrity, and the trace path from batch to result/gate."],
    ["Readiness/gate dashboard cho C6; giải thích rõ điều kiện nào đang giữ numeric result ở BLOCKED/MASKED.", "C6 readiness/gate dashboard explaining which conditions keep the numeric result BLOCKED/MASKED."],
    ["Report Center cho C7: tạo working-only HTML và trace JSON trực tiếp trên localhost, không phát hành numeric emission result.", "C7 Report Center: generate working-only HTML and trace JSON directly on localhost without releasing numeric emissions."],
    ["C8 pipeline console: quan sát toàn luồng Input → Validation → Graph → Gate → Working Export và các technical safety checks.", "C8 pipeline console: observe the full Input → Validation → Graph → Gate → Working Export flow and technical safety checks."],
    ["QA console cho D1/D3/D4/D5 manual acceptance; UAT record tách biệt hoàn toàn khỏi runtime release/compliance state.", "QA console for D1/D3/D4/D5 manual acceptance; the UAT record remains completely separate from runtime release/compliance state."],
    ["Nhập working data theo từng nhóm; Apply sẽ validate, rebuild graph và cập nhật release state ngay trên localhost.", "Enter working data by group; Apply validates, rebuilds the graph, and updates release state locally."],
    ["Working data đã được lưu và pipeline derived-state đã chạy lại.", "Working data was saved and the derived-state pipeline was rerun."],
    ["Working state đã trở về synthetic baseline.", "Working state has been reset to the synthetic baseline."],
    ["Validation, graph và release state đã được tính lại.", "Validation, graph, and release state have been recomputed."],
    ["End-to-End technical safety checks đã được recompute.", "End-to-End technical safety checks have been recomputed."],
    ["Hoàn tất manual evidence, định danh reviewer thật và chỉ export UAT JSON khi toàn bộ case đạt.", "Complete manual evidence, identify the actual reviewer, and export UAT JSON only when every case passes."],
    ["Tên này đi vào UAT JSON và phải là người thực sự review.", "This name is stored in the UAT JSON and must identify the actual reviewer."],
    ["Export chỉ mở khi 10/10 PASS + reviewer đã định danh.", "Export is enabled only when 10/10 cases PASS and a reviewer is identified."],
    ["Manual UAT không thay đổi runtime, không đóng R-006, không đánh giá compliance và không quyết định Gate 3.", "Manual UAT does not change runtime state, close R-006, evaluate compliance, or decide Gate 3."],
    ["Không dùng placeholder/UNSPECIFIED_REVIEWER.", "Do not use a placeholder or UNSPECIFIED_REVIEWER."],
    ["Cần đủ 10/10 PASS và họ tên reviewer thực tế trước khi xuất UAT.", "All 10/10 cases must PASS and an actual reviewer name is required before UAT export."],
    ["Manual UAT result và reviewer đã được reset.", "Manual UAT results and reviewer have been reset."],
    ["Reviewer đang để trống.", "Reviewer is blank."],
    ["Reviewer đã lưu:", "Reviewer saved:"],
    ["Lần kiểm tra gần nhất:", "Last checked:"],
    ["Máy/trình duyệt, kết quả quan sát, link/filename bằng chứng...", "Device/browser, observed result, evidence link/filename..."],
    ["Nhập họ và tên người thực sự duyệt", "Enter the actual reviewer's full name"],

    ["Chưa được khóa bằng real evidence", "Not locked by real evidence"],
    ["SEE đang blank; không mặc định thành 0", "SEE is blank; it does not default to 0"],
    ["OPEN — vẫn chặn numeric release", "OPEN — numeric release remains blocked"],
    ["CHƯA ĐỦ — GIỮ BLOCKED / MASKED", "NOT READY — KEEP BLOCKED / MASKED"],
    ["Thiếu dữ liệu → REVIEW/BLOCKED", "Missing data → REVIEW/BLOCKED"],
    ["Result nối tới rule, issue và gate", "Result links to rule, issue, and gate"],
    ["Không copy synthetic vào field real", "Synthetic values are never copied into real fields"],
    ["Không tự biến missing thành 0", "Missing values never become 0 automatically"],
    ["Không có demo substitute", "No demo substitute"],
    ["SYNTHETIC_ONLY · không đóng real gap", "SYNTHETIC_ONLY · does not close real gap"],
    ["Working state hiện không sinh issue nào.", "The current working state produces no issues."],
    ["Chọn ALL hoặc một severity khác để tiếp tục.", "Choose ALL or another severity to continue."],
    ["Lane này chưa có entity tương ứng trong working graph.", "This lane has no corresponding entity in the working graph."],
    ["Release engine hiện không trả về reason chặn nào.", "The release engine currently returns no blocking reasons."],
    ["Không có tCO₂e/SEE numeric output trong C6.", "No tCO₂e/SEE numeric output is released in C6."],
    ["Technical safety flow; không phải compliance decision.", "Technical safety flow; not a compliance decision."],
    ["Diễn giải đúng:", "Correct interpretation:"],
    ["chỉ chứng minh các module local nối đúng và guardrail hoạt động", "only demonstrates that local modules connect correctly and guardrails operate"],
    ["đã được tạo trong trình duyệt local.", "was generated in the local browser."],
    ["đã được ghi", "was recorded as"],

    ["Chuẩn hóa dữ liệu", "Standardize data"],
    ["quản lý bằng chứng", "manage evidence"],
    ["truy vết", "trace"],
    ["bằng chứng", "evidence"],
    ["dữ liệu", "data"],
    ["Dữ liệu", "Data"],
    ["giả lập", "synthetic"],
    ["phát thải", "emissions"],
    ["kết quả", "result"],
    ["Kết quả", "Result"],
    ["thẩm tra", "verification"],
    ["kiểm tra", "check"],
    ["Kiểm tra", "Check"],
    ["quy tắc", "rules"],
    ["Quy tắc", "Rules"],
    ["cảnh báo", "warning"],
    ["Cảnh báo", "Warning"],
    ["rủi ro", "risk"],
    ["Rủi ro", "Risk"],
    ["trạng thái", "status"],
    ["Trạng thái", "Status"],
    ["nguồn", "source"],
    ["Nguồn", "Source"],
    ["phạm vi", "scope"],
    ["Phạm vi", "Scope"],
    ["được chọn", "is selected"],
    ["chưa được khóa", "is not locked"],
    ["bắt buộc", "required"],
    ["không được", "must not"],
    ["Không được", "Must not"],
    ["không thể", "cannot"],
    ["Không thể", "Cannot"],
    ["không có", "no"],
    ["Không có", "No"],
    ["chưa có", "not yet available"],
    ["Chưa có", "Not yet available"],
    ["đang", "is"],
    ["Đang", "Currently"],
    ["phải", "must"],
    ["Phải", "Must"],
    ["cần", "need"],
    ["Cần", "Need"],
    ["để", "to"],
    ["khi", "when"],
    ["nếu", "if"],
    ["Nếu", "If"],
    ["và", "and"],
    [" hoặc ", " or "],
    ["theo", "according to"],
    ["trong", "in"],
    ["trước", "before"],
    ["sau", "after"],
    ["vẫn", "still"],
    ["hiện", "currently"],
    ["mở", "open"],
    ["Mở", "Open"],
    ["đóng", "close"],
    ["Đóng", "Close"],
    ["lưu", "save"],
    ["Lưu", "Save"],
    ["xuất", "export"],
    ["Xuất", "Export"],
    ["nhập", "enter"],
    ["Nhập", "Enter"],
    ["chạy", "run"],
    ["Chạy", "Run"],
    ["xóa", "remove"],
    ["Xóa", "Remove"],
    ["sửa", "fix"],
    ["Sửa", "Fix"],
    ["chọn", "select"],
    ["Chọn", "Select"],
    ["đúng", "correct"],
    ["Đúng", "Correct"],
    ["sai", "incorrect"],
    ["Sai", "Incorrect"],
    ["hợp lệ", "valid"],
    ["thiếu", "missing"],
    ["Thiếu", "Missing"],
    ["thật", "real"],
    ["người duyệt", "reviewer"],
    ["Người duyệt", "Reviewer"],
    ["người test", "tester"],
    ["bản demo", "demo build"],
    ["bản build", "build"],
    ["trình duyệt", "browser"],
    ["cửa sổ", "window"],
    ["thời điểm", "timestamp"],
    ["đường dẫn", "path"],
    ["liên kết", "link"],
    ["màn hình", "screen"],
    ["trường", "field"],
    ["giá trị", "value"],
    ["thay đổi", "change"],
    ["hiển thị", "display"],
    ["tạo", "generate"],
    ["mẫu", "sample"],
    ["quy trình", "workflow"],
    ["chuỗi", "chain"],
    ["sẵn sàng", "ready"],
    ["điều kiện", "condition"],
    ["phê duyệt", "approval"],
    ["duyệt", "review"],
    ["giữ", "keep"],
    ["khóa", "lock"],
    ["định danh", "identity"],
    ["Định danh", "Identity"],
    ["áp dụng", "apply"],
    ["khôi phục", "restore"],
    ["lỗi", "error"],
    ["Lỗi", "Error"],
    ["dừng", "stop"],
    ["Dừng", "Stop"],
    ["tiếp tục", "continue"],
    ["hoàn tất", "complete"],
    ["Hoàn tất", "Complete"],
    ["chứng minh", "demonstrate"],
    ["Xác nhận", "Confirm"],
    ["xác nhận", "confirm"],
    ["đối chiếu", "verify"],
    ["Đối chiếu", "Verify"],
    ["lần lượt", "sequentially"],
    ["tương ứng", "corresponding"],
    ["toàn bộ", "all"],
    ["mỗi", "each"],
    ["Mỗi", "Each"],
    ["một", "one"],
    ["Một", "One"],
    ["nhiều", "multiple"],
    ["ngày", "date"],
    ["năm", "year"],
    ["cổng", "port"],
    ["ảnh", "screenshot"],
    ["Ảnh", "Screenshot"],
    ["dòng", "line"],
    ["từ khóa", "keywords"],
    ["gói", "package"],
    ["nội bộ", "internal"],
    ["kỹ thuật", "technical"],
    ["thực tế", "real-world"],
    ["tự động", "automated"],
    ["thủ công", "manual"],
    ["cục bộ", "locally"],
    ["được phép", "is allowed"],
    ["không phải", "is not"],
    ["Không phải", "Not"],
    ["đánh giá", "evaluate"],
    ["quyết định", "decision"],
    ["ngành thép", "steel sector"],
    ["cơ sở", "facility"],
    ["nhà máy", "plant"],
    ["chi nhánh", "site"],
    ["Điện lưới", "Grid electricity"],
    ["Nhiên liệu", "Fuel"],
    ["Chuỗi giá trị", "Value chain"],
    ["Kết quả phát thải", "Emissions result"],
    ["Hệ thống kiểm kê toàn diện", "Comprehensive inventory system"],
    ["Xuất báo cáo theo nhiều định dạng", "Export reports in multiple formats"],
    ["Mẫu báo cáo KNK", "GHG report template"],
    ["Tính toán & phân tích kịch bản", "Scenario calculation & analysis"],
    ["Tổng quan phát thải", "Emissions overview"],
    ["Xu hướng", "Trend"],
    ["Mục tiêu", "Target"],
    ["Tổng quan dự án", "Project overview"],
    ["Câu hỏi thường gặp", "Frequently asked questions"],
    ["Ghi chú vận hành", "Operational notes"]
  ].sort((a, b) => b[0].length - a[0].length);

  const textOriginal = new Map();
  const textTranslated = new Map();
  const attrOriginal = new Map();
  let language = DEFAULT_LANGUAGE;
  let observer;

  function preserveWhitespace(original, translated) {
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    return leading + translated.trim() + trailing;
  }

  function translateString(input) {
    if (!input || !VIETNAMESE_RE.test(input)) return input;
    const trimmed = input.trim();
    if (exact.has(trimmed)) return preserveWhitespace(input, exact.get(trimmed));
    let out = input;
    phrases.forEach(([vi, en]) => {
      if (out.includes(vi)) out = out.split(vi).join(en);
    });
    return out;
  }

  function translateTextNode(node) {
    const current = node.nodeValue || "";
    if (!current.trim()) return;
    const lastTranslation = textTranslated.get(node);
    if (lastTranslation === current) return;
    if (!textOriginal.has(node) || textOriginal.get(node) !== current) textOriginal.set(node, current);
    const translated = translateString(current);
    if (translated !== current) {
      textTranslated.set(node, translated);
      node.nodeValue = translated;
    }
  }

  function translateAttributes(element) {
    ["title", "aria-label", "placeholder"].forEach((name) => {
      if (!element.hasAttribute || !element.hasAttribute(name)) return;
      const key = `${name}`;
      if (!attrOriginal.has(element)) attrOriginal.set(element, {});
      const originalSet = attrOriginal.get(element);
      const current = element.getAttribute(name) || "";
      if (!originalSet[key] || originalSet[key] === current) originalSet[key] = current;
      const translated = translateString(originalSet[key]);
      if (translated !== current) element.setAttribute(name, translated);
    });
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.currentNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else if (node.nodeType === Node.ELEMENT_NODE) translateAttributes(node);
      node = walker.nextNode();
    }
  }

  function restoreVietnamese() {
    if (observer) observer.disconnect();
    textOriginal.forEach((value, node) => {
      if (node && node.isConnected) node.nodeValue = value;
    });
    attrOriginal.forEach((values, element) => {
      if (!element || !element.isConnected) return;
      Object.entries(values).forEach(([name, value]) => element.setAttribute(name, value));
    });
    if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder"] });
  }

  function syncLanguageButton() {
    const button = document.getElementById("language-toggle");
    if (!button) return;
    button.textContent = language === "vi" ? "VI" : "EN";
    button.setAttribute("aria-label", language === "vi" ? "Ngôn ngữ hiện tại: Tiếng Việt. Chuyển sang English" : "Current language: English. Switch to Vietnamese");
    button.title = language === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt";
    document.documentElement.lang = language;
  }

  function applyLanguage(nextLanguage, animate = false) {
    language = nextLanguage === "en" ? "en" : "vi";
    try { window.localStorage.setItem(STORAGE_KEY, language); } catch (_) {}
    const button = document.getElementById("language-toggle");
    if (animate && button) {
      button.classList.remove("is-switching");
      void button.offsetWidth;
      button.classList.add("is-switching");
      window.setTimeout(() => button.classList.remove("is-switching"), 300);
    }
    if (language === "en") walk(document.body);
    else restoreVietnamese();
    syncLanguageButton();
    document.dispatchEvent(new CustomEvent("cg:languagechange", { detail: { language } }));
  }

  function initObserver() {
    observer = new MutationObserver((mutations) => {
      if (language !== "en") return;
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") translateTextNode(mutation.target);
        if (mutation.type === "attributes") translateAttributes(mutation.target);
        mutation.addedNodes?.forEach((node) => walk(node));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder"] });
  }

  function init() {
    const button = document.getElementById("language-toggle");
    if (!button) return;
    button.addEventListener("click", () => applyLanguage(language === "vi" ? "en" : "vi", true));
    initObserver();
    let saved = DEFAULT_LANGUAGE;
    try { saved = window.localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE; } catch (_) {}
    applyLanguage(saved === "en" ? "en" : "vi");
  }

  init();
})();
