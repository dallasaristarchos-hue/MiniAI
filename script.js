const API_URL = "https://miniai-api.dallasaristarchos.workers.dev/api/chat";

const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const conversation = document.querySelector("#conversation");
const sendButton = document.querySelector("#sendButton");
const welcomeMarkup = document.querySelector("#welcome")?.outerHTML || "";
const chatHistory = [];

function getMessageList() {
  let list = conversation.querySelector(".messages");
  if (!list) {
    list = document.createElement("div");
    list.className = "messages";
    conversation.append(list);
  }
  return list;
}

function addMessage(text, sender) {
  const row = document.createElement("div");
  row.className = `message ${sender}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "user" ? "Y" : "✦";
  avatar.setAttribute("aria-hidden", "true");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.append(avatar, bubble);
  getMessageList().append(row);
  conversation.scrollTop = conversation.scrollHeight;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "message";
  row.id = "typingIndicator";
  row.innerHTML = '<div class="avatar" aria-hidden="true">✦</div><div class="bubble"><span class="typing" aria-label="MiniAI is thinking"><i></i><i></i><i></i></span></div>';
  getMessageList().append(row);
  conversation.scrollTop = conversation.scrollHeight;
}

async function requestMiniAI(payload) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data;
      const error = new Error(data.error || `MiniAI service error (${response.status}).`);
      error.status = response.status;
      if (attempt === 0 && [502, 503, 504].includes(response.status)) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 700));
        continue;
      }
      throw error;
    } catch (error) {
      lastError = error;
      if (error.name === "AbortError") {
        if (attempt === 0) continue;
        throw new Error("MiniAI took too long to respond. Please try again in a moment.");
      }
      if (error instanceof TypeError && attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 700));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (lastError instanceof TypeError) {
    throw new Error("MiniAI couldn't reach its server. Check your internet connection and try again.");
  }
  throw lastError || new Error("MiniAI couldn't complete that request. Please try again.");
}

async function sendMessage(text) {
  const message = String(text || "").trim();
  if (!message || sendButton.disabled) return;
  document.querySelector("#welcome")?.remove();
  addMessage(message, "user");
  chatHistory.push({ role: "user", content: message });
  input.value = "";
  input.style.height = "auto";
  sendButton.disabled = true;
  showTyping();
  try {
    const data = await requestMiniAI({ messages: chatHistory.slice(-12) });
    document.querySelector("#typingIndicator")?.remove();
    const reply = String(data.reply || "").trim();
    if (!reply) throw new Error("MiniAI returned an empty answer. Please try asking again.");
    chatHistory.push({ role: "assistant", content: reply });
    addMessage(reply, "assistant");
  } catch (error) {
    document.querySelector("#typingIndicator")?.remove();
    const message = error.status === 429
      ? "MiniAI is receiving too many requests. Please wait a minute and try again."
      : (error.message || "MiniAI couldn't connect. Please try again.");
    addMessage(message, "assistant");
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 130) + "px";
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
document.addEventListener("click", (event) => {
  const suggestion = event.target.closest(".suggestion");
  if (suggestion?.dataset.prompt) sendMessage(suggestion.dataset.prompt);
});

function resetChat() {
  conversation.innerHTML = welcomeMarkup;
  chatHistory.length = 0;
  input.value = "";
  input.style.height = "auto";
  closeSidebar();
  input.focus();
}

function openSidebar() {
  document.querySelector("#sidebar")?.classList.add("open");
  document.querySelector("#sidebarScrim")?.classList.add("visible");
}
function closeSidebar() {
  document.querySelector("#sidebar")?.classList.remove("open");
  document.querySelector("#sidebarScrim")?.classList.remove("visible");
}
document.querySelector("#newChat")?.addEventListener("click", resetChat);
document.querySelector("#mobileMenu")?.addEventListener("click", openSidebar);
document.querySelector("#closeSidebar")?.addEventListener("click", closeSidebar);
document.querySelector("#sidebarScrim")?.addEventListener("click", closeSidebar);
document.querySelector("#collapseSidebar")?.addEventListener("click", () => {
  document.querySelector("#sidebar")?.classList.toggle("collapsed");
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    resetChat();
  }
  if (event.key === "Escape") closeSidebar();
});
