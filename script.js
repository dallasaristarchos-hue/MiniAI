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
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory.slice(-12) })
    });

    const data = await response.json().catch(() => ({}));
    document.querySelector("#typingIndicator")?.remove();

    if (!response.ok) {
      throw new Error(data.error || "MiniAI couldn't answer right now. Please try again.");
    }

    const reply = String(data.reply || "").trim();
    if (!reply) throw new Error("MiniAI returned an empty reply. Please try again.");

    chatHistory.push({ role: "assistant", content: reply });
    addMessage(reply, "assistant");
  } catch (error) {
    document.querySelector("#typingIndicator")?.remove();
    addMessage(error.message || "Connection problem. Please try again.", "assistant");
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
  input.focus();
}

document.querySelector("#newChat")?.addEventListener("click", resetChat);
document.querySelector("#mobileNewChat")?.addEventListener("click", resetChat);
document.querySelector("#clearChat")?.addEventListener("click", resetChat);
