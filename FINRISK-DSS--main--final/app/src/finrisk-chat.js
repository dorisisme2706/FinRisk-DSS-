(function () {
  "use strict";
  const messages = {
    toggle: ["Chat với FinRisk", "Chat with FinRisk"],
    title: ["Trợ lý FinRisk", "FinRisk assistant"],
    new: ["Cuộc trò chuyện mới", "New chat"],
    close: ["Đóng chat", "Close chat"],
    notice: ["Bản demo học thuật. Không nhập thông tin cá nhân hoặc dữ liệu tài chính thật.", "Academic demo. Do not enter personal information or real financial data."],
    id: ["ID hồ sơ (không bắt buộc)", "Profile ID (optional)"],
    idPlaceholder: ["Để trống để hỏi FAQ", "Leave blank for FAQ"],
    question: ["Câu hỏi", "Question"],
    placeholder: ["Nhập câu hỏi về FinRisk DSS…", "Ask about FinRisk DSS…"],
    welcome: ["Xin chào! Bạn có thể hỏi về đồ án hoặc nhập ID hồ sơ đã có trong CORE4 để yêu cầu giải thích.", "Hello! Ask about the project, or enter an existing CORE4 profile ID for an explanation."],
    ai: ["Trợ lý AI", "AI assistant"],
    facts: ["Dữ liệu hồ sơ đã xác minh", "Verified profile facts"],
    review: ["Có tín hiệu đề nghị chuyên viên xem xét (không phải quyết định duyệt/từ chối).", "Manual review signal (not an approval/rejection decision)."],
    noReview: ["Không có tín hiệu review theo ngưỡng demo (không phải quyết định duyệt/từ chối).", "No review signal under the demo threshold (not an approval/rejection decision)."],
    unknownReview: ["Không có trạng thái review.", "Review status unavailable."],
    modelScore: ["Điểm rủi ro mô hình", "Model risk score"],
    threshold: ["Ngưỡng review", "Review threshold"],
    modelVersion: ["Phiên bản mô hình", "Model version"],
    sources: ["Nguồn/ngữ cảnh", "Sources/context"],
    invalidMessage: ["Vui lòng nhập câu hỏi (tối đa 1000 ký tự).", "Enter a question (up to 1000 characters)."],
    invalidID: ["ID hồ sơ không hợp lệ.", "Invalid profile ID."],
    checking: ["Đang kiểm tra cấu hình chat…", "Checking chat configuration…"],
    configured: ["Đã cấu hình. Hãy gửi câu hỏi để kiểm tra kết nối AI.", "Configured. Send a question to test the AI connection."],
    notConfigured: ["Chưa cấu hình Groq API key. Chạy launcher chatbox và nhập key.", "Groq API key is not configured. Run the chat launcher and enter the key."],
    offline: ["Không kết nối được máy chủ. Hãy chạy launcher chatbox và thử tải lại trang.", "Cannot reach the server. Run the chat launcher and reload the page."],
    connected: ["Đã nhận phản hồi từ AI.", "AI response received."],
    send: ["Gửi", "Send"],
    busy: ["Đang gửi…", "Sending…"],
    fallback: ["Chatbot gặp lỗi. Kiểm tra cửa sổ PowerShell để biết trạng thái máy chủ.", "The chatbot encountered an error. Check the PowerShell window for server status."],
    timeout: ["Yêu cầu quá thời gian chờ. Vui lòng thử lại.", "The request timed out. Please try again."],
    CHAT_NOT_CONFIGURED: ["Chưa cấu hình Groq API key. Hãy chạy lại launcher chatbox.", "Groq API key is not configured. Run the chat launcher again."],
    PROVIDER_AUTH_FAILED: ["Groq trả về HTTP 401: API key không hợp lệ hoặc đã bị thu hồi. Tạo key mới và nhập lại khi chạy launcher.", "Groq returned HTTP 401: the API key is invalid or revoked. Create a new key and enter it when starting the launcher."],
    PROVIDER_ACCESS_DENIED: ["Groq trả về HTTP 403: tài khoản hoặc model chưa được cấp quyền. Kiểm tra quyền truy cập model trong Groq Console.", "Groq returned HTTP 403: the account or model is not authorized. Check model access in the Groq Console."],
    PROVIDER_RATE_LIMIT: ["Groq đang giới hạn yêu cầu. Chờ một lúc rồi thử lại.", "Groq rate limit reached. Wait a moment and try again."],
    PROVIDER_UNREACHABLE: ["Không kết nối được Groq. Kiểm tra Internet rồi thử lại.", "Cannot reach Groq. Check your internet connection and try again."],
    PROVIDER_ERROR: ["Groq gặp lỗi khi xử lý. Hãy thử lại sau.", "Groq returned an error. Please try again later."],
    UNSUPPORTED_PROVIDER: ["Nhà cung cấp AI chưa được hỗ trợ.", "The configured AI provider is not supported."],
    UNSUPPORTED_MODEL: ["Mô hình AI chưa được hỗ trợ.", "The configured AI model is not supported."],
    CHAT_BUSY: ["Chatbot đang xử lý yêu cầu khác. Vui lòng đợi rồi thử lại.", "The chatbot is handling another request. Wait and try again."],
    ML_NOT_READY: ["Tra cứu hồ sơ cần snapshot CORE4; hãy để trống ID để hỏi FAQ.", "Profile lookup requires a CORE4 snapshot; leave the ID blank to use FAQ."],
    PROFILE_NOT_FOUND: ["Không tìm thấy ID hồ sơ trong snapshot.", "Profile ID was not found in the snapshot."],
    PROFILE_RESERVED_FOR_FINAL_TEST: ["Hồ sơ này được dành riêng cho kiểm thử cuối.", "This profile is reserved for final testing."]
  };
  const t = key => messages[key]?.[lang() === "en" ? 1 : 0] || key;
  const host = document.createElement("aside");
  host.id = "fr-chat";
  host.setAttribute("data-i18n-ignore", "");
  host.innerHTML = `<button type="button" class="fr-chat-toggle" aria-controls="fr-chat-panel" aria-expanded="false"></button>
    <section id="fr-chat-panel" class="fr-chat-panel" role="region" aria-labelledby="fr-chat-title" hidden>
      <header class="fr-chat-header"><strong id="fr-chat-title"></strong><button type="button" class="fr-chat-clear"></button><button type="button" class="fr-chat-close">×</button></header>
      <p class="fr-chat-notice"></p><p class="fr-chat-status" role="status"></p>
      <div class="fr-chat-log" role="log" aria-live="polite" aria-relevant="additions"></div>
      <form class="fr-chat-form"><label for="fr-chat-id" class="fr-chat-id-label"></label><input id="fr-chat-id" type="text" inputmode="numeric" maxlength="15" autocomplete="off" />
      <label for="fr-chat-message" class="fr-chat-question-label"></label><textarea id="fr-chat-message" rows="2" maxlength="1000" required></textarea>
      <button type="submit" class="fr-chat-send"></button></form>
    </section>`;
  document.body.appendChild(host);
  const find = selector => host.querySelector(selector);
  const toggle = find(".fr-chat-toggle"), panel = find(".fr-chat-panel");
  const log = find(".fr-chat-log"), input = find("#fr-chat-message"), id = find("#fr-chat-id");
  const send = find(".fr-chat-send"), status = find(".fr-chat-status");
  let controller = null, generation = 0, statusKey = "checking", opened = false;
  const lang = () => document.documentElement.lang === "en" ? "en" : "vi";
  function setStatus(key) { statusKey = key; status.textContent = t(key); }
  function cancel() {
    generation += 1;
    if (controller) controller.abort();
    controller = null;
    send.disabled = false;
    send.textContent = t("send");
  }
  function clear() {
    cancel(); log.replaceChildren(); input.value = "";
    const welcome = document.createElement("p"); welcome.className = "fr-chat-welcome";
    welcome.textContent = t("welcome"); log.appendChild(welcome);
  }
  function labels() {
    toggle.textContent = t("toggle");
    find("#fr-chat-title").textContent = t("title");
    find(".fr-chat-clear").textContent = t("new");
    find(".fr-chat-close").setAttribute("aria-label", t("close"));
    find(".fr-chat-notice").textContent = t("notice");
    find(".fr-chat-id-label").textContent = t("id");
    id.placeholder = t("idPlaceholder");
    find(".fr-chat-question-label").textContent = t("question");
    input.placeholder = t("placeholder");
    send.textContent = t(controller ? "busy" : "send");
    setStatus(statusKey);
    const welcome = find(".fr-chat-welcome"); if (welcome) welcome.textContent = t("welcome");
    // Historic user/AI messages retain their original language; only UI labels change.
    host.querySelectorAll("[data-chat-label]").forEach(el => { el.textContent = t(el.dataset.chatLabel); });
  }
  function bubble(role, text) {
    find(".fr-chat-welcome")?.remove();
    const item = document.createElement("div"); item.className = `fr-chat-message fr-chat-${role}`;
    const p = document.createElement("p"); p.textContent = text; item.appendChild(p);
    if (role === "assistant") {
      const label = document.createElement("small"); label.dataset.chatLabel = "ai"; label.textContent = t("ai"); item.appendChild(label);
    }
    log.appendChild(item);
    while (log.children.length > 16) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
    return item;
  }
  function facts(item, data) {
    const context = data.profile_context;
    if (context && typeof context.risk_score === "number") {
      const box = document.createElement("details"); box.open = true;
      const summary = document.createElement("summary"); summary.dataset.chatLabel = "facts"; summary.textContent = t("facts"); box.appendChild(summary);
      const add = (key, value) => {
        const p = document.createElement("p"), label = document.createElement("span");
        label.dataset.chatLabel = key; label.textContent = t(key);
        p.append(label, document.createTextNode(": " + value)); box.appendChild(p);
      };
      const profile = document.createElement("p"); profile.textContent = "ID: " + context.sk_id_curr; box.appendChild(profile);
      add("modelScore", String(context.risk_score));
      if (context.decision_threshold !== undefined) add("threshold", String(context.decision_threshold));
      const review = document.createElement("p");
      review.dataset.chatLabel = context.review_recommended === true ? "review" : context.review_recommended === false ? "noReview" : "unknownReview";
      review.textContent = t(review.dataset.chatLabel); box.appendChild(review);
      add("modelVersion", context.model_version || "—"); item.appendChild(box);
    }
    const details = document.createElement("details"), summary = document.createElement("summary");
    summary.dataset.chatLabel = "sources"; summary.textContent = t("sources"); details.appendChild(summary);
    const p = document.createElement("p"); p.textContent = (data.sources || []).join(", "); details.appendChild(p); item.appendChild(details);
  }
  async function health() {
    setStatus("checking");
    try {
      const response = await fetch("/api/chat/health", { headers: {Accept: "application/json"}, cache: "no-store" });
      const data = await response.json();
      setStatus(response.ok && data.status === "configured_unverified" ? "configured" : "notConfigured");
    } catch (_) { setStatus("offline"); }
  }
  function open(value) {
    panel.hidden = !value; toggle.setAttribute("aria-expanded", String(value));
    if (value) { input.focus(); if (!opened) { opened = true; health(); } }
    else toggle.focus();
  }
  toggle.addEventListener("click", () => open(panel.hidden));
  find(".fr-chat-close").addEventListener("click", () => open(false));
  find(".fr-chat-clear").addEventListener("click", () => { clear(); input.focus(); });
  host.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) open(false); });
  id.addEventListener("input", clear);
  document.addEventListener("finrisk:profilechange", event => {
    const next = event.detail?.profileId == null ? "" : String(event.detail.profileId);
    if (id.value !== next) { id.value = next; clear(); }
  });
  document.addEventListener("cg:languagechange", () => { cancel(); labels(); });
  find(".fr-chat-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (controller) return;
    const question = input.value.trim(), rawID = id.value.trim();
    if (!question || input.value.length > 1000) { bubble("error", t("invalidMessage")); return; }
    if (rawID && !/^[1-9][0-9]{0,14}$/.test(rawID)) { bubble("error", t("invalidID")); return; }
    bubble("user", question); input.value = "";
    const token = ++generation, current = new AbortController(); controller = current;
    send.disabled = true; send.textContent = t("busy");
    const timer = window.setTimeout(() => current.abort(), 40000);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", signal: current.signal, headers: {"Content-Type": "application/json", Accept: "application/json"},
        body: JSON.stringify({message: question, profile_id: rawID || null, language: lang()})
      });
      const data = await response.json();
      if (token !== generation) return;
      if (!response.ok || data.status !== "ok") {
        const translated = t(data.code || "fallback");
        const detail = typeof data.message === "string" ? `\n${data.message}` : "";
        bubble("error", (translated === data.code ? t("fallback") : translated) + detail);
        return;
      }
      if (data.profile_id !== (rawID ? Number(rawID) : null) || typeof data.answer !== "string" || !data.answer.trim()) throw new Error("INVALID_RESPONSE");
      const item = bubble("assistant", data.answer); facts(item, data); setStatus("connected");
      log.scrollTop = log.scrollHeight;
    } catch (error) {
      if (token !== generation) return;
      bubble("error", t(error.name === "AbortError" ? "timeout" : "offline"));
    } finally {
      window.clearTimeout(timer);
      if (token === generation) { controller = null; send.disabled = false; send.textContent = t("send"); }
    }
  });
  clear(); labels();
})();
