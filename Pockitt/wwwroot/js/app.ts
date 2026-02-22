import * as signalR from "@microsoft/signalr";
import { initArt } from "./art";
import { getGeoHash } from "./geo";
import "../css/style.css";

// Elements - Join Screen
const joinScreen = document.getElementById("join-screen") as HTMLDivElement | null;
const joinForm = document.querySelector(".join-form") as HTMLFormElement | null;
const usernameInput = document.getElementById("username-input") as HTMLInputElement | null;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement | null;
const joinError = document.getElementById("join-error") as HTMLParagraphElement | null;

// Elements - Chat Screen
const chatScreen = document.getElementById("chat-screen") as HTMLDivElement | null;
const roomName = document.getElementById("room-name") as HTMLSpanElement | null;
const userCount = document.getElementById("user-count") as HTMLSpanElement | null;
const messageFeed = document.getElementById("message-feed") as HTMLDivElement | null;
const messageInput = document.getElementById("message-input") as HTMLInputElement | null;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement | null;
const drawBtn = document.getElementById("draw-btn") as HTMLButtonElement | null;
const drawingPanel = document.getElementById("drawing-panel") as HTMLDivElement | null;

// State
let username = "";
let roomId = "";

// SignalR connection
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hub")
    .withAutomaticReconnect()
    .build();

// Initialize art tool only on pages where drawing UI exists
let art: { openPanel: () => void } | null = null;
if (drawBtn && drawingPanel && document.getElementById("drawing-canvas")) {
    art = initArt(connection);
    drawBtn.addEventListener("click", () => {
        if (drawingPanel.hidden === false) {
            drawingPanel.hidden = true;
        } else {
            art?.openPanel();
        }
    });
}

// ---- SignalR Event Handlers ----

connection.on("RoomJoined", (data: {
    roomId: string;
    roomName: string;
    userCount: number;
    sessionToken: string;
    reconnected: boolean;
}) => {
    roomId = data.roomId;
    sessionStorage.setItem("sessionToken", data.sessionToken);
    if (username) {
        sessionStorage.setItem("username", username);
    }

    if (roomName) roomName.textContent = data.roomName;
    if (userCount) userCount.textContent = `${data.userCount} online`;

    if (joinScreen) joinScreen.hidden = true;
    if (chatScreen) {
        chatScreen.hidden = false;
    } else {
        window.location.href = "/chat.html";
        return;
    }

    if (data.reconnected) {
        appendSystemMessage("Reconnected to room.");
    }
});

connection.on("ReceiveMessage", (data: {
    username: string;
    content: string;
    timestamp: string;
    type: "text" | "art";
}) => {
    if (data.type === "text") {
        appendTextMessage(data.username, data.content);
    } else if (data.type === "art") {
        appendArtMessage(data.username, data.content);
    }
});

connection.on("UserJoined", (data: { username: string; userCount: number }) => {
    if (userCount) userCount.textContent = `${data.userCount} online`;
    appendSystemMessage(`${data.username} joined the room.`);
});

connection.on("UserLeft", (data: { username: string; userCount: number }) => {
    if (userCount) userCount.textContent = `${data.userCount} online`;
    appendSystemMessage(`${data.username} left the room.`);
});

connection.on("UserDisconnected", (data: { username: string; userCount: number }) => {
    if (userCount) userCount.textContent = `${data.userCount} online`;
    appendSystemMessage(`${data.username} disconnected.`);
});

connection.on("UserRejoined", (data: { username: string; userCount: number }) => {
    if (userCount) userCount.textContent = `${data.userCount} online`;
    appendSystemMessage(`${data.username} reconnected.`);
});

// ---- UI Functions ----

function appendTextMessage(user: string, content: string): void {
    if (!messageFeed) return;
    const msg = document.createElement("div");
    const isOwn = user === username;
    msg.className = `message text-message${isOwn ? " own-message" : ""}`;
    msg.innerHTML = `<span class="message-username">${escapeHtml(user)}</span><span class="message-content">${escapeHtml(content)}</span>`;
    messageFeed.appendChild(msg);
    messageFeed.scrollTop = messageFeed.scrollHeight;
}

function appendArtMessage(user: string, dataUrl: string): void {
    console.log("art message user:", user, "username:", username, "isOwn:", user === username);
    if (!messageFeed) return;
    const msg = document.createElement("div");
    const isOwn = user === username;
    msg.className = `message art-message${isOwn ? " own-message" : ""}`;

    const label = document.createElement("span");
    label.className = "message-username";
    label.textContent = user;

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = `${user}'s art`;

    msg.appendChild(label);
    msg.appendChild(img);
    messageFeed.appendChild(msg);
    messageFeed.scrollTop = messageFeed.scrollHeight;
}

function appendSystemMessage(content: string): void {
    if (!messageFeed) return;
    const msg = document.createElement("div");
    msg.className = "message system-message";
    msg.textContent = content;
    messageFeed.appendChild(msg);
    messageFeed.scrollTop = messageFeed.scrollHeight;
}

function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

function showError(message: string): void {
    if (!joinError) return;
    joinError.textContent = message;
    joinError.hidden = false;
}

// ---- Join Flow ----

async function startAndJoin(): Promise<void> {
    const sessionToken = sessionStorage.getItem("sessionToken");
    const geohash = await getGeoHash();
    await connection.invoke("Join", username, geohash, sessionToken);
}

async function join(): Promise<void> {
    if (!usernameInput || !joinBtn) return;
    username = usernameInput.value.trim();

    if (!username) {
        showError("Please enter a username.");
        return;
    }

    joinBtn.disabled = true;
    sessionStorage.setItem("username", username);

    try {
        if (connection.state === signalR.HubConnectionState.Disconnected) {
            await connection.start();
        }
        await startAndJoin();
    } catch {
        showError("Could not connect to the server. Please try again.");
        joinBtn.disabled = false;
    }
}

async function autoJoinFromChatPage(): Promise<void> {
    username = sessionStorage.getItem("username") ?? "";
    if (!username) {
        appendSystemMessage("No username found. Go to the join page first.");
        return;
    }

    try {
        if (connection.state === signalR.HubConnectionState.Disconnected) {
            await connection.start();
        }
        await startAndJoin();
    } catch {
        appendSystemMessage("Could not connect to the server. Refresh to try again.");
    }
}

// ---- Send Message ----

async function sendMessage(): Promise<void> {
    if (!messageInput) return;
    const content = messageInput.value.trim();
    if (!content) return;

    messageInput.value = "";
    await connection.invoke("SendMessage", content);
}

// ---- Button Listeners ----

if (joinForm) {
    joinForm.addEventListener("submit", (e) => {
        e.preventDefault();
        void join();
    });
}

if (joinBtn) {
    joinBtn.addEventListener("click", (e) => {
        e.preventDefault();
        void join();
    });
}

if (usernameInput) {
    usernameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            void join();
        }
    });
}

if (sendBtn) {
    sendBtn.addEventListener("click", () => {
        void sendMessage();
    });
}

if (messageInput) {
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            void sendMessage();
        }
    });
}

// If this is the dedicated chat page, join automatically using session state.
if (chatScreen && !joinScreen) {
    void autoJoinFromChatPage();
}
