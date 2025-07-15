export class DragHandler {
    constructor(editor) {
        this.editor = editor;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        // Bind methods
        this.boundHandleElementDrag = this.handleElementDrag.bind(this);
        this.boundHandleElementDragEnd = this.handleElementDragEnd.bind(this);
    }

    startDragging(element, e) {
        // Don't start dragging if we're already resizing or rotating
        if (this.editor.isResizing || this.editor.isRotating) return;
        
        this.isDragging = true;
        this.editor.selectedElement = element;
        this.editor.selectElement(element);
        
        const canvasRect = this.editor.canvas.getBoundingClientRect();
        const elementData = this.editor.elements.find(el => el.id === element.dataset.id);

        if (elementData) {
            // Calculate mouse position relative to the canvas
            const mouseX_canvas = (e.clientX - canvasRect.left) / this.editor.zoomLevel;
            const mouseY_canvas = (e.clientY - canvasRect.top) / this.editor.zoomLevel;
            
            // Calculate offset from mouse to element's top-left corner
            this.dragOffset.x = mouseX_canvas - elementData.x;
            this.dragOffset.y = mouseY_canvas - elementData.y;
        }

        // Add event listeners
        document.addEventListener("mousemove", this.boundHandleElementDrag);
        document.addEventListener("mouseup", this.boundHandleElementDragEnd);
    }

    handleElementDrag(e) {
        if (!this.isDragging || !this.editor.selectedElement) return;

        const elementData = this.editor.elements.find(el => el.id === this.editor.selectedElement.dataset.id);
        if (!elementData) return;
        
        const canvasRect = this.editor.canvas.getBoundingClientRect();
        
        // Calculate new position based on mouse movement
        let x = (e.clientX - canvasRect.left) / this.editor.zoomLevel - this.dragOffset.x;
        let y = (e.clientY - canvasRect.top) / this.editor.zoomLevel - this.dragOffset.y;
        
        // No boundary constraints - allow complete freedom of movement
        // Elements can move anywhere and overlap freely for PDF design flexibility
        
        // Apply snapping if enabled (but allow overlapping)
        if (this.editor.snapEnabled && !this.editor.isResizing) {
            const snapResult = this.editor.getSnapPosition(x, y, this.editor.selectedElement, elementData);
            x = snapResult.x;
            y = snapResult.y;
            
            // Show snap indicators
            this.editor.showSnapIndicators(snapResult.snapLines);
            
            // Add snapping visual feedback
            if (snapResult.snapLines.length > 0) {
                this.editor.selectedElement.classList.add("snapping");
            } else {
                this.editor.selectedElement.classList.remove("snapping");
            }
        }

        // Update element position
        this.editor.selectedElement.style.left = x + "px";
        this.editor.selectedElement.style.top = y + "px";
        
        // Update element data
        elementData.x = x;
        elementData.y = y;
    }

    handleElementDragEnd() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // Clear snap indicators
        this.editor.clearSnapIndicators();
        
        // Remove snapping visual feedback
        if (this.editor.selectedElement) {
            this.editor.selectedElement.classList.remove("snapping");
            this.editor.updatePropertiesPanel();
        }
        
        // Remove event listeners
        document.removeEventListener("mousemove", this.boundHandleElementDrag);
        document.removeEventListener("mouseup", this.boundHandleElementDragEnd);
    }

    // Utility methods
    isCurrentlyDragging() {
        return this.isDragging;
    }

    stopDragging() {
        if (this.isDragging) {
            this.handleElementDragEnd();
        }
    }
} 