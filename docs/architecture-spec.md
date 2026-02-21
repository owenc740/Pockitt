# Pockitt — Engineering & Architecture Specification

> **Version:** 1.0.0
> **Status:** Draft
> **Last Updated:** 2026-02-21

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
│                     ASP.NET Core API                        │
│                                                             │
│   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐  │
│   │  SignalR Hub │   │  Room Engine │   │  Image Upload │  │
│   │  (Chat/Draw) │   │  (Geohash)   │   │   Controller  │  │
│   └──────┬───────┘   └──────┬───────┘   └───────┬───────┘  │
│          │                  │                    │          │
│          └──────────────────┼────────────────────┘          │
│                             │                               │
│   ┌──────────────────────────▼──────────────────────────┐   │
│   │              In-Memory Cache (IMemoryCache)          │   │
│   │         Rooms · Sessions · Message Buffers           │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              wwwroot (Static Files)                  │   │
│   │         index.html · css/ · js/                      │   │
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
PockittHub.SendMessage() receives payload
       │
       ▼
RoomEngine validates sender is member of room
       │
       ▼
Message appended to in-memory ring buffer (last 50 msgs)
       │
       ▼
Hub broadcasts to all connections in SignalR Group (room)
       │
       ▼
All clients receive and render message in real time
```

---

## 3. Tech Stack Rationale

| Layer            | Technology                        | Rationale                                                                 |
|------------------|-----------------------------------|---------------------------------------------------------------------------|
| Containerization | Docker                            | Reproducible builds, single-command dev environment, prod parity          |
| Frontend         | HTML + Tailwind CSS + TypeScript  | Static files served from `wwwroot`; utility-first CSS, strong typing      |
| Backend          | ASP.NET Core 10                   | High-performance, built-in SignalR, serves frontend static files          |
| Real-Time        | SignalR (WebSocket)               | Native ASP.NET integration, automatic fallback, group broadcasting        |
| Geo              | Geohash + Haversine               | Client encodes to geohash; server decodes to lat/lng for proximity matching |
| Drawing          | HTML5 Canvas API                  | Native browser support, no dependencies, direct pixel manipulation        |
| State            | In-Memory (Dictionary)            | Ephemeral by design — static dictionaries in hub; no long-term persistence |

---

## 4. Frontend Architecture

### Directory Structure

```
wwwroot/
├── css/
│   └── style.css       # Tailwind-compiled stylesheet
├── js/
│   ├── geo.js          # Geolocation + geohash encoding (complete)
│   └── app.ts          # App entry point (TypeScript, in progress)
└── index.html
```

> **Planned JS modules** (to be added): `signalr.js` (SignalR connection manager), `session.js` (ephemeral identity), `chat.js` (chat feed renderer), `canvas.js` (drawing tool).

### State Management

No framework required. The app uses minimal vanilla JS state:

```
AppState {
  sessionId: string          // ephemeral UUID
  displayName: string        // randomly generated handle
  roomId: string             // geohash-derived room ID
  messages: Message[]        // bounded ring buffer, max 50
  isDrawing: boolean         // drawing panel open/closed
}
```

### UI Layout

```
┌──────────────────────────────────────┐
│  Pockitt          [area: Downtown]   │  ← header
├──────────────────────────────────────┤
│                                      │
│  [Anon#3921]  hey                    │
│  [Anon#7142]  what's up              │
│  [Anon#3921]  [drawing image]        │  ← chat feed
│                                      │
├──────────────────────────────────────┤
│  [✏ Draw]  [____________________] →  │  ← input bar
└──────────────────────────────────────┘
```

When the draw button is pressed, a canvas overlay replaces the chat feed:

```
┌──────────────────────────────────────┐
│  Drawing                    [Cancel] │
├──────────────────────────────────────┤
│                                      │
│           (canvas area)              │
│                                      │
├──────────────────────────────────────┤
│  [Clear]                    [Send]   │
└──────────────────────────────────────┘
```

---

## 5. Backend Architecture

### Project Structure (ASP.NET Core)

```
Pockitt/
├── Hubs/
│   └── RoomAssignHub.cs       # SignalR hub (chat, drawing, session reconnect)
├── Models/
│   ├── Message.cs             # Message + MessageType enum (Text/Art/Game)
│   ├── Room.cs                # Room model (Id, Name, Geohash, Users, Messages)
│   └── User.cs                # User model (ConnectionId, SessionToken, Username, Geohash, RoomId)
├── Services/
│   └── RoomService.cs         # Geohash decode + Haversine proximity room matching
├── wwwroot/                   # Frontend static files
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── geo.js
│   │   └── app.ts
│   └── index.html
└── Program.cs
```

### Program.cs Bootstrap

```csharp
builder.Services.AddSingleton<RoomService>();
builder.Services.AddSignalR();

app.UseDefaultFiles(); // Serves index.html by default
app.UseStaticFiles();  // Serves wwwroot/
app.MapHub<RoomAssignHub>("/hub");
```

---

## 6. Real-Time Communication

### Transport: SignalR over WebSocket

All real-time events flow through a single SignalR hub (`RoomAssignHub`). Clients connect once on page load and remain connected for the session duration.

### Hub Methods

| Direction          | Method                          | Payload                                           | Description                              |
|--------------------|---------------------------------|---------------------------------------------------|------------------------------------------|
| Client → Server    | `Join(username, geohash, sessionToken?)` | `string, string, string?`          | Assigns client to a proximity-matched room |
| Client → Server    | `SendMessage(content)`          | `string content`                                  | Broadcasts text message to room          |
| Client → Server    | `SendArt(artData)`              | `string base64`                                   | Broadcasts drawing image to room         |
| Server → Client    | `RoomJoined`                    | `{ roomId, roomName, userCount, sessionToken, reconnected }` | Room info on join or reconnect |
| Server → Client    | `ReceiveMessage`                | `{ username, content, timestamp, type }`          | Delivers message to all in room          |
| Server → Client    | `UserJoined`                    | `{ username, userCount }`                         | Notifies room of new participant         |
| Server → Client    | `UserLeft`                      | `{ username, userCount }`                         | Notifies room of departed participant    |

### Connection Lifecycle

```
Client connects → Join(username, geohash, sessionToken?)
  └─ If sessionToken matches disconnected user:
       └─ Cancel 5-minute removal timer
       └─ Restore user to their room → RoomJoined (reconnected: true)
  └─ If new user:
       └─ RoomService finds closest room within ~100m (one football field)
       └─ Falls back to absolute closest room with space if none nearby
       └─ Creates new room if no rooms exist
       └─ RoomJoined (reconnected: false) + UserJoined broadcast to room

OnDisconnectedAsync()
  └─ Move user to disconnected map
  └─ Start 5-minute grace period timer
  └─ If timer expires → remove user from room, broadcast UserLeft
  └─ If user reconnects within 5 min → timer cancelled, user restored
```

---

## 7. Geospatial Room System

### Geohash-Based Partitioning

Rooms are derived from the client's coarse GPS coordinates encoded as a **Geohash** at precision level **5** (approximately 5km × 5km cells). This provides neighborhood-level proximity without exposing exact location.

```
User GPS: 37.7749° N, 122.4194° W  (San Francisco)
Geohash (level 5): 9q8yy
→ Room ID: room:9q8yy
```

### Room Service

`RoomService` manages room creation and user matching using a two-pass proximity strategy:

1. **Nearby pass** — find any room within **~100 meters** (~0.062 miles, one football field) that has space
2. **Fallback pass** — if no nearby room exists, use the absolute closest room with available space
3. **Create** — if no rooms exist at all, create a new room keyed by the user's geohash

Geohash strings are decoded server-side to approximate lat/lng (center of the ~5km bounding box) using a BASE32 decoder. Distance is then calculated via the Haversine formula.

```csharp
private const double ProximityThresholdMiles = 0.062; // ~100m / one football field
private const int MaxRoomSize = 10;
```

### Room Lifecycle

```
Room Created  ──→  Active (users present)  ──→  All users disconnect
                                                        │
                                               5-minute grace period
                                                        │
                                          Room removed from memory
```

Empty rooms are scheduled for removal after **5 minutes** using a `CancellationTokenSource` timer. If a user reconnects within that window, the timer is cancelled and the room is preserved.

---

## 8. Drawing Tool Architecture

### Canvas Pipeline

```
User draws on <canvas>
        │
        ▼
canvas.js captures pointer events (mousedown, mousemove, mouseup, touch*)
        │
        ▼
Canvas 2D context renders strokes in real time (black ink, 3px line width)
        │
        ▼
User taps "Send"
        │
        ▼
canvas.toDataURL("image/png")  →  base64 string
        │
        ▼
SignalR SendDrawing(base64) → hub → broadcast to room
        │
        ▼
Receivers: <img src="data:image/png;base64,..."> rendered in chat feed
```

### Canvas Configuration

| Property        | Value                     |
|-----------------|---------------------------|
| Resolution      | 600 × 400px logical       |
| Stroke color    | `#1a1a1a` (near-black)    |
| Stroke width    | 3px                       |
| Background      | White (`#ffffff`)         |
| Export format   | PNG via `toDataURL`       |
| Max payload     | ~150KB (enforced server-side) |

### Server-Side Validation

```csharp
// ImageController.cs or hub validation
if (imageData.Length > 200_000) // ~150KB base64
    throw new HubException("Drawing payload exceeds size limit.");

if (!imageData.StartsWith("data:image/png;base64,"))
    throw new HubException("Invalid image format.");
```

---

## 9. Anonymous Identity System

### Identity Generation

On first page load, the client generates a session identity stored in `sessionStorage` (clears on tab close):

```js
// session.js
export function getOrCreateSession() {
  let session = sessionStorage.getItem('pockitt_session');
  if (!session) {
    session = JSON.stringify({
      id: crypto.randomUUID(),
      displayName: generateName() // e.g., "Anon#4821"
    });
    sessionStorage.setItem('pockitt_session', session);
  }
  return JSON.parse(session);
}

function generateName() {
  return `Anon#${Math.floor(1000 + Math.random() * 9000)}`;
}
```

### Identity Properties

| Property      | Value                            | Lifetime         |
|---------------|----------------------------------|------------------|
| `id`          | `crypto.randomUUID()` (UUIDv4)   | Tab session      |
| `displayName` | `Anon#XXXX`                      | Tab session      |
| Server record | `ConnectionId → SessionId` map   | SignalR lifetime |

The server never stores display names or session IDs beyond the active WebSocket connection. No database writes occur for identity.

---

## 10. Data Models

### User

```csharp
public class User
{
    public string ConnectionId { get; set; } = string.Empty;
    public string SessionToken { get; set; } = Guid.NewGuid().ToString();
    public string Username { get; set; } = string.Empty;
    public string Geohash { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
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

| Method | Path              | Description                                  |
|--------|-------------------|----------------------------------------------|
| `GET`  | `/api/health`     | Health check for container orchestration     |
| `GET`  | `/api/room/info?geohash=9q8yy` | Returns room metadata (participant count) |

### SignalR Hub Endpoint

```
wss://<host>/hub
```

All chat and drawing events are transported exclusively over this WebSocket connection.

### Error Codes

| Code | Meaning                          |
|------|----------------------------------|
| `INVALID_GEOHASH`  | Geohash precision not level 5 |
| `PAYLOAD_TOO_LARGE` | Drawing exceeds 150KB         |
| `INVALID_FORMAT`   | Image data not valid PNG base64 |
| `NOT_IN_ROOM`      | Message sent before JoinRoom    |

---

## 12. Security & Privacy

### Threat Model

| Threat                         | Mitigation                                              |
|--------------------------------|---------------------------------------------------------|
| Message flooding / spam        | Server-side rate limit: 10 messages / 10s per connection |
| Oversized drawing payloads     | Hard cap at 150KB, validated on hub receive             |
| XSS via message content        | All text rendered via `textContent`, never `innerHTML`  |
| Exact location exposure        | Geohash level 5 (~5km cell) — never store raw GPS       |
| Session hijacking              | `sessionStorage` cleared on tab close, UUIDv4 unguessable |
| Room enumeration               | Room IDs are geohashes; no listing endpoint             |

### Headers (ASP.NET Middleware)

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

- **Messages:** In-memory ring buffer, max 50 per room. Lost on process restart.
- **Sessions:** Tied to SignalR connection lifetime only.
- **Drawings:** Transmitted as base64 payloads, never written to disk.
- **Location:** Encoded to geohash precision 5, raw coordinates never leave the client.

---

## 13. Docker & Deployment

### Container Architecture

A single ASP.NET Core container serves both the API and the frontend static files from `wwwroot`. No separate frontend container or reverse proxy required.

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
# Build and run
docker build -t pockitt .
docker run -p 5000:8080 pockitt

# App:     http://localhost:5000
# SignalR: ws://localhost:5000/hub
```

---

## 14. Scalability & Performance

### Horizontal Scaling Considerations

The default in-memory `IMemoryCache` is **not shared across instances**. For multi-instance deployments:

| Concern                 | Single Instance | Multi-Instance                             |
|-------------------------|-----------------|--------------------------------------------|
| Room state              | In-memory       | Redis backplane required                   |
| SignalR groups          | In-memory       | Redis SignalR backplane                    |
| Session tracking        | In-memory       | Sticky sessions OR Redis                   |

For V1, single-instance deployment is the target. Scaling path is clear.

### Performance Targets

| Metric                        | Target          |
|-------------------------------|-----------------|
| Message end-to-end latency    | < 100ms (p99)   |
| Page load to first interaction | < 2s           |
| Concurrent users per instance | ~1,000          |
| Drawing payload transit time  | < 300ms (p95)   |
| Room eviction after idle      | 30 minutes      |

### Message Buffer Strategy

Each room maintains a **ring buffer of 50 messages** in memory. New connections joining a room receive the last 50 messages as backfill. This avoids cold-room UX without requiring a database.

---

## 15. Non-Functional Requirements

| Category      | Requirement                                                            |
|---------------|------------------------------------------------------------------------|
| Availability  | 99.5% uptime target for single-instance V1                             |
| Latency       | P99 message delivery < 100ms on local network                          |
| Privacy       | Zero PII collection, zero long-term storage, GDPR-compatible by design |
| Accessibility | WCAG 2.1 AA for text UI elements                                       |
| Browser Support | Last 2 versions of Chrome, Firefox, Safari, Edge                    |
| Mobile        | Responsive layout, touch support on drawing canvas                     |
| Observability | Structured logging via `ILogger`, `/api/health` liveness probe         |

---

## 16. Development Milestones

### Phase 1 — Foundation
- [x] Single ASP.NET Core project scaffold (`Hubs/`, `Models/`, `Services/`, `wwwroot/`)
- [x] SignalR registered and `/hub` endpoint mapped
- [x] `app.ts` TypeScript entry point placeholder in `wwwroot/js/`
- [ ] `wwwroot/index.html` populated with Tailwind CSS layout
- [ ] `/hub` WebSocket connection established end-to-end
- [ ] Ephemeral session identity (client-side UUID + display name)
- [ ] Docker single-container build and run

### Phase 2 — Core Features
- [x] Geolocation acquisition + geohash encoding (`geo.js`)
- [x] `RoomService` — geohash decode + proximity-based room matching (server)
- [x] `Join` / `SendMessage` / `SendArt` hub methods
- [ ] Chat feed UI with message rendering
- [ ] Room participant count display

### Phase 3 — Drawing Tool
- [ ] HTML5 Canvas drawing surface (pointer + touch events)
- [ ] Stroke rendering, clear, undo
- [ ] `SendDrawing` hub method (base64 PNG)
- [ ] Drawing message rendering in chat feed
- [ ] Server-side payload validation

### Phase 4 — Hardening
- [ ] Rate limiting middleware
- [ ] Security headers
- [ ] Message ring buffer backfill on join
- [ ] Idle room eviction
- [ ] Error states and reconnection logic (SignalR auto-reconnect)
- [ ] Health check endpoint

---

*This document is the authoritative engineering specification for Pockitt V1. All implementation decisions should reference this spec. Deviations require a spec update.*
