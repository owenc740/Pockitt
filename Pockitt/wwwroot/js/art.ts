import * as signalR from "@microsoft/signalr";

export function initArt(connection: signalR.HubConnection): { openPanel: () => void } {
    const canvas = document.getElementById("drawing-canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    const clearBtn = document.getElementById("clear-canvas-btn") as HTMLButtonElement;
    const sendBtn = document.getElementById("send-drawing-btn") as HTMLButtonElement;
    const closeBtn = document.getElementById("close-drawing-btn") as HTMLButtonElement;
    const drawingPanel = document.getElementById("drawing-panel") as HTMLDivElement;
    const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement;
    const redoBtn = document.getElementById("redo-btn") as HTMLButtonElement;
    const eraserBtn = document.getElementById("eraser-btn") as HTMLButtonElement;
    const brushSizeInput = document.getElementById("brush-size") as HTMLInputElement;
    const brushColorInput = document.getElementById("brush-color") as HTMLInputElement;

    // Drawing state
    let isDrawing = false;
    let isEraser = false;
    let undoStack: ImageData[] = [];
    let redoStack: ImageData[] = [];

    // ---- Snapshot Functions ----

    function saveSnapshot(): void {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        redoStack = []; // Clear redo stack on new action
    }

    function undo(): void {
        if (undoStack.length <= 1) return; // Keep the blank state
        redoStack.push(undoStack.pop()!);
        ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
    }

    function redo(): void {
        if (redoStack.length === 0) return;
        const snapshot = redoStack.pop()!;
        undoStack.push(snapshot);
        ctx.putImageData(snapshot, 0, 0);
    }

    // ---- Drawing Functions ----

    function getPos(e: MouseEvent | Touch): { x: number; y: number } {
        const rect = canvas.getBoundingClientRect();
        const clientX = e instanceof MouseEvent ? e.clientX : e.clientX;
        const clientY = e instanceof MouseEvent ? e.clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e: MouseEvent | Touch): void {
        isDrawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function draw(e: MouseEvent | Touch): void {
        if (!isDrawing) return;
        const pos = getPos(e);

        ctx.lineWidth = parseInt(brushSizeInput.value);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (isEraser) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = brushColorInput.value;
        }

        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function stopDrawing(): void {
        if (!isDrawing) return;
        isDrawing = false;
        ctx.closePath();
        saveSnapshot();
    }

    // ---- Mouse Events ----

    canvas.addEventListener("mousedown", (e) => startDrawing(e));
    canvas.addEventListener("mousemove", (e) => draw(e));
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);

    // ---- Touch Events ----

    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener("touchend", stopDrawing);

    // ---- Button Controls ----

    clearBtn.addEventListener("click", () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveSnapshot();
    });

    undoBtn.addEventListener("click", undo);
    redoBtn.addEventListener("click", redo);

    eraserBtn.addEventListener("click", () => {
        isEraser = !isEraser;
        eraserBtn.classList.toggle("active", isEraser);
    });

    sendBtn.addEventListener("click", async () => {
        const dataUrl = canvas.toDataURL("image/png");
        await connection.invoke("SendArt", dataUrl);

        // Clear and close panel after sending
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        undoStack = [];
        redoStack = [];
        saveSnapshot();
        drawingPanel.hidden = true;
    });

    closeBtn.addEventListener("click", () => {
        drawingPanel.hidden = true;
    });

    return {
        openPanel: () => {
            drawingPanel.hidden = false;
            requestAnimationFrame(() => {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                saveSnapshot();
            });
        }
    };
}
