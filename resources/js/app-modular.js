import { DragDropEditor } from './modules/core/Editor.js';

// Global variables
let editor;

// Tab Management
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tab;
            
            // Remove active class from all tabs and panels
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding panel
            button.classList.add('active');
            document.getElementById(tabId + '-tab').classList.add('active');
            
            // Update template info if template tab is selected
            if (tabId === 'template') {
                updateTemplateInfo();
            }
        });
    });

    // Setup tab actions
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
}

// Template Info Update
function updateTemplateInfo() {
    if (!editor) return;

    const canvas = document.getElementById('canvas');
    if (canvas) {
        const sizeDisplay = document.getElementById('templateCanvasSize');
        if (sizeDisplay) {
            const width = parseInt(canvas.style.width) || 595;
            const height = parseInt(canvas.style.height) || 842;
            sizeDisplay.textContent = `${width} × ${height} px`;
        }
    }

    const elementCount = document.getElementById('templateElementCount');
    if (elementCount) {
        const elements = document.querySelectorAll('.canvas-element');
        elementCount.textContent = elements.length;
    }

    const lastSaved = document.getElementById('templateLastSaved');
    if (lastSaved && editor.currentTemplateId) {
        lastSaved.textContent = editor.lastSavedTime || 'Unknown';
    }

    const widthInput = document.getElementById('templateWidth');
    const heightInput = document.getElementById('templateHeight');
    if (widthInput && heightInput && canvas) {
        const width = parseInt(canvas.style.width) || 595;
        const height = parseInt(canvas.style.height) || 842;
        widthInput.value = width;
        heightInput.value = height;
    }
}

// Template Size Management
function setupTemplateSizing() {
    const widthInput = document.getElementById('templateWidth');
    const heightInput = document.getElementById('templateHeight');
    const applyButton = document.getElementById('applyTemplateSize');
    const canvas = document.getElementById('canvas');

    if (widthInput && heightInput && canvas) {
        // Set initial values
        const currentWidth = parseInt(canvas.style.width) || 595;
        const currentHeight = parseInt(canvas.style.height) || 842;
        widthInput.value = currentWidth;
        heightInput.value = currentHeight;
    }

    if (applyButton && widthInput && heightInput && canvas) {
        applyButton.addEventListener('click', function() {
            const width = Math.max(100, Math.min(2000, parseInt(widthInput.value, 10)));
            const height = Math.max(100, Math.min(2000, parseInt(heightInput.value, 10)));
            
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            
            updateTemplateInfo();
            
            // Update rulers if editor is available
            if (window.editor && typeof window.editor.updateRulersForZoom === 'function') {
                setTimeout(() => {
                    window.editor.updateRulersForZoom();
                }, 0);
            }
            
            console.log(`Template size updated to ${width} × ${height} px`);
        });
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the modular editor
    editor = new DragDropEditor();
    window.editor = editor; // For debugging and backward compatibility

    // Check if we need to load a specific template from URL
    const templateMatch = window.location.pathname.match(/^\/editor\/(\d+)$/);
    if (templateMatch) {
        const templateId = templateMatch[1];
        setTimeout(() => {
            editor.loadTemplate(templateId);
        }, 200);
    }

    // Setup tab management
    setupTabs();

    // Setup template sizing
    setupTemplateSizing();

    console.log('Modular PDF Editor initialized successfully');
});

// Export for global access
window.DragDropEditor = DragDropEditor;
export { editor }; 