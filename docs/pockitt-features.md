# Pockitt — Feature Overview

## Overview

Pockitt is an accountless, location-based group chat web application. Users connect with people in their immediate geographic area, communicate through text chat, and express themselves via a built-in drawing tool. No accounts, no sign-up, no emoji — just local, ephemeral connection.

---

## Tech Stack

| Layer            | Technology                       |
|------------------|----------------------------------|
| Containerization | Docker (single container)        |
| Frontend         | HTML + Tailwind CSS + TypeScript |
| Backend          | ASP.NET Core 10 + SignalR 10     |
| Build Tool       | Vite 6 + TypeScript 5.9          |

---

## Core Features

### Accountless Access
- No registration or login required.
- Users enter a display name (up to 20 characters) and are placed in a room instantly.
- An ephemeral session token (`UUIDv4`) is generated on join and stored in `sessionStorage`, which clears automatically when the tab is closed.
- No personal data is stored or persisted beyond the session.

### Location-Based Chat Rooms
- The browser requests coarse GPS coordinates once on join — high-accuracy mode is intentionally disabled.
- Raw coordinates are immediately encoded client-side into a **Geohash at precision 5** (~5 km × 5 km cell) and discarded; the server never receives raw GPS data.
- `RoomService` places the user into the nearest open room within ~100 meters (one football field). If none exists, it creates a new room keyed to their geohash.
- Rooms hold up to **10 users**. Additional users in the same area are assigned to a new room.
- Rooms dissolve automatically **5 minutes** after the last user leaves.
- No manual room creation, naming, or browsing — proximity is the only selector.

### Real-Time Messaging
- All communication flows over a single persistent WebSocket connection managed by **SignalR**.
- Text messages (up to 200 characters) are broadcast to all users in the room in real time.
- System notifications inform the room when someone joins, leaves, or reconnects.

### Drawing Tool
- A full-featured canvas drawing tool is built directly into the chat UI.
- **Controls available:**
  - Color picker — choose any stroke color
  - Brush size slider — 1 to 40 px stroke width
  - Eraser — switch between drawing and erasing modes
  - Undo / Redo — step backward or forward through drawing history
  - Clear — wipe the canvas and save a blank snapshot for undo
  - Send — submit the drawing as a PNG image to the room
  - Cancel — dismiss the drawing panel without sending
- Supports both **mouse and touch input** for mobile/tablet use.
- Drawings are serialized as base64-encoded PNG via `canvas.toDataURL()` and transmitted through the SignalR hub.
- Drawings appear inline in the chat feed as images, alongside text messages.
- No server-side storage — drawings exist only in the WebSocket payload and the receivers' browsers.

### Session Reconnection
- If a user loses connection (network drop, brief tab switch), the server holds their room slot for a **5-minute grace period**.
- If they reconnect and provide their stored session token within that window, they are silently restored to their room without re-joining or re-requesting location.
- The room receives a `UserRejoined` notification instead of a `UserLeft` + `UserJoined` pair.
- After the grace period expires, the user is formally removed and the room is notified via `UserLeft`.

---

## Design Principles

- **Ephemeral by default** — no history persists beyond the session; messages are lost on process restart.
- **Proximity-driven** — community forms organically around shared physical location.
- **Visual-first** — the drawing tool is the expressive outlet; no emoji support.
- **Zero friction** — enter a name, grant location once, and you're in.
- **Privacy by design** — raw GPS never leaves the client; geohash cells obscure exact position.

---

## Deployment

The application is a single **ASP.NET Core** project that serves the frontend static files directly from `wwwroot`, eliminating the need for a separate frontend container or reverse proxy. **SignalR** handles all real-time communication over WebSocket. The frontend TypeScript is compiled by **Vite** at build time into the `wwwroot/js/` directory.

For local development, the Vite dev server proxies `/hub` to the ASP.NET backend at `localhost:5290`, enabling hot-reload on frontend changes without rebuilding the container.
