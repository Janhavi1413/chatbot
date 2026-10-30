const API_URL = "http://127.0.0.1:8080/chat";
const STORAGE_KEY = "nova_ai_conversations_v2";
const messagesElement = document.getElementById("messages");
const input = document.getElementById("messageInput");
const welcome = document.getElementById("welcome");
const sendButton = document.getElementById("sendButton");
const historyElement = document.getElementById("history");
const toastElement = document.getElementById("toast");

let conversations = loadConversations();
let currentConversationId = conversations[0]?.id || null;
let busy = false;
let toastTimer;

function loadConversations() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter(c => c && c.id && Array.isArray(c.messages)) : [];
    } catch { return []; }
}
function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); }
    catch { showToast("Storage is full. Export a chat to keep a backup."); }
}
function createConversation() {
    const c = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title: "New conversation", messages: [], updated: Date.now() };
    conversations.unshift(c);
    currentConversationId = c.id;
    persist(); renderHistory(); renderMessages();
    return c;
}
function getCurrentConversation() { return conversations.find(c => c.id === currentConversationId); }
function newChat() {
    if (busy) return;
    createConversation(); input.focus(); toggleSidebar(false);
}
function renderHistory() {
    historyElement.replaceChildren();
    document.getElementById("chatCount").textContent = conversations.length;
    conversations.forEach(c => {
        const row = document.createElement("div");
        row.className = "history-item" + (c.id === currentConversationId ? " active" : "");
        const title = document.createElement("button");
        title.className = "history-title"; title.textContent = c.title;
        title.onclick = () => { if (!busy) { currentConversationId = c.id; renderHistory(); renderMessages(); toggleSidebar(false); } };
        const del = document.createElement("button");
        del.className = "history-delete"; del.textContent = "×"; del.title = "Delete conversation";
        del.onclick = e => { e.stopPropagation(); deleteConversation(c.id); };
        row.append(title, del); historyElement.append(row);
    });
}
function deleteConversation(id) {
    if (busy) return;
    conversations = conversations.filter(c => c.id !== id);
    if (currentConversationId === id) currentConversationId = conversations[0]?.id || null;
    persist(); renderHistory(); renderMessages(); showToast("Conversation deleted");
}
function renderMessages() {
    messagesElement.replaceChildren();
    const c = getCurrentConversation();
    welcome.hidden = !!(c && c.messages.length);
    if (!c) return;
    c.messages.forEach(m => addMessageToDOM(m.role, m.content));
    scrollToBottom();
}
function escapeHTML(s) {
    return s.replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function renderMarkdown(raw) {
    let s = escapeHTML(raw);
    const blocks = [];
    s = s.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        blocks.push(`<pre><div class="code-head"><span>${lang || "CODE"}</span><button class="code-copy" data-code="${encodeURIComponent(code)}">Copy code</button></div><code>${code.trim()}</code></pre>`);
        return `%%CODE${blocks.length - 1}%%`;
    });
    s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>");
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, "<code class='inline-code'>$1</code>");
    s = s.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>").replace(/(?:<li>.*<\/li>\n?)+/g, x => `<ul>${x}</ul>`);
    s = s.split(/\n{2,}/).map(part => /^(<h\d|<ul>|%%CODE)/.test(part) ? part : `<p>${part.replace(/\n/g, "<br>")}</p>`).join("");
    blocks.forEach((b, i) => { s = s.replace(`%%CODE${i}%%`, b); });
    return s;
}
function addMessageToDOM(role, content, actions = true) {
    const row = document.createElement("article");
    row.className = `message ${role}`;
    const avatar = document.createElement("div"); avatar.className = "message-avatar"; avatar.textContent = role === "user" ? "G" : "✦";
    const panel = document.createElement("div"); panel.className = "message-panel";
    const meta = document.createElement("div"); meta.className = "message-meta";
    const label = document.createElement("b"); label.textContent = role === "user" ? "You" : "Nova AI";
    const time = document.createElement("span"); time.textContent = new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    meta.append(label, time);
    const contentBox = document.createElement("div"); contentBox.className = "message-content";
    contentBox.innerHTML = role === "assistant" ? renderMarkdown(content) : escapeHTML(content).replace(/\n/g, "<br>");
    panel.append(meta, contentBox);
    if (actions && role === "assistant") {
        const bar = document.createElement("div"); bar.className = "message-actions";
        const copy = document.createElement("button"); copy.textContent = "Copy response";
        copy.onclick = () => copyText(content);
        bar.append(copy); panel.append(bar);
    }
    row.append(avatar, panel); messagesElement.append(row);
    contentBox.querySelectorAll(".code-copy").forEach(btn => btn.onclick = () => copyText(decodeURIComponent(btn.dataset.code)));
    return row;
}
async function copyText(value) {
    try { await navigator.clipboard.writeText(value); showToast("Copied to clipboard"); }
    catch { showToast("Clipboard access unavailable"); }
}
function usePrompt(value) { input.value = value; updateCounter(); input.focus(); sendMessage(); }
async function sendMessage() {
    const message = input.value.trim();
    if (!message || busy) return;
    if (!currentConversationId) createConversation();
    const c = getCurrentConversation();
    c.messages.push({role:"user", content:message});
    if (c.title === "New conversation") c.title = message.length > 34 ? message.slice(0,34) + "…" : message;
    c.updated = Date.now(); input.value = ""; input.style.height = "auto"; updateCounter();
    welcome.hidden = true; addMessageToDOM("user", message, false); renderHistory(); persist();
    const typing = addMessageToDOM("assistant", "Nova is thinking…", false);
    typing.querySelector(".message-content").classList.add("typing");
    busy = true; sendButton.disabled = true;
    try {
        const response = await fetch(API_URL, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({message, history:c.messages.slice(0,-1)})
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Server error (${response.status})`);
        if (typeof data.reply !== "string") throw new Error("Invalid response from server.");
        typing.remove(); c.messages.push({role:"assistant", content:data.reply}); c.updated = Date.now();
        addMessageToDOM("assistant", data.reply); persist(); renderHistory();
    } catch (err) {
        typing.remove();
        const msg = `⚠ ${err.message || "Could not connect to Nova AI."}\n\nMake sure the C++ backend is running and the API key is configured.`;
        c.messages.push({role:"assistant", content:msg}); addMessageToDOM("assistant", msg); persist();
        console.error(err);
    } finally { busy = false; sendButton.disabled = false; input.focus(); scrollToBottom(); }
}
function clearChat() {
    if (busy) return;
    const c = getCurrentConversation(); if (!c || !c.messages.length) return;
    if (!confirm("Clear all messages in this conversation?")) return;
    c.messages = []; c.title = "New conversation"; persist(); renderMessages(); renderHistory(); showToast("Chat cleared");
}
function exportCurrentChat() {
    const c = getCurrentConversation();
    if (!c || !c.messages.length) return showToast("There is no conversation to export");
    const content = c.messages.map(m => `${m.role === "user" ? "YOU" : "NOVA AI"}\n${m.content}`).join("\n\n--------------------\n\n");
    const blob = new Blob([`NOVA AI CONVERSATION\n${c.title}\n\n${content}`], {type:"text/plain"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "nova-conversation.txt"; a.click(); URL.revokeObjectURL(url);
    showToast("Conversation exported");
}
function toggleTheme() {
    document.body.classList.toggle("light");
    localStorage.setItem("nova_theme", document.body.classList.contains("light") ? "light" : "dark");
}
function toggleSidebar(force) {
    const el = document.getElementById("sidebar");
    if (typeof force === "boolean") el.classList.toggle("open", force); else el.classList.toggle("open");
}
function showToast(msg) {
    toastElement.textContent = msg; toastElement.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastElement.classList.remove("show"), 2300);
}
function scrollToBottom() {
    const area = document.getElementById("chatArea");
    requestAnimationFrame(() => area.scrollTop = area.scrollHeight);
}
function updateCounter() {
    document.getElementById("charCount").textContent = `${input.value.length} / 12000`;
}
async function checkServer() {
    const dot = document.getElementById("connectionDot"), label = document.getElementById("connectionText");
    try {
        const r = await fetch("http://127.0.0.1:8080/health", {cache:"no-store"});
        if (!r.ok) throw new Error();
        dot.classList.add("online"); label.textContent = "Backend online";
    } catch { dot.classList.remove("online"); label.textContent = "Backend offline"; }
}
input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
input.addEventListener("input", () => {
    input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 150) + "px"; updateCounter();
});
if (localStorage.getItem("nova_theme") === "light") document.body.classList.add("light");
if (!conversations.length) createConversation(); else { renderHistory(); renderMessages(); }
checkServer(); setInterval(checkServer, 20000);
