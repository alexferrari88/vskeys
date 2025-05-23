// src/content_utils.js
// content_utils.js - Core DOM, text manipulation utilities, selection, feedback

let _feedbackElement = null; 
const FEEDBACK_MESSAGE_CLASS = 'vskeys-feedback-message'; 
// DEFAULT_GLOBAL_SETTINGS would be available if common.js is loaded before this in the browser
// For testing, we mock or import it.
const DGS_FOR_TESTING_ONLY = { feedbackDuration: 1500 }; // Placeholder for testing

function showFeedbackMessage(message, targetElement, globalSettings) {
    // Use a fallback for globalSettings if not provided, relevant for testing
    const effectiveGlobalSettings = globalSettings || DGS_FOR_TESTING_ONLY;

    if (!effectiveGlobalSettings || !effectiveGlobalSettings.showFeedback) return;

    if (_feedbackElement && _feedbackElement.parentNode) { // Check if it's still in DOM
        _feedbackElement.remove();
    }
    _feedbackElement = document.createElement('div');
    _feedbackElement.className = FEEDBACK_MESSAGE_CLASS; 
    _feedbackElement.textContent = message;
    Object.assign(_feedbackElement.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 20px',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        color: 'white',
        borderRadius: '5px',
        zIndex: '2147483647', 
        fontSize: '14px',
        fontFamily: 'sans-serif',
        opacity: '0',
        transition: 'opacity 0.25s ease-in-out',
        pointerEvents: 'none'
    });

    if (targetElement && typeof targetElement.getBoundingClientRect === 'function') {
        try {
            const rect = targetElement.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0 ) { // Allow if either is > 0 for visibility check
                _feedbackElement.style.left = `${rect.left + rect.width / 2}px`;
                _feedbackElement.style.bottom = `${window.innerHeight - rect.top + 10}px`; // Position above element
                 if ((window.innerHeight - rect.top) < 70 ) { // If element is too close to bottom, show below
                    _feedbackElement.style.top = `${rect.bottom + 10}px`;
                    _feedbackElement.style.bottom = 'auto';
                } else if (rect.top < 50) { // If element is too close to top, show below
                     _feedbackElement.style.top = `${rect.bottom + 10}px`;
                     _feedbackElement.style.bottom = 'auto';
                }
                _feedbackElement.style.maxWidth = '90vw'; 
            }
        } catch (e) { /* Element might not be in DOM or other issues */ }
    }
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(_feedbackElement);
        // Force reflow to ensure transition is applied
        void _feedbackElement.offsetWidth; 
        _feedbackElement.style.opacity = '1';

        setTimeout(() => {
            if (_feedbackElement && _feedbackElement.parentNode) {
                _feedbackElement.style.opacity = '0';
                setTimeout(() => {
                    if (_feedbackElement && _feedbackElement.parentNode) _feedbackElement.remove();
                    _feedbackElement = null; // Clear reference
                }, 300); // Matches transition duration
            }
        }, (effectiveGlobalSettings.feedbackDuration || 1500));
    }
}


function isEditable(element) {
    if (!element) return false;
    if (element.disabled || element.readOnly) return false;

    const tagName = element.tagName.toLowerCase();
    const textInputTypes = ['text', 'search', 'url', 'tel', 'password', 'email', 'number', 'date', 'month', 'week', 'time', 'datetime-local'];
    
    if (tagName === 'input' && (textInputTypes.includes(element.type) || !element.type)) {
        return true;
    }
    if (tagName === 'textarea') {
        return true;
    }
    // Check the standard boolean property first.
    if (element.isContentEditable) {
        return true;
    }
    
    return false;
}

function getSelectionDetails(element) {
    if (!element) return { start: 0, end: 0, selectedText: "", collapsed: true };

    if (element.isContentEditable) { 
        if (typeof window === 'undefined' || !window.getSelection) {
            const textContent = element.textContent || "";
            return { start: 0, end: 0, selectedText: textContent, collapsed: textContent.length === 0 };
        }
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const selectedText = range.toString();
            let start = 0;

            if (element.contains(range.startContainer) || range.startContainer === element) {
                const preSelectionRange = document.createRange();
                try {
                    preSelectionRange.selectNodeContents(element); 
                    // Ensure range.startContainer is valid before calling setEnd
                    if (element.contains(range.startContainer) || range.startContainer === element) {
                        preSelectionRange.setEnd(range.startContainer, range.startOffset); 
                    } else { 
                        // If range is somehow outside, assume start of element for preSelectionRange
                        preSelectionRange.setEnd(element, 0);
                    }
                    start = preSelectionRange.toString().length; 
                } catch (e) {
                    start = 0; // Fallback
                }
            } else if (element.childNodes.length === 0 && (range.startContainer === element || (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.parentNode === element))) {
                start = range.startOffset;
            }
            
            const end = start + selectedText.length;
            
            return {
                start: start,
                end: end,
                selectedText: selectedText,
                collapsed: selectedText.length === 0 // More reliable than range.collapsed in JSDOM
            };
        }
        return { start: 0, end: 0, selectedText: "", collapsed: true };
    } else if (typeof element.selectionStart === 'number' && typeof element.selectionEnd === 'number') { 
        return {
            start: element.selectionStart,
            end: element.selectionEnd,
            selectedText: element.value.substring(element.selectionStart, element.selectionEnd),
            collapsed: element.selectionStart === element.selectionEnd
        };
    }
    return { start: 0, end: 0, selectedText: "", collapsed: true };
}


function setSelection(element, start, end) {
    if (!element || typeof window === 'undefined' || !window.getSelection) return;

    if (element.isContentEditable) { 
        if(typeof element.focus === 'function') element.focus(); 
        try {
            const sel = window.getSelection();
            if (!sel) return;
            sel.removeAllRanges();
            const range = document.createRange();

            let startNode = element, startOffset = 0;
            let endNode = element, endOffset = 0;
            let charIndex = 0;
            let foundStart = false, foundEnd = false;

            // Simplified traversal primarily for text nodes.
            function findRecursive(node, targetCharOffset, type) {
                if (foundStart && (type === 'start' || (type === 'end' && foundEnd))) return true; // Already found

                if (node.nodeType === Node.TEXT_NODE) {
                    const nodeLength = node.textContent.length;
                    if (!foundStart && targetCharOffset >= charIndex && targetCharOffset <= charIndex + nodeLength) {
                        startNode = node;
                        startOffset = targetCharOffset - charIndex;
                        foundStart = true;
                        if (type === 'start') return true; // Found start, exit if only looking for start
                    }
                    // For end, ensure start is already found or we are setting end to start.
                    if ((foundStart || type === 'end') && targetCharOffset >= charIndex && targetCharOffset <= charIndex + nodeLength) {
                        endNode = node;
                        endOffset = targetCharOffset - charIndex;
                        foundEnd = true;
                        return true; // Found end
                    }
                    charIndex += nodeLength;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        if (findRecursive(node.childNodes[i], targetCharOffset, type)) {
                            return true;
                        }
                    }
                }
                return false;
            }
            
            if (element.hasChildNodes()) {
                findRecursive(element, start, 'start');
                if (end !== start) { // Only search for end if different from start
                    charIndex = 0; // Reset for separate end search
                    // foundEnd = false; // Not strictly needed as findRecursive checks foundEnd
                    findRecursive(element, end, 'end');
                } else { // Collapsed selection
                    endNode = startNode;
                    endOffset = startOffset;
                    foundEnd = true;
                }
            } else { // Element is empty
                foundStart = true; foundEnd = true; // Offsets remain 0, nodes are element
            }

            // Fallbacks if precise nodes/offsets weren't found
            if (!foundStart) { startNode = element; startOffset = 0; }
            if (!foundEnd) { endNode = startNode; endOffset = startOffset; }


            // Clamp offsets to be within node boundaries
            startOffset = Math.max(0, startNode.nodeType === Node.TEXT_NODE ? Math.min(startOffset, startNode.nodeValue.length) : Math.min(startOffset, startNode.childNodes.length));
            endOffset = Math.max(0, endNode.nodeType === Node.TEXT_NODE ? Math.min(endOffset, endNode.nodeValue.length) : Math.min(endOffset, endNode.childNodes.length));
            
            // Final check for node containment (JSDOM safety)
            if (!element.contains(startNode) && startNode !== element) startNode = element;
            if (!element.contains(endNode) && endNode !== element) endNode = element;


            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            sel.addRange(range);

        } catch (e) {
            // console.error("JSDOM CE setSelection error (may be benign in tests):", e, {start, end});
            try { // Last resort fallback for JSDOM
                const selFallback = window.getSelection();
                if (selFallback) {
                    selFallback.removeAllRanges();
                    const rangeFallback = document.createRange();
                    if (element.hasChildNodes()) {
                        rangeFallback.selectNodeContents(element.firstChild); // Select contents of first child if exists
                    } else {
                        rangeFallback.selectNodeContents(element); // Or element itself
                    }
                    if (start === end) { rangeFallback.collapse(start === 0); } // Collapse if cursor
                    selFallback.addRange(rangeFallback);
                }
            } catch (e2) { /* give up */ }
        }
    } else if (typeof element.setSelectionRange === 'function') { 
        element.setSelectionRange(start, end);
    }
}

function getTextareaHelper(el) {
    return {
        el: el,
        get value() { return el.value; },
        set value(v) { el.value = v; },
        get selectionStart() { return el.selectionStart; },
        set selectionStart(v) { el.selectionStart = v; },
        get selectionEnd() { return el.selectionEnd; },
        set selectionEnd(v) { el.selectionEnd = v; },

        getSelection: () => ({ start: el.selectionStart, end: el.selectionEnd }),
        setSelection: (start, end) => {
            el.selectionStart = start;
            el.selectionEnd = end;
        },
        replaceRange: (text, start, end) => { 
            const S = el.selectionStart, E = el.selectionEnd;
            el.value = el.value.substring(0, start) + text + el.value.substring(end);
            el.selectionStart = el.selectionEnd = start + text.length;
        },
    };
}

function getLineBoundaries(text, cursorPos) {
    if (typeof text !== 'string') text = ""; 
    let lineStart;

    if (cursorPos <= 0) { 
        lineStart = 0;
    } else {
        lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
    }
    
    let lineEnd = text.indexOf('\n', cursorPos);
    if (lineEnd === -1) { 
        lineEnd = text.length;
    }
    
    // Correction: if lineStart ends up greater than lineEnd (e.g. cursor at end of text without trailing \n)
    // and it's not a single line document, re-evaluate lineStart based on the found lineEnd.
    if (lineStart > lineEnd && lineStart <= text.length) {
         const lastNewlineBeforeLineEnd = text.lastIndexOf('\n', lineEnd -1);
         lineStart = lastNewlineBeforeLineEnd === -1 ? 0 : lastNewlineBeforeLineEnd + 1;
    }


    return { lineStart, lineEnd };
}

function getCurrentLineInfo(element) {
    const sel = getSelectionDetails(element);
    let text = "";
    if (element) {
        if (element.isContentEditable) { 
            if (typeof document !== 'undefined') { // Check for document for JSDOM safety
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = element.innerHTML; 
                Array.from(tempDiv.querySelectorAll('br')).forEach(br => {
                    if (br.parentNode) { // Ensure br is still in a parent
                        br.parentNode.replaceChild(document.createTextNode("__BR_MARKER__"), br);
                    }
                });
                text = tempDiv.textContent.replace(/__BR_MARKER__/g, '\n') || "";
            } else {
                text = element.textContent || ""; // Basic fallback if no document
            }
        } else {
            text = element.value || "";
        }
    }
    
    let effectiveCursorPos = sel.start; 
    
    if (element && element.isContentEditable && sel.collapsed && typeof window !== 'undefined' && window.getSelection) { 
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && (element.contains(selection.anchorNode) || element === selection.anchorNode) ) { 
            const range = selection.getRangeAt(0);
            const preCaretRange = document.createRange();
            try {
                preCaretRange.selectNodeContents(element); 
                if (element.contains(range.startContainer) || element === range.startContainer) { // Check contains for startContainer
                     preCaretRange.setEnd(range.startContainer, range.startOffset); 
                     effectiveCursorPos = preCaretRange.toString().length; 
                } else { effectiveCursorPos = sel.start; }
            } catch(e) { effectiveCursorPos = sel.start; }
        }
    }

    const { lineStart, lineEnd } = getLineBoundaries(text, effectiveCursorPos);
    const lineText = text.substring(lineStart, lineEnd);
    
    return { lineText, lineStart, lineEnd, currentSelection: sel, fullText: text };
}


function replaceText(element, newText, start, end, newCursorPosStart, newCursorPosEnd) {
    if (!element || (typeof document === 'undefined' && typeof window === 'undefined') ) return; 
    if (element.isContentEditable && typeof document !== 'undefined' && typeof element.focus === 'function') {
        element.focus(); 
    }
    
    const finalNewStart = newCursorPosStart !== undefined ? newCursorPosStart : start + newText.length;
    const finalNewEnd = newCursorPosEnd !== undefined ? newCursorPosEnd : finalNewStart;

    if (element.isContentEditable) { 
        setSelection(element, start, end); 

        let replacedViaExec = false;
        if (typeof document !== 'undefined' && document.execCommand) {
           try {
                // JSDOM's execCommand for 'insertText' might not be fully reliable or might not exist.
                if (document.queryCommandSupported && document.queryCommandSupported('insertText') && document.execCommand('insertText', false, newText)) {
                    replacedViaExec = true;
                }
           } catch (e) { /* JSDOM might throw */ }
        }

        if (!replacedViaExec && typeof window !== 'undefined' && window.getSelection) { 
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0); 
                try {
                    range.deleteContents();
                    const textNode = document.createTextNode(newText);
                    range.insertNode(textNode);
                    // Move cursor to end of inserted text
                    range.setStartAfter(textNode); // Move start of range after the new node
                    range.collapse(true);      // Collapse range to its start point
                    sel.removeAllRanges();      // Remove old ranges
                    sel.addRange(range);        // Add the new, collapsed range
                } catch(e) { 
                     const currentFullText = element.textContent || ""; // Fallback if range ops fail
                     element.textContent = currentFullText.substring(0, start) + newText + currentFullText.substring(end);
                }
            } else { 
                const currentFullText = element.textContent || "";
                element.textContent = currentFullText.substring(0, start) + newText + currentFullText.substring(end);
            }
        } else if (!replacedViaExec) { // If execCommand failed and no selection API (should not happen in JSDOM for tests)
             const currentFullText = element.textContent || "";
             element.textContent = currentFullText.substring(0, start) + newText + currentFullText.substring(end);
        }
        
        setSelection(element, finalNewStart, finalNewEnd);

    } else if (typeof element.value === 'string' && typeof element.setSelectionRange === 'function') { 
        const T = getTextareaHelper(element);
        const originalValue = T.value;
        const scrollLeft = T.el.scrollLeft; 
        const scrollTop = T.el.scrollTop;

        T.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
        
        T.el.scrollLeft = scrollLeft; 
        T.el.scrollTop = scrollTop;
        
        T.setSelection(finalNewStart, finalNewEnd);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showFeedbackMessage,
        isEditable,
        getSelectionDetails,
        setSelection,
        getTextareaHelper,
        getLineBoundaries,
        getCurrentLineInfo,
        replaceText,
        FEEDBACK_MESSAGE_CLASS 
    };
}