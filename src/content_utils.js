// src/content_utils.js
// content_utils.js - Core DOM, text manipulation utilities, selection, feedback

let _feedbackElement = null; 
const FEEDBACK_MESSAGE_CLASS = 'vskeys-feedback-message'; // Added class

function showFeedbackMessage(message, targetElement, globalSettings) {
    if (!globalSettings || !globalSettings.showFeedback) return;

    if (_feedbackElement) {
        _feedbackElement.remove();
    }
    _feedbackElement = document.createElement('div');
    _feedbackElement.className = FEEDBACK_MESSAGE_CLASS; // Use the class
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
                _feedbackElement.style.maxWidth = '90vw'; 
            }
        } catch (e) { /* Element might not be in DOM */ }
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
    }, (globalSettings.feedbackDuration || (typeof DEFAULT_GLOBAL_SETTINGS !== 'undefined' ? DEFAULT_GLOBAL_SETTINGS.feedbackDuration : 1500) ));
}


function isEditable(element) {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    const textInputTypes = ['text', 'search', 'url', 'tel', 'password', 'email', 'number', 'date', 'month', 'week', 'time', 'datetime-local'];
    const isInputText = tagName === 'input' && (textInputTypes.includes(element.type) || !element.type); 
    const isTextArea = tagName === 'textarea';
    const isContentEditable = element.isContentEditable;
    
    return (isInputText || isTextArea || isContentEditable) && !element.disabled && !element.readOnly;
}

function getSelectionDetails(element) {
    if (element.isContentEditable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // For contenteditable, calculating start/end relative to element's textContent is complex.
            // This simplified version might not be perfectly accurate for all HTML structures within contenteditable.
            // A robust solution would involve traversing nodes.
            // However, for many common cases, range.toString() gives the selected text.
            // And range.collapsed indicates if it's a cursor.
            // Getting precise start/end numeric offsets is harder.
            // Let's try a more common approach for start/end:
            let FAKE_TEXTAREA_FOR_OFFSETS_CONTENTEDITABLE;
            if (!document.getElementById('vskeys-fake-textarea-ce')) {
                FAKE_TEXTAREA_FOR_OFFSETS_CONTENTEDITABLE = document.createElement('textarea');
                FAKE_TEXTAREA_FOR_OFFSETS_CONTENTEDITABLE.id = 'vskeys-fake-textarea-ce';
                FAKE_TEXTAREA_FOR_OFFSETS_CONTENTEDITABLE.style.position = 'absolute';
                FAKE_TEXTAREA_FOR_OFFSETS_CONTENTEDITABLE.style.left = '-9999px';
                FAKE_TEXTAREA_FOR_OFFSETS_CONTENTEDITABLE.style.height = '0px';
                document.body.appendChild(FAKE_TEXTAREA_FOR_OFFSETS_CONTENTEDITABLE);
            } else {
                FAKE_TEXTAREA_FOR_OFFSETS_CONTENTEDITABLE = document.getElementById('vskeys-fake-textarea-ce');
            }
            // This is a heuristic and might not always be perfect
            FAKE_TEXTAREA_FOR_OFFSETS_CONTENTEDITABLE.value = element.innerText || element.textContent || "";
            const clonedRange = range.cloneRange();
            const tempDiv = document.createElement("div");
            tempDiv.appendChild(clonedRange.cloneContents());
            const selectedText = tempDiv.innerText || tempDiv.textContent || "";
            
            // Heuristic for start/end based on textContent
            // This is very basic and might fail in complex contenteditables
            const fullText = element.textContent || "";
            let start = -1, end = -1;
            if (selectedText.length > 0) {
                start = fullText.indexOf(selectedText); // Simple first occurrence
                if (start !== -1) end = start + selectedText.length;
            } else { // Collapsed
                // Try to find cursor position - this is very hard for contenteditable reliably
                // For now, return 0,0 for collapsed if we can't determine.
                // Or try to find the text node and offset
                const anchorNode = selection.anchorNode;
                const anchorOffset = selection.anchorOffset;
                let currentOffset = 0;
                function findOffset(parentNode, targetNode, targetOffset) {
                    for(let i=0; i<parentNode.childNodes.length; i++) {
                        const child = parentNode.childNodes[i];
                        if(child === targetNode) {
                            currentOffset += targetOffset;
                            return true;
                        }
                        if(child.nodeType === Node.TEXT_NODE) {
                            currentOffset += child.textContent.length;
                        } else if (child.nodeType === Node.ELEMENT_NODE) {
                            if(findOffset(child, targetNode, targetOffset)) return true;
                        }
                    }
                    return false;
                }
                if(anchorNode && element.contains(anchorNode)) {
                    findOffset(element, anchorNode, anchorOffset);
                    start = end = currentOffset;
                } else {
                    start = end = 0; // Fallback
                }

            }
            
            return {
                start: start !== -1 ? start : 0,
                end: end !== -1 ? end : 0,
                selectedText: selectedText,
                collapsed: range.collapsed
            };
        }
        return { start: 0, end: 0, selectedText: "", collapsed: true };
    } else { 
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
            if (!sel) return;
            sel.removeAllRanges();
            const range = document.createRange();
            
            let charCount = 0;
            let startNode, startOffsetFound, endNode, endOffsetFound;

            function findNodeAndOffsetRecursive(currNode, targetOffset, isStartBoundary) {
                if (currNode.nodeType === Node.TEXT_NODE) {
                    const len = currNode.textContent.length;
                    if (charCount <= targetOffset && charCount + len >= targetOffset) {
                        if (isStartBoundary) {
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
                        if (findNodeAndOffsetRecursive(currNode.childNodes[i], targetOffset, isStartBoundary)) {
                            return true; 
                        }
                    }
                }
                return false; 
            }
            
            charCount = 0;
            if (!findNodeAndOffsetRecursive(element, start, true) && start >= (element.textContent || "").length) {
                let lastNodeSearch = element;
                while(lastNodeSearch.lastChild) lastNodeSearch = lastNodeSearch.lastChild;
                startNode = lastNodeSearch;
                startOffsetFound = (startNode.nodeType === Node.TEXT_NODE) ? startNode.textContent.length : 0;
            }

            charCount = 0;
            if (!findNodeAndOffsetRecursive(element, end, false) && end >= (element.textContent || "").length) {
                 let lastNodeSearch = element;
                while(lastNodeSearch.lastChild) lastNodeSearch = lastNodeSearch.lastChild;
                endNode = lastNodeSearch;
                endOffsetFound = (endNode.nodeType === Node.TEXT_NODE) ? endNode.textContent.length : 0;
            }

            if (startNode && endNode && typeof startOffsetFound !== 'undefined' && typeof endOffsetFound !== 'undefined') {
                range.setStart(startNode, startOffsetFound);
                range.setEnd(endNode, endOffsetFound);
                sel.addRange(range);
            } else if (element.childNodes.length === 0 && start === 0 && end === 0) { 
                range.selectNodeContents(element);
                range.collapse(true);
                sel.addRange(range);
            } else {
                range.selectNodeContents(element);
                if (start === end && start >= (element.textContent || "").length) { 
                    range.collapse(false); 
                } else if (start === end) {
                    // Try to collapse to start if possible, otherwise fallback
                    try {
                       if (startNode) range.setStart(startNode, startOffsetFound);
                       else range.setStart(element, 0); // Failsafe
                       range.collapse(true);
                    } catch (e) { range.collapse(false); } // Fallback to end
                }
                sel.addRange(range);
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
        replaceRange: (text, start, end) => { 
            const S = el.selectionStart, E = el.selectionEnd;
            el.value = el.value.substring(0, start) + text + el.value.substring(end);
            el.selectionStart = el.selectionEnd = start + text.length;
        },
    };
}

function getLineBoundaries(text, cursorPos) {
    if (typeof text !== 'string') text = ""; 
    let lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
    let lineEnd = text.indexOf('\n', cursorPos);
    if (lineEnd === -1) lineEnd = text.length;
    return { lineStart, lineEnd };
}

function getCurrentLineInfo(element) {
    const sel = getSelectionDetails(element);
    const text = element.isContentEditable ? (element.textContent || "") : (element.value || "");
    
    // For contenteditable, selection start might be less reliable.
    // If it's collapsed, try to get the line around the cursor.
    let effectiveCursorPos = sel.start;
    if (element.isContentEditable && sel.collapsed) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // A more robust way to find effectiveCursorPos in contenteditable:
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(element);
            preCaretRange.setEnd(range.startContainer, range.startOffset);
            effectiveCursorPos = preCaretRange.toString().length;
        }
    }

    const { lineStart, lineEnd } = getLineBoundaries(text, effectiveCursorPos);
    const lineText = text.substring(lineStart, lineEnd);
    
    return { lineText, lineStart, lineEnd, currentSelection: sel, fullText: text };
}


function replaceText(element, newText, start, end, newCursorPosStart, newCursorPosEnd) {
    const finalNewStart = newCursorPosStart !== undefined ? newCursorPosStart : start + newText.length;
    const finalNewEnd = newCursorPosEnd !== undefined ? newCursorPosEnd : finalNewStart;

    if (element.isContentEditable) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) { // No selection, try to set one
            setSelection(element, start, end); // Set selection first
        }
        
        // Re-get selection as setSelection might have normalized it
        const currentRange = sel.getRangeAt(0);
        
        // More robust way to replace content:
        // Create a range covering the text to be replaced
        let rangeToReplace = document.createRange();
        let tempStartNode, tempStartOffset, tempEndNode, tempEndOffset;
        let charCount = 0;

        function findNodeAndOffset(currNode, targetOffset, forStart) {
            if (currNode.nodeType === Node.TEXT_NODE) {
                const len = currNode.textContent.length;
                if (charCount <= targetOffset && charCount + len >= targetOffset) {
                    if (forStart) { tempStartNode = currNode; tempStartOffset = targetOffset - charCount; }
                    else { tempEndNode = currNode; tempEndOffset = targetOffset - charCount; }
                    return true;
                }
                charCount += len;
            } else {
                for (let i = 0; i < currNode.childNodes.length; i++) {
                    if (findNodeAndOffset(currNode.childNodes[i], targetOffset, forStart)) return true;
                }
            }
            return false;
        }
        charCount = 0;
        findNodeAndOffset(element, start, true);
        charCount = 0;
        findNodeAndOffset(element, end, false);

        if (tempStartNode && tempEndNode) {
            rangeToReplace.setStart(tempStartNode, tempStartOffset);
            rangeToReplace.setEnd(tempEndNode, tempEndOffset);
            rangeToReplace.deleteContents();
            // Insert new text (plain text for now, could be adapted for HTML)
            const textNode = document.createTextNode(newText);
            rangeToReplace.insertNode(textNode);
            // Set cursor
            setSelection(element, finalNewStart, finalNewEnd);

        } else if (document.queryCommandSupported('insertText')) {
            // Fallback if precise range setting failed, but selection might be set
            setSelection(element, start, end); // Try to set selection
            document.execCommand('insertText', false, newText);
            // execCommand cursor handling is browser-dependent, may need explicit setSelection
            setSelection(element, finalNewStart, finalNewEnd);
        } else {
            // Absolute fallback: Replace all content (loses formatting)
            const fullText = element.textContent || "";
            element.textContent = fullText.substring(0, start) + newText + fullText.substring(end);
            setSelection(element, finalNewStart, finalNewEnd);
        }

    } else { // input or textarea
        const T = getTextareaHelper(element);
        const originalValue = T.value;
        const scrollLeft = T.el.scrollLeft; // Preserve scroll position
        const scrollTop = T.el.scrollTop;

        T.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
        
        T.el.scrollLeft = scrollLeft; // Restore scroll position
        T.el.scrollTop = scrollTop;
        
        T.setSelection(finalNewStart, finalNewEnd);
    }
}