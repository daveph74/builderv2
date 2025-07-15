export class ElementManager {
    constructor(editor) {
        this.editor = editor;
        this.elementCounter = 0;
        this.elementNameCounters = {
            text: 0,
            heading: 0,
            rectangle: 0,
            circle: 0,
            line: 0,
            image: 0
        };
    }

    generateElementName(type, counter) {
        const names = {
            text: "Text",
            heading: "Heading",
            rectangle: "Rectangle",
            circle: "Circle",
            line: "Line",
            image: "Image"
        };
        return `${names[type]} ${counter}`;
    }

    createElement(type, x, y) {
        const element = document.createElement("div");
        element.className = `canvas-element element-${type}`;
        element.dataset.type = type;
        element.dataset.id = `element-${++this.elementCounter}`;
        
        // Element created successfully
        
        this.elementNameCounters[type]++;
        const name = this.generateElementName(type, this.elementNameCounters[type]);
        
        console.log('🏗️ MODULAR CREATE DEBUG: Creating new element:', {
            elementId: element.dataset.id,
            elementType: type,
            elementName: name,
            position: { x, y },
            elementCounter: this.elementCounter
        });
        
        const elementData = {
            id: element.dataset.id,
            name: name,
            type: type,
            x: x,
            y: y,
            ...this.editor.config.getDefaultElementData(type)
        };

        // Type-specific setup
        switch (type) {
            case "text":
                element.textContent = elementData.text;
                element.contentEditable = true;
                element.style.fontFamily = this.editor.config.getFontStack(elementData.fontFamily);
                break;
            case "heading":
                element.textContent = elementData.text;
                element.contentEditable = true;
                element.style.fontFamily = this.editor.config.getFontStack(elementData.fontFamily);
                break;
            case "rectangle":
                break;
            case "circle":
                break;
            case "line":
                break;
            case "image":
                element.innerHTML = '<i class="fas fa-image"></i>';
                break;
        }

        // Set initial styles
        element.style.left = x + "px";
        element.style.top = y + "px";
        element.style.width = elementData.width + "px";
        element.style.height = elementData.height + "px";

        // Add to canvas and elements array
        this.editor.canvas.appendChild(element);
        this.editor.elements.push(elementData);
        
        // Element added to canvas and data structures
        
        // Add to layers
        this.editor.addElementToLayers(element.dataset.id);
        
        // Select the new element
        this.editor.selectElement(element);
        
        // Add event listeners
        this.addEventListenersToElement(element);
        
        return element;
    }

    addEventListenersToElement(element) {
        element.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            const targetElement = e.target.closest(".canvas-element") || element;
            this.editor.dragHandler.startDragging(targetElement, e);
        });

        element.addEventListener("click", (e) => {
            e.stopPropagation();
            const targetElement = e.target.closest(".canvas-element") || element;
            this.editor.selectElement(targetElement);
        });

        element.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            if (element.contentEditable === "true") {
                element.focus();
            }
        });

        element.addEventListener("blur", () => {
            if (element.contentEditable === "true") {
                const elementData = this.editor.elements.find(el => el.id === element.dataset.id);
                if (elementData) {
                    elementData.text = element.textContent;
                }
            }
        });
    }

    deleteElement(element) {
        const elementData = this.editor.elements.find(el => el.id === element.dataset.id);
        if (!elementData) return;

        // Remove from elements array
        this.editor.elements = this.editor.elements.filter(el => el.id !== element.dataset.id);
        
        // Remove from layers
        this.editor.removeElementFromLayers(element.dataset.id);
        
        // Remove visual controls
        this.editor.removeVisualControls();
        
        // Remove from DOM
        element.remove();
        
        // Deselect if this was the selected element
        if (this.editor.selectedElement === element) {
            this.editor.selectedElement = null;
        }
        
        // Update UI
        this.editor.updatePropertiesPanel();
    }

    duplicateElement(element) {
        const elementData = this.editor.elements.find(el => el.id === element.dataset.id);
        if (!elementData) return;

        // Create new element at offset position
        const newElement = this.createElement(elementData.type, elementData.x + 20, elementData.y + 20);
        const newElementData = this.editor.elements[this.editor.elements.length - 1];

        // Copy all properties from original element
        Object.assign(newElementData, {
            ...elementData,
            id: newElementData.id, // Keep new ID
            name: newElementData.name, // Keep new name
            x: elementData.x + 20,
            y: elementData.y + 20
        });

        // Update visual element
        const newVisualElement = document.querySelector(`[data-id="${newElementData.id}"]`);
        if (newVisualElement) {
            this.editor.updateElementStyle(newVisualElement, newElementData);
            if (elementData.text) {
                newVisualElement.textContent = elementData.text;
            }
            this.editor.updateLayersUI();
        }

        return newElement;
    }

    findElementById(id) {
        return this.editor.elements.find(el => el.id === id);
    }

    findElementByDOMId(domId) {
        return document.querySelector(`[data-id="${domId}"]`);
    }

    getAllElements() {
        return this.editor.elements;
    }

    clearAllElements() {
        this.editor.elements = [];
        this.elementCounter = 0;
        this.elementNameCounters = {
            text: 0,
            heading: 0,
            rectangle: 0,
            circle: 0,
            line: 0,
            image: 0
        };
    }

    bringToFront(element) {
        element.style.zIndex = "1000";
    }

    sendToBack(element) {
        element.style.zIndex = "1";
    }

    ensureColorModeProperties(elementData) {
        // Ensure color mode properties exist
        if (!elementData.colorMode) elementData.colorMode = "hex";
        if (!elementData.backgroundColorMode) elementData.backgroundColorMode = "hex";
        if (!elementData.borderColorMode) elementData.borderColorMode = "hex";

        // Ensure text alignment exists for text elements
        if ((elementData.type === "text" || elementData.type === "heading") && !elementData.textAlign) {
            elementData.textAlign = "left";
        }

        // Ensure line height exists for text elements
        if ((elementData.type === "text" || elementData.type === "heading") && !elementData.lineHeight) {
            elementData.lineHeight = 18;
        }

        // Fix line height if it's too small (relative to font size)
        if ((elementData.type === "text" || elementData.type === "heading") && elementData.lineHeight < 8) {
            elementData.lineHeight = Math.round(elementData.fontSize * elementData.lineHeight);
        }

        // Ensure CMYK color values exist
        if (!elementData.colorCmyk) {
            elementData.colorCmyk = this.editor.config.hexToCmyk(elementData.color || "#333333");
        }
        if (!elementData.backgroundColorCmyk) {
            elementData.backgroundColorCmyk = this.editor.config.hexToCmyk(elementData.backgroundColor || "#3498db");
        }
        if (!elementData.borderColorCmyk) {
            elementData.borderColorCmyk = this.editor.config.hexToCmyk(elementData.borderColor || "#2c3e50");
        }
    }
} 