<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <title>{{ config('app.name', 'Connect Editor') }} - Drag & Drop PDF Editor</title>
    @vite(['resources/css/app.css', 'resources/js/app-modular.js'])
</head>

<body>
    <div class="app-container">
        <header class="header">
            <h1><i class="fas fa-file-pdf"></i> PDFd Editor</h1>

            <div class="header-insert-section">
                <div class="insert-section">
                    <h3>Insert</h3>
                    <div class="element-group">
                        <div class="clickable-element" data-type="text">
                            <i class="fas fa-font"></i>
                            <span>Text</span>
                        </div>
                        <div class="clickable-element" data-type="image">
                            <i class="fas fa-image"></i>
                            <span>Image</span>
                        </div>
                        <div class="clickable-element" data-type="rectangle">
                            <i class="fas fa-square"></i>
                            <span>Rectangle</span>
                        </div>
                        <div class="clickable-element" data-type="circle">
                            <i class="fas fa-circle"></i>
                            <span>Circle</span>
                        </div>
                        <div class="clickable-element" data-type="line">
                            <i class="fas fa-minus"></i>
                            <span>Line</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="header-controls">
                <div class="toolbar-section">
                    <button id="clearGuides" class="btn btn-small">
                        Clear Guides
                    </button>
                    <button id="toggleSnap" class="btn btn-small snap-enabled">
                        Snap: ON
                    </button>
                </div>

                <div class="toolbar-separator"></div>

                <div class="toolbar-section zoom-controls">
                    <button id="zoomOut" class="btn btn-small">
                        <i class="fas fa-search-minus"></i>
                    </button>
                    <select id="zoomLevel" class="zoom-select">
                        <option value="0.25">25%</option>
                        <option value="0.5">50%</option>
                        <option value="0.75">75%</option>
                        <option value="1" selected>100%</option>
                        <option value="1.25">125%</option>
                        <option value="1.5">150%</option>
                        <option value="2">200%</option>
                        <option value="3">300%</option>
                        <option value="4">400%</option>
                    </select>
                    <button id="zoomIn" class="btn btn-small">
                        <i class="fas fa-search-plus"></i>
                    </button>
                    <button id="zoomFit" class="btn btn-small">Fit</button>
                </div>
            </div>
        </header>

        <div class="main-content">
            <div class="toolbar">
                <div class="properties-panel">
                    <h3>Properties</h3>
                    <div id="propertiesContent">
                        <p>Select an element to edit its properties</p>
                    </div>
                </div>
            </div>

            <div class="canvas-container">
                <div class="canvas-info">
                </div>
                <div class="canvas-workspace">
                    <!-- Corner ruler intersection -->
                    <div class="ruler-corner"></div>

                    <!-- Horizontal ruler -->
                    <div class="ruler ruler-horizontal">
                        <div class="ruler-track"></div>
                    </div>

                    <!-- Vertical ruler -->
                    <div class="ruler ruler-vertical">
                        <div class="ruler-track"></div>
                    </div>

                    <!-- Canvas with guide lines -->
                    <div class="canvas-with-guides">
                        <div id="canvas" class="canvas">
                            <div class="canvas-grid"></div>
                            <div class="guide-lines"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="right-sidebar">
                <div class="canvas-position-header">
                    <div class="canvas-position-display">
                        <span id="canvasCoords">Canvas Position: X: 0, Y: 0</span>
                    </div>
                </div>
                <div class="tabbed-panel">
                    <div class="tab-header">
                        <button class="tab-button active" data-tab="layers">
                            <i class="fas fa-layer-group"></i> Layers
                        </button>
                        <button class="tab-button" data-tab="template">
                            <i class="fas fa-file-alt"></i> Template
                        </button>
                    </div>

                    <div class="tab-content">
                        <!-- Layers Tab -->
                        <div id="layers-tab" class="tab-panel active">
                            <div class="layers-toolbar">
                                <button id="moveLayerUp" title="Move Layer Up" disabled>
                                    <i class="fas fa-arrow-up"></i>
                                </button>
                                <button id="moveLayerDown" title="Move Layer Down" disabled>
                                    <i class="fas fa-arrow-down"></i>
                                </button>
                                <button id="bringToFront" title="Bring to Front" disabled>
                                    <i class="fas fa-angle-double-up"></i>
                                </button>
                                <button id="sendToBack" title="Send to Back" disabled>
                                    <i class="fas fa-angle-double-down"></i>
                                </button>
                                <button id="duplicateLayer" title="Duplicate Layer" disabled>
                                    <i class="fas fa-copy"></i>
                                </button>
                                <button id="deleteLayer" title="Delete Layer" disabled>
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                            <div id="layersList" class="layers-list">
                                <div class="no-layers">No elements</div>
                            </div>
                        </div>

                        <!-- Template Tab -->
                        <div id="template-tab" class="tab-panel">
                            <div class="template-info">
                                <div class="template-name-section">
                                    <label>Template Name *</label>
                                    <input type="text" id="templateNameTab" placeholder="Enter template name" class="template-input" required>
                                </div>

                                <div class="template-client-section">
                                    <label>Client *</label>
                                    <select id="templateClientSelect" class="template-input" required>
                                        <option value="">Select a client</option>
                                    </select>
                                </div>

                                <div class="template-size-section">
                                    <label>Template Size *</label>
                                    <div class="template-size-controls">
                                        <div class="size-input-group">
                                            <label for="templateWidth">Width *</label>
                                            <input type="number" id="templateWidth" min="1" max="2000" value="595" class="template-input size-input" required>
                                        </div>
                                        <div class="size-input-group">
                                            <label for="templateHeight">Height *</label>
                                            <input type="number" id="templateHeight" min="1" max="2000" value="842" class="template-input size-input" required>
                                        </div>
                                        <button id="applyTemplateSize" class="btn btn-secondary btn-full">
                                            <i class="fas fa-arrows-alt"></i> Apply Size
                                        </button>
                                    </div>
                                </div>

                                <div class="template-actions">
                                    <button id="saveTemplateTab" class="btn btn-success btn-full">
                                        <i class="fas fa-save"></i> Save Template
                                    </button>
                                    <button id="loadTemplateTab" class="btn btn-info btn-full">
                                        <i class="fas fa-folder-open"></i> Load Template
                                    </button>
                                </div>

                                <div class="template-stats">
                                    <div class="stat-item">
                                        <label>Canvas Size</label>
                                        <span id="templateCanvasSize">793 × 1122 px</span>
                                    </div>
                                    <div class="stat-item">
                                        <label>Elements</label>
                                        <span id="templateElementCount">0</span>
                                    </div>
                                    <div class="stat-item">
                                        <label>Last Saved</label>
                                        <span id="templateLastSaved">Never</span>
                                    </div>
                                </div>

                                <div class="template-export">
                                    <button id="generatePDFTab" class="btn btn-primary btn-full">
                                        <i class="fas fa-download"></i> Generate PDF
                                    </button>
                                    <button id="clearCanvasTab" class="btn btn-secondary btn-full">
                                        <i class="fas fa-trash"></i> Clear Canvas
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Context Menu -->
    <div id="contextMenu" class="context-menu">
        <div class="context-item" data-action="delete">
            <i class="fas fa-trash"></i> Delete
        </div>
        <div class="context-item" data-action="duplicate">
            <i class="fas fa-copy"></i> Duplicate
        </div>
        <div class="context-item" data-action="bring-front">
            <i class="fas fa-arrow-up"></i> Bring to Front
        </div>
        <div class="context-item" data-action="send-back">
            <i class="fas fa-arrow-down"></i> Send to Back
        </div>
    </div>

    <!-- Template Load Modal -->
    <div id="templateModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Load Template</h3>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <div class="template-search">
                    <input
                        type="text"
                        id="templateSearch"
                        placeholder="Search templates..."
                        class="search-input" />
                </div>
                <div id="templateList" class="template-list">
                    <!-- Templates will be loaded here -->
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelLoad" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    </div>

    <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
</body>

</html>