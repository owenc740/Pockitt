var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as signalR from "@microsoft/signalr";
import { initArt } from "./art";
import { getGeoHash } from "./geo";
// Elements - Join Screen
const joinScreen = document.getElementById("join-screen");
const usernameInput = document.getElementById("username-input");
const joinBtn = document.getElementById("join-btn");
const joinError = document.getElementById("join-error");
// Elements - Chat Screen
const chatScreen = document.getElementById("chat-screen");
const roomName = document.getElementById("room-name");
const userCount = document.getElementById("user-count");
const messageFeed = document.getElementById("message-feed");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const drawBtn = document.getElementById("draw-btn");
const drawingPanel = document.getElementById("drawing-panel");
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
connection.on("RoomJoined", (data) => {
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
connection.on("ReceiveMessage", (data) => {
    if (data.type === "text") {
        appendTextMessage(data.username, data.content);
    }
    else if (data.type === "art") {
        appendArtMessage(data.username, data.content);
    }
});
connection.on("UserJoined", (data) => {
    userCount.textContent = `${data.userCount} online`;
    appendSystemMessage(`${data.username} joined the room.`);
});
connection.on("UserLeft", (data) => {
    userCount.textContent = `${data.userCount} online`;
    appendSystemMessage(`${data.username} left the room.`);
});
// ---- UI Functions ----
function appendTextMessage(user, content) {
    const msg = document.createElement("div");
    msg.className = "message text-message";
    msg.innerHTML = `<span class="message-username">${escapeHtml(user)}</span><span class="message-content">${escapeHtml(content)}</span>`;
    messageFeed.appendChild(msg);
    messageFeed.scrollTop = messageFeed.scrollHeight;
}
function appendArtMessage(user, dataUrl) {
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
function appendSystemMessage(content) {
    const msg = document.createElement("div");
    msg.className = "message system-message";
    msg.textContent = content;
    messageFeed.appendChild(msg);
    messageFeed.scrollTop = messageFeed.scrollHeight;
}
function escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
function showError(message) {
    joinError.textContent = message;
    joinError.hidden = false;
}
// ---- Join Flow ----
function join() {
    return __awaiter(this, void 0, void 0, function* () {
        username = usernameInput.value.trim();
        if (!username) {
            showError("Please enter a username.");
            return;
        }
        joinBtn.disabled = true;
        try {
            yield connection.start();
            const sessionToken = sessionStorage.getItem("sessionToken");
            getGeoHash()
                .then((geohash) => __awaiter(this, void 0, void 0, function* () {
                yield connection.invoke("Join", username, geohash, sessionToken);
            }))
                .catch(() => {
                showError("Location access is required to join a room.");
                joinBtn.disabled = false;
            });
        }
        catch (_a) {
            showError("Could not connect to the server. Please try again.");
            joinBtn.disabled = false;
        }
    });
}
// ---- Send Message ----
function sendMessage() {
    return __awaiter(this, void 0, void 0, function* () {
        const content = messageInput.value.trim();
        if (!content)
            return;
        messageInput.value = "";
        yield connection.invoke("SendMessage", content);
    });
}
// ---- Button Listeners ----
joinBtn.addEventListener("click", join);
usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter")
        join();
});
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter")
        sendMessage();
});
drawBtn.addEventListener("click", () => {
    drawingPanel.hidden = false;
});
