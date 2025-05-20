// content_utils.js - Core DOM, text manipulation utilities, selection, feedback

let _feedbackElement = null; // Underscore to denote it's managed by showFeedbackMessage

function showFeedbackMessage(message, targetElement, globalSettings) {
    if (!globalSettings || !globalSettings.showFeedback) return;

    if (_feedbackElement) {
        _feedbackElement.remove();
    }
    _feedbackElement = document.createElement('div');
    _feedbackElement.textContent = message;
    Object.assign(_feedbackElement.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 20px',
        backgroundColor: 'rgba(0, 0, 0, 0.75)', // Slightly darker
        color: 'white',
        borderRadius: '5px',
        zIndex: '2147483647', // Max z-index
        fontSize: '14px',
        fontFamily: 'sans-serif',
        opacity: '0',
        transition: 'opacity 0.25s ease-in-out',
        pointerEvents: 'none' // Prevent interference
    });

    if (targetElement) {
        try {
            const rect = targetElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth) {
                _feedbackElement.style.left = `${rect.left + rect.width / 2}px`;
                _feedbackElement.style.bottom = `${window.innerHeight - rect.top + 10}px`;
                if (rect.top < 50) {
                     _feedbackElement.style.top = `${rect.bottom + 10}px`;
                     _feedbackElement.style.bottom = 'auto';
                }
                 // Ensure it doesn't go off-screen horizontally
                _feedbackElement.style.maxWidth = '90vw'; // prevent too wide messages
            }
        } catch (e) { /* Element might not be in DOM / measurable */ }
    }

    document.body.appendChild(_feedbackElement);
    void _feedbackElement.offsetWidth; 
    _feedbackElement.style.opacity = '1';

    setTimeout(() => {
        if (_feedbackElement) {
            _feedbackElement.style.opacity = '0';
            setTimeout(() => {
                if (_feedbackElement) _feedbackElement.remove();
                _feedbackElement = null;
            }, 300); 
        }
    }, (globalSettings.feedbackDuration || DEFAULT_GLOBAL_SETTINGS.feedbackDuration));
}


function isEditable(element) {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    // Expanded list of text-like input types
    const textInputTypes = ['text', 'search', 'url', 'tel', 'password', 'email', 'number', 'date', 'month', 'week', 'time', 'datetime-local'];
    const isInputText = tagName === 'input' && (textInputTypes.includes(element.type) || !element.type); // !element.type often defaults to text
    const isTextArea = tagName === 'textarea';
    const isContentEditable = element.isContentEditable;
    
    return (isInputText || isTextArea || isContentEditable) && !element.disabled && !element.readOnly;
}

function getSelectionDetails(element) {
    if (element.isContentEditable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(element);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length;
            const end = start + range.toString().length;
            
            return {
                start: start,
                end: end,
                selectedText: range.toString(),
                collapsed: range.collapsed
            };
        }
        // Fallback for contenteditable if no selection or range
        return { start: 0, end: 0, selectedText: "", collapsed: true };
    } else { // input or textarea
        return {
            start: element.selectionStart,
            end: element.selectionEnd,
            selectedText: element.value.substring(element.selectionStart, element.selectionEnd),
            collapsed: element.selectionStart === element.selectionEnd
        };
    }
}

function setSelection(element, start, end) {
    if (element.isContentEditable) {
        try {
            const sel = window.getSelection();
            sel.removeAllRanges();
            const range = document.createRange();
            
            let charCount = 0;
            let startNode, startOffsetFound, endNode, endOffsetFound;

            function findNodeAndOffsetRecursive(currNode, targetOffset, isStart) {
                if (currNode.nodeType === Node.TEXT_NODE) {
                    const len = currNode.textContent.length;
                    if (!isStart && charCount === targetOffset && charCount + len === targetOffset) { // Handle cursor at end of a text node
                        endNode = currNode;
                        endOffsetFound = len;
                        return true;
                    }
                    if (charCount <= targetOffset && charCount + len >= targetOffset) {
                        if (isStart) {
                            startNode = currNode;
                            startOffsetFound = targetOffset - charCount;
                        } else {
                            endNode = currNode;
                            endOffsetFound = targetOffset - charCount;
                        }
                        return true; 
                    }
                    charCount += len;
                } else {
                    for (let i = 0; i < currNode.childNodes.length; i++) {
                        if (findNodeAndOffsetRecursive(currNode.childNodes[i], targetOffset, isStart)) {
                            return true; 
                        }
                    }
                }
                return false; 
            }
            
            charCount = 0;
            if (!findNodeAndOffsetRecursive(element, start, true) && start === element.textContent.length) { // Cursor at very end
                // Heuristic: find last text node or element itself
                let lastTextNode = element;
                while (lastTextNode.lastChild) {
                    if (lastTextNode.lastChild.nodeType === Node.TEXT_NODE) {
                        lastTextNode = lastTextNode.lastChild; break;
                    } else if (lastTextNode.lastChild.childNodes.length > 0) {
                        lastTextNode = lastTextNode.lastChild;
                    } else if (lastTextNode.lastChild.nodeType === Node.ELEMENT_NODE) { // empty element at end
                         lastTextNode = lastTextNode.lastChild; break;
                    }
                     else break;
                }
                startNode = lastTextNode;
                startOffsetFound = startNode.nodeType === Node.TEXT_NODE ? startNode.textContent.length : 0;
            }

            charCount = 0;
            if (!findNodeAndOffsetRecursive(element, end, false) && end === element.textContent.length) {
                let lastTextNode = element;
                while (lastTextNode.lastChild) {
                     if (lastTextNode.lastChild.nodeType === Node.TEXT_NODE) {
                        lastTextNode = lastTextNode.lastChild; break;
                    } else if (lastTextNode.lastChild.childNodes.length > 0) {
                        lastTextNode = lastTextNode.lastChild;
                    } else if (lastTextNode.lastChild.nodeType === Node.ELEMENT_NODE) {
                         lastTextNode = lastTextNode.lastChild; break;
                    }
                     else break;
                }
                endNode = lastTextNode;
                endOffsetFound = endNode.nodeType === Node.TEXT_NODE ? endNode.textContent.length : 0;
            }


            if (startNode && endNode && typeof startOffsetFound !== 'undefined' && typeof endOffsetFound !== 'undefined') {
                range.setStart(startNode, startOffsetFound);
                range.setEnd(endNode, endOffsetFound);
                sel.addRange(range);
            } else if (element.childNodes.length === 0 && start === 0 && end === 0) { // Empty contenteditable
                range.selectNodeContents(element);
                range.collapse(true);
                sel.addRange(range);
            } else {
                // Fallback: select all or place cursor at end
                range.selectNodeContents(element);
                if(start === end && start >= (element.textContent || "").length){ 
                    range.collapse(false); 
                }
                sel.addRange(range);
                // console.warn("Could not precisely set selection in contenteditable for", start, end, "using fallback.");
            }
        } catch (e) {
            console.error("Error setting selection in contenteditable:", e, element, start, end);
        }
    } else { 
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
        replaceRange: (text, start, end) => { // Simplified, assumes cursor at end of replacement
            const S = el.selectionStart, E = el.selectionEnd;
            el.value = el.value.substring(0, start) + text + el.value.substring(end);
            el.selectionStart = el.selectionEnd = start + text.length;
        },
    };
}

function getLineBoundaries(text, cursorPos) {
    if (typeof text !== 'string') text = ""; // Guard against null/undefined
    let lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
    let lineEnd = text.indexOf('\n', cursorPos);
    if (lineEnd === -1) lineEnd = text.length;
    return { lineStart, lineEnd };
}

function getCurrentLineInfo(element) {
    const sel = getSelectionDetails(element);
    const text = element.isContentEditable ? (element.textContent || "") : (element.value || "");
    
    const { lineStart, lineEnd } = getLineBoundaries(text, sel.start);
    const lineText = text.substring(lineStart, lineEnd);
    
    return { lineText, lineStart, lineEnd, currentSelection: sel, fullText: text };
}

function replaceText(element, newText, start, end, newCursorPosStart, newCursorPosEnd) {
    const finalNewStart = newCursorPosStart !== undefined ? newCursorPosStart : start + newText.length;
    const finalNewEnd = newCursorPosEnd !== undefined ? newCursorPosEnd : finalNewStart;

    if (element.isContentEditable) {
        const selDetails = getSelectionDetails(element);
        
        // Attempt to use execCommand for simple replacements if selection matches
        if (selDetails.start === start && selDetails.end === end && document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, newText);
            // execCommand often handles cursor, but may need adjustment.
            // For now, we rely on its default, or manually set if needed.
             setSelection(element, finalNewStart, finalNewEnd); // Re-affirm selection
        } else {
            // More complex replacement for contenteditable - can lose formatting
            const fullText = element.textContent || "";
            element.textContent = fullText.substring(0, start) + newText + fullText.substring(end);
            setSelection(element, finalNewStart, finalNewEnd);
        }
    } else { // input or textarea
        const T = getTextareaHelper(element);
        const originalValue = T.value;
        T.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
        T.setSelection(finalNewStart, finalNewEnd);
    }
}