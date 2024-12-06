CKEDITOR.plugins.add('shapeEditor', {
    icons: 'shapeEditor',
    init: function (editor) {
        editor.addCommand('openShapeEditor', {
            exec: function (editor) {
                let existingDataUrl = null;

                // Retrieve an existing image from CKEditor content
                const editorContent = editor.document;
                const images = editorContent.getElementsByTag('img');

                if (images.count() > 0) {
                    const firstImage = images.getItem(0);
                    existingDataUrl = firstImage.getAttribute('src');
                }

                // Create the shape editor container
                const editorContainer = document.createElement('div');
                editorContainer.id = 'shape-editor-container';
                editorContainer.style.position = 'fixed';
                editorContainer.style.top = '10%';
                editorContainer.style.left = '10%';
                editorContainer.style.width = '80%';
                editorContainer.style.height = '80%';
                editorContainer.style.backgroundColor = 'white';
                editorContainer.style.zIndex = '10000';
                editorContainer.style.border = '1px solid #ccc';
                editorContainer.style.display = 'flex';
                editorContainer.style.flexDirection = 'column';

                // Toolbar for controls
                const toolbar = document.createElement('div');
                toolbar.style.display = 'flex';
                toolbar.style.justifyContent = 'space-between';
                toolbar.style.padding = '10px';
                toolbar.style.borderBottom = '1px solid #ccc';

                // Add color picker
                const colorLabel = document.createElement('label');
                colorLabel.textContent = 'Outline Color: ';
                const colorPicker = document.createElement('input');
                colorPicker.type = 'color';
                colorPicker.value = '#000000';
                colorLabel.appendChild(colorPicker);
                toolbar.appendChild(colorLabel);

                // Add shape buttons
                const addButton = (label, onClick) => {
                    const button = document.createElement('button');
                    button.textContent = label;
                    button.style.marginRight = '10px';
                    button.addEventListener('click', onClick);
                    toolbar.appendChild(button);
                };

                let selectedShape = null; // Active shape type
                let isSelectionMode = false; // Selection mode toggle
                let polygonPoints = [];
                let tempLine = null;

                addButton('Rectangle', () => {
                    selectedShape = 'rectangle';
                    activateDrawingMode();
                });

                addButton('Circle', () => {
                    selectedShape = 'circle';
                    activateDrawingMode();
                });

                addButton('Line', () => {
                    selectedShape = 'line';
                    activateDrawingMode();
                });

                addButton('Polygon', () => {
                    selectedShape = 'polygon';
                    polygonPoints = [];
                    activateDrawingMode();
                });

                addButton('Select', () => {
                    selectedShape = null;
                    isSelectionMode = true;
                    fabricCanvas.selection = true;
                    fabricCanvas.forEachObject((obj) => (obj.selectable = true));
                });

                editorContainer.appendChild(toolbar);

                // Add canvas
                const canvas = document.createElement('canvas');
                canvas.id = 'shapeEditorCanvas';
                canvas.style.flexGrow = '1';
                editorContainer.appendChild(canvas);
                document.body.appendChild(editorContainer);

                // Resize canvas
                canvas.width = editorContainer.clientWidth - 20;
                canvas.height = editorContainer.clientHeight - 90;

                // Initialize Fabric.js
                const fabricCanvas = new fabric.Canvas('shapeEditorCanvas', {
                    selection: false,
                });

                // Load the existing image
                if (existingDataUrl) {
                    fabric.Image.fromURL(existingDataUrl, (img) => {
                        img.set({
                            left: 50,
                            top: 50,
                            scaleX: canvas.width / img.width / 2,
                            scaleY: canvas.height / img.height / 2,
                        });
                        fabricCanvas.add(img);
                        fabricCanvas.renderAll();
                    });
                }

                // Drawing variables
                let isDrawing = false;
                let startX = 0;
                let startY = 0;
                let shape = null;

                const activateDrawingMode = () => {
                    isSelectionMode = false;
                    fabricCanvas.selection = false;
                    fabricCanvas.forEachObject((obj) => (obj.selectable = false));
                };

                // Mouse events for drawing
                fabricCanvas.on('mouse:down', (e) => {
                    if (isSelectionMode) return;

                    const pointer = fabricCanvas.getPointer(e.e);

                    if (selectedShape === 'polygon') {
                        if (polygonPoints.length > 0) {
                            const firstPoint = polygonPoints[0];
                            const distance = Math.sqrt(
                                Math.pow(pointer.x - firstPoint.x, 2) + Math.pow(pointer.y - firstPoint.y, 2)
                            );
                            if (distance < 10) {
                                if (tempLine) {
                                    fabricCanvas.remove(tempLine);
                                    tempLine = null;
                                }
                                const polygon = new fabric.Polygon(polygonPoints, {
                                    fill: '',
                                    stroke: colorPicker.value,
                                    strokeWidth: 2,
                                });
                                fabricCanvas.add(polygon);
                                polygonPoints = [];
                                return;
                            }
                        }
                        polygonPoints.push({ x: pointer.x, y: pointer.y });
                        if (polygonPoints.length > 1) {
                            const lastPoint = polygonPoints[polygonPoints.length - 2];
                            const newLine = new fabric.Line(
                                [lastPoint.x, lastPoint.y, pointer.x, pointer.y],
                                {
                                    stroke: colorPicker.value,
                                    strokeWidth: 2,
                                    selectable: false,
                                }
                            );
                            fabricCanvas.add(newLine);
                        }
                        return;
                    }

                    if (!selectedShape) return;

                    isDrawing = true;
                    startX = pointer.x;
                    startY = pointer.y;

                    if (selectedShape === 'rectangle') {
                        shape = new fabric.Rect({
                            left: startX,
                            top: startY,
                            width: 0,
                            height: 0,
                            fill: '',
                            stroke: colorPicker.value,
                            strokeWidth: 2,
                        });
                    } else if (selectedShape === 'circle') {
                        shape = new fabric.Circle({
                            left: startX,
                            top: startY,
                            radius: 0,
                            fill: '',
                            stroke: colorPicker.value,
                            strokeWidth: 2,
                        });
                    } else if (selectedShape === 'line') {
                        shape = new fabric.Line([startX, startY, startX, startY], {
                            stroke: colorPicker.value,
                            strokeWidth: 2,
                        });
                    }

                    if (shape) {
                        fabricCanvas.add(shape);
                    }
                });

                fabricCanvas.on('mouse:move', (e) => {
                    if (!isDrawing || isSelectionMode || !shape) return;

                    const pointer = fabricCanvas.getPointer(e.e);
                    const width = pointer.x - startX;
                    const height = pointer.y - startY;

                    if (selectedShape === 'rectangle') {
                        shape.set({ width, height });
                    } else if (selectedShape === 'circle') {
                        shape.set({ radius: Math.sqrt(width * width + height * height) });
                    } else if (selectedShape === 'line') {
                        shape.set({ x2: pointer.x, y2: pointer.y });
                    }
                    fabricCanvas.renderAll();
                });

                fabricCanvas.on('mouse:up', () => {
                    isDrawing = false;
                    shape = null;
                });

                // Add close button
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Close';
                closeButton.style.position = 'absolute';
                closeButton.style.right = '10px';
                closeButton.style.top = '10px';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(editorContainer);
                });
                editorContainer.appendChild(closeButton);

                // Add save button
                const saveButton = document.createElement('button');
                saveButton.textContent = 'Insert Shape';
                saveButton.style.position = 'absolute';
                saveButton.style.bottom = '10px';
                saveButton.style.left = '50%';
                saveButton.style.transform = 'translateX(-50%)';
                saveButton.addEventListener('click', () => {
                    const shapeImage = fabricCanvas.toDataURL();
                    const img = new CKEDITOR.dom.element('img');
                    img.setAttribute('src', shapeImage);
                    if (images.count() > 0) {
                        images.getItem(0).setAttribute('src', shapeImage);
                    } else {
                        editor.insertElement(img);
                    }
                    document.body.removeChild(editorContainer);
                });
                editorContainer.appendChild(saveButton);
            },
        });

        editor.ui.addButton('ShapeEditor', {
            label: 'Shape Editor',
            command: 'openShapeEditor',
            toolbar: 'insert',
        });
    },
});
