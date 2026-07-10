# Pockitt
<img width="1425" height="1002" alt="image" src="https://github.com/user-attachments/assets/935bcecd-c896-4a36-a6d0-e0f6024add71" />

### First Place Winner
[Awarded first place at Hack@URI 2026 (Creative Currents Track)](https://devpost.com/software/pockitt)

### What is Pockitt?
Pockitt connects users in close physical locations with each other, allowing them to chat anonymously with simple yet fun options such as text chat, drawing, a minigame invite, and more! It's focused on simplicity and creativity, so no emojis, no images or gifs, no pasting, just whatever you can come up with in words or drawings!

### How we built it
We used ASP.NET Core for the backend along with SignalR for connectivity, then we used TypeScript and HTML/CSS for frontend, with Node.js for package management. Additionally, we used Docker for development compatibility.

### Inspiration
Pockitt is inspired by simple, creative, and fun chatting tools from our youth such as Pictochat for the Nintendo DS, and connecting with the community around us in a new way.

### Getting Started

Pockitt runs inside a Docker dev container, so you don't need to install .NET or Node directly on your machine.

**Prerequisites**
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [VS Code](https://code.visualstudio.com) with the **Dev Containers** extension (`ms-vscode-remote.remote-containers`)

**Setup**
1. Clone the repo and open the folder in VS Code.
2. When prompted, choose **Reopen in Container** (or run **Dev Containers: Reopen in Container** from the command palette). The first build takes a few minutes while it pulls the .NET image and installs Node.
3. Install the frontend dependencies: "npm install"

**Running the app**

Pockitt needs two processes running at the same time: the ASP.NET Core backend and the Vite dev server. Open two terminals in the container.

Terminal 1 (backend): "dotnet run --project Pockitt"
Terminal 2 (frontend): "npm run dev"

Then open the forwarded **5173** port (Vite). The dev server proxies real-time traffic to the backend automatically, so you always visit 5173, not 5290.