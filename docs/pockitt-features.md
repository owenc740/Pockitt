# Pockitt — Feature Overview

## Overview

Pockitt is an accountless, location-based group chat web application. Users connect with people in their immediate geographic area, communicate through chat, and express themselves via a built-in drawing tool. No accounts, no sign-up, no emoji — just local, ephemeral connection.

---

## Tech Stack

| Layer          | Technology                       |
|----------------|----------------------------------|
| Containerization | Docker (single container)      |
| Frontend        | HTML + Tailwind CSS + TypeScript |
| Backend         | ASP.NET Core 10 + SignalR       |

---

## Core Features

### Accountless Access
- No registration or login required.
- Users are assigned an anonymous, ephemeral identity on session start.
- No personal data is stored or persisted beyond the session.

### Location-Based Chat Rooms
- Chat rooms are automatically generated around users within a general geographic area.
- Room membership is determined by proximity — users in the same area share the same room.
- Rooms are dynamic: they form and dissolve based on active participants.
- No manual room creation or joining required.

### Drawing Tool
- Users have access to an in-app canvas drawing tool.
- Drawings can be submitted directly to the group chat as images.
- The drawing tool serves as the primary expressive medium for visual communication.
- No emoji support — drawings replace emoji as the visual communication method.

---

## Design Principles

- **Ephemeral by default** — no history, no accounts, no persistence.
- **Proximity-driven** — community forms organically around shared location.
- **Visual-first** — drawing is the expressive outlet, not text emoji.
- **Zero friction** — open the app and you're in.

---

## Deployment

The application is a single **ASP.NET Core** project containerized with **Docker**. The backend serves the frontend static files directly from `wwwroot`, eliminating the need for a separate frontend container or reverse proxy. SignalR handles all real-time communication over WebSocket.
