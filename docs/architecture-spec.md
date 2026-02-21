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
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Docker Network   │
                    │  (bridge/compose)  │
                    └────────────────────┘
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

| Layer            | Technology          | Rationale                                                                 |
|------------------|---------------------|---------------------------------------------------------------------------|
| Containerization | Docker + Compose    | Reproducible builds, single-command dev environment, prod parity          |
| Package Manager  | Node.js / npm       | Manages frontend toolchain (Vite, Tailwind build pipeline)                |
| Frontend         | Tailwind CSS + Vite | Utility-first, zero runtime CSS overhead, fast HMR builds                 |
| Backend          | ASP.NET Core 8      | High-performance, built-in SignalR for real-time, strong typing           |
| Real-Time        | SignalR (WebSocket) | Native ASP.NET integration, automatic fallback, group broadcasting        |
| Geo              | Geohash             | O(1) room lookup by encoding lat/lng into a string prefix                 |
| Drawing          | HTML5 Canvas API    | Native browser support, no dependencies, direct pixel manipulation        |
| State            | IMemoryCache        | Ephemeral by design — in-process cache enforces no long-term persistence  |

---

## 4. Frontend Architecture

### Directory Structure

```
/frontend
├── src/
│   ├── components/
│   │   ├── ChatFeed.js          # Message list renderer
│   │   ├── MessageInput.js      # Text input bar
│   │   ├── DrawingCanvas.js     # Canvas drawing tool
│   │   └── DrawingSendButton.js # Submit drawing to chat
│   ├── services/
│   │   ├── signalr.js           # SignalR connection manager
│   │   ├── geo.js               # Geolocation + geohash encoding
│   │   └── session.js           # Ephemeral identity management
│   ├── main.js                  # App entry point
│   └── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

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
/backend
├── Pockitt.Api/
│   ├── Hubs/
│   │   └── PockittHub.cs          # SignalR hub (chat + drawing)
│   ├── Services/
│   │   ├── RoomEngine.cs          # Geohash → room mapping
│   │   ├── SessionService.cs      # Ephemeral session management
│   │   └── MessageBuffer.cs       # In-memory ring buffer per room
│   ├── Controllers/
│   │   └── ImageController.cs     # Drawing image upload endpoint
│   ├── Models/
│   │   ├── ChatMessage.cs
│   │   ├── DrawingMessage.cs
│   │   └── Session.cs
│   ├── Program.cs
│   └── appsettings.json
└── Pockitt.Api.csproj
```

### Program.cs Bootstrap

```csharp
builder.Services.AddSignalR();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<RoomEngine>();
builder.Services.AddSingleton<SessionService>();

app.MapHub<PockittHub>("/hub");
app.MapControllers();
```

---

## 6. Real-Time Communication

### Transport: SignalR over WebSocket

All real-time events flow through a single SignalR hub (`PockittHub`). Clients connect once on page load and remain connected for the session duration.

### Hub Methods

| Direction          | Method                   | Payload                        | Description                        |
|--------------------|--------------------------|--------------------------------|------------------------------------|
| Client → Server    | `JoinRoom(geohash)`      | `string geohash`               | Assigns client to a SignalR group  |
| Client → Server    | `SendMessage(text)`      | `string text`                  | Broadcasts text to room            |
| Client → Server    | `SendDrawing(imageData)` | `string base64`                | Broadcasts drawing to room         |
| Server → Client    | `ReceiveMessage`         | `ChatMessage`                  | Delivers message to all in room    |
| Server → Client    | `ReceiveDrawing`         | `DrawingMessage`               | Delivers drawing to all in room    |
| Server → Client    | `RoomInfo`               | `{ roomId, participantCount }` | Room metadata on join              |

### Connection Lifecycle

```
OnConnectedAsync()
  └─ Assign ephemeral SessionId
  └─ Return SessionId + generated display name to client

JoinRoom(geohash)
  └─ Validate geohash precision (level 5, ~5km cell)
  └─ Add connection to SignalR Group by geohash
  └─ Broadcast RoomInfo to joiner

OnDisconnectedAsync()
  └─ Remove connection from group
  └─ If room is empty → evict room from cache
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

### Room Engine

```csharp
public class RoomEngine
{
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan RoomTtl = TimeSpan.FromMinutes(30);

    public string GetOrCreateRoom(string geohash)
    {
        string roomId = $"room:{geohash}";
        _cache.GetOrCreate(roomId, entry =>
        {
            entry.SlidingExpiration = RoomTtl;
            return new RoomState(roomId);
        });
        return roomId;
    }

    public void TouchRoom(string roomId)
    {
        // Resets TTL on activity — rooms dissolve 30 min after last message
        _cache.TryGetValue(roomId, out RoomState _);
    }
}
```

### Room Lifecycle

```
Room Created  ──→  Active (messages flowing)  ──→  Idle 30 min  ──→  Evicted from cache
     ↑                        │
     └────────────────────────┘  (activity resets TTL)
```

---

## 8. Drawing Tool Architecture

### Canvas Pipeline

```
User draws on <canvas>
        │
        ▼
DrawingCanvas.js captures pointer events (mousedown, mousemove, mouseup, touch*)
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

### ChatMessage

```csharp
public record ChatMessage(
    string SenderName,    // "Anon#4821"
    string Text,          // message body
    DateTimeOffset SentAt // UTC timestamp
);
```

### DrawingMessage

```csharp
public record DrawingMessage(
    string SenderName,    // "Anon#4821"
    string ImageData,     // "data:image/png;base64,..."
    DateTimeOffset SentAt
);
```

### RoomState

```csharp
public class RoomState
{
    public string RoomId { get; }
    public ConcurrentQueue<object> MessageBuffer { get; } = new(); // max 50
    public int ParticipantCount { get; set; }
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

```
docker-compose.yml
├── pockitt-frontend   (Node.js/Vite build → nginx serve static)
└── pockitt-backend    (ASP.NET Core 8 runtime)
```

### docker-compose.yml

```yaml
version: "3.9"

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "5000:8080"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ASPNETCORE_URLS=http://+:8080
```

### Frontend Dockerfile (Multi-Stage)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Backend Dockerfile (Multi-Stage)

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Pockitt.Api.dll"]
```

### Local Development

```bash
# Start everything
docker compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
# SignalR:  ws://localhost:5000/hub
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
- [ ] Docker Compose setup (frontend + backend containers)
- [ ] ASP.NET Core project scaffold with SignalR
- [ ] Vite + Tailwind frontend scaffold
- [ ] `/hub` WebSocket connection established end-to-end
- [ ] Ephemeral session identity (client-side UUID + display name)

### Phase 2 — Core Features
- [ ] Geolocation acquisition + geohash encoding (client)
- [ ] `RoomEngine` — geohash to room mapping (server)
- [ ] `JoinRoom` / `SendMessage` / `ReceiveMessage` hub methods
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
