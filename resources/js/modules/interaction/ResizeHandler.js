export class ResizeHandler {
    constructor(editor) {
        this.editor = editor;
        this.isResizing = false;
        this.resizeElement = null;
        this.resizePosition = null;
        this.resizeStartData = null;
        this.originalSnapState = undefined;
        
        // Bind methods
        this.boundHandleResize = this.handleResize.bind(this);
        this.boundStopResize = this.stopResize.bind(this);
    }

    startResize(element, position, e) {
        this.isResizing = true;
        this.resizePosition = position;
        this.resizeElement = element;
        
        const elementData = this.editor.elements.find(el => el.id === element.dataset.id);
        if (!elementData) return;
        
        // Store initial state
        this.resizeStartData = {
            x: elementData.x,
            y: elementData.y,
            width: elementData.width,
            height: elementData.height,
            mouseX: e.clientX,
            mouseY: e.clientY
        };
        
        // Disable snapping during resize for complete independence
        this.originalSnapState = this.editor.snapEnabled;
        this.editor.snapEnabled = false;
        this.editor.snapManager.clearSnapIndicators();
        
        // Add event listeners
        document.addEventListener("mousemove", this.boundHandleResize);
        document.addEventListener("mouseup", this.boundStopResize);
        
        // Prevent text selection during resize
        document.body.style.userSelect = "none";
    }

    handleResize(e) {
        if (!this.isResizing || !this.resizeElement) return;
        
        const elementData = this.editor.elements.find(el => el.id === this.resizeElement.dataset.id);
        if (!elementData) return;
        
        // Calculate mouse movement
        const deltaX = (e.clientX - this.resizeStartData.mouseX) / this.editor.zoomLevel;
        const deltaY = (e.clientY - this.resizeStartData.mouseY) / this.editor.zoomLevel;
        
        // Calculate new dimensions and position based on resize handle
        let newX = this.resizeStartData.x;
        let newY = this.resizeStartData.y;
        let newWidth = this.resizeStartData.width;
        let newHeight = this.resizeStartData.height;
        
        switch (this.resizePosition) {
            case "nw":
                newX = this.resizeStartData.x + deltaX;
                newY = this.resizeStartData.y + deltaY;
                newWidth = this.resizeStartData.width - deltaX;
                newHeight = this.resizeStartData.height - deltaY;
                break;
            case "n":
                newY = this.resizeStartData.y + deltaY;
                newHeight = this.resizeStartData.height - deltaY;
                break;
            case "ne":
                newY = this.resizeStartData.y + deltaY;
                newWidth = this.resizeStartData.width + deltaX;
                newHeight = this.resizeStartData.height - deltaY;
                break;
            case "e":
                newWidth = this.resizeStartData.width + deltaX;
                break;
            case "se":
                newWidth = this.resizeStartData.width + deltaX;
                newHeight = this.resizeStartData.height + deltaY;
                break;
            case "s":
                newHeight = this.resizeStartData.height + deltaY;
                break;
            case "sw":
                newX = this.resizeStartData.x + deltaX;
                newWidth = this.resizeStartData.width - deltaX;
                newHeight = this.resizeStartData.height + deltaY;
                break;
            case "w":
                newX = this.resizeStartData.x + deltaX;
                newWidth = this.resizeStartData.width - deltaX;
                break;
        }
        
        // Enforce minimum size
        const minSize = this.editor.config.constraints.minElementSize;
        if (newWidth < minSize) {
            if (this.resizePosition.includes("w")) {
                newX = newX - (minSize - newWidth);
            }
            newWidth = minSize;
        }
        if (newHeight < minSize) {
            if (this.resizePosition.includes("n")) {
                newY = newY - (minSize - newHeight);
            }
            newHeight = minSize;
        }
        
        // Allow elements to extend beyond canvas bounds for overlapping designs
        // Only constrain to prevent elements from being moved completely off-screen
        const canvasWidth = this.editor.canvas.offsetWidth;
        const canvasHeight = this.editor.canvas.offsetHeight;
        const BOUNDARY_MARGIN = 50; // Allow some margin for grabbing elements
        
        newX = Math.max(-newWidth + BOUNDARY_MARGIN, Math.min(newX, canvasWidth - BOUNDARY_MARGIN));
        newY = Math.max(-newHeight + BOUNDARY_MARGIN, Math.min(newY, canvasHeight - BOUNDARY_MARGIN));
        
        // Update element data
        elementData.x = newX;
        elementData.y = newY;
        elementData.width = newWidth;
        elementData.height = newHeight;
        
        // Update visual element
        this.editor.elementRenderer.updateElementStyle(this.resizeElement, elementData);
        
        // Update visual controls position
        this.editor.visualControls.updateVisualControlsPosition(this.resizeElement);
        
        // Update properties panel
        this.editor.propertiesPanel.updatePropertiesPanel();
    }

    stopResize() {
        this.isResizing = false;
        this.resizeElement = null;
        this.resizePosition = null;
        this.resizeStartData = null;
        
        // Restore original snap state
        if (this.originalSnapState !== undefined) {
            this.editor.snapEnabled = this.originalSnapState;
            this.originalSnapState = undefined;
        }
        
        // Remove event listeners
        document.removeEventListener("mousemove", this.boundHandleResize);
        document.removeEventListener("mouseup", this.boundStopResize);
        
        // Restore text selection
        document.body.style.userSelect = "";
    }

    // Utility methods
    isCurrentlyResizing() {
        return this.isResizing;
    }

    stopResizing() {
        if (this.isResizing) {
            this.stopResize();
        }
    }

    getCurrentResizeElement() {
        return this.resizeElement;
    }

    getCurrentResizePosition() {
        return this.resizePosition;
    }
} 