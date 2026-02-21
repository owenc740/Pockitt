var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export function initArt(connection) {
    const canvas = document.getElementById("drawing-canvas");
    const ctx = canvas.getContext("2d");
    const clearBtn = document.getElementById("clear-canvas-btn");
    const sendBtn = document.getElementById("send-drawing-btn");
    const closeBtn = document.getElementById("close-drawing-btn");
    const drawingPanel = document.getElementById("drawing-panel");
    const undoBtn = document.getElementById("undo-btn");
    const redoBtn = document.getElementById("redo-btn");
    const eraserBtn = document.getElementById("eraser-btn");
    const brushSizeInput = document.getElementById("brush-size");
    const brushColorInput = document.getElementById("brush-color");
    // Canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    // Drawing state
    let isDrawing = false;
    let isEraser = false;
    let undoStack = [];
    let redoStack = [];
    // Save initial blank state
    saveSnapshot();
    // ---- Snapshot Functions ----
    function saveSnapshot() {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        redoStack = []; // Clear redo stack on new action
    }
    function undo() {
        if (undoStack.length <= 1)
            return; // Keep the blank state
        redoStack.push(undoStack.pop());
        ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
    }
    function redo() {
        if (redoStack.length === 0)
            return;
        const snapshot = redoStack.pop();
        undoStack.push(snapshot);
        ctx.putImageData(snapshot, 0, 0);
    }
    // ---- Drawing Functions ----
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e instanceof MouseEvent ? e.clientX : e.clientX;
        const clientY = e instanceof MouseEvent ? e.clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    function startDrawing(e) {
        isDrawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }
    function draw(e) {
        if (!isDrawing)
            return;
        const pos = getPos(e);
        ctx.lineWidth = parseInt(brushSizeInput.value);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (isEraser) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
        }
        else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = brushColorInput.value;
        }
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }
    function stopDrawing() {
        if (!isDrawing)
            return;
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
    sendBtn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
        const dataUrl = canvas.toDataURL("image/png");
        yield connection.invoke("SendArt", dataUrl);
        // Clear and close panel after sending
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        undoStack = [];
        redoStack = [];
        saveSnapshot();
        drawingPanel.hidden = true;
    }));
    closeBtn.addEventListener("click", () => {
        drawingPanel.hidden = true;
    });
}
