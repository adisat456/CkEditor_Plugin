CKEDITOR.plugins.add('diagrameditor', {
    icons: 'diagrameditor',
    init: function (editor) {
        editor.addCommand('openDiagramEditor', {
            exec: function () {
                openDiagramEditor(editor);
            }
        });

        editor.ui.addButton('DiagramEditor', {
            label: 'Insert Diagram',
            command: 'openDiagramEditor',
            toolbar: 'insert',
            icon: this.path + 'icons/drawio.png',
        });
    }
});
function DiagramEditor(config, ui, done, initialized, urlParams, editor) {
    this.config = (config != null) ? config : this.config;
    this.ui = (ui != null) ? ui : this.ui;
    this.done = (done != null) ? done : this.done;
    this.initialized = (initialized != null) ? initialized : this.initialized;
    this.urlParams = urlParams;

    var self = this;

    this.handleMessageEvent = function (evt) {
        if (self.frame != null && evt.source == self.frame.contentWindow &&
            evt.data.length > 0) {
            try {
                var msg = JSON.parse(evt.data);
                if (msg != null) {
                    self.handleMessage(msg, editor);
                }
            }
            catch (e) {
                console.error(e);
            }
        }
    };
};


/**
 * Static method to edit the diagram in the given img or object.
 */
DiagramEditor.editElement = function (elt,editor, config, ui, done, urlParams) {
    if (!elt.diagramEditorStarting) {
        elt.diagramEditorStarting = true;

        return new DiagramEditor(config, ui, done, function () {
            delete elt.diagramEditorStarting;
        }, urlParams, editor).editElement(elt, editor);
    }
};

/**
 * Global configuration.
 */
DiagramEditor.prototype.config = null;

/**
 * Protocol and domain to use.
 */
DiagramEditor.prototype.drawDomain = 'https://embed.diagrams.net/';

/**
 * UI theme to be use.
 */
DiagramEditor.prototype.ui = 'min';

/**
 * Contains XML for pending image export.
 */
DiagramEditor.prototype.xml = null;

/**
 * Format to use.
 */
DiagramEditor.prototype.format = 'xml';

/**
 * Specifies if libraries should be enabled.
 */
DiagramEditor.prototype.libraries = true;

/**
 * CSS style for the iframe.
 */
DiagramEditor.prototype.frameStyle = 'position:absolute;border:0;width:100%;height:100%;';

/**
 * Adds the iframe and starts editing.
 */
DiagramEditor.prototype.editElement = function (elem, editor
) {
    var src;

    // Check if elem is a DOM element
    if (elem instanceof HTMLElement) {
        if (elem.tagName.toLowerCase() === 'img') {
            // For normal DOM or direct <img> elements
            src = elem.getAttribute('src');
        } else if (elem.tagName.toLowerCase() === 'span' && elem.querySelector('img')) {
            // For CKEditor where <img> is wrapped in a <span>
            var img = elem.querySelector('img.cke_widget_element'); // Specific to CKEditor
            src = img ? img.getAttribute('src') || img.getAttribute('data-cke-saved-src') : null;
        } else {
            src = "";
        }
    } else if (elem.getName && typeof elem.getName === 'function') {
        // Handle CKEditor elements or other object-like structures
        var elementName = elem.getName().toLowerCase();
        if (elementName === 'img') {
            src = elem.getAttribute('src');
        } else if (elementName === 'span' && elem.find('img').count() > 0) {
            // Use CKEditor's API to find child <img>
            var img = elem.find('img').getItem(0);
            src = img ? img.getAttribute('src') || img.getAttribute('data-cke-saved-src') : null;
        } else {
            src = "";
        }
    } else {
        console.error('Invalid element provided');
        src = "";
    }

    // Ensure startElement and format are set correctly
    this.startElement = elem;
    var fmt = this.format;

    if (src) {
        if (src.substring(0, 15) === 'data:image/png;') {
            fmt = 'xmlpng';
        } else if (src.substring(0, 19) === 'data:image/svg+xml;' ||
            (elem.tagName && elem.tagName.toLowerCase() === 'svg')) {
            fmt = 'xmlsvg';
        }
    }
    // Proceed with editing
    this.startEditing(src, fmt, editor);

    return this;
};

DiagramEditor.prototype.getElementData = function (elem) {
    // Handle CKEditor elements and normal DOM elements
    var name = elem.getName ? elem.getName().toLowerCase() : elem.nodeName.toLowerCase();

    // Dynamically get attributes based on element type
    if (name === 'svg') {
        return elem.getAttribute ? elem.getAttribute('content') : elem.content;
    } else if (name === 'img') {
        return elem.getAttribute ? elem.getAttribute('src') : elem.src;
    } else {
        return elem.getAttribute ? elem.getAttribute('data') : elem.dataset?.data;
    }
};

DiagramEditor.prototype.setElementData = function (elem, data, editor) {
    const name = elem.getName ? elem.getName().toLowerCase() : elem.nodeName.toLowerCase();

    if (name === 'svg') {
        // Replace the SVG element with the new content
        if (elem.setOuterHtml) {
            elem.setOuterHtml(atob(data.substring(data.indexOf(',') + 1))); // CKEditor
        } else {
            elem.outerHTML = atob(data.substring(data.indexOf(',') + 1)); // DOM
        }
    } else if (name === 'span' ) {

        const editorContent = editor.document;
        const images = editorContent.getElementsByTag('img');
        const image = images.getItem(0);
        image.setAttribute('src', data);
        image.setAttribute('data-cke-saved-src', data);

        // Update the widget metadata
        const widget = editor.widgets.getByElement(image);
        if (widget) {
            widget.setData({
                src: data
            });
            // widget.redraw();
        }
    } else {
        // Handle normal DOM img or other elements
        if (elem.setAttribute) {
            elem.setAttribute(name === 'img' ? 'src' : 'data', data);
        } else {
            if (name === 'img') {
                elem.src = data; // Fallback for DOM img
            } else {
                elem.dataset.data = data; // Fallback for generic DOM elements
            }
        }
    }
    if(!existingSpan){
        existingSpan = true;
        editor.widgets.initOn(elem, 'image');
    }
    editor.fire('change');
    return elem;
};

/**
 * Starts the editor for the given data.
 */
DiagramEditor.prototype.startEditing = function (data, format,editor, title) {
    if (this.frame == null) {
        window.addEventListener('message', this.handleMessageEvent);
        this.format = (format != null) ? format : this.format;
        this.title = (title != null) ? title : this.title;
        this.data = data;

        this.frame = this.createFrame(
            this.getFrameUrl(),
            this.getFrameStyle());
        document.body.appendChild(this.frame);
        this.setWaiting(true);
    }
};

/**
 * Updates the waiting cursor.
 */
DiagramEditor.prototype.setWaiting = function (waiting) {
    if (this.startElement != null) {
        // Redirect cursor to parent for SVG and object
        var elt = this.startElement;
        var name = elt.getName ? elt.getName().toLowerCase() : elt.nodeName.toLowerCase();

        if (name === 'svg' || name === 'object') {
            elt = elt.getParent ? elt.getParent() : elt.parentNode;
        }

        if (elt != null && elt.setStyle) {
            if (waiting) {
                this.frame.style.pointerEvents = 'none';
                this.previousCursor = elt.getStyle('cursor');
                elt.setStyle('cursor', 'wait');
            } else {
                elt.setStyle('cursor', this.previousCursor || '');
                this.frame.style.pointerEvents = '';
            }
        }
    }
};


/**
 * Updates the waiting cursor.
 */
DiagramEditor.prototype.setActive = function (active) {
    if (active) {
        this.previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
    else {
        document.body.style.overflow = this.previousOverflow;
    }
};

/**
 * Removes the iframe.
 */
DiagramEditor.prototype.stopEditing = function () {
    if (this.frame != null) {
        window.removeEventListener('message', this.handleMessageEvent);
        document.body.removeChild(this.frame);
        this.setActive(false);
        this.frame = null;
    }
};

/**
 * Send the given message to the iframe.
 */
DiagramEditor.prototype.postMessage = function (msg) {
    if (this.frame != null) {
        this.frame.contentWindow.postMessage(JSON.stringify(msg), '*');
    }
};

/**
 * Returns the diagram data.
 */
DiagramEditor.prototype.getData = function () {
    return this.data;
};

/**
 * Returns the title for the editor.
 */
DiagramEditor.prototype.getTitle = function () {
    return this.title;
};

/**
 * Returns the CSS style for the iframe.
 */
DiagramEditor.prototype.getFrameStyle = function () {
    return this.frameStyle + ';position:fixed;' +
        'left:50%; top:50%; transform:translate(-50%, -50%); z-index: 1000;';
};


/**
 * Returns the URL for the iframe.
 */
DiagramEditor.prototype.getFrameUrl = function () {
    var url = this.drawDomain + '?proto=json&spin=1';

    if (this.ui != null) {
        url += '&ui=' + this.ui;
    }

    if (this.libraries != null) {
        url += '&libraries=1';
    }

    if (this.config != null) {
        url += '&configure=1';
    }

    if (this.urlParams != null) {
        url += '&' + this.urlParams.join('&');
    }

    return url;
};

/**
 * Creates the iframe.
 */
DiagramEditor.prototype.createFrame = function (url, style) {
    var frame = document.createElement('iframe');
    frame.setAttribute('frameborder', '0');
    frame.setAttribute('style', style);
    frame.setAttribute('src', url);

    return frame;
};

/**
 * Sets the status of the editor.
 */
DiagramEditor.prototype.setStatus = function (messageKey, modified) {
    this.postMessage({ action: 'status', messageKey: messageKey, modified: modified });
};

/**
 * Handles the given message.
 */
DiagramEditor.prototype.handleMessage = function (msg, editor) {
    if (msg.event == 'configure') {
        this.configureEditor();
    }
    else if (msg.event == 'init') {
        this.initializeEditor();
    }
    else if (msg.event == 'autosave') {
        this.save(msg.xml, true, this.startElement);
    }
    else if (msg.event == 'export') {
        this.setElementData(this.startElement, msg.data, editor);
        this.stopEditing();
        this.xml = null;
    }
    else if (msg.event == 'save') {
        this.save(msg.xml, false, this.startElement);
        this.xml = msg.xml;

        if (msg.exit) {
            msg.event = 'exit';
        }
        else {
            this.setStatus('allChangesSaved', false);
        }
    }

    if (msg.event == 'exit') {
        if (this.format != 'xml') {
            if (this.xml != null) {
                this.postMessage({
                    action: 'export', format: this.format,
                    xml: this.xml, spinKey: 'export'
                });
            }
            else {
                this.stopEditing(msg);
            }
        }
        else {
            if (msg.modified == null || msg.modified) {
                this.save(msg.xml, false, this.startElement);
            }

            this.stopEditing(msg);
        }
    }
};

/**
 * Posts configure message to editor.
 */
DiagramEditor.prototype.configureEditor = function () {
    this.postMessage({ action: 'configure', config: this.config });
};

/**
 * Posts load message to editor.
 */
DiagramEditor.prototype.initializeEditor = function () {
    this.postMessage({
        action: 'load', autosave: 1, saveAndExit: '1',
        modified: 'unsavedChanges', xml: this.getData(),
        title: this.getTitle()
    });
    this.setWaiting(false);
    this.setActive(true);
    this.initialized();
};

/**
 * Saves the given data.
 */
DiagramEditor.prototype.save = function (data, draft, elt) {
    this.done(data, draft, elt);
};

/**
 * Invoked after save.
 */
DiagramEditor.prototype.done = function () {
    // hook for subclassers
};

/**
 * Invoked after the editor has sent the init message.
 */
DiagramEditor.prototype.initialized = function () {
    // hook for subclassers
};

let existingSpan = true;
function openDiagramEditor(editor) {
    // Get the selected element in the CKEditor
    let selectedElement = editor.getSelection().getSelectedElement();
    // Check if the selected element is already a wrapper span with an image inside
    let wrapperSpan = selectedElement && selectedElement.hasClass('cke_widget_wrapper') ? selectedElement : null;

    if (!wrapperSpan) {
        existingSpan = false;
        // If no wrapper span exists, create the wrapper span and image
        wrapperSpan = new CKEDITOR.dom.element('span');
        wrapperSpan.setAttribute('class', 'cke_widget_wrapper cke_widget_inline cke_widget_image cke_image_nocaption');
        
        const img = new CKEDITOR.dom.element('img');
        img.setAttribute('src', 'data:image/svg+xml;base64,PHN2Zw0KICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciDQogIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIg0KICB2ZXJzaW9uPSIxLjEiDQogIHdpZHRoPSI4MXB4Ig0KICBoZWlnaHQ9IjgxcHgiDQogIHZpZXdCb3g9Ii0wLjUgLTAuNSA4MSA4MSINCiAgY29udGVudD0nJmx0O214ZmlsZSBob3N0PSJlbWJlZC5kaWFncmFtcy5uZXQiIGFnZW50PSJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTMxLjAuMC4wIFNhZmFyaS81MzcuMzYiIHZlcnNpb249IjI1LjAuMyImZ3Q7Jmx0O2RpYWdyYW0gbmFtZT0iUGFnZS0xIiBpZD0iYmM5TGFmQV9lWVcwdTQzdnpXaHciJmd0OyZsdDsvZGlhZ3JhbSZndDsmbHQ7L214ZmlsZSZndDsnDQo+DQogIDxkZWZzIC8+DQogIDxnPg0KICAgIDxnIGRhdGEtY2VsbC1pZD0iMCI+DQogICAgICA8ZyBkYXRhLWNlbGwtaWQ9IjEiPg0KICAgICAgICA8ZyBkYXRhLWNlbGwtaWQ9IjIiPg0KICAgICAgICA8L2c+DQogICAgICA8L2c+DQogICAgPC9nPg0KICA8L2c+DQo8L3N2Zz4NCg==');
        
        // Append the image to the wrapper span
        wrapperSpan.append(img);
        
        // Insert the new span with the image into the editor
        editor.insertElement(wrapperSpan);
    }

    // Open the diagram editor for the selected or newly created element
    DiagramEditor.editElement(wrapperSpan, editor); // Pass the DOM element to the DiagramEditor
}
