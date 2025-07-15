class DragDropEditor {
    constructor() {
        this.canvas = null; // Will be assigned in init
        this.propertiesPanel = null; // Will be assigned in init
        this.layersPanel = null; // Will be assigned in init
        this.elements = [];
        this.selectedElement = null;
        this.draggedElement = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.elementCounter = 0;
        
        // Visual controls state
        this.isResizing = false;
        this.isRotating = false;
        this.resizeElement = null;
        this.resizePosition = null;
        this.resizeStartData = null;
        this.rotationElement = null;
        this.rotationCenter = null;
        this.rotationStartAngle = 0;
        this.rotationStartMouse = 0;
        
        // Guide lines and rulers
        this.guideLines = [];
        this.snapEnabled = true;
        this.snapThreshold = 5;
        this.isDraggingGuide = false;
        this.currentGuide = null;
        this.snapIndicators = [];
        this.originalSnapState = undefined;
        
        // Zoom functionality
        this.zoomLevel = 1;
        this.minZoom = 0.25;
        this.maxZoom = 4;
        this.zoomStep = 0.25;
        
        // Element naming
        this.elementNameCounters = {
            text: 0,
            heading: 0,
            rectangle: 0,
            circle: 0,
            line: 0,
            image: 0
        };
        
        // Template system
        this.apiBaseUrl = 'http://builder.test/api'; // Default fallback URL
        this.currentTemplateName = '';
        this.currentTemplateId = null; // Track if we're editing an existing template
        
        // Layer system
        this.layerOrder = []; // Array of element IDs in layer order (bottom to top)
        this.layerVisibility = {}; // Object mapping element IDs to visibility state
        this.draggedLayerIndex = null;
        
        // Tool buttons reference
        this.toolButtons = null;
        
        // Bind event handlers once
        this.boundHandleElementDrag = this.handleElementDrag.bind(this);
        this.boundHandleElementDragEnd = this.handleElementDragEnd.bind(this);
        this.boundHandleResize = this.handleResize.bind(this);
        this.boundStopResize = this.stopResize.bind(this);
        this.boundHandleRotation = this.handleRotation.bind(this);
        this.boundStopRotation = this.stopRotation.bind(this);
        
        this.init();
    }
    
    async init() {
        this.canvas = document.getElementById('canvas');
        this.propertiesPanel = document.getElementById('propertiesPanel');
        this.layersPanel = document.getElementById('layersPanel');
        
        await this.loadConfiguration();
        this.setupEventListeners();
        this.setupMouseTracking();
        this.setupContextMenu();
        this.setupRulers();
        this.setupGuideLines();
        this.setupZoom();
        this.setupTemplateModal();
        this.setupLayers();
        await this.loadClients();
    }

    async loadConfiguration() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/config`);
            if (response.ok) {
                const config = await response.json();
                this.apiBaseUrl = config.api_base_url;
                console.log('Configuration loaded successfully. API Base URL:', this.apiBaseUrl);
            } else {
                console.warn('Failed to load configuration from server, using fallback URL:', this.apiBaseUrl);
            }
        } catch (error) {
            console.warn('Error loading configuration, using fallback URL:', this.apiBaseUrl, error);
        }
    }
    
    async loadClients() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/clients`);
            if (response.ok) {
                const clients = await response.json();
                const clientSelect = document.getElementById('templateClientSelect');
                
                if (clientSelect) {
                    // Clear existing options except the first one (placeholder)
                    clientSelect.innerHTML = '<option value="">Select a client</option>';
                    
                    // Add client options
                    clients.forEach(client => {
                        const option = document.createElement('option');
                        option.value = client.id;
                        option.textContent = client.name;
                        clientSelect.appendChild(option);
                    });
                }
            } else {
                console.warn('Failed to load clients from server');
            }
        } catch (error) {
            console.warn('Error loading clients:', error);
        }
    }
    
    setupEventListeners() {
        // Tool selection
        this.toolButtons = document.querySelectorAll('.clickable-element');
        this.toolButtons.forEach(button => {
            button.addEventListener('click', this.handleToolSelect.bind(this));
        });
        
        // Canvas element events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        
        // Button events
        document.getElementById('clearGuides').addEventListener('click', this.clearGuides.bind(this));
        document.getElementById('toggleSnap').addEventListener('click', this.toggleSnap.bind(this));
        document.getElementById('zoomIn').addEventListener('click', this.zoomIn.bind(this));
        document.getElementById('zoomOut').addEventListener('click', this.zoomOut.bind(this));
        document.getElementById('zoomFit').addEventListener('click', this.zoomToFit.bind(this));
        document.getElementById('zoomLevel').addEventListener('change', this.handleZoomChange.bind(this));
        
        // Global events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('click', this.handleGlobalClick.bind(this));
    }
    
    setupMouseTracking() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.round((e.clientX - rect.left) / this.zoomLevel);
            const y = Math.round((e.clientY - rect.top) / this.zoomLevel);
            
            document.getElementById('canvasCoords').textContent = `Canvas Position: X: ${x}, Y: ${y}`;
        });
    }
    
    setupContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            const element = e.target.closest('.canvas-element');
            if (element) {
                this.selectedElement = element;
                this.selectElement(element);
                
                contextMenu.style.display = 'block';
                contextMenu.style.left = e.pageX + 'px';
                contextMenu.style.top = e.pageY + 'px';
            }
        });
        
        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });
        
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-item')?.dataset.action;
            if (action && this.selectedElement) {
                this.handleContextAction(action);
            }
            contextMenu.style.display = 'none';
        });
    }
    
    setupRulers() {
        const horizontalRuler = document.querySelector('.ruler-horizontal .ruler-track');
        const verticalRuler = document.querySelector('.ruler-vertical .ruler-track');
        
        // Wait for canvas to be positioned, then create ruler markings
        setTimeout(() => {
            this.createRulerMarkings(horizontalRuler, 'horizontal');
            this.createRulerMarkings(verticalRuler, 'vertical');
        }, 100);
        
        // Add ruler event listeners
        document.querySelector('.ruler-horizontal').addEventListener('mousedown', (e) => {
            this.createGuideFromRuler(e, 'horizontal');
        });
        
        document.querySelector('.ruler-vertical').addEventListener('mousedown', (e) => {
            this.createGuideFromRuler(e, 'vertical');
        });
        
        // Add window resize handler to recalculate ruler alignment
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.createRulerMarkings(horizontalRuler, 'horizontal');
                this.createRulerMarkings(verticalRuler, 'vertical');
            }, 100);
        });
    }
    
    createRulerMarkings(ruler, orientation) {
        // Use the current canvas size
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        const canvasSize = orientation === 'horizontal' ? canvasWidth : canvasHeight;
        const increment = 50;
        
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
            ruler.style.backgroundSize = `${scaledIncrement}px 15px, ${smallIncrement}px 10px`;
            ruler.style.backgroundPosition = `${offset}px 9px, ${offset}px 11px`;
        } else {
            ruler.style.backgroundSize = `15px ${scaledIncrement}px, 10px ${smallIncrement}px`;
            ruler.style.backgroundPosition = `9px ${offset}px, 11px ${offset}px`;
        }
    }
    
    setupGuideLines() {
        const guideContainer = document.querySelector('.guide-lines');
        
        // Set up guide line drag events
        guideContainer.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('guide-line')) {
                this.startDraggingGuide(e.target, e);
            }
        });
        
        // Set up guide line double-click to delete
        guideContainer.addEventListener('dblclick', (e) => {
            if (e.target.classList.contains('guide-line')) {
                this.deleteGuideLine(e.target);
            }
        });
        
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
        } else {
            guideLine.style.left = position + 'px';
        }
        
        const guideContainer = document.querySelector('.guide-lines');
        console.log('Guide container found:', guideContainer);
        
        guideContainer.appendChild(guideLine);
        this.guideLines.push({
            element: guideLine,
            orientation: orientation,
            position: position
        });
        
        console.log('Guide line created and added. Total guides:', this.guideLines.length);
        
        return guideLine;
    }
    
    // Test function to manually create a guide line for debugging
    createTestGuide(orientation = 'vertical', position = 100) {
        console.log('Creating test guide:', orientation, position);
        return this.createGuideLine(orientation, position);
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
        
        let position;
        if (orientation === 'horizontal') {
            position = (e.clientY - canvasRect.top) / this.zoomLevel;
            position = Math.max(0, Math.min(position, 842));
            this.currentGuide.style.top = position + 'px';
        } else {
            position = (e.clientX - canvasRect.left) / this.zoomLevel;
            position = Math.max(0, Math.min(position, 595));
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
            this.currentGuide = null;
        }
        
        this.isDraggingGuide = false;
        document.body.style.cursor = '';
    }
    
    deleteGuideLine(guideElement) {
        const guideIndex = this.guideLines.findIndex(g => g.element === guideElement);
        if (guideIndex !== -1) {
            this.guideLines.splice(guideIndex, 1);
            guideElement.remove();
        }
    }
    
    clearGuides() {
        this.guideLines.forEach(guide => {
            guide.element.remove();
        });
        this.guideLines = [];
        this.clearSnapIndicators();
    }
    
    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
        const button = document.getElementById('toggleSnap');
        
        if (this.snapEnabled) {
            button.textContent = 'Snap: ON';
            button.classList.add('snap-enabled');
        } else {
            button.textContent = 'Snap: OFF';
            button.classList.remove('snap-enabled');
        }
        
        this.clearSnapIndicators();
    }
    
    generateElementName(type, count) {
        const typeNames = {
            text: 'Text',
            heading: 'Heading',
            rectangle: 'Rectangle',
            circle: 'Circle',
            line: 'Line',
            image: 'Image'
        };
        
        return `${typeNames[type]} ${count}`;
    }
    
    setupZoom() {
        // Add mouse wheel zoom support
        this.canvas.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
                this.setZoom(this.zoomLevel + delta);
            }
        });
        
        // Initial zoom application
        this.applyZoom();
    }
    
    zoomIn() {
        this.setZoom(this.zoomLevel + this.zoomStep);
    }
    
    zoomOut() {
        this.setZoom(this.zoomLevel - this.zoomStep);
    }
    
    handleZoomChange(e) {
        this.setZoom(parseFloat(e.target.value));
    }
    
    setZoom(newZoom) {
        // Constrain zoom level
        newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        
        if (newZoom !== this.zoomLevel) {
            this.zoomLevel = newZoom;
            this.applyZoom();
            this.updateZoomUI();
        }
    }
    
    applyZoom() {
        const canvasWithGuides = document.querySelector('.canvas-with-guides');
        canvasWithGuides.style.transform = `scale(${this.zoomLevel})`;
        canvasWithGuides.style.transformOrigin = 'top left';
        
        // Update rulers to reflect zoom
        this.updateRulersForZoom();
        
        // Update snap threshold for zoom
        this.snapThreshold = 5 / this.zoomLevel;
    }
    
    updateZoomUI() {
        const zoomSelect = document.getElementById('zoomLevel');
        zoomSelect.value = this.zoomLevel;
        
        // Update canvas info to show zoom
        const canvasInfo = document.querySelector('.canvas-info span');
        canvasInfo.textContent = `Canvas: 595 x 842 px (A4 Size) - ${Math.round(this.zoomLevel * 100)}%`;
    }
    
    zoomToFit() {
        const canvasContainer = document.querySelector('.canvas-workspace');
        const containerRect = canvasContainer.getBoundingClientRect();
        
        // Calculate available space (minus rulers)
        const availableWidth = containerRect.width - 30; // 30px for vertical ruler
        const availableHeight = containerRect.height - 30; // 30px for horizontal ruler
        
        // Calculate zoom to fit
        const scaleX = availableWidth / 595;
        const scaleY = availableHeight / 842;
        const fitZoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%
        
        this.setZoom(Math.max(this.minZoom, fitZoom));
    }
    
    updateRulersForZoom() {
        this.updateRulerTrackSizes();
        const horizontalRuler = document.querySelector('.ruler-horizontal .ruler-track');
        const verticalRuler = document.querySelector('.ruler-vertical .ruler-track');
        
        // Update ruler markings to reflect zoom
        setTimeout(() => {
            this.createRulerMarkings(horizontalRuler, 'horizontal');
            this.createRulerMarkings(verticalRuler, 'vertical');
        }, 50);
    }

    updateRulerTrackSizes() {
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        const horizontalRuler = document.querySelector('.ruler-horizontal .ruler-track');
        const verticalRuler = document.querySelector('.ruler-vertical .ruler-track');
        if (horizontalRuler) horizontalRuler.style.width = canvasWidth + 'px';
        if (verticalRuler) verticalRuler.style.height = canvasHeight + 'px';
    }
    
        handleToolSelect(e) {
        const toolType = e.currentTarget.dataset.type;
        
        // Calculate center position of canvas
        const centerX = 595 / 2; // Canvas width / 2
        const centerY = 842 / 2; // Canvas height / 2
        
        // Create element immediately at center
        this.createElement(toolType, centerX, centerY);
        
        // No need to clear states since we don't maintain tool selection
    }




    
    createElement(type, x, y) {
        const element = document.createElement('div');
        element.className = `canvas-element element-${type}`;
        element.dataset.type = type;
        element.dataset.id = `element-${++this.elementCounter}`;
        
        // Generate unique name for the element
        this.elementNameCounters[type]++;
        const elementName = this.generateElementName(type, this.elementNameCounters[type]);
        
        console.log('🏗️ CREATE DEBUG: Creating new element:', {
            elementId: element.dataset.id,
            elementType: type,
            elementName: elementName,
            position: { x, y },
            elementCounter: this.elementCounter
        });
        
        const elementData = {
            id: element.dataset.id,
            name: elementName,
            type: type,
            x: x,
            y: y,
            width: 100,
            height: 60,
            text: '',
            fontSize: 14,
            fontFamily: 'Arial',
            textAlign: 'left', // Text alignment: left, center, right, justify
            lineHeight: 18, // Line height (leading) for text in pixels
            color: '#333333',
            colorCmyk: this.hexToCmyk('#333333'),
            colorMode: 'hex', // Text color mode
            backgroundColor: '#3498db',
            backgroundColorCmyk: this.hexToCmyk('#3498db'),
            backgroundColorMode: 'hex', // Background color mode
            borderColor: '#2c3e50',
            borderColorCmyk: this.hexToCmyk('#2c3e50'),
            borderColorMode: 'hex', // Border color mode
            borderWidth: 1,
            opacity: 1,
            rotation: 0
        };
        
        switch (type) {
            case 'text':
                elementData.text = 'Sample Text';
                elementData.width = 120;
                elementData.height = 30;
                elementData.fontSize = 14;
                element.textContent = elementData.text;
                element.contentEditable = true;
                element.style.fontFamily = this.getFontStack(elementData.fontFamily);
                break;
            case 'heading':
                elementData.text = 'Heading';
                elementData.width = 150;
                elementData.height = 40;
                elementData.fontSize = 20;
                element.textContent = elementData.text;
                element.contentEditable = true;
                element.style.fontFamily = this.getFontStack(elementData.fontFamily);
                break;
            case 'rectangle':
                elementData.width = 100;
                elementData.height = 60;
                break;
            case 'circle':
                elementData.width = 60;
                elementData.height = 60;
                break;
            case 'line':
                elementData.width = 100;
                elementData.height = 2;
                break;
            case 'image':
                elementData.width = 100;
                elementData.height = 100;
                element.innerHTML = '<i class="fas fa-image"></i>';
                break;
        }
        
        element.style.left = x + 'px';
        element.style.top = y + 'px';
        element.style.width = elementData.width + 'px';
        element.style.height = elementData.height + 'px';
        
        this.canvas.appendChild(element);
        this.elements.push(elementData);
        
        // Add to layer system
        this.addElementToLayers(element.dataset.id);
        
        this.selectElement(element);
        this.addEventListenersToElement(element);
    }
    
    addEventListenersToElement(element) {
        element.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            // Ensure we're working with the canvas element, not a child element
            const canvasElement = e.target.closest('.canvas-element') || element;
            this.startDragging(canvasElement, e);
        });
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            // Ensure we're working with the canvas element, not a child element
            const canvasElement = e.target.closest('.canvas-element') || element;
            this.selectElement(canvasElement);
        });
        
        element.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (element.contentEditable === 'true') {
                element.focus();
            }
        });
        
        element.addEventListener('blur', () => {
            if (element.contentEditable === 'true') {
                const elementData = this.elements.find(el => el.id === element.dataset.id);
                if (elementData) {
                    elementData.text = element.textContent;
                }
            }
        });
    }
    
    startDragging(element, e) {
        // Don't start dragging if we're already resizing or rotating
        if (this.isResizing || this.isRotating) return;
        
        this.isDragging = true;
        this.selectedElement = element;
        this.selectElement(element);
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const elementData = this.elements.find(el => el.id === element.dataset.id);

        if (elementData) {
            // Calculate mouse position relative to the canvas
            const mouseX_canvas = (e.clientX - canvasRect.left) / this.zoomLevel;
            const mouseY_canvas = (e.clientY - canvasRect.top) / this.zoomLevel;
            
            // Calculate offset from current element position
            this.dragOffset.x = mouseX_canvas - elementData.x;
            this.dragOffset.y = mouseY_canvas - elementData.y;
        }
        
        document.addEventListener('mousemove', this.boundHandleElementDrag);
        document.addEventListener('mouseup', this.boundHandleElementDragEnd);
    }
    
    handleElementDrag(e) {
        if (!this.isDragging || !this.selectedElement) return;

        const elementData = this.elements.find(el => el.id === this.selectedElement.dataset.id);
        if (!elementData) return;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // Calculate new position based on mouse movement
        let x = (e.clientX - canvasRect.left) / this.zoomLevel - this.dragOffset.x;
        let y = (e.clientY - canvasRect.top) / this.zoomLevel - this.dragOffset.y;
        
        // No boundary constraints - allow complete freedom of movement
        // Elements can move anywhere and overlap freely for PDF design flexibility
        
        // Apply snapping if enabled (but allow overlapping)
        if (this.snapEnabled && !this.isResizing) {
            const snapResult = this.getSnapPosition(x, y, this.selectedElement, elementData);
            x = snapResult.x;
            y = snapResult.y;
            
            // Show snap indicators
            this.showSnapIndicators(snapResult.snapLines);
            
            // Add snapping class
            if (snapResult.snapLines.length > 0) {
                this.selectedElement.classList.add('snapping');
            } else {
                this.selectedElement.classList.remove('snapping');
            }
        }
        
        // Update both DOM and data model
        this.selectedElement.style.left = x + 'px';
        this.selectedElement.style.top = y + 'px';
        elementData.x = x;
        elementData.y = y;
    }
    
    handleElementDragEnd() {
        this.isDragging = false;
        this.clearSnapIndicators();
        
        if (this.selectedElement) {
            this.selectedElement.classList.remove('snapping');
            this.updatePropertiesPanel(); // Update properties only on drag end
        }
        
        document.removeEventListener('mousemove', this.boundHandleElementDrag);
        document.removeEventListener('mouseup', this.boundHandleElementDragEnd);
    }
    
    handleMouseDown(e) {
        if (e.target === this.canvas) {
            this.deselectAll();
        }
    }
    
    handleMouseMove(e) {
        // Mouse tracking is handled in setupMouseTracking
    }
    
    handleMouseUp(e) {
        // Handle any mouseup events
    }
    
    handleCanvasClick(e) {
        // Check if we clicked on an existing canvas element
        const clickedElement = e.target.closest('.canvas-element');
        
        // Handle deselection if clicking on empty canvas (not on an element)
        if (!clickedElement) {
            this.deselectAll();
        }
    }
    
    handleKeyDown(e) {
        if (e.key === 'Delete' && this.selectedElement) {
            this.deleteElement(this.selectedElement);
        }
        
        if (e.key === 'Escape') {
            this.deselectAll();
        }
        
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            if (this.selectedElement) {
                this.duplicateElement(this.selectedElement);
            }
        }
    }
    
    handleGlobalClick(e) {
        // If any panel doesn't exist yet, do nothing.
        if (!this.canvas || !this.propertiesPanel || !this.layersPanel) {
            return;
        }

        // Deselect if clicking outside the canvas and properties panel
        if (
            !this.canvas.contains(e.target) &&
            !this.propertiesPanel.contains(e.target) &&
            !this.layersPanel.contains(e.target) &&
            !e.target.closest('.context-item')
        ) {
            this.deselectAll();
        }
    }
    
    selectElement(element) {
        console.log('🎯 SELECT DEBUG: Selecting element:', {
            elementId: element.dataset.id,
            elementType: element.dataset.type,
            previousSelection: this.selectedElement ? this.selectedElement.dataset.id : 'none'
        });
        
        this.deselectAll();
        this.selectedElement = element;
        element.classList.add('selected');
        
        // Update selected element name display
        const elementData = this.elements.find(el => el.id === element.dataset.id);
        
        // Update element style to show border for selected rectangles/circles
        if (elementData) {
            this.updateElementStyle(element, elementData);
        }
        
        // Add visual controls
        this.addVisualControls(element);
        
        this.updatePropertiesPanel();
        this.updateLayersUI();
        this.updateLayerToolbarButtons();
    }
    
    deselectAll() {
        // Remove all visual controls first
        this.removeVisualControls();
        
        document.querySelectorAll('.canvas-element.selected').forEach(el => {
            el.classList.remove('selected');
            
            // Update element style to hide border for deselected rectangles/circles
            const elementData = this.elements.find(data => data.id === el.dataset.id);
            if (elementData) {
                this.updateElementStyle(el, elementData);
            }
        });
        this.selectedElement = null;
        
        // Update layer UI
        this.updateLayersUI();
        this.updateLayerToolbarButtons();
        
        this.updatePropertiesPanel();
    }
    
    addVisualControls(element) {
        this.removeVisualControls(); // Remove any existing controls
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'element-controls';
        controlsContainer.setAttribute('data-element-id', element.dataset.id);
        
        // Position the controls container
        const rect = element.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
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
            this.deleteElement(element);
        });
        
        controlsContainer.appendChild(deleteButton);
        
        this.canvas.appendChild(controlsContainer);
    }
    
    removeVisualControls() {
        const existingControls = this.canvas.querySelectorAll('.element-controls');
        existingControls.forEach(control => control.remove());
    }
    
    startResize(element, position, e) {
        this.isResizing = true;
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
        
        document.addEventListener('mousemove', this.boundHandleResize);
        document.addEventListener('mouseup', this.boundStopResize);
        
        // Prevent element dragging during resize
        document.body.style.userSelect = 'none';
    }
    
    handleResize(e) {
        if (!this.isResizing || !this.resizeElement) return;
        
        const elementData = this.elements.find(el => el.id === this.resizeElement.dataset.id);
        if (!elementData) return;
        
        console.log('🔧 RESIZE DEBUG: Starting resize for element:', {
            elementId: this.resizeElement.dataset.id,
            elementType: elementData.type,
            currentPosition: { x: elementData.x, y: elementData.y },
            currentSize: { width: elementData.width, height: elementData.height }
        });
        
        // Debug: Check all elements' positions before resize
        console.log('📍 ALL ELEMENTS BEFORE RESIZE:', this.elements.map(el => ({
            id: el.id,
            type: el.type,
            position: { x: el.x, y: el.y },
            size: { width: el.width, height: el.height }
        })));
        
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
        
        // Use dynamic canvas dimensions for bounds checking
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        
        // Allow elements to extend beyond canvas bounds for overlapping designs
        // Only constrain to prevent elements from being moved completely off-screen
        const BOUNDARY_MARGIN = 50; // Allow some margin for grabbing elements
        newX = Math.max(-newWidth + BOUNDARY_MARGIN, Math.min(newX, canvasWidth - BOUNDARY_MARGIN));
        newY = Math.max(-newHeight + BOUNDARY_MARGIN, Math.min(newY, canvasHeight - BOUNDARY_MARGIN));
        
        // Update element data and visual element
        elementData.x = newX;
        elementData.y = newY;
        elementData.width = newWidth;
        elementData.height = newHeight;
        
        console.log('🔧 RESIZE DEBUG: After resize calculation:', {
            elementId: this.resizeElement.dataset.id,
            newPosition: { x: newX, y: newY },
            newSize: { width: newWidth, height: newHeight },
            resizePosition: this.resizePosition
        });
        
        this.updateElementStyle(this.resizeElement, elementData);
        this.updateVisualControlsPosition(this.resizeElement);
        this.updatePropertiesPanel();
        
        // Debug: Check all elements' positions after resize
        console.log('📍 ALL ELEMENTS AFTER RESIZE:', this.elements.map(el => ({
            id: el.id,
            type: el.type,
            position: { x: el.x, y: el.y },
            size: { width: el.width, height: el.height }
        })));
        console.log('------- END RESIZE OPERATION -------');
    }
    
    stopResize() {
        console.log('🛑 RESIZE STOP DEBUG: Stopping resize operation');
        
        this.isResizing = false;
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
        
        // Final debug check of all element positions
        console.log('📍 FINAL ELEMENT POSITIONS AFTER RESIZE STOP:', this.elements.map(el => ({
            id: el.id,
            type: el.type,
            position: { x: el.x, y: el.y },
            size: { width: el.width, height: el.height }
        })));
    }
    
    startRotation(element, e) {
        this.isRotating = true;
        this.rotationElement = element;
        
        const elementData = this.elements.find(el => el.id === element.dataset.id);
        if (!elementData) return;
        
        const rect = element.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        this.rotationCenter = {
            x: rect.left + rect.width / 2 - canvasRect.left,
            y: rect.top + rect.height / 2 - canvasRect.top
        };
        
        this.rotationStartAngle = elementData.rotation || 0;
        this.rotationStartMouse = Math.atan2(
            e.clientY - canvasRect.top - this.rotationCenter.y,
            e.clientX - canvasRect.left - this.rotationCenter.x
        );
        
        document.addEventListener('mousemove', this.boundHandleRotation);
        document.addEventListener('mouseup', this.boundStopRotation);
        document.body.style.userSelect = 'none';
    }
    
    handleRotation(e) {
        if (!this.isRotating || !this.rotationElement) return;
        
        const elementData = this.elements.find(el => el.id === this.rotationElement.dataset.id);
        if (!elementData) return;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const currentAngle = Math.atan2(
            e.clientY - canvasRect.top - this.rotationCenter.y,
            e.clientX - canvasRect.left - this.rotationCenter.x
        );
        
        const angleDiff = currentAngle - this.rotationStartMouse;
        let newRotation = this.rotationStartAngle + (angleDiff * 180 / Math.PI);
        
        // Normalize angle to 0-360 degrees
        newRotation = ((newRotation % 360) + 360) % 360;
        
        elementData.rotation = newRotation;
        this.rotationElement.style.transform = `rotate(${newRotation}deg)`;
        
        this.updatePropertiesPanel();
    }
    
    stopRotation() {
        this.isRotating = false;
        this.rotationElement = null;
        this.rotationCenter = null;
        this.rotationStartAngle = 0;
        this.rotationStartMouse = 0;
        
        document.removeEventListener('mousemove', this.boundHandleRotation);
        document.removeEventListener('mouseup', this.boundStopRotation);
        document.body.style.userSelect = '';
    }
    
    updateVisualControlsPosition(element) {
        const controls = this.canvas.querySelector(`[data-element-id="${element.dataset.id}"]`);
        console.log('🎯 CONTROLS DEBUG: Updating visual controls position:', {
            elementId: element.dataset.id,
            controlsFound: !!controls,
            elementPosition: { left: element.offsetLeft, top: element.offsetTop },
            elementSize: { width: element.offsetWidth, height: element.offsetHeight },
            allControlsOnCanvas: this.canvas.querySelectorAll('.element-controls').length
        });
        
        if (controls) {
            controls.style.left = element.offsetLeft + 'px';
            controls.style.top = element.offsetTop + 'px';
            controls.style.width = element.offsetWidth + 'px';
            controls.style.height = element.offsetHeight + 'px';
        }
    }
    
    handleContextAction(action) {
        switch (action) {
            case 'delete':
                this.deleteElement(this.selectedElement);
                break;
            case 'duplicate':
                this.duplicateElement(this.selectedElement);
                break;
            case 'bring-front':
                this.bringToFront(this.selectedElement);
                break;
            case 'send-back':
                this.sendToBack(this.selectedElement);
                break;
        }
    }
    
    deleteElement(element) {
        const elementData = this.elements.find(el => el.id === element.dataset.id);
        if (elementData) {
            this.elements = this.elements.filter(el => el.id !== element.dataset.id);
            
            // Remove from layer system
            this.removeElementFromLayers(element.dataset.id);
            
            // Remove visual controls first
            this.removeVisualControls();
            
            element.remove();
            this.selectedElement = null;
            this.updatePropertiesPanel();
        }
    }
    
    duplicateElement(element) {
        const elementData = this.elements.find(el => el.id === element.dataset.id);
        if (elementData) {
            const newElement = this.createElement(elementData.type, elementData.x + 20, elementData.y + 20);
            
            // Copy properties from original element
            const newElementData = this.elements[this.elements.length - 1];
            newElementData.text = elementData.text;
            newElementData.fontSize = elementData.fontSize;
            newElementData.fontFamily = elementData.fontFamily;
            newElementData.color = elementData.color;
            newElementData.colorCmyk = element.colorCmyk || this.hexToCmyk(element.color || '#333333');
            newElementData.backgroundColor = elementData.backgroundColor;
            newElementData.backgroundColorCmyk = element.backgroundColorCmyk || this.hexToCmyk(element.backgroundColor || '#3498db');
            newElementData.borderColor = elementData.borderColor;
            newElementData.borderColorCmyk = element.borderColorCmyk || this.hexToCmyk(element.borderColor || '#2c3e50');
            newElementData.borderWidth = elementData.borderWidth;
            newElementData.opacity = elementData.opacity;
            newElementData.width = elementData.width;
            newElementData.height = elementData.height;
            newElementData.colorMode = elementData.colorMode || 'hex';
            
            // Update the visual element with copied properties
            const newVisualElement = document.querySelector(`[data-id="${newElementData.id}"]`);
            if (newVisualElement) {
                this.updateElementStyle(newVisualElement, newElementData);
                if (elementData.text) {
                    newVisualElement.textContent = elementData.text;
                }
                
                // Add to layer system (it was already added in createElement, but need to update UI)
                this.updateLayersUI();
            }
        }
    }
    
    bringToFront(element) {
        element.style.zIndex = '1000';
    }
    
    sendToBack(element) {
        element.style.zIndex = '1';
    }
    
    updatePropertiesPanel() {
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
                    <label>Upload Image</label>
                    <input type="file" id="prop-imageFile" accept="image/*,.svg" class="file-input">
                    <button type="button" id="upload-image-btn" class="btn btn-primary" style="margin-top: 0.5rem;">Upload to S3</button>
                    <div id="upload-progress" class="upload-progress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <span class="progress-text">Uploading...</span>
                    </div>
                </div>
                <div class="property-group">
                    <label>Or use Image URL</label>
                    <input type="url" id="prop-imageUrl" value="${elementData.imageUrl || ''}" placeholder="https://example.com/image.jpg">
                    <button type="button" id="load-image-btn" class="btn btn-secondary">Load from URL</button>
                </div>
                <div class="property-group">
                    <label>Tailwind Classes</label>
                    <input type="text" id="prop-tailwindClasses" value="${elementData.tailwindClasses || ''}" placeholder="rounded-lg shadow-lg border-2">
                    <small class="help-text">Add Tailwind CSS classes (e.g., rounded-lg shadow-lg border-2)</small>
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
        
        // Add image upload button listener
        const uploadImageBtn = document.getElementById('upload-image-btn');
        if (uploadImageBtn) {
            uploadImageBtn.addEventListener('click', () => {
                this.uploadImageToS3(elementData);
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

    // Get PDF color object based on color mode
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

    updateElementStyle(element, elementData) {
        console.log('🎨 UPDATE STYLE DEBUG: Updating element style:', {
            elementId: element.dataset.id,
            elementType: elementData.type,
            position: { x: elementData.x, y: elementData.y },
            size: { width: elementData.width, height: elementData.height },
            isSelectedElement: element === this.selectedElement,
            callStack: new Error().stack.split('\n').slice(1, 4).join('\n')
        });
        
        element.style.left = elementData.x + 'px';
        element.style.top = elementData.y + 'px';
        element.style.width = elementData.width + 'px';
        element.style.height = elementData.height + 'px';
        element.style.opacity = elementData.opacity;
        
        // Apply rotation if it exists
        if (elementData.rotation !== undefined && elementData.rotation !== null) {
            if (elementData.rotation !== 0) {
                element.style.transform = `rotate(${elementData.rotation}deg)`;
            } else {
                element.style.transform = '';
            }
        } else {
            element.style.transform = '';
        }
        
        if (elementData.type === 'text' || elementData.type === 'heading') {
            element.innerHTML = elementData.text;
            element.style.fontSize = elementData.fontSize + 'px';
            element.style.fontFamily = this.getFontStack(elementData.fontFamily);
            element.style.color = elementData.color;
            element.style.textAlign = elementData.textAlign || 'left';
            element.style.lineHeight = (elementData.lineHeight || 18) + 'px';
            
            // Apply Tailwind classes
            if (elementData.tailwindClasses && elementData.tailwindClasses.trim() !== '') {
                element.className = `canvas-element element-${elementData.type} ${elementData.tailwindClasses}`;
            } else {
                element.className = `canvas-element element-${elementData.type}`;
            }
        }
        
        if (elementData.type === 'rectangle' || elementData.type === 'circle') {
            element.style.backgroundColor = elementData.backgroundColor;
            element.style.borderColor = elementData.borderColor;
            element.style.borderWidth = elementData.borderWidth + 'px';
            
            // Only show border when element is selected
            if (element.classList.contains('selected')) {
                element.style.borderStyle = 'solid';
            } else {
                element.style.borderStyle = 'none';
            }
        }
        
        if (elementData.type === 'image') {
            if (elementData.imageUrl && elementData.imageUrl.trim() !== '') {
                // Use setElementImage for consistent SVG and regular image handling
                this.setElementImage(elementData, elementData.imageUrl);
            } else {
                element.innerHTML = '<i class="fas fa-image"></i>';
                element.style.backgroundImage = '';
                element.style.backgroundSize = '';
                element.style.backgroundPosition = '';
                element.style.backgroundRepeat = '';
                element.style.backgroundColor = ''; // Restore original background color when no image
            }
            
            // Apply Tailwind classes
            if (elementData.tailwindClasses && elementData.tailwindClasses.trim() !== '') {
                element.className = `canvas-element element-${elementData.type} ${elementData.tailwindClasses}`;
            } else {
                element.className = `canvas-element element-${elementData.type}`;
            }
        }
        
        // Update visual controls position if element is selected
        if (element === this.selectedElement) {
            this.updateVisualControlsPosition(element);
        }
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

    async uploadImageToS3(elementData) {
        const fileInput = document.getElementById('prop-imageFile');
        const clientId = this.getCurrentClientId();
        
        if (!fileInput.files || fileInput.files.length === 0) {
            alert('Please select an image file to upload');
            return;
        }
        
        if (!clientId) {
            alert('Please select a client before uploading images');
            return;
        }
        
        const file = fileInput.files[0];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }
        
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            return;
        }
        
        const progressContainer = document.getElementById('upload-progress');
        const progressFill = progressContainer.querySelector('.progress-fill');
        const progressText = progressContainer.querySelector('.progress-text');
        const uploadBtn = document.getElementById('upload-image-btn');
        
        try {
            // Show progress
            progressContainer.style.display = 'block';
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
            
            // Create FormData
            const formData = new FormData();
            formData.append('image', file);
            formData.append('client_id', clientId);
            
            // Upload with progress tracking
            const xhr = new XMLHttpRequest();
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    progressFill.style.width = percent + '%';
                    progressText.textContent = `Uploading... ${Math.round(percent)}%`;
                }
            };
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        // Update the element with the uploaded image
                        this.setElementImage(elementData, response.data.url);
                        
                        // Clear the file input
                        fileInput.value = '';
                        
                        alert('Image uploaded successfully!');
                    } else {
                        alert('Upload failed: ' + response.message);
                    }
                } else {
                    const response = JSON.parse(xhr.responseText);
                    alert('Upload failed: ' + (response.message || 'Unknown error'));
                }
            };
            
            xhr.onerror = () => {
                alert('Upload failed: Network error');
            };
            
            xhr.open('POST', `${this.apiBaseUrl}/images/upload`);
            xhr.send(formData);
            
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed: ' + error.message);
        } finally {
            // Hide progress and reset button
            setTimeout(() => {
                progressContainer.style.display = 'none';
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload to S3';
                progressFill.style.width = '0%';
                progressText.textContent = 'Uploading...';
            }, 1000);
        }
    }

    setElementImage(elementData, imageUrl) {
        // Find the element on canvas
        const element = document.querySelector(`[data-id="${elementData.id}"]`);
        if (!element) return;
        
        // Check if the image is an SVG (by URL extension or MIME type in the URL)
        const isSvg = imageUrl.toLowerCase().includes('.svg') || 
                     imageUrl.toLowerCase().includes('image/svg') ||
                     imageUrl.toLowerCase().includes('svg+xml');
        
        // Clear existing content
        element.innerHTML = '';
        
        if (isSvg) {
            // For SVG files, use an img tag for proper display
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.display = 'block';
            element.appendChild(img);
            
            // Clear background image styles
            element.style.backgroundImage = '';
            element.style.backgroundSize = '';
            element.style.backgroundPosition = '';
            element.style.backgroundRepeat = '';
        } else {
            // For other image types, use background image
            element.style.backgroundImage = `url(${imageUrl})`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            element.style.backgroundRepeat = 'no-repeat';
        }
        
        element.style.backgroundColor = 'transparent'; // Hide background color when image is loaded
        
        // Update element data
        elementData.imageUrl = imageUrl;
        
        // Update the URL input field
        const imageUrlInput = document.getElementById('prop-imageUrl');
        if (imageUrlInput) {
            imageUrlInput.value = imageUrl;
        }
        
        console.log('Image set successfully:', imageUrl);
    }

    getCurrentClientId() {
        const clientSelect = document.getElementById('templateClientSelect');
        return clientSelect ? clientSelect.value : null;
    }
    
    clearCanvas() {
        if (confirm('Are you sure you want to clear the canvas? This action cannot be undone.')) {
            // Remove all visual controls first
            this.removeVisualControls();
            
            // Clear guide lines properly
            this.clearGuides();
            
            this.canvas.innerHTML = '<div class="canvas-grid"></div><div class="guide-lines"></div>';
            this.elements = [];
            this.selectedElement = null;
            this.elementCounter = 0;
            
            // Reset element name counters
            this.elementNameCounters = {
                text: 0,
                heading: 0,
                rectangle: 0,
                circle: 0,
                line: 0,
                image: 0
            };
            
            // Reset visual control state
            this.isResizing = false;
            this.isRotating = false;
            this.resizeElement = null;
            this.rotationElement = null;
            
                    // Reset layer system
        this.layerOrder = [];
        this.layerVisibility = {};
        this.updateLayersUI();
        
        // Reset template tracking
        this.currentTemplateName = '';
        this.currentTemplateId = null;
            
            // Update URL to remove template ID when canvas is cleared
            if (window.location.pathname.match(/^\/editor\/\d+$/)) {
                window.history.pushState({}, '', '/editor');
            }
            
            this.updatePropertiesPanel();
        }
    }
    
    clearCanvasSilent(preserveGuides = false) {
        // Remove all visual controls first
        this.removeVisualControls();
        
        // Clear guide lines only if not preserving them
        if (!preserveGuides) {
            this.clearGuides();
        }
        
        this.canvas.innerHTML = '<div class="canvas-grid"></div><div class="guide-lines"></div>';
        
        // If preserving guides, restore them to the new DOM
        if (preserveGuides && this.guideLines.length > 0) {
            const guidesContainer = this.canvas.querySelector('.guide-lines');
            this.guideLines.forEach(guide => {
                guidesContainer.appendChild(guide.element);
            });
        }
        
        // Re-setup guide line event listeners since the container was recreated
        this.setupGuideLines();
        
        this.elements = [];
        this.selectedElement = null;
        this.elementCounter = 0;
        
        // Reset element name counters
        this.elementNameCounters = {
            text: 0,
            heading: 0,
            rectangle: 0,
            circle: 0,
            line: 0,
            image: 0
        };
        
        // Reset visual control state
        this.isResizing = false;
        this.isRotating = false;
        this.resizeElement = null;
        this.rotationElement = null;
        
        // Reset layer system
        this.layerOrder = [];
        this.layerVisibility = {};
        this.updateLayersUI();
        
        // Reset template tracking
        this.currentTemplateName = '';
        this.currentTemplateId = null;
        
        this.updatePropertiesPanel();
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
                            opacity: elementData.opacity
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
                            opacity: elementData.opacity
                        });
                        break;
                        
                    case 'circle':
                        const circleBgColor = this.getPdfColor(elementData.backgroundColor, elementData.backgroundColorCmyk, elementData.colorMode);
                        const circleBorderColor = this.getPdfColor(elementData.borderColor, elementData.borderColorCmyk, elementData.colorMode);
                        
                        page.drawCircle({
                            x: x + elementData.width / 2,
                            y: y + elementData.height / 2,
                            size: elementData.width / 2,
                            color: circleBgColor,
                            borderColor: circleBorderColor,
                            borderWidth: elementData.borderWidth,
                            opacity: elementData.opacity
                        });
                        break;
                        
                    case 'line':
                        const lineColor = this.getPdfColor(elementData.borderColor, elementData.borderColorCmyk, elementData.colorMode);
                        
                        page.drawLine({
                            start: { x: x, y: y + elementData.height / 2 },
                            end: { x: x + elementData.width, y: y + elementData.height / 2 },
                            thickness: elementData.borderWidth,
                            color: lineColor,
                            opacity: elementData.opacity
                        });
                        break;
                }
            });
            
            // Save the PDF
            const pdfBytes = await pdfDoc.save();
            
            // Download the PDF
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'design.pdf';
            a.click();
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
        }
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    // Convert CMYK to RGB
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

    // Convert RGB to CMYK
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

    // Convert RGB to Hex
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Convert CMYK to Hex
    cmykToHex(c, m, y, k) {
        const rgb = this.cmykToRgb(c, m, y, k);
        return this.rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    // Convert Hex to CMYK
    hexToCmyk(hex) {
        const rgb = this.hexToRgb(hex);
        return this.rgbToCmyk(rgb.r, rgb.g, rgb.b);
    }
    
    getSnapPosition(x, y, element, elementData) {
        const snapLines = [];
        let snapX = x;
        let snapY = y;
        
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
        
        // Check snapping to other elements
        this.elements.forEach(otherElementData => {
            if (otherElementData.id === element.dataset.id) return;
            
            const otherElement = document.querySelector(`[data-id="${otherElementData.id}"]`);
            if (!otherElement) return;
            
            const otherX = otherElementData.x;
            const otherY = otherElementData.y;
            const otherWidth = otherElementData.width;
            const otherHeight = otherElementData.height;
            
            // Vertical alignment
            if (Math.abs(y - otherY) <= this.snapThreshold) {
                snapY = otherY;
                snapLines.push({ orientation: 'horizontal', position: otherY });
            }
            if (Math.abs((y + elementHeight) - (otherY + otherHeight)) <= this.snapThreshold) {
                snapY = otherY + otherHeight - elementHeight;
                snapLines.push({ orientation: 'horizontal', position: otherY + otherHeight });
            }
            
            // Horizontal alignment
            if (Math.abs(x - otherX) <= this.snapThreshold) {
                snapX = otherX;
                snapLines.push({ orientation: 'vertical', position: otherX });
            }
            if (Math.abs((x + elementWidth) - (otherX + otherWidth)) <= this.snapThreshold) {
                snapX = otherX + otherWidth - elementWidth;
                snapLines.push({ orientation: 'vertical', position: otherX + otherWidth });
            }
        });
        
        return {
            x: snapX,
            y: snapY,
            snapLines: snapLines
        };
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
            this.snapIndicators.push(indicator);
        });
    }
    
    clearSnapIndicators() {
        this.snapIndicators.forEach(indicator => {
            indicator.remove();
        });
        this.snapIndicators = [];
    }
    
    // Template Management Methods
    setupTemplateModal() {
        const modal = document.getElementById('templateModal');
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelLoad');
        const searchInput = document.getElementById('templateSearch');
        
        // Close modal events
        closeBtn.addEventListener('click', () => this.hideTemplateModal());
        cancelBtn.addEventListener('click', () => this.hideTemplateModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideTemplateModal();
        });
        
        // Search functionality
        searchInput.addEventListener('input', (e) => {
            this.filterTemplates(e.target.value);
        });
    }
    
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
                id: element.id, // Save element ID for layer order mapping
                name: element.name,
                type: element.type,
                x: parseInt(element.x, 10) || 0,
                y: parseInt(element.y, 10) || 0,
                width: parseInt(element.width, 10) || 100,
                height: parseInt(element.height, 10) || 60,
                text: element.text || '',
                fontSize: parseInt(element.fontSize, 10) || 14,
                fontFamily: element.fontFamily || 'Arial',
                textAlign: element.textAlign || 'left',
                lineHeight: parseInt(element.lineHeight, 10) || 18,
                color: element.color || '#333333',
                colorCmyk: element.colorCmyk || this.hexToCmyk(element.color || '#333333'),
                backgroundColor: element.backgroundColor || '#3498db',
                backgroundColorCmyk: element.backgroundColorCmyk || this.hexToCmyk(element.backgroundColor || '#3498db'),
                borderColor: element.borderColor || '#2c3e50',
                borderColorCmyk: element.borderColorCmyk || this.hexToCmyk(element.borderColor || '#2c3e50'),
                borderWidth: parseInt(element.borderWidth, 10) || 1,
                opacity: parseFloat(element.opacity) || 1,
                rotation: parseInt(element.rotation, 10) || 0,
                colorMode: element.colorMode || 'hex',
                imageUrl: element.imageUrl || null
            }))
        };
        
        try {
            // Debug: Log template data being sent to server
            console.log('Template data being sent:', templateData);
            
            // Determine URL and method based on whether we're updating
            const url = isUpdate 
                ? `${this.apiBaseUrl}/templates/${this.currentTemplateId}`
                : `${this.apiBaseUrl}/templates`;
            const method = isUpdate ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify(templateData)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.currentTemplateName = templateName;
                
                // If this was a new template, set the ID for future updates
                if (!isUpdate) {
                    this.currentTemplateId = result.id;
                    // Update URL to reflect the saved template
                    const newUrl = `/editor/${result.id}`;
                    window.history.pushState({templateId: result.id}, '', newUrl);
                }
                
                alert(`Template ${isUpdate ? 'updated' : 'saved'} successfully!`);
                
                // Don't clear the template name for updates, only for new templates
                if (!isUpdate) {
                    document.getElementById('templateNameTab').value = '';
                }
            } else {
                const error = await response.json();
                
                // Handle validation errors (422 status)
                if (response.status === 422 && error.errors) {
                    let errorMessage = 'Validation Error:\n';
                    for (const [field, messages] of Object.entries(error.errors)) {
                        errorMessage += `${field}: ${messages.join(', ')}\n`;
                    }
                    alert(errorMessage);
                } else {
                    alert('Error saving template: ' + (error.message || 'Unknown error'));
                }
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
                    <h4>${template.name}</h4>
                    <div class="template-meta">
                        ${template.width} x ${template.height}px • ${template.elements_count || 0} elements
                        <br>Created: ${new Date(template.created_at).toLocaleDateString()}
                    </div>
                </div>
                <div class="template-actions">
                    <button class="template-delete" onclick="editor.deleteTemplate(${template.id}, '${template.name}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click events to template items
        templateList.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.template-actions')) {
                    const templateId = item.dataset.templateId;
                    this.loadTemplate(templateId);
                }
            });
        });
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
                this.updateRulerTrackSizes();
                const horizontalRuler = document.querySelector('.ruler-horizontal .ruler-track');
                const verticalRuler = document.querySelector('.ruler-vertical .ruler-track');
                if (horizontalRuler && verticalRuler) {
                    this.createRulerMarkings(horizontalRuler, 'horizontal');
                    this.createRulerMarkings(verticalRuler, 'vertical');
                }
            }, 150);
        }
        
        // Set template name and ID
        this.currentTemplateName = templateData.name;
        this.currentTemplateId = templateData.id; // Track that we're editing an existing template
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
        const elementIdMap = new Map(); // Map original element IDs to new IDs
        
        templateData.elements.forEach(elementData => {
            // Use dynamic canvas dimensions and allow free positioning for overlapping designs
            const canvasWidth = this.canvas.offsetWidth;
            const canvasHeight = this.canvas.offsetHeight;
            
            // Only prevent completely off-screen elements (keep some part grabbable)
            const BOUNDARY_BUFFER = 50;
            const safeX = Math.max(-elementData.width + BOUNDARY_BUFFER, Math.min(elementData.x, canvasWidth - BOUNDARY_BUFFER));
            const safeY = Math.max(-elementData.height + BOUNDARY_BUFFER, Math.min(elementData.y, canvasHeight - BOUNDARY_BUFFER));
            
            const element = this.createElement(elementData.type, safeX, safeY);
            
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
            createdElementData.id = preservedId; // Keep the new DOM element's ID
            createdElementData.name = preservedName; // Keep the generated name
            
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
            
            // Update the visual element (use the preserved ID)
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
            // Map old element IDs to new ones and restore layer order
            this.layerOrder = templateData.layer_order.map(oldId => {
                const newId = elementIdMap.get(oldId);
                return newId || oldId; // Fallback to old ID if mapping not found
            }).filter(id => {
                // Only include IDs that actually exist in the current elements
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
        
        // Update template tab info including size inputs
        updateTemplateTabInfo();
    }
    
    async deleteTemplate(templateId, templateName) {
        if (!confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/templates/${templateId}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                }
            });
            
            if (response.ok) {
                alert('Template deleted successfully!');
                await this.loadTemplateList();
            } else {
                alert('Error deleting template');
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            alert('Error deleting template. Please try again.');
        }
    }
    
    filterTemplates(searchTerm) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.loadTemplateList(searchTerm);
        }, 300);
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

    setupLayers() {
        // Layer toolbar buttons
        document.getElementById('moveLayerUp').addEventListener('click', () => this.moveLayerUp());
        document.getElementById('moveLayerDown').addEventListener('click', () => this.moveLayerDown());
        document.getElementById('bringToFront').addEventListener('click', () => this.bringLayerToFront());
        document.getElementById('sendToBack').addEventListener('click', () => this.sendLayerToBack());
        document.getElementById('duplicateLayer').addEventListener('click', () => this.duplicateLayer());
        document.getElementById('deleteLayer').addEventListener('click', () => this.deleteLayer());
    }

    addElementToLayers(elementId) {
        // Add element to the top of the layer order
        this.layerOrder.push(elementId);
        this.layerVisibility[elementId] = true;
        this.updateLayerZIndices();
        this.updateLayersUI();
        updateTemplateTabInfo();
    }

    removeElementFromLayers(elementId) {
        // Remove element from layers
        this.layerOrder = this.layerOrder.filter(id => id !== elementId);
        delete this.layerVisibility[elementId];
        this.updateLayerZIndices();
        this.updateLayersUI();
        updateTemplateTabInfo();
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

    updateLayersUI() {
        const layersList = document.getElementById('layersList');
        
        if (this.layerOrder.length === 0) {
            layersList.innerHTML = '<div class="no-layers">No elements</div>';
            this.updateLayerToolbarButtons();
            return;
        }

        // Create layers list (reverse order to show top layers first)
        const layersHTML = [...this.layerOrder].reverse().map((elementId, reverseIndex) => {
            const elementData = this.elements.find(el => el.id === elementId);
            if (!elementData) return '';

            const actualIndex = this.layerOrder.length - 1 - reverseIndex;
            const isVisible = this.layerVisibility[elementId];
            const isSelected = this.selectedElement && this.selectedElement.dataset.id === elementId;

            const typeIcons = {
                text: 'fa-font',
                heading: 'fa-heading',
                rectangle: 'fa-square',
                circle: 'fa-circle',
                line: 'fa-minus',
                image: 'fa-image'
            };

            return `
                <div class="layer-item ${isSelected ? 'selected' : ''}" 
                     data-element-id="${elementId}" 
                     data-layer-index="${actualIndex}"
                     draggable="true">
                    <div class="layer-visibility ${isVisible ? '' : 'hidden'}" 
                         data-element-id="${elementId}">
                        <i class="fas ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </div>
                    <div class="layer-icon">
                        <i class="fas ${typeIcons[elementData.type] || 'fa-square'}"></i>
                    </div>
                    <div class="layer-name">${elementData.name}</div>
                    <div class="layer-z-index">${actualIndex + 1}</div>
                </div>
            `;
        }).join('');

        layersList.innerHTML = layersHTML;

        // Add event listeners to layer items
        this.setupLayerItemListeners();
        this.updateLayerToolbarButtons();
    }

    setupLayerItemListeners() {
        const layerItems = document.querySelectorAll('.layer-item');
        
        layerItems.forEach(item => {
            const elementId = item.dataset.elementId;
            
            // Layer selection
            item.addEventListener('click', (e) => {
                if (e.target.closest('.layer-visibility')) return;
                
                const element = document.querySelector(`[data-id="${elementId}"]`);
                if (element) {
                    this.selectElement(element);
                }
            });

            // Visibility toggle
            const visibilityIcon = item.querySelector('.layer-visibility');
            visibilityIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLayerVisibility(elementId);
            });

            // Drag and drop for reordering
            item.addEventListener('dragstart', (e) => {
                this.draggedLayerIndex = parseInt(item.dataset.layerIndex);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.draggedLayerIndex = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetIndex = parseInt(item.dataset.layerIndex);
                if (this.draggedLayerIndex !== null && this.draggedLayerIndex !== targetIndex) {
                    this.reorderLayer(this.draggedLayerIndex, targetIndex);
                }
            });
        });
    }

    toggleLayerVisibility(elementId) {
        const element = document.querySelector(`[data-id="${elementId}"]`);
        if (!element) return;

        this.layerVisibility[elementId] = !this.layerVisibility[elementId];
        element.style.display = this.layerVisibility[elementId] ? 'block' : 'none';
        
        // Also hide/show visual controls if this element is selected
        if (this.selectedElement && this.selectedElement.dataset.id === elementId) {
            if (!this.layerVisibility[elementId]) {
                this.removeVisualControls();
            } else {
                this.addVisualControls(element);
            }
        }

        this.updateLayersUI();
    }

    moveLayerUp() {
        if (!this.selectedElement) return;
        const elementId = this.selectedElement.dataset.id;
        const currentIndex = this.layerOrder.indexOf(elementId);
        
        if (currentIndex < this.layerOrder.length - 1) {
            this.reorderLayer(currentIndex, currentIndex + 1);
        }
    }

    moveLayerDown() {
        if (!this.selectedElement) return;
        const elementId = this.selectedElement.dataset.id;
        const currentIndex = this.layerOrder.indexOf(elementId);
        
        if (currentIndex > 0) {
            this.reorderLayer(currentIndex, currentIndex - 1);
        }
    }

    bringLayerToFront() {
        if (!this.selectedElement) return;
        const elementId = this.selectedElement.dataset.id;
        const currentIndex = this.layerOrder.indexOf(elementId);
        
        if (currentIndex < this.layerOrder.length - 1) {
            this.reorderLayer(currentIndex, this.layerOrder.length - 1);
        }
    }

    sendLayerToBack() {
        if (!this.selectedElement) return;
        const elementId = this.selectedElement.dataset.id;
        const currentIndex = this.layerOrder.indexOf(elementId);
        
        if (currentIndex > 0) {
            this.reorderLayer(currentIndex, 0);
        }
    }

    reorderLayer(fromIndex, toIndex) {
        const elementId = this.layerOrder[fromIndex];
        
        // Remove from current position
        this.layerOrder.splice(fromIndex, 1);
        
        // Insert at new position
        this.layerOrder.splice(toIndex, 0, elementId);
        
        this.updateLayerZIndices();
        this.updateLayersUI();
    }

    duplicateLayer() {
        if (!this.selectedElement) return;
        this.duplicateElement(this.selectedElement);
    }

    deleteLayer() {
        if (!this.selectedElement) return;
        this.deleteElement(this.selectedElement);
    }

    updateLayerToolbarButtons() {
        const hasSelection = !!this.selectedElement;
        const elementId = hasSelection ? this.selectedElement.dataset.id : null;
        const currentIndex = elementId ? this.layerOrder.indexOf(elementId) : -1;
        const isFirst = currentIndex === 0;
        const isLast = currentIndex === this.layerOrder.length - 1;

        document.getElementById('moveLayerUp').disabled = !hasSelection || isLast;
        document.getElementById('moveLayerDown').disabled = !hasSelection || isFirst;
        document.getElementById('bringToFront').disabled = !hasSelection || isLast;
        document.getElementById('sendToBack').disabled = !hasSelection || isFirst;
        document.getElementById('duplicateLayer').disabled = !hasSelection;
        document.getElementById('deleteLayer').disabled = !hasSelection;
    }
}

// Global reference for template actions
let editor;

// Tab functionality
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            
            // Remove active class from all buttons and panels
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            // Add active class to clicked button and corresponding panel
            button.classList.add('active');
            document.getElementById(targetTab + '-tab').classList.add('active');
            
            // Update template tab info when switching to template tab
            if (targetTab === 'template') {
                updateTemplateTabInfo();
            }
        });
    });
    
    // Connect template tab buttons to existing functionality
    document.getElementById('saveTemplateTab').addEventListener('click', () => {
        if (editor) editor.saveTemplate();
    });
    
    document.getElementById('loadTemplateTab').addEventListener('click', () => {
        if (editor) editor.showTemplateModal();
    });
    
    document.getElementById('generatePDFTab').addEventListener('click', () => {
        if (editor) editor.generatePDF();
    });
    
    document.getElementById('clearCanvasTab').addEventListener('click', () => {
        if (editor) editor.clearCanvas();
    });
    
    // No sync needed since template name is now only in the tab
}

function updateTemplateTabInfo() {
    if (!editor) return;
    
    // Update canvas size
    const canvas = document.getElementById('canvas');
    if (canvas) {
        const canvasSize = document.getElementById('templateCanvasSize');
        if (canvasSize) {
            const width = parseInt(canvas.style.width) || 595;
            const height = parseInt(canvas.style.height) || 842;
            canvasSize.textContent = `${width} × ${height} px`;
        }
    }
    
    // Update element count
    const elementCount = document.getElementById('templateElementCount');
    if (elementCount) {
        const elements = document.querySelectorAll('.canvas-element');
        elementCount.textContent = elements.length;
    }
    
    // Update last saved (if available)
    const lastSaved = document.getElementById('templateLastSaved');
    if (lastSaved && editor.currentTemplateId) {
        lastSaved.textContent = editor.lastSavedTime || 'Unknown';
    }
    
    // Update template size inputs with current canvas size
    const templateWidth = document.getElementById('templateWidth');
    const templateHeight = document.getElementById('templateHeight');
    if (templateWidth && templateHeight && canvas) {
        const width = parseInt(canvas.style.width) || 595;
        const height = parseInt(canvas.style.height) || 842;
        templateWidth.value = width;
        templateHeight.value = height;
    }
}

function setupTemplateSizeControls() {
    const templateWidth = document.getElementById('templateWidth');
    const templateHeight = document.getElementById('templateHeight');
    const applyTemplateSize = document.getElementById('applyTemplateSize');
    const canvas = document.getElementById('canvas');
    
    // Sync template size inputs with current canvas size on init
    if (templateWidth && templateHeight && canvas) {
        const width = parseInt(canvas.style.width) || 595;
        const height = parseInt(canvas.style.height) || 842;
        templateWidth.value = width;
        templateHeight.value = height;
    }
    
    // Handle apply template size button
    if (applyTemplateSize && templateWidth && templateHeight && canvas) {
        applyTemplateSize.addEventListener('click', function() {
            const w = Math.max(100, Math.min(2000, parseInt(templateWidth.value, 10)));
            const h = Math.max(100, Math.min(2000, parseInt(templateHeight.value, 10)));
            
            // Update canvas size
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            
            // Update template info
            updateTemplateTabInfo();
            
            // Update rulers
            if (window.editor && typeof window.editor.updateRulersForZoom === 'function') {
                setTimeout(() => {
                    window.editor.updateRulersForZoom();
                }, 0);
            }
            
            console.log(`Template size updated to ${w} × ${h} px`);
        });
    }
}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    editor = new DragDropEditor(); // Assign to the global editor variable
    window.editor = editor; // Make it globally accessible if needed

    // Check if we're on a template-specific URL and auto-load it
    const pathMatch = window.location.pathname.match(/^\/editor\/(\d+)$/);
    if (pathMatch) {
        const templateId = pathMatch[1];
        // The editor's init is async, so we wait a moment
        setTimeout(() => {
            editor.loadTemplate(templateId);
        }, 200);
    }
    
    // Setup UI components that are outside the main class
    setupTabs();
    setupTemplateSizeControls();
}); 