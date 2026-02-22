# Pockitt — Engineering & Architecture Specification

> **Version:** 1.1.0
> **Status:** Active
> **Last Updated:** 2026-02-22

---

## Table of Contents

1. [Vision & Goals](#vision--goals)
2. [System Architecture](#system-architecture)
3. [Tech Stack Rationale](#tech-stack-rationale)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Real-Time Communication](#real-time-communication)
7. [Geospatial Room System](#geospatial-room-system)
8. [Drawing Tool Architecture](#drawing-tool-architecture)
9. [Anonymous Identity System](#anonymous-identity-system)
10. [Data Models](#data-models)
11. [API Design](#api-design)
12. [Security & Privacy](#security--privacy)
13. [Docker & Deployment](#docker--deployment)
14. [Scalability & Performance](#scalability--performance)
15. [Non-Functional Requirements](#non-functional-requirements)
16. [Development Milestones](#development-milestones)

---

## 1. Vision & Goals

Pockitt is built on a single conviction: **the best social experience is the one happening right next to you.** No accounts. No global noise. No algorithmic feeds. Just you and the people nearby, communicating in real time.

### Product Goals
- Sub-second message delivery to all room participants.
- Zero-friction entry — fully functional within 2 seconds of page load.
- Privacy by design — no PII collected, no long-term data retention.
- Resilient ephemeral rooms — no stale state, no ghost rooms.

### Engineering Goals
- Stateless, horizontally scalable backend.
- Container-first deployment with single-command local dev.
- Clear separation of concerns between transport, domain, and presentation layers.

---

## 2. System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│                                                             │
│   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐  │
│   │  Chat UI     │   │ Drawing Tool │   │ Geo + Session │  │
│   │ (Tailwind)   │   │ (Canvas API) │   │   Manager     │  │
│   └──────┬───────┘   └──────┬───────┘   └───────┬───────┘  │
│          │                  │                    │          │
│          └──────────────────┼────────────────────┘          │
│                             │ WebSocket (SignalR)            │
└─────────────────────────────┼─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                     ASP.NET Core Backend                    │
│                                                             │
│   ┌──────────────┐   ┌──────────────────────────────────┐  │
│   │  SignalR Hub │   │         RoomService              │  │
│   │(RoomAssign   │   │  (Geohash decode + Haversine     │  │
│   │    Hub)      │   │   proximity matching)            │  │
│   └──────┬───────┘   └──────────────────────────────────┘  │
│          │                                                  │
│   ┌──────▼──────────────────────────────────────────────┐  │
│   │              In-Memory State (static Dictionaries)   │  │
│   │  _connectedUsers    · _disconnectedUsers             │  │
│   │  _rooms             · _disconnectTimers              │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              wwwroot (Static Files)                  │   │
│   │  index.html · chat.html · css/ · js/                │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow — Message Lifecycle

```
User types message
       │
       ▼
Client sends via SignalR WebSocket
       │
       ▼
RoomAssignHub.SendMessage() receives payload
       │
       ▼
Hub validates sender is a member of a room
       │
       ▼
Message appended to room's in-memory list
       │
       ▼
Hub broadcasts to all connections in SignalR Group (roomId)
       │
       ▼
All clients receive ReceiveMessage and render in real time
```

---

## 3. Tech Stack Rationale

| Layer            | Technology                        | Rationale                                                                 |
|------------------|-----------------------------------|---------------------------------------------------------------------------|
| Containerization | Docker                            | Reproducible builds, single-command dev environment, prod parity          |
| Frontend         | HTML + Tailwind CSS + TypeScript  | Static files served from `wwwroot`; utility-first CSS, strong typing      |
| Backend          | ASP.NET Core 10                   | High-performance, built-in SignalR, serves frontend static files          |
| Real-Time        | SignalR 10 (WebSocket)            | Native ASP.NET integration, automatic fallback, group broadcasting        |
| Build Tool       | Vite 6                            | Fast dev server with `/hub` proxy, native ES modules, TypeScript support  |
| Geo              | Geohash + Haversine               | Client encodes to geohash; server decodes to lat/lng for proximity match  |
| Drawing          | HTML5 Canvas API                  | Native browser support, no dependencies, direct pixel manipulation        |
| State            | In-Memory (static Dictionaries)   | Ephemeral by design — no long-term persistence; clear Redis upgrade path  |

---

## 4. Frontend Architecture

### Directory Structure

```
wwwroot/
├── css/
│   └── style.css          # Custom styles (Roboto Mono font, layout, buttons, canvas)
├── js/
│   ├── app.ts             # Main entry point: SignalR lifecycle, join flow, chat UI
│   ├── art.ts             # Drawing tool module (canvas, undo/redo, send)
│   └── geo.ts             # Geolocation acquisition + geohash encoding
├── index.html             # Join page (username entry + location request)
└── chat.html              # Chat page (message feed + drawing panel)
```

### Module Responsibilities

| Module    | Role |
|-----------|------|
| `app.ts`  | Owns SignalR connection, join/reconnect flow, message send/receive, HTML rendering, XSS prevention |
| `art.ts`  | Owns canvas context, pointer/touch events, undo/redo stacks, drawing controls, base64 export |
| `geo.ts`  | Acquires browser geolocation, encodes to geohash precision 5, discards raw coordinates |

### State Management

No framework required. The app uses minimal vanilla TypeScript state:

```typescript
// In app.ts
let username: string = "";
let roomId: string = "";

// In art.ts
let isDrawing = false;
let isEraser = false;
let undoStack: ImageData[] = [];
let redoStack: ImageData[] = [];
```

Session persistence across navigation uses `sessionStorage`:

```typescript
sessionStorage.setItem("pockitt_username", username);
sessionStorage.setItem("pockitt_session", sessionToken);
sessionStorage.setItem("pockitt_roomId", roomId);
```

### UI Layout

**Join Page (index.html):**
```
┌──────────────────────────────────────┐
│  pockitt.                            │
│                                      │
│  the best social experience          │
│  is right next to you.               │
│                                      │
│  [_____________________] (username)  │
│  [        Join         ]             │
│                                      │
│  tip: you'll be placed in a room     │
│  with others nearby.                 │
└──────────────────────────────────────┘
```

**Chat Page (chat.html):**
```
┌──────────────────────────────────────┐
│  Room 1                     2 users  │  ← header
├──────────────────────────────────────┤
│                                      │
│  alice: hey!                         │
│  bob: what's up                      │
│  alice: [drawing image]              │  ← message feed
│  ** bob joined the room **           │
│                                      │
├──────────────────────────────────────┤
│  [Art]  [____________________] [Send]│  ← input bar
└──────────────────────────────────────┘
```

**Drawing Panel (chat.html, toggled):**
```
┌──────────────────────────────────────┐
│  [Color] [Size] [Eraser] [Undo][Redo]│
├──────────────────────────────────────┤
│                                      │
│           (canvas area)              │  ← 100% width × 400px
│                                      │
├──────────────────────────────────────┤
│  [Clear]            [Cancel] [Send]  │
└──────────────────────────────────────┘
```

---

## 5. Backend Architecture

### Project Structure (ASP.NET Core)

```
Pockitt/
├── Hubs/
│   └── RoomAssignHub.cs       # SignalR hub (Join, SendMessage, SendArt, disconnect lifecycle)
├── Models/
│   ├── Message.cs             # Message + MessageType enum (Text / Art / Game)
│   ├── Room.cs                # Room (Id, Name, Geohash, Users, Messages)
│   └── User.cs                # User (ConnectionId, SessionToken, Username, UserNameColor, Geohash, RoomId)
├── Services/
│   └── RoomService.cs         # Geohash decode + Haversine proximity room matching + room lifecycle
├── wwwroot/                   # Frontend static files (served by ASP.NET Core)
└── Program.cs                 # Service registration and middleware pipeline
```

### Program.cs Bootstrap

```csharp
builder.Services.AddSingleton<RoomService>();
builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 10 * 1024 * 1024; // 10MB
});

app.UseDefaultFiles(); // Serves index.html by default
app.UseStaticFiles();  // Serves wwwroot/
app.MapHub<RoomAssignHub>("/hub");
```

---

## 6. Real-Time Communication

### Transport: SignalR over WebSocket

All real-time events flow through a single SignalR hub (`RoomAssignHub`). Clients connect once on page load and remain connected for the session duration. `withAutomaticReconnect()` is enabled on the client to handle transient network failures.

### Hub Methods (Client → Server)

| Method                              | Payload                | Description                                    |
|-------------------------------------|------------------------|------------------------------------------------|
| `Join(username, geohash, sessionToken?)` | `string, string, string?` | Assigns client to a proximity-matched room. If `sessionToken` matches a disconnected user, restores them. |
| `SendMessage(content)`              | `string`               | Broadcasts text message to room                |
| `SendArt(artData)`                  | `string` (base64 PNG)  | Broadcasts drawing image to room               |

### Server Events (Server → Client)

| Event              | Payload                                                          | Description                                    |
|--------------------|------------------------------------------------------------------|------------------------------------------------|
| `RoomJoined`       | `{ roomId, roomName, userCount, sessionToken, reconnected }`     | Sent to joining client on join or reconnect    |
| `ReceiveMessage`   | `{ username, content, timestamp, type: "text" \| "art" }`       | Delivers message to all clients in room        |
| `UserJoined`       | `{ username, userCount }`                                        | Broadcast to room when a new user joins        |
| `UserLeft`         | `{ username, userCount }`                                        | Broadcast when a user's grace period expires   |
| `UserDisconnected` | `{ username, userCount }`                                        | Broadcast immediately when a user drops        |
| `UserRejoined`     | `{ username, userCount }`                                        | Broadcast when a user restores within grace period |

### Connection Lifecycle

```
Client connects → Join(username, geohash, sessionToken?)
  └─ If sessionToken matches _disconnectedUsers:
       └─ Cancel 5-minute removal timer
       └─ Restore user to their room → RoomJoined (reconnected: true)
       └─ Broadcast UserRejoined to room
  └─ If new user:
       └─ RoomService.GetOrCreateRoomForUser() → proximity matching
       └─ Add to SignalR group keyed by roomId
       └─ RoomJoined (reconnected: false) + UserJoined to room

OnDisconnectedAsync()
  └─ Move user from _connectedUsers to _disconnectedUsers
  └─ Broadcast UserDisconnected to room
  └─ Start 5-minute CancellationTokenSource timer
       └─ If timer fires → RemoveUser() + broadcast UserLeft
       └─ If user reconnects → timer cancelled, session restored
```

---

## 7. Geospatial Room System

### Geohash-Based Partitioning

Rooms are derived from the client's coarse GPS coordinates encoded as a **Geohash at precision level 5** (approximately 5 km × 5 km cells). This provides neighborhood-level proximity without exposing exact location.

```
User GPS: 37.7749° N, 122.4194° W  (San Francisco)
Geohash (precision 5): 9q8yy
→ Room candidates with geohash ~= 9q8yy are searched first
```

### Room Service

`RoomService` manages room creation and user matching using a two-pass proximity strategy:

1. **Nearby pass** — find any room within **~100 meters** (~0.062 miles, one football field) that has space (`< MaxRoomSize`)
2. **Fallback pass** — if no nearby room exists, use the absolute closest room with available space
3. **Create** — if no rooms exist at all, create a new room keyed by the user's geohash

Geohash strings are decoded server-side to approximate lat/lng (center of the ~5 km bounding box) using a BASE32 decoder. Distance is then calculated via the **Haversine formula**.

```csharp
private const double ProximityThresholdMiles = 0.062; // ~100m / one football field
private const int MaxRoomSize = 10;
private static readonly TimeSpan EmptyRoomLifetime = TimeSpan.FromMinutes(5);
```

### Room Lifecycle

```
Room Created  ──→  Active (users present)  ──→  All users disconnect
                                                        │
                                               5-minute grace period
                       User reconnects ←──── (CancellationTokenSource)
                       (timer cancelled)               │
                                               Timer fires → Room removed from memory
```

Empty rooms are scheduled for removal after **5 minutes** using a `CancellationTokenSource` timer. If a user reconnects within that window, the timer is cancelled and the room is preserved.

---

## 8. Drawing Tool Architecture

### Canvas Pipeline

```
User draws on <canvas> (mouse or touch)
        │
        ▼
art.ts captures pointer events (mousedown, mousemove, mouseup, touch*)
        │
        ▼
Canvas 2D context renders strokes in real time
  └─ stroke color from #brush-color input
  └─ line width from #brush-size input (1–40px)
  └─ eraser via composite operation (destination-out)
        │
        ▼
saveSnapshot() → stores ImageData in undoStack after each stroke
        │
        ▼
User taps "Send"
        │
        ▼
canvas.toDataURL("image/png")  →  base64 string
        │
        ▼
connection.invoke("SendArt", base64) → hub → Clients.Group(roomId).SendAsync(...)
        │
        ▼
Receivers: <img src="data:image/png;base64,..."> rendered in chat feed
```

### Canvas Configuration

| Property        | Value                                         |
|-----------------|-----------------------------------------------|
| Width           | 100% of container (responsive)                |
| Height          | 400px                                         |
| Stroke color    | User-selected via color picker (default black)|
| Stroke width    | User-selected 1–40px slider                   |
| Background      | White (`#ffffff`)                             |
| Export format   | PNG via `canvas.toDataURL("image/png")`       |
| Undo depth      | Unlimited (full ImageData stack)              |
| Redo depth      | Unlimited (full ImageData stack)              |
| Touch support   | Yes (touch events mapped to canvas coords)    |
| Max payload     | ~150 KB (enforced server-side)                |

### Server-Side Validation

```csharp
// In RoomAssignHub.SendArt()
if (string.IsNullOrEmpty(artData) || artData.Length > 200_000)
    throw new HubException("Drawing payload exceeds size limit.");
```

---

## 9. Anonymous Identity System

### Identity Flow

On the join page, the user enters a custom display name (up to 20 characters). On `Join()`, the server generates a `SessionToken` (UUIDv4) and returns it to the client, which stores it in `sessionStorage`.

```typescript
// In app.ts — after RoomJoined event
sessionStorage.setItem("pockitt_session", data.sessionToken);
sessionStorage.setItem("pockitt_username", username);
sessionStorage.setItem("pockitt_roomId", data.roomId);
```

On navigation to `chat.html`, the stored values are read and `Join()` is invoked automatically, with the session token passed for potential reconnection.

### Identity Properties

| Property       | Value                              | Lifetime           |
|----------------|------------------------------------|--------------------|
| `username`     | User-entered string (max 20 chars) | Tab session        |
| `sessionToken` | `Guid.NewGuid()` (UUIDv4)          | Tab session        |
| Server record  | `_connectedUsers[connectionId]`    | SignalR connection |
| Disconnected   | `_disconnectedUsers[sessionToken]` | 5-minute grace     |

The server never stores display names or session tokens beyond the active connection and the 5-minute reconnection window. No database writes occur for identity.

---

## 10. Data Models

### User

```csharp
public class User
{
    public string ConnectionId { get; set; } = string.Empty;
    public string SessionToken { get; set; } = Guid.NewGuid().ToString();
    public string Username { get; set; } = string.Empty;
    public NameColor UserNameColor { get; set; } = NameColor.Default;
    public string Geohash { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
}

public enum NameColor
{
    Default, Red, Green, Blue, Yellow, Orange, Purple, Pink, Brown
}
```

### Room

```csharp
public class Room
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Geohash { get; set; } = string.Empty;
    public List<User> Users { get; set; } = new();
    public List<Message> Messages { get; set; } = new();
}
```

### Message

```csharp
public enum MessageType { Text, Art, Game }

public class Message
{
    public string Username { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public MessageType Type { get; set; } = MessageType.Text;
}
```

---

## 11. API Design

### REST Endpoints

| Method | Path          | Description                              |
|--------|---------------|------------------------------------------|
| `GET`  | `/api/health` | Health check for container orchestration |

### SignalR Hub Endpoint

```
wss://<host>/hub
```

All chat and drawing events are transported exclusively over this WebSocket connection.

### Error Codes

| Code              | Meaning                               |
|-------------------|---------------------------------------|
| `PAYLOAD_TOO_LARGE` | Drawing exceeds 150 KB              |
| `NOT_IN_ROOM`     | Message sent before `Join()` completes |

---

## 12. Security & Privacy

### Threat Model

| Threat                        | Mitigation                                                    |
|-------------------------------|---------------------------------------------------------------|
| Oversized drawing payloads    | Hard cap at ~150 KB, validated on hub receive                 |
| XSS via message content       | All text rendered via `textContent`, never `innerHTML`; `escapeHtml()` wrapper for dynamic HTML |
| Exact location exposure       | Geohash precision 5 (~5 km cell) — raw GPS never sent to server |
| Session hijacking             | `sessionStorage` cleared on tab close; UUIDv4 tokens are unguessable |
| Room enumeration              | Room IDs are GUIDs; no listing endpoint                       |
| Message flooding / spam       | Rate limiting planned (Phase 4)                               |

### Recommended Headers (ASP.NET Middleware)

```csharp
app.Use(async (ctx, next) => {
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; img-src 'self' data:; connect-src 'self' wss:";
    await next();
});
```

### Data Retention Policy

- **Messages:** In-memory list, per room. Lost on process restart.
- **Sessions:** Tied to SignalR connection lifetime + 5-minute reconnect window.
- **Drawings:** Transmitted as base64 payloads, never written to disk.
- **Location:** Encoded to geohash precision 5 client-side; raw coordinates never leave the browser.

---

## 13. Docker & Deployment

### Container Architecture

A single ASP.NET Core container serves both the API and the frontend static files from `wwwroot`. The TypeScript frontend must be compiled by Vite before the Docker build (or as part of a multi-stage build that includes Node.js).

### Dockerfile (Multi-Stage)

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Pockitt.dll"]
```

### Local Development

```bash
# Terminal 1 — backend (ASP.NET Core)
dotnet run --project Pockitt/

# Terminal 2 — frontend (Vite dev server with /hub proxy)
npm run dev

# App:     http://localhost:5173
# SignalR: ws://localhost:5173/hub  (proxied to localhost:5290)
```

---

## 14. Scalability & Performance

### Horizontal Scaling Considerations

The in-memory state (`_rooms`, `_connectedUsers`, etc.) uses static dictionaries and is **not shared across instances**. For multi-instance deployments:

| Concern              | Single Instance | Multi-Instance                      |
|----------------------|-----------------|-------------------------------------|
| Room state           | In-memory       | Redis backplane required            |
| SignalR groups       | In-memory       | Redis SignalR backplane             |
| Session tracking     | In-memory       | Sticky sessions OR Redis            |

For V1, single-instance deployment is the target. The scaling path to Redis is clear.

### Performance Targets

| Metric                         | Target        |
|--------------------------------|---------------|
| Message end-to-end latency     | < 100ms (p99) |
| Page load to first interaction | < 2s          |
| Concurrent users per instance  | ~1,000        |
| Drawing payload transit time   | < 300ms (p95) |
| Room eviction after idle       | 5 minutes     |

### Message Buffer

Each room maintains an in-memory `List<Message>`. New connections joining a room could receive recent messages as backfill (planned). This avoids cold-room UX without requiring a database.

---

## 15. Non-Functional Requirements

| Category       | Requirement                                                            |
|----------------|------------------------------------------------------------------------|
| Availability   | 99.5% uptime target for single-instance V1                             |
| Latency        | P99 message delivery < 100ms on local network                          |
| Privacy        | Zero PII collection, zero long-term storage, GDPR-compatible by design |
| Accessibility  | WCAG 2.1 AA for text UI elements                                       |
| Browser Support | Last 2 versions of Chrome, Firefox, Safari, Edge                     |
| Mobile         | Responsive layout, touch support on drawing canvas                     |
| Observability  | Structured logging via `ILogger`, `/api/health` liveness probe         |

---

## 16. Development Milestones

### Phase 1 — Foundation
- [x] Single ASP.NET Core project scaffold (`Hubs/`, `Models/`, `Services/`, `wwwroot/`)
- [x] SignalR registered and `/hub` endpoint mapped
- [x] `Program.cs` service registration with `RoomService` singleton and 10 MB SignalR limit
- [x] `index.html` join page with username input
- [x] `chat.html` chat page with message feed and input bar
- [x] Vite dev server with `/hub` proxy to ASP.NET backend
- [x] TypeScript configuration (`tsconfig.json`, `vite.config.ts`)

### Phase 2 — Core Features
- [x] Geolocation acquisition + geohash encoding (`geo.ts`)
- [x] `RoomService` — geohash decode + Haversine proximity room matching
- [x] `Join` / `SendMessage` / `SendArt` hub methods
- [x] `RoomJoined`, `ReceiveMessage`, `UserJoined`, `UserLeft`, `UserDisconnected`, `UserRejoined` events
- [x] Session token generation and `sessionStorage` persistence
- [x] Auto-join from `chat.html` using stored session
- [x] Chat feed UI with text and art message rendering
- [x] Room name and participant count display in header
- [x] System messages for join/leave/disconnect/rejoin events

### Phase 3 — Drawing Tool
- [x] HTML5 Canvas drawing surface (pointer + touch events)
- [x] Color picker, brush size slider (1–40px)
- [x] Eraser mode
- [x] Undo / redo stacks (`ImageData` snapshots)
- [x] Clear canvas
- [x] `SendArt` hub method (base64 PNG)
- [x] Drawing message rendering in chat feed as `<img>`
- [x] Server-side payload size validation

### Phase 4 — Hardening
- [ ] Rate limiting middleware (10 messages / 10s per connection)
- [ ] Security headers middleware (CSP, X-Frame-Options, X-Content-Type-Options)
- [ ] Message ring buffer backfill on join (last 50 messages)
- [ ] Health check endpoint (`/api/health`)
- [ ] `UserNameColor` selection in UI
- [ ] Comprehensive unit, integration, and E2E test coverage
- [ ] Docker multi-stage build with Node.js frontend compilation

---

*This document is the authoritative engineering specification for Pockitt V1. All implementation decisions should reference this spec. Deviations require a spec update.*
