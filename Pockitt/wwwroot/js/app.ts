import * as signalR from "@microsoft/signalr";
import { initArt } from "./art";

// Elements - Join Screen
const joinScreen = document.getElementById("join-screen") as HTMLDivElement;
const usernameInput = document.getElementById("username-input") as HTMLInputElement;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement;
const joinError = document.getElementById("join-error") as HTMLParagraphElement;

// Elements - Chat Screen
const chatScreen = document.getElementById("chat-screen") as HTMLDivElement;
const roomName = document.getElementById("room-name") as HTMLSpanElement;
const userCount = document.getElementById("user-count") as HTMLSpanElement;
const messageFeed = document.getElementById("message-feed") as HTMLDivElement;
const messageInput = document.getElementById("message-input") as HTMLInputElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const drawBtn = document.getElementById("draw-btn") as HTMLButtonElement;
const drawingPanel = document.getElementById("drawing-panel") as HTMLDivElement;

// State
let username = "";
let roomId = "";

// SignalR connection
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hub")
    .withAutomaticReconnect()
    .build();

// Initialize art tool
initArt(connection);

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

    roomName.textContent = data.roomName;
    userCount.textContent = `${data.userCount} online`;

    joinScreen.hidden = true;
    chatScreen.hidden = false;

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
    userCount.textContent = `${data.userCount} online`;
    appendSystemMessage(`${data.username} joined the room.`);
});

connection.on("UserLeft", (data: { username: string; userCount: number }) => {
    userCount.textContent = `${data.userCount} online`;
    appendSystemMessage(`${data.username} left the room.`);
});

// ---- UI Functions ----

function appendTextMessage(user: string, content: string): void {
    const msg = document.createElement("div");
    msg.className = "message text-message";
    msg.innerHTML = `<span class="message-username">${escapeHtml(user)}</span><span class="message-content">${escapeHtml(content)}</span>`;
    messageFeed.appendChild(msg);
    messageFeed.scrollTop = messageFeed.scrollHeight;
}

function appendArtMessage(user: string, dataUrl: string): void {
    const msg = document.createElement("div");
    msg.className = "message art-message";

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = `${user}'s art`;

    const label = document.createElement("span");
    label.className = "message-username";
    label.textContent = user;

    msg.appendChild(label);
    msg.appendChild(img);
    messageFeed.appendChild(msg);
    messageFeed.scrollTop = messageFeed.scrollHeight;
}

function appendSystemMessage(content: string): void {
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
    joinError.textContent = message;
    joinError.hidden = false;
}

// ---- Join Flow ----

async function join(): Promise<void> {
    username = usernameInput.value.trim();

    if (!username) {
        showError("Please enter a username.");
        return;
    }

    joinBtn.disabled = true;

    try {
        await connection.start();

        const sessionToken = sessionStorage.getItem("sessionToken");

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                await connection.invoke("Join",
                    username,
                    position.coords.latitude,
                    position.coords.longitude,
                    sessionToken
                );
            },
            () => {
                showError("Location access is required to join a room.");
                joinBtn.disabled = false;
            }
        );
    } catch {
        showError("Could not connect to the server. Please try again.");
        joinBtn.disabled = false;
    }
}

// ---- Send Message ----

async function sendMessage(): Promise<void> {
    const content = messageInput.value.trim();
    if (!content) return;

    messageInput.value = "";
    await connection.invoke("SendMessage", content);
}

// ---- Button Listeners ----

joinBtn.addEventListener("click", join);

usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") join();
});

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
});

drawBtn.addEventListener("click", () => {
    drawingPanel.hidden = false;
});
