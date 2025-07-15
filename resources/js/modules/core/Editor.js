import { Config } from './Config.js';
import { ElementManager } from '../elements/ElementManager.js';
import { DragHandler } from '../interaction/DragHandler.js';
import { ResizeHandler } from '../interaction/ResizeHandler.js';

export class DragDropEditor {
    constructor() {
        // Core properties
        this.canvas = null;
        this.propertiesPanel = null;
        this.layersPanel = null;
        this.elements = [];
        this.selectedElement = null;
        this.zoomLevel = 1;
        
        // Layer management
        this.layerOrder = [];
        this.layerVisibility = {};
        this.draggedLayerIndex = null;
        
        // Template management
        this.currentTemplateName = "";
        this.currentTemplateId = null;
        this.lastSavedTime = null;
        
        // Snapping system
        this.snapEnabled = true;
        this.snapThreshold = 5;
        
        // Guide lines
        this.guideLines = [];
        this.isDraggingGuide = false;
        this.currentGuide = null;
        
        // Resize state
        this._isResizing = false;
        this.resizeElement = null;
        this.resizePosition = null;
        this.resizeStartData = null;
        this.originalSnapState = undefined;
        
        // API configuration
        this.apiBaseUrl = '/api';
        
        // Initialize modules
        this.config = new Config();
        this.elementManager = new ElementManager(this);
        this.dragHandler = new DragHandler(this);
        this.resizeHandler = new ResizeHandler(this);
        
        // Initialize editor
        this.init();
    }

    async init() {
        // Get DOM elements
        this.canvas = document.getElementById("canvas");
        this.propertiesPanel = document.getElementById("propertiesPanel");
        this.layersPanel = document.getElementById("layersPanel");

        // Load configuration
        await this.config.loadFromServer();
        
        // Setup systems
        this.setupEventListeners();
        this.setupMouseTracking();
        this.setupContextMenu();
        this.setupRulers();
        this.setupGuideLines();
        this.setupZoom();
        this.setupTemplateModal();
        this.setupLayers();
        
        // Load clients
        await this.loadClients();
        
        console.log("Editor initialized successfully");
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Tool buttons
        this.toolButtons = document.querySelectorAll(".clickable-element");
        this.toolButtons.forEach(button => {
            button.addEventListener("click", this.handleToolSelect.bind(this));
        });

        // Canvas events
        this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
        this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
        this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
        this.canvas.addEventListener("click", this.handleCanvasClick.bind(this));

        // Global events
        document.addEventListener("keydown", this.handleKeyDown.bind(this));
        document.addEventListener("click", this.handleGlobalClick.bind(this));

        // UI Controls
        this.setupUIControls();
    }

    setupUIControls() {
        // Guide and snap controls
        document.getElementById("clearGuides").addEventListener("click", this.clearGuides.bind(this));
        document.getElementById("toggleSnap").addEventListener("click", this.toggleSnap.bind(this));
        
        // Zoom controls
        document.getElementById("zoomIn").addEventListener("click", this.zoomIn.bind(this));
        document.getElementById("zoomOut").addEventListener("click", this.zoomOut.bind(this));
        document.getElementById("zoomFit").addEventListener("click", this.zoomToFit.bind(this));
        document.getElementById("zoomLevel").addEventListener("change", this.handleZoomChange.bind(this));
    }

    setupMouseTracking() {
        this.canvas.addEventListener("mousemove", (e) => {
            const canvasRect = this.canvas.getBoundingClientRect();
            const x = Math.round((e.clientX - canvasRect.left) / this.zoomLevel);
            const y = Math.round((e.clientY - canvasRect.top) / this.zoomLevel);
            document.getElementById("canvasCoords").textContent = `Canvas Position: X: ${x}, Y: ${y}`;
        });
    }

    setupContextMenu() {
        const contextMenu = document.getElementById("contextMenu");
        
        this.canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            const element = e.target.closest(".canvas-element");
            if (element) {
                this.selectedElement = element;
                this.selectElement(element);
                contextMenu.style.display = "block";
                contextMenu.style.left = e.pageX + "px";
                contextMenu.style.top = e.pageY + "px";
            }
        });

        document.addEventListener("click", () => {
            contextMenu.style.display = "none";
        });

        contextMenu.addEventListener("click", (e) => {
            const action = e.target.closest(".context-item")?.dataset.action;
            if (action && this.selectedElement) {
                this.handleContextAction(action);
            }
            contextMenu.style.display = "none";
        });
    }

    // Tool Selection
    handleToolSelect(e) {
        const type = e.currentTarget.dataset.type;
        const centerX = this.config.canvas.defaultWidth / 2;
        const centerY = this.config.canvas.defaultHeight / 2;
        this.elementManager.createElement(type, centerX, centerY);
    }

    // Mouse Events
    handleMouseDown(e) {
        if (e.target === this.canvas) {
            this.deselectAll();
        }
    }

    handleMouseMove(e) {
        // Mouse tracking handled in setupMouseTracking
    }

    handleMouseUp(e) {
        // Handle mouse up events
    }

    handleCanvasClick(e) {
        if (!e.target.closest(".canvas-element")) {
            this.deselectAll();
        }
    }

    // Keyboard Events
    handleKeyDown(e) {
        if (e.key === "Delete" && this.selectedElement) {
            this.elementManager.deleteElement(this.selectedElement);
        }
        if (e.key === "Escape") {
            this.deselectAll();
        }
        if (e.ctrlKey && e.key === "d") {
            e.preventDefault();
            if (this.selectedElement) {
                this.elementManager.duplicateElement(this.selectedElement);
            }
        }
    }

    handleGlobalClick(e) {
        if (!this.canvas || !this.propertiesPanel || !this.layersPanel) return;
        
        const isClickInside = this.canvas.contains(e.target) || 
                             this.propertiesPanel.contains(e.target) || 
                             this.layersPanel.contains(e.target) ||
                             e.target.closest(".context-item");
        
        if (!isClickInside) {
            this.deselectAll();
        }
    }

    // Context Actions
    handleContextAction(action) {
        switch (action) {
            case "delete":
                this.elementManager.deleteElement(this.selectedElement);
                break;
            case "duplicate":
                this.elementManager.duplicateElement(this.selectedElement);
                break;
            case "bring-front":
                this.elementManager.bringToFront(this.selectedElement);
                break;
            case "send-back":
                this.elementManager.sendToBack(this.selectedElement);
                break;
        }
    }

    // Element Selection
    selectElement(element) {
        this.deselectAll();
        this.selectedElement = element;
        element.classList.add("selected");
        
        const elementData = this.elements.find(el => el.id === element.dataset.id);
        if (elementData) {
            this.updateElementStyle(element, elementData);
        }
        
        // Add visual controls (resize handles, rotation handle, delete button)
        this.addVisualControls(element);
        
        // Update UI
        this.updatePropertiesPanel();
        this.updateLayersUI();
        this.updateLayerToolbarButtons();
    }

    deselectAll() {
        // Remove all visual controls first
        this.removeVisualControls();
        
        document.querySelectorAll(".canvas-element.selected").forEach(element => {
            element.classList.remove("selected");
            const elementData = this.elements.find(el => el.id === element.dataset.id);
            if (elementData) {
                this.updateElementStyle(element, elementData);
            }
        });
        
        this.selectedElement = null;
        this.updateLayersUI();
        this.updateLayerToolbarButtons();
        this.updatePropertiesPanel();
    }

    addVisualControls(element) {
        this.removeVisualControls(); // Remove any existing controls
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'element-controls';
        controlsContainer.dataset.elementId = element.dataset.id;
        
        // Position the controls container
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.left = (element.offsetLeft) + 'px';
        controlsContainer.style.top = (element.offsetTop) + 'px';
        controlsContainer.style.width = element.offsetWidth + 'px';
        controlsContainer.style.height = element.offsetHeight + 'px';
        controlsContainer.style.pointerEvents = 'none';
        controlsContainer.style.zIndex = '1001';
        
        // Create resize handles
        const handlePositions = [
            { class: 'nw', cursor: 'nw-resize' },
            { class: 'n', cursor: 'n-resize' },
            { class: 'ne', cursor: 'ne-resize' },
            { class: 'e', cursor: 'e-resize' },
            { class: 'se', cursor: 'se-resize' },
            { class: 's', cursor: 's-resize' },
            { class: 'sw', cursor: 'sw-resize' },
            { class: 'w', cursor: 'w-resize' }
        ];
        
        handlePositions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos.class}`;
            handle.style.cursor = pos.cursor;
            handle.style.pointerEvents = 'auto';
            handle.dataset.position = pos.class;
            
            // Add resize event listeners
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startResize(element, pos.class, e);
            });
            
            controlsContainer.appendChild(handle);
        });
        
        // Create rotation handle
        const rotationHandle = document.createElement('div');
        rotationHandle.className = 'rotation-handle';
        rotationHandle.innerHTML = '<i class="fas fa-redo"></i>';
        rotationHandle.style.pointerEvents = 'auto';
        
        rotationHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.startRotation(element, e);
        });
        
        controlsContainer.appendChild(rotationHandle);
        
        // Create delete button
        const deleteButton = document.createElement('div');
        deleteButton.className = 'delete-control';
        deleteButton.innerHTML = '<i class="fas fa-times"></i>';
        deleteButton.style.pointerEvents = 'auto';
        
        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elementManager.deleteElement(element);
        });
        
        controlsContainer.appendChild(deleteButton);
        
        this.canvas.appendChild(controlsContainer);
    }

    removeVisualControls() {
        // Remove visual controls (resize handles, etc.)
        const existingControls = this.canvas.querySelectorAll('.element-controls');
        existingControls.forEach(control => control.remove());
    }

    updateVisualControlsPosition(element) {
        // Updating visual controls position
        const controlsContainer = this.canvas.querySelector(`[data-element-id="${element.dataset.id}"]`);
        if (controlsContainer) {
            controlsContainer.style.left = (element.offsetLeft) + 'px';
            controlsContainer.style.top = (element.offsetTop) + 'px';
            controlsContainer.style.width = element.offsetWidth + 'px';
            controlsContainer.style.height = element.offsetHeight + 'px';
        }
    }

    // Resize functionality
    startResize(element, position, e) {
        this._isResizing = true;
        this.resizePosition = position;
        this.resizeElement = element;
        
        const elementData = this.elements.find(el => el.id === element.dataset.id);
        if (!elementData) return;
        
        this.resizeStartData = {
            x: elementData.x,
            y: elementData.y,
            width: elementData.width,
            height: elementData.height,
            mouseX: e.clientX,
            mouseY: e.clientY
        };
        
        // Store original snap state and disable snapping during resize
        this.originalSnapState = this.snapEnabled;
        this.snapEnabled = false;
        this.clearSnapIndicators();
        
        // Bind methods and add event listeners
        this.boundHandleResize = this.handleResize.bind(this);
        this.boundStopResize = this.stopResize.bind(this);
        
        document.addEventListener('mousemove', this.boundHandleResize);
        document.addEventListener('mouseup', this.boundStopResize);
        
        // Prevent element dragging during resize
        document.body.style.userSelect = 'none';
    }

    handleResize(e) {
        if (!this._isResizing || !this.resizeElement) return;
        
        const elementData = this.elements.find(el => el.id === this.resizeElement.dataset.id);
        if (!elementData) return;
        
        const deltaX = (e.clientX - this.resizeStartData.mouseX) / this.zoomLevel;
        const deltaY = (e.clientY - this.resizeStartData.mouseY) / this.zoomLevel;
        
        let newX = this.resizeStartData.x;
        let newY = this.resizeStartData.y;
        let newWidth = this.resizeStartData.width;
        let newHeight = this.resizeStartData.height;
        
        // Handle different resize positions
        switch (this.resizePosition) {
            case 'nw':
                newX = this.resizeStartData.x + deltaX;
                newY = this.resizeStartData.y + deltaY;
                newWidth = this.resizeStartData.width - deltaX;
                newHeight = this.resizeStartData.height - deltaY;
                break;
            case 'n':
                newY = this.resizeStartData.y + deltaY;
                newHeight = this.resizeStartData.height - deltaY;
                break;
            case 'ne':
                newY = this.resizeStartData.y + deltaY;
                newWidth = this.resizeStartData.width + deltaX;
                newHeight = this.resizeStartData.height - deltaY;
                break;
            case 'e':
                newWidth = this.resizeStartData.width + deltaX;
                break;
            case 'se':
                newWidth = this.resizeStartData.width + deltaX;
                newHeight = this.resizeStartData.height + deltaY;
                break;
            case 's':
                newHeight = this.resizeStartData.height + deltaY;
                break;
            case 'sw':
                newX = this.resizeStartData.x + deltaX;
                newWidth = this.resizeStartData.width - deltaX;
                newHeight = this.resizeStartData.height + deltaY;
                break;
            case 'w':
                newX = this.resizeStartData.x + deltaX;
                newWidth = this.resizeStartData.width - deltaX;
                break;
        }
        
        // Ensure minimum size
        const minSize = 20;
        if (newWidth < minSize) {
            if (this.resizePosition.includes('w')) {
                newX = newX - (minSize - newWidth);
            }
            newWidth = minSize;
        }
        if (newHeight < minSize) {
            if (this.resizePosition.includes('n')) {
                newY = newY - (minSize - newHeight);
            }
            newHeight = minSize;
        }
        
        // Allow elements to extend beyond canvas bounds for overlapping designs
        // Only constrain to prevent elements from being moved completely off-screen
        const BOUNDARY_MARGIN = 50;
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        newX = Math.max(-newWidth + BOUNDARY_MARGIN, Math.min(newX, canvasWidth - BOUNDARY_MARGIN));
        newY = Math.max(-newHeight + BOUNDARY_MARGIN, Math.min(newY, canvasHeight - BOUNDARY_MARGIN));
        
        // Update element data and visual element
        // Updating element dimensions
        
        elementData.x = newX;
        elementData.y = newY;
        elementData.width = newWidth;
        elementData.height = newHeight;
        
        // Resize operation completed successfully
        
        // Element resize completed successfully
        
        this.updateElementStyle(this.resizeElement, elementData);
        this.updateVisualControlsPosition(this.resizeElement);
        this.updatePropertiesPanel();
    }

    stopResize() {
        this._isResizing = false;
        this.resizeElement = null;
        this.resizePosition = null;
        this.resizeStartData = null;
        
        // Restore original snap state
        if (this.originalSnapState !== undefined) {
            this.snapEnabled = this.originalSnapState;
            this.originalSnapState = undefined;
        }
        
        document.removeEventListener('mousemove', this.boundHandleResize);
        document.removeEventListener('mouseup', this.boundStopResize);
        document.body.style.userSelect = '';
    }

    // Rotation functionality (placeholder)
    startRotation(element, e) {
        console.log('Rotation functionality - to be implemented');
    }

    // Zoom Management
    setupZoom() {
        // Add mouse wheel zoom support
        this.canvas.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -this.config.canvas.zoomStep : this.config.canvas.zoomStep;
                this.setZoom(this.zoomLevel + delta);
            }
        });
        
        // Initial zoom application
        this.applyZoom();
    }

    zoomIn() {
        this.setZoom(this.zoomLevel + this.config.canvas.zoomStep);
    }

    zoomOut() {
        this.setZoom(this.zoomLevel - this.config.canvas.zoomStep);
    }

    handleZoomChange(e) {
        this.setZoom(parseFloat(e.target.value));
    }

    setZoom(zoom) {
        zoom = Math.max(this.config.canvas.minZoom, Math.min(this.config.canvas.maxZoom, zoom));
        if (zoom !== this.zoomLevel) {
            this.zoomLevel = zoom;
            this.applyZoom();
            this.updateZoomUI();
        }
    }

    applyZoom() {
        const canvasContainer = document.querySelector(".canvas-with-guides");
        canvasContainer.style.transform = `scale(${this.zoomLevel})`;
        canvasContainer.style.transformOrigin = "top left";
        
        this.updateRulersForZoom();
        this.snapThreshold = 5 / this.zoomLevel;
    }

    updateZoomUI() {
        const zoomInput = document.getElementById("zoomLevel");
        zoomInput.value = this.zoomLevel;
        
        const canvasInfo = document.querySelector(".canvas-info span");
        canvasInfo.textContent = `Canvas: ${this.config.canvas.defaultWidth} x ${this.config.canvas.defaultHeight} px (A4 Size) - ${Math.round(this.zoomLevel * 100)}%`;
    }

    zoomToFit() {
        const workspace = document.querySelector(".canvas-workspace").getBoundingClientRect();
        const availableWidth = workspace.width - 30;
        const availableHeight = workspace.height - 30;
        
        const scaleX = availableWidth / this.config.canvas.defaultWidth;
        const scaleY = availableHeight / this.config.canvas.defaultHeight;
        const scale = Math.min(scaleX, scaleY, 1);
        
        this.setZoom(Math.max(this.config.canvas.minZoom, scale));
    }

    // Snap Management
    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
        const toggleButton = document.getElementById("toggleSnap");
        
        if (this.snapEnabled) {
            toggleButton.textContent = "Snap: ON";
            toggleButton.classList.add("snap-enabled");
        } else {
            toggleButton.textContent = "Snap: OFF";
            toggleButton.classList.remove("snap-enabled");
        }
    }

    // Template Management
    async saveTemplate() {
        const templateName = document.getElementById('templateNameTab').value.trim();
        const clientSelect = document.getElementById('templateClientSelect');
        const clientId = clientSelect.value;
        const width = parseInt(this.canvas.style.width) || parseInt(this.canvas.offsetWidth) || 595;
        const height = parseInt(this.canvas.style.height) || parseInt(this.canvas.offsetHeight) || 842;
        
        // Validate all required fields
        if (!templateName) {
            alert('Please enter a template name');
            return;
        }
        
        if (!clientId) {
            alert('Please select a client');
            return;
        }
        
        if (!width || width <= 0) {
            alert('Please enter a valid width');
            return;
        }
        
        if (!height || height <= 0) {
            alert('Please enter a valid height');
            return;
        }
        
        if (this.elements.length === 0) {
            alert('Cannot save empty template. Please add some elements first.');
            return;
        }

        // Debug: Log element data before validation
        console.log('Elements before saving:', this.elements);
        
        // Determine if we're updating an existing template or creating a new one
        const isUpdate = this.currentTemplateId !== null;
        
        // Check if template name already exists (only for new templates or if changing name)
        if (!isUpdate || templateName !== this.currentTemplateName) {
            if (await this.templateNameExists(templateName)) {
                alert('A template with this name already exists. Please choose a different name.');
                return;
            }
        }
        
        const templateData = {
            name: templateName,
            width: width,
            height: height,
            client_id: clientId,
            layerOrder: this.layerOrder, // Save layer order
            layerVisibility: this.layerVisibility, // Save layer visibility
            elements: this.elements.map(element => ({
                id: element.id,
                type: element.type,
                name: element.name,
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
                text: element.text || '',
                fontSize: element.fontSize || 16,
                fontFamily: element.fontFamily || 'Arial',
                fontWeight: element.fontWeight || 'normal',
                textAlign: element.textAlign || 'left',
                lineHeight: element.lineHeight || 1.2,
                lineHeightMode: element.lineHeightMode || 'normal',
                color: element.color || '#000000',
                colorCmyk: element.colorCmyk || {c: 0, m: 0, y: 0, k: 100},
                colorMode: element.colorMode || 'hex',
                backgroundColor: element.backgroundColor || '#ffffff',
                backgroundColorCmyk: element.backgroundColorCmyk || {c: 0, m: 0, y: 0, k: 0},
                borderColor: element.borderColor || '#000000',
                borderColorCmyk: element.borderColorCmyk || {c: 0, m: 0, y: 0, k: 100},
                borderWidth: element.borderWidth || 0,
                borderStyle: element.borderStyle || 'solid',
                borderRadius: element.borderRadius || 0,
                opacity: element.opacity || 1,
                zIndex: element.zIndex || 0,
                rotation: element.rotation || 0,
                imageUrl: element.imageUrl || null
            }))
        };

        console.log('Template data to save:', templateData);

        try {
            const method = isUpdate ? 'PUT' : 'POST';
            const url = isUpdate ? `${this.apiBaseUrl}/templates/${this.currentTemplateId}` : `${this.apiBaseUrl}/templates`;
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(templateData)
            });

            if (response.ok) {
                const result = await response.json();
                this.currentTemplateName = templateName;
                this.currentTemplateId = result.id;
                this.lastSavedTime = new Date().toLocaleString();
                
                alert(isUpdate ? 'Template updated successfully!' : 'Template saved successfully!');
                console.log('Template saved:', result);
                
                // Update URL to reflect the saved template
                const newUrl = `/editor/${result.id}`;
                window.history.pushState({templateId: result.id}, '', newUrl);
            } else {
                const errorData = await response.json();
                console.error('Error saving template:', errorData);
                alert('Error saving template: ' + (errorData.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving template:', error);
            alert('Error saving template. Please try again.');
        }
    }

    async showTemplateModal() {
        const modal = document.getElementById('templateModal');
        modal.style.display = 'block';
        await this.loadTemplateList();
    }

    hideTemplateModal() {
        const modal = document.getElementById('templateModal');
        modal.style.display = 'none';
        document.getElementById('templateSearch').value = '';
    }

    async loadTemplateList(searchTerm = '') {
        const templateList = document.getElementById('templateList');
        templateList.innerHTML = '<div class="loading">Loading templates...</div>';
        
        try {
            const url = searchTerm 
                ? `${this.apiBaseUrl}/templates?search=${encodeURIComponent(searchTerm)}`
                : `${this.apiBaseUrl}/templates`;
                
            const response = await fetch(url);
            
            if (response.ok) {
                const templates = await response.json();
                this.renderTemplateList(templates);
            } else {
                templateList.innerHTML = '<div class="error">Error loading templates</div>';
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            templateList.innerHTML = '<div class="error">Error loading templates</div>';
        }
    }

    renderTemplateList(templates) {
        const templateList = document.getElementById('templateList');
        
        if (templates.length === 0) {
            templateList.innerHTML = '<div class="no-templates">No templates found</div>';
            return;
        }
        
        templateList.innerHTML = templates.map(template => `
            <div class="template-item" data-template-id="${template.id}">
                <div class="template-info">
                    <h3>${template.name}</h3>
                    <p>Client: ${template.client ? template.client.name : 'Unknown'}</p>
                    <p>Size: ${template.width}x${template.height}px</p>
                    <p>Updated: ${new Date(template.updated_at).toLocaleDateString()}</p>
                </div>
                <div class="template-actions">
                    <button onclick="editor.loadTemplate(${template.id})">Load</button>
                    <button onclick="editor.deleteTemplate(${template.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async loadTemplate(templateId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/templates/${templateId}`);
            
            if (response.ok) {
                const templateData = await response.json();
                this.applyTemplate(templateData);
                this.hideTemplateModal();
                
                // Update URL to reflect the loaded template
                const newUrl = `/editor/${templateId}`;
                window.history.pushState({templateId: templateId}, '', newUrl);
            } else {
                alert('Error loading template');
            }
        } catch (error) {
            console.error('Error loading template:', error);
            alert('Error loading template. Please try again.');
        }
    }

    applyTemplate(templateData) {
        // Clear current canvas but preserve guide lines
        this.clearCanvasSilent(true);
        
        // Set canvas dimensions from template
        if (templateData.width && templateData.height) {
            this.canvas.style.width = templateData.width + 'px';
            this.canvas.style.height = templateData.height + 'px';
            
            // Update input fields
            const widthInput = document.getElementById('canvasWidthInput');
            const heightInput = document.getElementById('canvasHeightInput');
            if (widthInput) widthInput.value = templateData.width;
            if (heightInput) heightInput.value = templateData.height;
            
            // Update rulers after canvas resize with proper timing
            setTimeout(() => {
                this.updateRulersForZoom();
            }, 150);
        }
        
        // Set template name and ID
        this.currentTemplateName = templateData.name;
        this.currentTemplateId = templateData.id;
        document.getElementById('templateNameTab').value = templateData.name;
        
        // Set client selection
        const clientSelect = document.getElementById('templateClientSelect');
        if (clientSelect && templateData.client_id) {
            clientSelect.value = templateData.client_id;
        } else if (clientSelect) {
            clientSelect.value = '';
        }
        
        // Reset element counters to maintain unique names
        this.elementNameCounters = {
            text: 0,
            heading: 0,
            rectangle: 0,
            circle: 0,
            line: 0,
            image: 0
        };
        
        // Reset layer system
        this.layerOrder = [];
        this.layerVisibility = {};
        
        // Create elements from template
        const elementIdMap = new Map();
        
        templateData.elements.forEach(elementData => {
            const canvasWidth = this.canvas.offsetWidth;
            const canvasHeight = this.canvas.offsetHeight;
            
            // Only prevent completely off-screen elements (keep some part grabbable)
            const BOUNDARY_BUFFER = 50;
            const safeX = Math.max(-elementData.width + BOUNDARY_BUFFER, Math.min(elementData.x, canvasWidth - BOUNDARY_BUFFER));
            const safeY = Math.max(-elementData.height + BOUNDARY_BUFFER, Math.min(elementData.y, canvasHeight - BOUNDARY_BUFFER));
            
            const element = this.elementManager.createElement(elementData.type, safeX, safeY);
            
            // Find the created element data and update it
            const createdElementData = this.elements[this.elements.length - 1];
            
            // Preserve the new element's ID and name, but update everything else
            const preservedId = createdElementData.id;
            const preservedName = createdElementData.name;
            
            // Store mapping for layer order restoration
            if (elementData.id) {
                elementIdMap.set(elementData.id, preservedId);
            }
            
            Object.assign(createdElementData, elementData);
            createdElementData.id = preservedId;
            createdElementData.name = preservedName;
            
            // Apply the safe coordinates
            createdElementData.x = safeX;
            createdElementData.y = safeY;
            
            // Ensure CMYK values exist
            if (!createdElementData.colorCmyk && createdElementData.color) {
                createdElementData.colorCmyk = this.hexToCmyk(createdElementData.color);
            }
            if (!createdElementData.backgroundColorCmyk && createdElementData.backgroundColor) {
                createdElementData.backgroundColorCmyk = this.hexToCmyk(createdElementData.backgroundColor);
            }
            if (!createdElementData.borderColorCmyk && createdElementData.borderColor) {
                createdElementData.borderColorCmyk = this.hexToCmyk(createdElementData.borderColor);
            }
            if (!createdElementData.colorMode) {
                createdElementData.colorMode = 'hex';
            }
            
            // Update the visual element
            const visualElement = document.querySelector(`[data-id="${preservedId}"]`);
            if (visualElement) {
                this.updateElementStyle(visualElement, createdElementData);
                if (elementData.text) {
                    visualElement.textContent = elementData.text;
                }
            }
        });
        
        // Restore layer order and visibility if saved
        if (templateData.layer_order && templateData.layer_order.length > 0) {
            this.layerOrder = templateData.layer_order.map(oldId => {
                const newId = elementIdMap.get(oldId);
                return newId || oldId;
            }).filter(id => {
                return this.elements.some(element => element.id === id);
            });
            
            // Restore layer visibility
            if (templateData.layer_visibility) {
                this.layerVisibility = {};
                for (const [oldId, visibility] of Object.entries(templateData.layer_visibility)) {
                    const newId = elementIdMap.get(oldId) || oldId;
                    if (this.elements.some(element => element.id === newId)) {
                        this.layerVisibility[newId] = visibility;
                        
                        // Apply visibility to the element
                        const visualElement = document.querySelector(`[data-id="${newId}"]`);
                        if (visualElement) {
                            visualElement.style.display = visibility ? 'block' : 'none';
                        }
                    }
                }
            }
        } else {
            // No saved layer order, create default order
            this.layerOrder = this.elements.map(element => element.id);
            this.layerVisibility = {};
            this.elements.forEach(element => {
                this.layerVisibility[element.id] = true;
            });
        }
        
        // Update z-indices and layers UI
        this.updateLayerZIndices();
        this.updateLayersUI();
    }

    async templateNameExists(name) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/templates`);
            if (response.ok) {
                const templates = await response.json();
                return templates.some(template => template.name.toLowerCase() === name.toLowerCase());
            }
        } catch (error) {
            console.error('Error checking template name:', error);
        }
        return false;
    }

    clearCanvas() {
        if (confirm('Are you sure you want to clear the canvas? This action cannot be undone.')) {
            this.clearCanvasSilent();
            
            // Reset template tracking
            this.currentTemplateName = '';
            this.currentTemplateId = null;
            
            // Update URL to remove template ID when canvas is cleared
            if (window.location.pathname.match(/^\/editor\/\d+$/)) {
                window.history.pushState({}, '', '/editor');
            }
        }
    }

    clearCanvasSilent(preserveGuides = false) {
        // Clear guide lines only if not preserving them
        if (!preserveGuides) {
            this.clearGuides();
        }
        
        this.canvas.innerHTML = '<div class="canvas-grid"></div><div class="guide-lines"></div>';
        
        // Re-setup guide line event listeners since the container was recreated
        this.setupGuideLines();
        
        this.elements = [];
        this.selectedElement = null;
        this.elementManager.elementCounter = 0;
        
        // Reset element name counters
        this.elementManager.elementNameCounters = {
            text: 0,
            heading: 0,
            rectangle: 0,
            circle: 0,
            line: 0,
            image: 0
        };
        
        // Reset layer system
        this.layerOrder = [];
        this.layerVisibility = {};
        this.updateLayersUI();
    }

    async generatePDF() {
        try {
            const { PDFDocument, StandardFonts, rgb, cmyk } = PDFLib;
            
            // Create a new PDF document
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([595, 842]); // A4 size
            
            // Get fonts
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
            const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
            
            const fontMap = {
                'Arial': helveticaFont,
                'Helvetica': helveticaFont,
                'Times-Roman': timesRomanFont,
                'Courier': courierFont,
                'Nimbus': helveticaFont
            };
            
            // Add elements to PDF
            this.elements.forEach(elementData => {
                const x = elementData.x;
                const y = 842 - elementData.y - elementData.height; // Flip Y coordinate for PDF
                
                switch (elementData.type) {
                    case 'text':
                    case 'heading':
                        const font = fontMap[elementData.fontFamily] || helveticaFont;
                        const textColor = this.getPdfColor(elementData.color, elementData.colorCmyk, elementData.colorMode);
                        
                        page.drawText(elementData.text, {
                            x: x,
                            y: y,
                            size: elementData.fontSize,
                            font: font,
                            color: textColor,
                        });
                        break;
                        
                    case 'rectangle':
                        const rectBgColor = this.getPdfColor(elementData.backgroundColor, elementData.backgroundColorCmyk, elementData.colorMode);
                        const rectBorderColor = this.getPdfColor(elementData.borderColor, elementData.borderColorCmyk, elementData.colorMode);
                        
                        page.drawRectangle({
                            x: x,
                            y: y,
                            width: elementData.width,
                            height: elementData.height,
                            color: rectBgColor,
                            borderColor: rectBorderColor,
                            borderWidth: elementData.borderWidth,
                        });
                        break;
                        
                    case 'circle':
                        const circleBgColor = this.getPdfColor(elementData.backgroundColor, elementData.backgroundColorCmyk, elementData.colorMode);
                        const circleBorderColor = this.getPdfColor(elementData.borderColor, elementData.borderColorCmyk, elementData.colorMode);
                        
                        page.drawCircle({
                            x: x + elementData.width / 2,
                            y: y + elementData.height / 2,
                            size: Math.min(elementData.width, elementData.height) / 2,
                            color: circleBgColor,
                            borderColor: circleBorderColor,
                            borderWidth: elementData.borderWidth,
                        });
                        break;
                        
                    case 'line':
                        const lineColor = this.getPdfColor(elementData.borderColor, elementData.borderColorCmyk, elementData.colorMode);
                        
                        page.drawLine({
                            start: { x: x, y: y + elementData.height / 2 },
                            end: { x: x + elementData.width, y: y + elementData.height / 2 },
                            thickness: elementData.borderWidth,
                            color: lineColor,
                        });
                        break;
                }
            });
            
            // Save the PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = this.currentTemplateName ? `${this.currentTemplateName}.pdf` : 'template.pdf';
            a.click();
            
            // Clean up
            URL.revokeObjectURL(url);
            
            console.log('PDF generated successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
        }
    }

    // Helper methods
    getPdfColor(hexColor, cmykColor, colorMode) {
        if (colorMode === 'cmyk' && cmykColor && typeof PDFLib !== 'undefined') {
            const { cmyk } = PDFLib;
            return cmyk(cmykColor.c / 100, cmykColor.m / 100, cmykColor.y / 100, cmykColor.k / 100);
        } else {
            // Default to RGB
            const { rgb } = PDFLib;
            const rgbColor = this.hexToRgb(hexColor);
            return rgb(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255);
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : {r: 0, g: 0, b: 0};
    }

    hexToCmyk(hex) {
        const rgb = this.hexToRgb(hex);
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        
        const k = 1 - Math.max(r, g, b);
        const c = (1 - r - k) / (1 - k) || 0;
        const m = (1 - g - k) / (1 - k) || 0;
        const y = (1 - b - k) / (1 - k) || 0;
        
        return {
            c: Math.round(c * 100),
            m: Math.round(m * 100),
            y: Math.round(y * 100),
            k: Math.round(k * 100)
        };
    }

    updateLayerZIndices() {
        // Update z-index based on layer order
        this.layerOrder.forEach((elementId, index) => {
            const element = document.querySelector(`[data-id="${elementId}"]`);
            if (element) {
                element.style.zIndex = index + 10; // Start from 10 to avoid conflicts
            }
        });
    }

    addElementToLayers(elementId) {
        // Add element to the top of the layer order
        this.layerOrder.push(elementId);
        this.layerVisibility[elementId] = true;
        this.updateLayerZIndices();
        this.updateLayersUI();
    }

    removeElementFromLayers(elementId) {
        // Remove element from layers
        this.layerOrder = this.layerOrder.filter(id => id !== elementId);
        delete this.layerVisibility[elementId];
        this.updateLayerZIndices();
        this.updateLayersUI();
    }

    // Essential methods for template loading
    setupRulers() {
        const horizontalRuler = document.querySelector('.ruler-horizontal .ruler-track');
        const verticalRuler = document.querySelector('.ruler-vertical .ruler-track');
        
        console.log('Setting up rulers:', { horizontalRuler, verticalRuler });
        
        // Wait for canvas to be positioned, then create ruler markings
        setTimeout(() => {
            console.log('Creating ruler markings after timeout');
            this.createRulerMarkings(horizontalRuler, 'horizontal');
            this.createRulerMarkings(verticalRuler, 'vertical');
        }, 100);
        
        // Add ruler event listeners
        const horizontalRulerContainer = document.querySelector('.ruler-horizontal');
        const verticalRulerContainer = document.querySelector('.ruler-vertical');
        
        if (horizontalRulerContainer) {
            horizontalRulerContainer.addEventListener('mousedown', (e) => {
                this.createGuideFromRuler(e, 'horizontal');
            });
        }
        
        if (verticalRulerContainer) {
            verticalRulerContainer.addEventListener('mousedown', (e) => {
                this.createGuideFromRuler(e, 'vertical');
            });
        }
        
        // Add window resize handler to recalculate ruler alignment
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.createRulerMarkings(horizontalRuler, 'horizontal');
                this.createRulerMarkings(verticalRuler, 'vertical');
            }, 100);
        });
    }

    createRulerMarkings(ruler, orientation) {
        if (!ruler) {
            console.log('No ruler element found for orientation:', orientation);
            return;
        }
        
        // Use the current canvas size
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        const canvasSize = orientation === 'horizontal' ? canvasWidth : canvasHeight;
        const increment = 50;
        
        console.log(`Creating ruler markings for ${orientation}, canvas size: ${canvasSize}`);
        
        // Clear existing markings
        ruler.innerHTML = '';
        
        // Calculate the offset to align ruler 0 with canvas top-left
        const canvasRect = this.canvas.getBoundingClientRect();
        const rulerRect = ruler.getBoundingClientRect();
        
        let offset = 0;
        if (orientation === 'horizontal') {
            offset = canvasRect.left - rulerRect.left;
        } else {
            offset = canvasRect.top - rulerRect.top;
        }
        
        for (let i = 0; i <= canvasSize; i += increment) {
            const number = document.createElement('div');
            number.className = 'ruler-number';
            number.textContent = i;
            
            if (orientation === 'horizontal') {
                number.style.left = (i * this.zoomLevel + offset) + 'px';
            } else {
                number.style.top = (i * this.zoomLevel + offset) + 'px';
            }
            
            ruler.appendChild(number);
        }
        
        // Update background pattern to align with canvas and account for zoom
        const scaledIncrement = 50 * this.zoomLevel;
        const smallIncrement = 25 * this.zoomLevel;
        
        if (orientation === 'horizontal') {
            ruler.style.backgroundImage = 
                'linear-gradient(to right, #dee2e6 1px, transparent 1px), linear-gradient(to right, #ccc 1px, transparent 1px)';
            ruler.style.backgroundSize = `${scaledIncrement}px 15px, ${smallIncrement}px 10px`;
            ruler.style.backgroundPosition = `${offset}px 9px, ${offset}px 11px`;
        } else {
            ruler.style.backgroundImage = 
                'linear-gradient(to bottom, #dee2e6 1px, transparent 1px), linear-gradient(to bottom, #ccc 1px, transparent 1px)';
            ruler.style.backgroundSize = `15px ${scaledIncrement}px, 10px ${smallIncrement}px`;
            ruler.style.backgroundPosition = `9px ${offset}px, 11px ${offset}px`;
        }
    }

    updateRulerTrackSizes() {
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        const horizontalRuler = document.querySelector('.ruler-horizontal .ruler-track');
        const verticalRuler = document.querySelector('.ruler-vertical .ruler-track');
        if (horizontalRuler) horizontalRuler.style.width = canvasWidth + 'px';
        if (verticalRuler) verticalRuler.style.height = canvasHeight + 'px';
    }

    createGuideFromRuler(e, orientation) {
        console.log('Creating guide from ruler:', orientation, e);
        
        const canvasRect = this.canvas.getBoundingClientRect();
        // Use dynamic canvas size
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        
        let position;
        if (orientation === 'horizontal') {
            // Calculate position relative to canvas left edge and account for zoom
            position = (e.clientX - canvasRect.left) / this.zoomLevel;
        } else {
            // Calculate position relative to canvas top edge and account for zoom
            position = (e.clientY - canvasRect.top) / this.zoomLevel;
        }
        
        // Ensure position is within canvas bounds
        const maxPosition = orientation === 'horizontal' ? canvasWidth : canvasHeight;
        position = Math.max(0, Math.min(position, maxPosition));
        
        console.log('Guide position calculated:', position, 'max:', maxPosition);
        
        const guide = this.createGuideLine(orientation, position);
        this.startDraggingGuide(guide, e);
    }

    createGuideLine(orientation, position) {
        console.log('Creating guide line:', orientation, position);
        
        const guideLine = document.createElement('div');
        guideLine.className = `guide-line ${orientation}`;
        guideLine.dataset.orientation = orientation;
        guideLine.dataset.position = position;
        
        if (orientation === 'horizontal') {
            guideLine.style.top = position + 'px';
            guideLine.style.left = '0px';
            guideLine.style.width = '100%';
            guideLine.style.height = '1px';
        } else {
            guideLine.style.left = position + 'px';
            guideLine.style.top = '0px';
            guideLine.style.width = '1px';
            guideLine.style.height = '100%';
        }
        
        guideLine.style.backgroundColor = '#00FFFF';
        guideLine.style.position = 'absolute';
        guideLine.style.zIndex = '999';
        guideLine.style.cursor = orientation === 'horizontal' ? 'ns-resize' : 'ew-resize';
        
        // Add to guide lines container
        const guideContainer = document.querySelector('.guide-lines');
        if (guideContainer) {
            guideContainer.appendChild(guideLine);
        }
        
        // Add to guides array
        this.guideLines.push({
            element: guideLine,
            orientation: orientation,
            position: position
        });
        
        return guideLine;
    }

    updateRulersForZoom() {
        const horizontalRuler = document.querySelector('.ruler-horizontal .ruler-track');
        const verticalRuler = document.querySelector('.ruler-vertical .ruler-track');
        
        if (horizontalRuler && verticalRuler) {
            this.updateRulerTrackSizes();
            this.createRulerMarkings(horizontalRuler, 'horizontal');
            this.createRulerMarkings(verticalRuler, 'vertical');
        }
    }

    setupGuideLines() {
        const guideContainer = document.querySelector('.guide-lines');
        
        // Set up guide line drag events
        if (guideContainer) {
            guideContainer.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('guide-line')) {
                    this.startDraggingGuide(e.target, e);
                }
            });
            
            guideContainer.addEventListener('dblclick', (e) => {
                if (e.target.classList.contains('guide-line')) {
                    this.deleteGuideLine(e.target);
                }
            });
        }
        
        // Add global mouse move and up events for guide dragging
        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingGuide && this.currentGuide) {
                this.dragGuide(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDraggingGuide) {
                this.stopDraggingGuide();
            }
        });
    }

    setupTemplateModal() {
        // Basic template modal setup
        const templateModal = document.getElementById('templateModal');
        if (templateModal) {
            const closeBtn = templateModal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hideTemplateModal());
            }
        }
    }

    setupLayers() {
        // Basic layer setup
        const layerButtons = {
            'moveLayerUp': () => this.moveLayerUp(),
            'moveLayerDown': () => this.moveLayerDown(),
            'bringToFront': () => this.bringLayerToFront(),
            'sendToBack': () => this.sendLayerToBack(),
            'duplicateLayer': () => this.duplicateLayer(),
            'deleteLayer': () => this.deleteLayer()
        };
        
        Object.entries(layerButtons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
            }
        });
    }

    clearGuides() {
        this.guideLines.forEach(guide => {
            if (guide.element) {
                guide.element.remove();
            }
        });
        this.guideLines = [];
        this.clearSnapIndicators();
    }

    clearSnapIndicators() {
        // Clear snap indicators
        const snapIndicators = document.querySelectorAll('.snap-indicator');
        snapIndicators.forEach(indicator => indicator.remove());
    }

    getSnapPosition(x, y, element, elementData) {
        const snapLines = [];
        let snapX = x;
        let snapY = y;
        
        if (!this.snapEnabled) {
            return { x: snapX, y: snapY, snapLines };
        }
        
        const elementWidth = elementData.width;
        const elementHeight = elementData.height;
        
        // Check snapping to guide lines
        this.guideLines.forEach(guide => {
            const guidePos = parseFloat(guide.position);
            
            if (guide.orientation === 'vertical') {
                // Snap to left edge
                if (Math.abs(x - guidePos) <= this.snapThreshold) {
                    snapX = guidePos;
                    snapLines.push({ orientation: 'vertical', position: guidePos });
                }
                // Snap to right edge
                else if (Math.abs((x + elementWidth) - guidePos) <= this.snapThreshold) {
                    snapX = guidePos - elementWidth;
                    snapLines.push({ orientation: 'vertical', position: guidePos });
                }
                // Snap to center
                else if (Math.abs((x + elementWidth / 2) - guidePos) <= this.snapThreshold) {
                    snapX = guidePos - elementWidth / 2;
                    snapLines.push({ orientation: 'vertical', position: guidePos });
                }
            } else if (guide.orientation === 'horizontal') {
                // Snap to top edge
                if (Math.abs(y - guidePos) <= this.snapThreshold) {
                    snapY = guidePos;
                    snapLines.push({ orientation: 'horizontal', position: guidePos });
                }
                // Snap to bottom edge
                else if (Math.abs((y + elementHeight) - guidePos) <= this.snapThreshold) {
                    snapY = guidePos - elementHeight;
                    snapLines.push({ orientation: 'horizontal', position: guidePos });
                }
                // Snap to center
                else if (Math.abs((y + elementHeight / 2) - guidePos) <= this.snapThreshold) {
                    snapY = guidePos - elementHeight / 2;
                    snapLines.push({ orientation: 'horizontal', position: guidePos });
                }
            }
        });
        
        return { x: snapX, y: snapY, snapLines };
    }

    showSnapIndicators(snapLines) {
        this.clearSnapIndicators();
        
        snapLines.forEach(line => {
            const indicator = document.createElement('div');
            indicator.className = `snap-indicator ${line.orientation}`;
            
            if (line.orientation === 'horizontal') {
                indicator.style.top = line.position + 'px';
            } else {
                indicator.style.left = line.position + 'px';
            }
            
            document.querySelector('.guide-lines').appendChild(indicator);
        });
    }

    updateElementStyle(element, elementData) {
        if (!element || !elementData) return;
        
        // Update element visual styles
        
        // Basic element styling
        element.style.left = elementData.x + 'px';
        element.style.top = elementData.y + 'px';
        element.style.width = elementData.width + 'px';
        element.style.height = elementData.height + 'px';
        element.style.opacity = elementData.opacity || 1;
        
        // Apply rotation
        if (elementData.rotation !== undefined && elementData.rotation !== null) {
            if (elementData.rotation !== 0) {
                element.style.transform = `rotate(${elementData.rotation}deg)`;
            } else {
                element.style.transform = '';
            }
        }
        
        // Handle text elements
        if (elementData.type === 'text' || elementData.type === 'heading') {
            element.innerHTML = elementData.text || '';
            element.style.fontSize = (elementData.fontSize || 16) + 'px';
            element.style.fontFamily = this.getFontStack(elementData.fontFamily || 'Arial');
            element.style.color = elementData.color || '#000000';
            element.style.textAlign = elementData.textAlign || 'left';
            element.style.lineHeight = (elementData.lineHeight || 18) + 'px';
        }
        
        // Handle rectangle and circle elements
        if (elementData.type === 'rectangle' || elementData.type === 'circle') {
            element.style.backgroundColor = elementData.backgroundColor || '#ffffff';
            element.style.borderColor = elementData.borderColor || '#000000';
            element.style.borderWidth = (elementData.borderWidth || 0) + 'px';
            element.style.borderStyle = element.classList.contains('selected') ? 'solid' : 'none';
        }
        
        // Handle image elements
        if (elementData.type === 'image') {
            if (elementData.imageUrl) {
                this.setElementImage(elementData, elementData.imageUrl);
            } else {
                element.innerHTML = '<i class="fas fa-image"></i>';
                element.style.backgroundImage = '';
                element.style.backgroundColor = elementData.backgroundColor || '#ffffff';
            }
        }
    }

    getFontStack(fontFamily) {
        const fontStacks = {
            'Arial': 'Arial, "Helvetica Neue", Helvetica, sans-serif',
            'Helvetica': '"Helvetica Neue", Helvetica, Arial, sans-serif',
            'Times-Roman': '"Times New Roman", Times, serif',
            'Courier': '"Courier New", Courier, monospace',
            'Nimbus': '"Nimbus Sans", "Liberation Sans", "Helvetica Neue", Helvetica, Arial, sans-serif'
        };
        return fontStacks[fontFamily] || fontStacks['Arial'];
    }

    setElementImage(elementData, imageUrl) {
        const element = document.querySelector(`[data-id="${elementData.id}"]`);
        if (!element) return;
        
        const isSvg = imageUrl.toLowerCase().includes('.svg') || 
                     imageUrl.toLowerCase().includes('image/svg') ||
                     imageUrl.toLowerCase().includes('svg+xml');
        
        element.innerHTML = '';
        
        if (isSvg) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.display = 'block';
            element.appendChild(img);
            
            element.style.backgroundImage = '';
            element.style.backgroundSize = '';
            element.style.backgroundPosition = '';
            element.style.backgroundRepeat = '';
        } else {
            element.style.backgroundImage = `url(${imageUrl})`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            element.style.backgroundRepeat = 'no-repeat';
        }
        
        element.style.backgroundColor = 'transparent';
        elementData.imageUrl = imageUrl;
    }

    updatePropertiesPanel() {
        // Updating properties panel
        const panel = document.getElementById('propertiesContent');
        
        if (!this.selectedElement) {
            panel.innerHTML = '<p>Select an element to edit its properties</p>';
            return;
        }
        
        const elementData = this.elements.find(el => el.id === this.selectedElement.dataset.id);
        if (!elementData) return;
        
        // Ensure element has all required color mode properties
        this.ensureColorModeProperties(elementData);
        
        const properties = this.getPropertiesHTML(elementData);
        panel.innerHTML = properties;
        
        // Add event listeners to property inputs
        this.addPropertyEventListeners(elementData);
    }

    ensureColorModeProperties(elementData) {
        // Ensure all color mode properties exist with default values
        if (!elementData.colorMode) {
            elementData.colorMode = 'hex';
        }
        if (!elementData.backgroundColorMode) {
            elementData.backgroundColorMode = 'hex';
        }
        if (!elementData.borderColorMode) {
            elementData.borderColorMode = 'hex';
        }
        
        // Ensure text alignment exists for text elements
        if ((elementData.type === 'text' || elementData.type === 'heading') && !elementData.textAlign) {
            elementData.textAlign = 'left';
        }
        
        // Ensure line height exists for text elements
        if ((elementData.type === 'text' || elementData.type === 'heading') && !elementData.lineHeight) {
            elementData.lineHeight = 18;
        }
        
        // Convert old relative line height values to pixels
        if ((elementData.type === 'text' || elementData.type === 'heading') && elementData.lineHeight < 8) {
            elementData.lineHeight = Math.round(elementData.fontSize * elementData.lineHeight);
        }
        
        // Ensure CMYK color objects exist
        if (!elementData.colorCmyk) {
            elementData.colorCmyk = this.hexToCmyk(elementData.color || '#333333');
        }
        if (!elementData.backgroundColorCmyk) {
            elementData.backgroundColorCmyk = this.hexToCmyk(elementData.backgroundColor || '#3498db');
        }
        if (!elementData.borderColorCmyk) {
            elementData.borderColorCmyk = this.hexToCmyk(elementData.borderColor || '#2c3e50');
        }
    }

    getPropertiesHTML(elementData) {
        const commonProperties = `
            <div class="property-group">
                <label>Name</label>
                <input type="text" id="prop-name" value="${elementData.name}" placeholder="Element name">
            </div>
            <div class="property-group property-row">
                <div class="property-half">
                    <label>Position X</label>
                    <input type="number" id="prop-x" value="${elementData.x}" placeholder="X">
                </div>
                <div class="property-half">
                    <label>Position Y</label>
                    <input type="number" id="prop-y" value="${elementData.y}" placeholder="Y">
                </div>
            </div>
            <div class="property-group property-row">
                <div class="property-half">
                    <label>Width</label>
                    <input type="number" id="prop-width" value="${elementData.width}" placeholder="W">
                </div>
                <div class="property-half">
                    <label>Height</label>
                    <input type="number" id="prop-height" value="${elementData.height}" placeholder="H">
                </div>
            </div>
            <div class="property-group property-row">
                <div class="property-half">
                    <label>Rotation</label>
                    <input type="range" id="prop-rotation" min="0" max="360" step="1" value="${elementData.rotation || 0}">
                    <span id="rotation-value">${Math.round(elementData.rotation || 0)}°</span>
                </div>
                <div class="property-half">
                    <label>Opacity</label>
                    <input type="range" id="prop-opacity" min="0" max="1" step="0.1" value="${elementData.opacity}">
                    <span id="opacity-value">${Math.round(elementData.opacity * 100)}%</span>
                </div>
            </div>
        `;
        
        let specificProperties = '';
        
        if (elementData.type === 'text' || elementData.type === 'heading') {
            specificProperties = `
                <div class="property-group">
                    <label>Text</label>
                    <textarea id="prop-text" rows="3">${elementData.text}</textarea>
                </div>
                <div class="property-group property-row">
                    <div class="property-half">
                        <label>Font Size</label>
                        <input type="number" id="prop-fontSize" value="${elementData.fontSize}" min="8" max="72">
                    </div>
                    <div class="property-half">
                        <label>Line Height</label>
                        <input type="number" id="prop-lineHeight" value="${elementData.lineHeight}" min="8" max="100" step="1" placeholder="18">
                    </div>
                </div>
                <div class="property-group">
                    <label>Font Family</label>
                    <select id="prop-fontFamily">
                        <option value="Arial" ${elementData.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                        <option value="Helvetica" ${elementData.fontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                        <option value="Times-Roman" ${elementData.fontFamily === 'Times-Roman' ? 'selected' : ''}>Times Roman</option>
                        <option value="Courier" ${elementData.fontFamily === 'Courier' ? 'selected' : ''}>Courier</option>
                        <option value="Nimbus" ${elementData.fontFamily === 'Nimbus' ? 'selected' : ''}>Nimbus</option>
                    </select>
                </div>
                <div class="property-group">
                    <label>Text Alignment</label>
                    <select id="prop-textAlign">
                        <option value="left" ${elementData.textAlign === 'left' ? 'selected' : ''}>Left</option>
                        <option value="center" ${elementData.textAlign === 'center' ? 'selected' : ''}>Center</option>
                        <option value="right" ${elementData.textAlign === 'right' ? 'selected' : ''}>Right</option>
                        <option value="justify" ${elementData.textAlign === 'justify' ? 'selected' : ''}>Justify</option>
                    </select>
                </div>
                <div class="property-group">
                    <label>Color</label>
                    <div class="color-mode-toggle">
                        <button type="button" id="color-mode-hex" class="color-mode-btn ${elementData.colorMode === 'hex' ? 'active' : ''}">RGB/Hex</button>
                        <button type="button" id="color-mode-cmyk" class="color-mode-btn ${elementData.colorMode === 'cmyk' ? 'active' : ''}">CMYK</button>
                    </div>
                    <div id="hex-color-input" class="color-input-group" style="display: ${elementData.colorMode === 'hex' ? 'block' : 'none'}">
                        <input type="color" id="prop-color" value="${elementData.color}">
                        <input type="text" id="prop-color-hex" value="${elementData.color}" placeholder="#000000" pattern="^#[a-fA-F0-9]{6}$">
                    </div>
                    <div id="cmyk-color-input" class="color-input-group cmyk-inputs" style="display: ${elementData.colorMode === 'cmyk' ? 'block' : 'none'}">
                        <div class="cmyk-row">
                            <label>C</label>
                            <input type="number" id="prop-color-c" value="${elementData.colorCmyk.c}" min="0" max="100">
                        </div>
                        <div class="cmyk-row">
                            <label>M</label>
                            <input type="number" id="prop-color-m" value="${elementData.colorCmyk.m}" min="0" max="100">
                        </div>
                        <div class="cmyk-row">
                            <label>Y</label>
                            <input type="number" id="prop-color-y" value="${elementData.colorCmyk.y}" min="0" max="100">
                        </div>
                        <div class="cmyk-row">
                            <label>K</label>
                            <input type="number" id="prop-color-k" value="${elementData.colorCmyk.k}" min="0" max="100">
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (elementData.type === 'image') {
            specificProperties = `
                <div class="property-group">
                    <label>Image URL</label>
                    <input type="url" id="prop-imageUrl" value="${elementData.imageUrl || ''}" placeholder="https://example.com/image.jpg">
                    <button type="button" id="load-image-btn" class="btn btn-secondary">Load from URL</button>
                </div>
            `;
        }

        if (elementData.type === 'rectangle' || elementData.type === 'circle') {
            specificProperties = `
                <div class="property-group">
                    <label>Background Color</label>
                    <div class="color-mode-toggle">
                        <button type="button" id="bg-color-mode-hex" class="color-mode-btn ${elementData.backgroundColorMode === 'hex' ? 'active' : ''}">RGB/Hex</button>
                        <button type="button" id="bg-color-mode-cmyk" class="color-mode-btn ${elementData.backgroundColorMode === 'cmyk' ? 'active' : ''}">CMYK</button>
                    </div>
                    <div id="hex-bg-color-input" class="color-input-group" style="display: ${elementData.backgroundColorMode === 'hex' ? 'block' : 'none'}">
                        <input type="color" id="prop-backgroundColor" value="${elementData.backgroundColor}">
                        <input type="text" id="prop-backgroundColor-hex" value="${elementData.backgroundColor}" placeholder="#000000" pattern="^#[a-fA-F0-9]{6}$">
                    </div>
                    <div id="cmyk-bg-color-input" class="color-input-group cmyk-inputs" style="display: ${elementData.backgroundColorMode === 'cmyk' ? 'block' : 'none'}">
                        <div class="cmyk-row">
                            <label>C</label>
                            <input type="number" id="prop-backgroundColor-c" value="${elementData.backgroundColorCmyk.c}" min="0" max="100">
                        </div>
                        <div class="cmyk-row">
                            <label>M</label>
                            <input type="number" id="prop-backgroundColor-m" value="${elementData.backgroundColorCmyk.m}" min="0" max="100">
                        </div>
                        <div class="cmyk-row">
                            <label>Y</label>
                            <input type="number" id="prop-backgroundColor-y" value="${elementData.backgroundColorCmyk.y}" min="0" max="100">
                        </div>
                        <div class="cmyk-row">
                            <label>K</label>
                            <input type="number" id="prop-backgroundColor-k" value="${elementData.backgroundColorCmyk.k}" min="0" max="100">
                        </div>
                    </div>
                </div>
                <div class="property-group">
                    <label>Border Color</label>
                    <div class="color-mode-toggle">
                        <button type="button" id="border-color-mode-hex" class="color-mode-btn ${elementData.borderColorMode === 'hex' ? 'active' : ''}">RGB/Hex</button>
                        <button type="button" id="border-color-mode-cmyk" class="color-mode-btn ${elementData.borderColorMode === 'cmyk' ? 'active' : ''}">CMYK</button>
                    </div>
                    <div id="hex-border-color-input" class="color-input-group" style="display: ${elementData.borderColorMode === 'hex' ? 'block' : 'none'}">
                        <input type="color" id="prop-borderColor" value="${elementData.borderColor}">
                        <input type="text" id="prop-borderColor-hex" value="${elementData.borderColor}" placeholder="#000000" pattern="^#[a-fA-F0-9]{6}$">
                    </div>
                    <div id="cmyk-border-color-input" class="color-input-group cmyk-inputs" style="display: ${elementData.borderColorMode === 'cmyk' ? 'block' : 'none'}">
                        <div class="cmyk-row">
                            <label>C</label>
                            <input type="number" id="prop-borderColor-c" value="${elementData.borderColorCmyk.c}" min="0" max="100">
                        </div>
                        <div class="cmyk-row">
                            <label>M</label>
                            <input type="number" id="prop-borderColor-m" value="${elementData.borderColorCmyk.m}" min="0" max="100">
                        </div>
                        <div class="cmyk-row">
                            <label>Y</label>
                            <input type="number" id="prop-borderColor-y" value="${elementData.borderColorCmyk.y}" min="0" max="100">
                        </div>
                        <div class="cmyk-row">
                            <label>K</label>
                            <input type="number" id="prop-borderColor-k" value="${elementData.borderColorCmyk.k}" min="0" max="100">
                        </div>
                    </div>
                </div>
                <div class="property-group">
                    <label>Border Width</label>
                    <input type="number" id="prop-borderWidth" value="${elementData.borderWidth}" min="0" max="10">
                </div>
            `;
        }
        
        return commonProperties + specificProperties;
    }

    addPropertyEventListeners(elementData) {
        const inputs = document.querySelectorAll('#propertiesContent input, #propertiesContent select, #propertiesContent textarea');
        
        const handlePropertyChange = (e) => {
            const property = e.target.id.replace('prop-', '');
            const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
            
            // Handle color conversions
            if (property.includes('color') && !property.includes('-c') && !property.includes('-m') && !property.includes('-y') && !property.includes('-k') && !property.includes('-hex')) {
                // Standard hex color input
                elementData[property] = value;
                const cmykProperty = property + 'Cmyk';
                if (elementData.hasOwnProperty(cmykProperty)) {
                    elementData[cmykProperty] = this.hexToCmyk(value);
                }
            } else if (property.includes('-hex')) {
                // Hex text input
                const baseProperty = property.replace('-hex', '');
                if (this.isValidHex(value)) {
                    elementData[baseProperty] = value;
                    const cmykProperty = baseProperty + 'Cmyk';
                    if (elementData.hasOwnProperty(cmykProperty)) {
                        elementData[cmykProperty] = this.hexToCmyk(value);
                    }
                    // Update color picker
                    const colorPicker = document.getElementById('prop-' + baseProperty);
                    if (colorPicker) colorPicker.value = value;
                }
            } else if (property.includes('-c') || property.includes('-m') || property.includes('-y') || property.includes('-k')) {
                // CMYK input
                const [baseProperty, component] = property.split('-');
                const cmykProperty = baseProperty + 'Cmyk';
                if (!elementData[cmykProperty]) elementData[cmykProperty] = { c: 0, m: 0, y: 0, k: 0 };
                
                elementData[cmykProperty][component] = Math.max(0, Math.min(100, value));
                
                // Convert to hex and update
                const newHex = this.cmykToHex(
                    elementData[cmykProperty].c,
                    elementData[cmykProperty].m,
                    elementData[cmykProperty].y,
                    elementData[cmykProperty].k
                );
                elementData[baseProperty] = newHex;
                
                // Update hex inputs
                const colorPicker = document.getElementById('prop-' + baseProperty);
                const hexInput = document.getElementById('prop-' + baseProperty + '-hex');
                if (colorPicker) colorPicker.value = newHex;
                if (hexInput) hexInput.value = newHex;
            } else {
                elementData[property] = value;
            }
            
            // Update layer display if name was changed
            if (property === 'name') {
                this.updateLayersUI();
            }
            
            // Update rotation value display
            if (property === 'rotation') {
                const rotationValueSpan = document.getElementById('rotation-value');
                if (rotationValueSpan) {
                    rotationValueSpan.textContent = Math.round(value) + '°';
                }
            }
            
            // Update opacity value display
            if (property === 'opacity') {
                const opacityValueSpan = document.getElementById('opacity-value');
                if (opacityValueSpan) {
                    opacityValueSpan.textContent = Math.round(value * 100) + '%';
                }
            }
            
            this.updateElementStyle(this.selectedElement, elementData);
        };
        
        inputs.forEach(input => {
            // Use both 'input' and 'change' events to handle all form elements
            input.addEventListener('input', handlePropertyChange);
            input.addEventListener('change', handlePropertyChange);
        });

        // Add color mode toggle listeners
        this.addColorModeEventListeners(elementData);
        
        // Add image URL load button listener
        const loadImageBtn = document.getElementById('load-image-btn');
        if (loadImageBtn) {
            loadImageBtn.addEventListener('click', () => {
                this.loadImageFromUrl(elementData);
            });
        }
    }

    addColorModeEventListeners(elementData) {
        // Text color mode toggle
        const hexColorMode = document.getElementById('color-mode-hex');
        const cmykColorMode = document.getElementById('color-mode-cmyk');
        
        if (hexColorMode && cmykColorMode) {
            hexColorMode.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.switchColorMode('hex', elementData, 'text');
            });
            cmykColorMode.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.switchColorMode('cmyk', elementData, 'text');
            });
        }

        // Background color mode toggle
        const bgHexColorMode = document.getElementById('bg-color-mode-hex');
        const bgCmykColorMode = document.getElementById('bg-color-mode-cmyk');
        
        if (bgHexColorMode && bgCmykColorMode) {
            bgHexColorMode.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.switchColorMode('hex', elementData, 'background');
            });
            bgCmykColorMode.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.switchColorMode('cmyk', elementData, 'background');
            });
        }

        // Border color mode toggle
        const borderHexColorMode = document.getElementById('border-color-mode-hex');
        const borderCmykColorMode = document.getElementById('border-color-mode-cmyk');
        
        if (borderHexColorMode && borderCmykColorMode) {
            borderHexColorMode.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.switchColorMode('hex', elementData, 'border');
            });
            borderCmykColorMode.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.switchColorMode('cmyk', elementData, 'border');
            });
        }
    }

    switchColorMode(mode, elementData, colorType = 'text') {
        switch (colorType) {
            case 'text':
                elementData.colorMode = mode;
                break;
            case 'background':
                elementData.backgroundColorMode = mode;
                break;
            case 'border':
                elementData.borderColorMode = mode;
                break;
        }
        this.updatePropertiesPanel();
    }

    isValidHex(hex) {
        return /^#[0-9A-F]{6}$/i.test(hex);
    }

    loadImageFromUrl(elementData) {
        const imageUrlInput = document.getElementById('prop-imageUrl');
        const imageUrl = imageUrlInput.value.trim();
        
        if (!imageUrl) {
            alert('Please enter a valid image URL');
            return;
        }
        
        // Find the element on canvas
        const element = document.querySelector(`[data-id="${elementData.id}"]`);
        if (!element) return;
        
        // Create a temporary image to test if the URL is valid
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Try to handle CORS
        
        img.onload = () => {
            // Use the setElementImage method for consistent handling
            this.setElementImage(elementData, imageUrl);
            console.log('Image loaded successfully:', imageUrl);
        };
        
        img.onerror = () => {
            alert('Failed to load image. Please check the URL and try again.');
            console.error('Failed to load image:', imageUrl);
        };
        
        img.src = imageUrl;
    }

    // Color conversion methods
    cmykToRgb(c, m, y, k) {
        // Convert percentages to 0-1 range
        c = c / 100;
        m = m / 100;
        y = y / 100;
        k = k / 100;

        // CMYK to RGB conversion
        const r = Math.round(255 * (1 - c) * (1 - k));
        const g = Math.round(255 * (1 - m) * (1 - k));
        const b = Math.round(255 * (1 - y) * (1 - k));

        return { r, g, b };
    }

    rgbToCmyk(r, g, b) {
        // Normalize RGB values to 0-1 range
        r = r / 255;
        g = g / 255;
        b = b / 255;

        // Find the maximum of R, G, B
        const k = 1 - Math.max(r, g, b);
        
        // Handle the case where k = 1 (black)
        if (k === 1) {
            return { c: 0, m: 0, y: 0, k: 100 };
        }

        // Calculate C, M, Y
        const c = Math.round(((1 - r - k) / (1 - k)) * 100);
        const m = Math.round(((1 - g - k) / (1 - k)) * 100);
        const y = Math.round(((1 - b - k) / (1 - k)) * 100);
        const kPercent = Math.round(k * 100);

        return { c, m, y, k: kPercent };
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    cmykToHex(c, m, y, k) {
        const rgb = this.cmykToRgb(c, m, y, k);
        return this.rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    updateLayersUI() {
        // Basic layers UI update
        console.log("Update layers UI - basic implementation");
    }

    updateLayerToolbarButtons() {
        // Basic layer toolbar update
        console.log("Update layer toolbar buttons - basic implementation");
    }

    async loadClients() {
        // Basic client loading
        try {
            const response = await fetch(`${this.apiBaseUrl}/clients`);
            if (response.ok) {
                const clients = await response.json();
                const clientSelect = document.getElementById('templateClientSelect');
                if (clientSelect) {
                    clientSelect.innerHTML = '<option value="">Select a client</option>';
                    clients.forEach(client => {
                        const option = document.createElement('option');
                        option.value = client.id;
                        option.textContent = client.name;
                        clientSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    }

    // Layer management placeholder methods
    moveLayerUp() {
        console.log("Move layer up - to be implemented");
    }

    moveLayerDown() {
        console.log("Move layer down - to be implemented");
    }

    bringLayerToFront() {
        console.log("Bring layer to front - to be implemented");
    }

    sendLayerToBack() {
        console.log("Send layer to back - to be implemented");
    }

    duplicateLayer() {
        console.log("Duplicate layer - to be implemented");
    }

    deleteLayer() {
        console.log("Delete layer - to be implemented");
    }

    startDraggingGuide(guide, e) {
        this.isDraggingGuide = true;
        this.currentGuide = guide;
        guide.classList.add('dragging');
        
        document.body.style.cursor = guide.classList.contains('horizontal') ? 'ns-resize' : 'ew-resize';
        
        e.preventDefault();
    }

    dragGuide(e) {
        if (!this.currentGuide) return;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const orientation = this.currentGuide.dataset.orientation;
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        
        let position;
        if (orientation === 'horizontal') {
            position = (e.clientY - canvasRect.top) / this.zoomLevel;
            position = Math.max(0, Math.min(position, canvasHeight));
            this.currentGuide.style.top = position + 'px';
        } else {
            position = (e.clientX - canvasRect.left) / this.zoomLevel;
            position = Math.max(0, Math.min(position, canvasWidth));
            this.currentGuide.style.left = position + 'px';
        }
        
        this.currentGuide.dataset.position = position;
        
        // Update guide line data
        const guideData = this.guideLines.find(g => g.element === this.currentGuide);
        if (guideData) {
            guideData.position = position;
        }
    }

    stopDraggingGuide() {
        if (this.currentGuide) {
            this.currentGuide.classList.remove('dragging');
        }
        this.isDraggingGuide = false;
        this.currentGuide = null;
        document.body.style.cursor = 'default';
    }

    deleteGuideLine(guide) {
        guide.remove();
        this.guideLines = this.guideLines.filter(g => g.element !== guide);
    }

    // Getters for state checks
    get isResizing() {
        return this._isResizing;
    }

    get isRotating() {
        return false; // Will be implemented in RotationHandler module
    }

    get isDragging() {
        return this.dragHandler.isCurrentlyDragging();
    }
} 