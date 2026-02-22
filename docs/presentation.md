# Pockitt — Presentation

---

## Introduction

**Pockitt** is a location-based, accountless group chat application that connects you with the people physically around you — in real time, with no sign-up required.

The premise is simple: the best social experience is the one happening right next to you. Not across the country. Not curated by an algorithm. Right here, right now.

### The Problem We're Solving

Modern social platforms are global by default. You can message anyone, anywhere — but that ubiquity comes with noise, curation, and friction. What if you just want to talk to the people in the same coffee shop, park, or neighborhood as you?

Most apps require accounts, logins, friend lists, or invite codes before a single message can be sent. By the time you've gotten through setup, the moment has passed.

Pockitt removes every barrier. Open the app, enter a name, and you're chatting with whoever is nearby.

### What Makes Pockitt Different

| Feature              | Pockitt          | Typical Chat App      |
|----------------------|------------------|-----------------------|
| Account required     | No               | Yes                   |
| Room selection       | Automatic        | Manual                |
| Proximity-based      | Yes (~100m range)| Rarely                |
| Ephemeral sessions   | Yes (tab close)  | No (persistent)       |
| Drawing built-in     | Yes              | Rarely                |
| Data collected       | None             | Extensive             |

---

## How Does It Work

### The User Experience

1. **Open the app** — you land on the join page.
2. **Enter a display name** (up to 20 characters) — no email, no password.
3. **Grant location** — the browser requests your GPS position once. High-accuracy mode is intentionally off; we only need a rough neighborhood.
4. **Join** — within milliseconds, you're placed in a chat room with other people nearby.
5. **Chat** — send text messages or open the drawing tool to sketch something and send it as an image.
6. **Leave** — close the tab. Your session evaporates. No trace left behind.

### Location Without Surveillance

The most sensitive part of the design is location handling. Here's exactly what happens:

```
Your browser gets GPS coordinates
         │
         ▼  (never leaves the device as raw data)
Encoded into a Geohash (5-character string, ~5km × 5km cell)
         │
         ▼
Geohash sent to the server
         │
         ▼
Server finds nearby rooms using Haversine distance formula
         │
         ▼
Raw GPS coordinates are gone — never stored, never logged
```

A **Geohash at precision 5** covers roughly a 5 km × 5 km area — think a neighborhood, not a street corner. The server never knows exactly where you are, only which cell you're in.

### Room Assignment

Once the server has your geohash, `RoomService` finds the right room in two passes:

1. **Nearby pass:** Is there a room within ~100 meters (one football field) with fewer than 10 users? Join it.
2. **Fallback pass:** If not, find the closest room with space, regardless of distance.
3. **Create:** If no rooms exist yet, create a new one.

Rooms cap at **10 users** to keep conversations human-scale. Empty rooms are cleaned up after **5 minutes** of inactivity.

### Drawing Tool

Text is the floor, not the ceiling. The built-in canvas drawing tool lets users sketch directly in the browser and send drawings as images to the room.

Controls include:
- **Color picker** — any stroke color
- **Brush size** — 1 to 40 px
- **Eraser** — toggle between drawing and erasing
- **Undo / Redo** — full history of strokes
- **Send** — converts the canvas to a PNG and broadcasts it to the room

Drawings are never stored on the server. They live as base64 payloads in the WebSocket message, rendered inline in the chat feed as `<img>` elements.

### Reconnection

Losing your connection doesn't mean losing your seat. The server holds your room slot for **5 minutes** after a disconnect. If you reconnect within that window — by refreshing the tab or recovering from a network drop — you're silently restored to your room. The room sees a "rejoined" notification, not a leave/join pair.

---

## Architecture

### System Overview

```
┌────────────────────────────────────────────┐
│              Browser (Client)              │
│                                            │
│  app.ts    ←→    art.ts    ←→    geo.ts   │
│  (chat UI)     (canvas)     (geolocation) │
│                    │                       │
│             SignalR WebSocket              │
└────────────────────┼───────────────────────┘
                     │
┌────────────────────▼───────────────────────┐
│         ASP.NET Core Backend               │
│                                            │
│  RoomAssignHub  ←→  RoomService            │
│  (SignalR hub)       (proximity logic)     │
│                                            │
│  In-Memory State:                          │
│  _connectedUsers / _disconnectedUsers      │
│  _rooms / _disconnectTimers                │
└────────────────────────────────────────────┘
```

### Technology Choices

| Layer       | Technology            | Why                                                      |
|-------------|-----------------------|----------------------------------------------------------|
| Backend     | ASP.NET Core 10       | High performance, built-in SignalR, serves static files  |
| Real-time   | SignalR (WebSocket)   | Group broadcasting, automatic reconnect, native .NET     |
| Frontend    | TypeScript + Vite     | Strong typing, fast build, ES module output              |
| Styling     | Tailwind CSS          | Utility-first, no CSS bloat, responsive by default       |
| Geo         | Geohash + Haversine   | Privacy-preserving location; accurate distance math      |
| Drawing     | HTML5 Canvas API      | No dependencies, native browser support                  |
| State       | In-memory dictionaries| Ephemeral by design; Redis upgrade path is clear         |

### Frontend Modules

Three TypeScript modules, each with a single responsibility:

**`geo.ts`** — Geolocation
Calls `navigator.geolocation.getCurrentPosition()` with low accuracy settings, encodes the result to a 5-character geohash, and returns it. Raw coordinates are never stored or forwarded.

**`art.ts`** — Drawing Tool
Owns the `<canvas>` element: pointer and touch event listeners, stroke rendering, undo/redo stacks (`ImageData` arrays), brush controls, and the export-to-base64 + SendArt invoke.

**`app.ts`** — Application Shell
Manages the SignalR connection lifecycle, the join flow, all hub event handlers, message rendering (with XSS prevention), and the join-to-chat navigation via `sessionStorage`.

### Backend Components

**`RoomAssignHub.cs`** — SignalR Hub
The single entry point for all real-time communication. Handles `Join`, `SendMessage`, `SendArt`, and the disconnect/reconnect lifecycle. Maintains static dictionaries for connected users, disconnected users (grace period), and per-room cancellation timers.

**`RoomService.cs`** — Room Engine
Decodes geohashes to lat/lng using BASE32, computes Haversine distances, runs the two-pass room matching algorithm, creates rooms, removes users, and schedules room cleanup via `CancellationTokenSource`.

**`Models/`** — Data Structures
- `User` — ConnectionId, SessionToken, Username, UserNameColor, Geohash, RoomId
- `Room` — Id, Name, Geohash, Users list, Messages list
- `Message` — Username, Content, Timestamp, MessageType (Text / Art / Game)

### Data Flow: A Drawing Sent

```
1. User finishes drawing on <canvas>
2. art.ts: canvas.toDataURL("image/png") → base64 string
3. art.ts: connection.invoke("SendArt", base64)
4. RoomAssignHub.SendArt(): validates size (< 150KB), looks up user's roomId
5. Clients.Group(roomId).SendAsync("ReceiveMessage", { username, content: base64, type: "art" })
6. All clients in room receive ReceiveMessage
7. app.ts: creates <img src="data:image/png;base64,..."> and appends to feed
```

No disk I/O. No database. The drawing lives in memory for the duration of the WebSocket round-trip.

### Privacy by Design

- Raw GPS coordinates are encoded client-side and discarded before anything leaves the browser.
- Session tokens are UUIDv4 — cryptographically random, stored in `sessionStorage`, cleared on tab close.
- The server holds no user accounts, no email addresses, no persistent identity of any kind.
- Room IDs are GUIDs — not guessable, not enumerable via any API.
- All text content is rendered via `textContent` / `escapeHtml()`, never `innerHTML`, preventing XSS.

---

## Future Plans

### Near-Term (Phase 4 — Hardening)

**Rate Limiting**
Prevent message flooding by capping each connection at 10 messages per 10 seconds. Implemented as ASP.NET Core middleware before the SignalR pipeline.

**Security Headers**
Add `Content-Security-Policy`, `X-Frame-Options`, and `X-Content-Type-Options` headers via middleware to harden the frontend against injection and framing attacks.

**Message Backfill**
New users joining a room currently see an empty feed. A ring buffer of the last 50 messages will be sent as backfill on `RoomJoined` so new joiners have context.

**Health Check Endpoint**
A `GET /api/health` endpoint returning room count and connected user count for container orchestration liveness/readiness probes.

**Username Color Selection**
The `UserNameColor` enum (`Default`, `Red`, `Green`, `Blue`, `Yellow`, `Orange`, `Purple`, `Pink`, `Brown`) is already modeled in `User.cs`. The next step is exposing a color picker on the join page and rendering usernames in the selected color in the chat feed.

### Medium-Term

**Game Messages (`MessageType.Game`)**
The `MessageType` enum already includes `Game`. A lightweight shared game (e.g., a word game or a pixel-art challenge) could be broadcast as a structured message and rendered as an interactive widget in the chat feed.

**Emoji Reactions on Drawings**
Allow users to react to a drawing with a tap — a counter rendered below the image, broadcast to the room in real time.

**Room Names**
Let users optionally name a room (e.g., by landmark or event). The name would be broadcast to new joiners and displayed in the header. No persistent registry — names exist only in room memory.

**Push Notifications (PWA)**
Convert the app to a Progressive Web App with a service worker. Allow users to receive a push notification when someone joins their room or sends a message while the tab is backgrounded.

### Long-Term

**Multi-Instance Scaling with Redis**
Replace the in-memory `Dictionary` state with a Redis backplane for SignalR groups and a Redis-backed room registry. This allows horizontal scaling to multiple instances behind a load balancer without sticky sessions.

**Moderation Tools**
- Per-room mute (tap a username to mute their messages locally)
- Voluntary room reporting (flags sent to a moderation queue — no automated content scanning, which would require storing messages)

**Offline-First with IndexedDB**
Cache the last session's room and messages in `IndexedDB` so the UI loads instantly on revisit, before the WebSocket reconnects.

**Native Mobile App (MAUI / React Native)**
A native shell would enable background location updates (for users who move between geohash cells during a session), home-screen presence, and richer notifications.

---

*Pockitt is a hackathon project. The architecture is intentionally lean — every decision optimizes for zero-friction deployment, zero data retention, and zero barriers to local human connection.*
