const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const conversation = document.querySelector("#conversation");
const sendButton = document.querySelector("#sendButton");
const welcomeMarkup = document.querySelector("#welcome").outerHTML;

const demoReplies = [
  { test: /hello|hi|hey|good morning|good evening/i, reply: "Hey! 💜 What would you like to explore today?" },
  { test: /who are you|what are you/i, reply: "I'm MiniAI — a small chatbot project with a big purple personality. I'm currently running in demo mode, so my replies are sample responses rather than a live AI model." },
  { test: /artificial intelligence|\bai\b|machine learning/i, reply: "Artificial intelligence is technology that can perform tasks that usually need human-like abilities, such as understanding language, spotting patterns, or generating ideas. A model learns patterns from examples and uses them to respond to new input." },
  { test: /idea|brainstorm|app/i, reply: "Let's brainstorm! ✨\n\n1. A smart study buddy that turns notes into quizzes.\n2. A device-care tracker for phones and computers.\n3. A tiny habit garden that grows as you complete goals.\n\nWhich direction sounds interesting?" },
  { test: /plan|productive|schedule/i, reply: "Here's a simple afternoon plan:\n\n• 10 minutes — choose your top priority.\n• 25 minutes — focus on that one task.\n• 5 minutes — take a screen break.\n• 20 minutes — learn or practise something.\n• 10 minutes — review what you got done.\n\nKeep it flexible and make it yours. 💜" },
  { test: /science|fact|surprise/i, reply: "A surprising science fact: a day on Venus (one full rotation) is longer than its year (one trip around the Sun)! Space is full of strange details. 🌌" },
  { test: /thank/i, reply: "You're welcome! 💜 What shall we explore next?" }
];

function addMessage(text, sender) {
  let list = conversation.querySelector(".messages");
  if (!list) {
    conversation.innerHTML = '<div class="messages"></div>';
    list = conversation.querySelector(".messages");
  }
  const row = document.createElement("div");
  row.className = `message ${sender}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "user" ? "Y" : "✳";
  avatar.setAttribute("aria-hidden", "true");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.append(avatar, bubble);
  list.append(row);
  conversation.scrollTop = conversation.scrollHeight;
}

function getDemoReply(message) {
  const match = demoReplies.find(item => item.test.test(message));
  if (match) return match.reply;
  return "That's an interesting question! 💜 I'm still a demo, so I don't have a live AI brain connected yet. Right now I can respond to a few sample topics. The next development step is connecting a real AI model through a secure backend — never putting a private API key in browser code.";
}

function showTyping() {
  let list = conversation.querySelector(".messages");
  if (!list) {
    conversation.innerHTML = '<div class="messages"></div>';
    list = conversation.querySelector(".messages");
  }
  const row = document.createElement("div");
  row.className = "message";
  row.id = "typingIndicator";
  row.innerHTML = '<div class="avatar" aria-hidden="true">✳</div><div class="bubble"><span class="typing" aria-label="MiniAI is thinking"><i></i><i></i><i></i></span></div>';
  list.append(row);
  conversation.scrollTop = conversation.scrollHeight;
}

function sendMessage(text) {
  const message = text.trim();
  if (!message) return;
  document.querySelector("#welcome")?.remove();
  addMessage(message, "user");
  input.value = "";
  input.style.height = "auto";
  sendButton.disabled = true;
  showTyping();
  window.setTimeout(() => {
    document.querySelector("#typingIndicator")?.remove();
    addMessage(getDemoReply(message), "assistant");
    sendButton.disabled = false;
    input.focus();
  }, 650);
}

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(input.value);
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 130) + "px";
});
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});
function resetChat() {
  conversation.innerHTML = welcomeMarkup;
  document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt));
  });
  input.value = "";
  input.focus();
}
document.querySelector("#newChat").addEventListener("click", resetChat);
document.querySelector("#mobileNewChat").addEventListener("click", resetChat);
document.querySelector("#clearChat").addEventListener("click", resetChat);
