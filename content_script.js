let chordState = null;
let lastChordKeyTime = 0;
const CHORD_TIMEOUT = 1500; // 1.5 seconds for chorded keys
let lastSearchTermCtrlD = "";

// --- Helper Functions ---

function isEditable(element) {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    const isInputText = tagName === 'input' && element.type === 'text';
    const isTextArea = tagName === 'textarea';
    const isContentEditable = element.isContentEditable;
    return isInputText || isTextArea || isContentEditable;
}

function getSelectionDetails(element) {
    if (element.isContentEditable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // This is a simplified approach for contenteditable.
            // True start/end relative to overall text content is complex.
            // For now, we'll work with what execCommand uses or textContent.
            // This part might need refinement for complex contenteditable structures.
            const commonAncestor = range.commonAncestorContainer;
            let textContentLength = (commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor : element).textContent.length;

            // A very rough approximation for start/end in contenteditable for our purpose
            // This isn't universally reliable for character offsets in complex HTML
            let tempRange = range.cloneRange();
            tempRange.selectNodeContents(element);
            tempRange.setEnd(range.startContainer, range.startOffset);
            const start = tempRange.toString().length;

            tempRange = range.cloneRange();
            tempRange.selectNodeContents(element);
            tempRange.setEnd(range.endContainer, range.endOffset);
            const end = tempRange.toString().length;
            
            return {
                start: Math.min(start,end), // Ensure start <= end
                end: Math.max(start,end),
                selectedText: range.toString(),
                collapsed: range.collapsed
            };
        }
        return { start: 0, end: 0, selectedText: "", collapsed: true }; // Fallback
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
        // This is very challenging to do robustly for arbitrary character offsets.
        // For now, execCommand based changes often handle selection.
        // If manual selection is needed, it requires careful range construction.
        // For simplicity, this function might be less effective for contenteditable
        // unless used after text modifications that preserve selection or clear it.
        console.warn("setSelection for contenteditable is approximate and may not always work as expected.");
        try {
            const sel = window.getSelection();
            sel.removeAllRanges();
            const range = document.createRange();
            
            let charCount = 0;
            let startNode, startOffset, endNode, endOffset;

            function findNodeAndOffset(root, targetOffset) {
                let node, offset = -1;
                const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
                while (node = walker.nextNode()) {
                    const len = node.textContent.length;
                    if (charCount + len >= targetOffset) {
                        offset = targetOffset - charCount;
                        return { node, offset };
                    }
                    charCount += len;
                }
                // Fallback if offset is out of bounds (e.g. at the very end)
                if (root.lastChild && root.lastChild.nodeType === Node.TEXT_NODE) {
                     return { node: root.lastChild, offset: root.lastChild.textContent.length };
                } else if (root.childNodes.length === 0 && root.textContent === "") { // Handle empty contenteditable
                     return { node: root, offset: 0 };
                }
                return { node: root, offset: 0 }; // Last resort
            }
            
            const startPos = findNodeAndOffset(element, start);
            startNode = startPos.node; startOffset = startPos.offset;
            
            charCount = 0; // Reset for end position
            const endPos = findNodeAndOffset(element, end);
            endNode = endPos.node; endOffset = endPos.offset;

            if (startNode && endNode) {
                range.setStart(startNode, startOffset);
                range.setEnd(endNode, endOffset);
                sel.addRange(range);
            }
        } catch (e) {
            console.error("Error setting selection in contenteditable:", e);
        }
    } else {
        element.setSelectionRange(start, end);
    }
}

function getLineBoundaries(text, cursorPos) {
    let lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
    let lineEnd = text.indexOf('\n', cursorPos);
    if (lineEnd === -1) lineEnd = text.length;
    return { lineStart, lineEnd };
}

function getCurrentLineInfo(element) {
    const sel = getSelectionDetails(element);
    const text = element.isContentEditable ? element.textContent : element.value;
    
    const { lineStart, lineEnd } = getLineBoundaries(text, sel.start);
    const lineText = text.substring(lineStart, lineEnd);
    
    return { lineText, lineStart, lineEnd, currentSelection: sel };
}

function replaceText(element, newText, start, end, newCursorPos) {
    if (element.isContentEditable) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            // Approximate setting range for replacement. Robustly finding the exact
            // nodes for arbitrary start/end char offsets is complex.
            // This works best if start/end correspond to current selection.
            if (getSelectionDetails(element).start === start && getSelectionDetails(element).end === end) {
                range.deleteContents();
                range.insertNode(document.createTextNode(newText));
                 // Try to position cursor after inserted text.
                range.setStart(range.endContainer, range.endOffset);
                range.setEnd(range.endContainer, range.endOffset);
                sel.removeAllRanges();
                sel.addRange(range);

            } else { // Fallback if selection doesn't match start/end: replace all and re-select. Risky for formatting.
                console.warn("Replacing arbitrary range in contenteditable, formatting may be lost.");
                const fullText = element.textContent;
                element.textContent = fullText.substring(0, start) + newText + fullText.substring(end);
                if (typeof newCursorPos !== 'undefined') setSelection(element, newCursorPos, newCursorPos);
            }
        }
    } else {
        const T = getTextareaHelper(element);
        T.replaceRange(newText, start, end);
        if (typeof newCursorPos !== 'undefined') {
            T.setSelection(newCursorPos, newCursorPos);
        } else {
            T.setSelection(start + newText.length, start + newText.length);
        }
    }
}


// Textarea helper (from a simplified version of a library like textarea-caret-position)
// This is a basic helper, more robust libraries exist for complex textarea manipulations.
function getTextareaHelper(el) {
    return {
        el: el,
         L: el.value.length,
        getSelection: () => ({ start: el.selectionStart, end: el.selectionEnd }),
        setSelection: (start, end) => {
            el.selectionStart = start;
            el.selectionEnd = end;
        },
        replaceRange: (text, start, end, select = "end") => {
            const S = el.selectionStart, E = el.selectionEnd;
            el.value = el.value.substring(0, start) + text + el.value.substring(end);
            let len = text.length;
            if (select === "ensure") {
                if (S === E) { // cursor
                     if (S >= end) el.selectionStart = el.selectionEnd = S - (end - start) + len;
                     else if (S >= start && S < end) el.selectionStart = el.selectionEnd = start + len;
                     // else: S < start:  S stays S, E stays E.
                } else { // selection
                    // complex logic to update selection markers, omitted for brevity here
                    // for now, just place cursor at end of replaced text
                    el.selectionStart = el.selectionEnd = start + len;
                }
            } else if (select === "end") {
                el.selectionStart = el.selectionEnd = start + len;
            } else if (select === "around") {
                el.selectionStart = start;
                el.selectionEnd = start + len;
            } else if (select === "preserve") {
                // Try to preserve selection relative to change
                if (E <= start) { // selection before change
                    // no change
                } else if (S >= end) { // selection after change
                    el.selectionStart = S - (end - start) + len;
                    el.selectionEnd = E - (end - start) + len;
                } else { // selection overlaps change
                    // for simplicity, select the inserted text
                    el.selectionStart = start;
                    el.selectionEnd = start + len;
                }
            }
        },
        getCurrentLineNumber: () => el.value.substring(0, el.selectionStart).split('\n').length,
        getLineInfo: (lineNumber) => {
            const lines = el.value.split('\n');
            if (lineNumber < 1 || lineNumber > lines.length) return null;
            let charCount = 0;
            for (let i = 0; i < lineNumber - 1; i++) {
                charCount += lines[i].length + 1; // +1 for newline char
            }
            return {
                text: lines[lineNumber - 1],
                start: charCount,
                end: charCount + lines[lineNumber - 1].length
            };
        }
    };
}


// --- Shortcut Handlers ---

async function handleKeyDown(event) {
    const activeElement = document.activeElement;
    if (!isEditable(activeElement)) {
        chordState = null; // Reset chord if focus is lost
        return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? event.metaKey : event.ctrlKey; // Use Cmd on Mac, Ctrl on others

    // Handle Ctrl+K chord
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        chordState = 'k';
        lastChordKeyTime = Date.now();
        event.preventDefault();
        event.stopPropagation();
        // Set a timeout to clear chordState if no second key is pressed
        setTimeout(() => {
            if (Date.now() - lastChordKeyTime >= CHORD_TIMEOUT) {
                chordState = null;
            }
        }, CHORD_TIMEOUT);
        return;
    }

    if (chordState === 'k' && Date.now() - lastChordKeyTime < CHORD_TIMEOUT) {
        if (ctrlKey && !event.shiftKey && !event.altKey) { // Ensure Ctrl is still held for the second part
            const secondKey = event.key.toLowerCase();
            chordState = null; // Consume chord

            if (secondKey === 'c') { // Ctrl+K Ctrl+C: Add Line Comment
                event.preventDefault();
                event.stopPropagation();
                toggleLineComment(activeElement, 'comment');
                return;
            }
            if (secondKey === 'u') { // Ctrl+K Ctrl+U: Remove Line Comment
                event.preventDefault();
                event.stopPropagation();
                toggleLineComment(activeElement, 'uncomment');
                return;
            }
        }
        // If second key isn't recognized or modifier changed, reset chord
        chordState = null;
    }


    // --- Standard Shortcuts ---
    // Note: For contenteditable, many of these operations are simplified or might affect formatting.

    // Ctrl+X: Cut line (if empty selection) or Cut selection
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        event.stopPropagation();
        const selDetails = getSelectionDetails(activeElement);
        if (selDetails.collapsed && activeElement.tagName.toLowerCase() !== 'input') {
            const { lineText, lineStart, lineEnd } = getCurrentLineInfo(activeElement);
            const textToCut = activeElement.value.substring(lineStart, lineEnd + (activeElement.value[lineEnd] === '\n' ? 1 : 0) ); // include newline
            await navigator.clipboard.writeText(textToCut);
            replaceText(activeElement, "", lineStart, lineEnd + (activeElement.value[lineEnd] === '\n' ? 1 : 0), lineStart);
        } else {
            if (activeElement.isContentEditable) document.execCommand('cut');
            else {
                 await navigator.clipboard.writeText(selDetails.selectedText);
                 replaceText(activeElement, "", selDetails.start, selDetails.end, selDetails.start);
            }
        }
        return;
    }

    // Ctrl+C: Copy line (if empty selection) or Copy selection
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        event.stopPropagation();
        const selDetails = getSelectionDetails(activeElement);
        if (selDetails.collapsed && activeElement.tagName.toLowerCase() !== 'input') {
            const { lineText } = getCurrentLineInfo(activeElement);
            await navigator.clipboard.writeText(lineText);
        } else {
             if (activeElement.isContentEditable) document.execCommand('copy');
             else await navigator.clipboard.writeText(selDetails.selectedText);
        }
        return;
    }

    // Ctrl+V: Paste
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        event.stopPropagation();
        const textToPaste = await navigator.clipboard.readText();
        if (textToPaste) {
            if (activeElement.isContentEditable) {
                document.execCommand('insertText', false, textToPaste);
            } else {
                const selDetails = getSelectionDetails(activeElement);
                replaceText(activeElement, textToPaste, selDetails.start, selDetails.end, selDetails.start + textToPaste.length);
            }
        }
        return;
    }
    
    // Ctrl+Shift+K: Delete Line
    if (ctrlKey && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();
        if (activeElement.tagName.toLowerCase() === 'input') { // Delete all content for input
            replaceText(activeElement, "", 0, activeElement.value.length, 0);
        } else {
            const { lineStart, lineEnd } = getCurrentLineInfo(activeElement);
            // Include newline if it's not the last line
            const endPos = activeElement.value[lineEnd] === '\n' ? lineEnd + 1 : lineEnd;
            replaceText(activeElement, "", lineStart, endPos, lineStart);
        }
        return;
    }

    // Ctrl+Enter: Insert Line Below
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (activeElement.isContentEditable) {
            document.execCommand('insertParagraph'); // or insertHTML <br> might be needed
        } else {
            const T = getTextareaHelper(activeElement);
            const { lineEnd } = getCurrentLineInfo(activeElement);
            const currentLineText = getCurrentLineInfo(activeElement).lineText;
            const indentation = currentLineText.match(/^\s*/)[0];
            const textToInsert = '\n' + indentation;
            replaceText(activeElement, textToInsert, lineEnd, lineEnd, lineEnd + textToInsert.length);
        }
        return;
    }

    // Ctrl+Shift+Enter: Insert Line Above
    if (ctrlKey && event.shiftKey && !event.altKey && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (activeElement.isContentEditable) {
            // This is harder in contenteditable. One way is to move cursor to line start and insert paragraph.
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                // Try to move to visual line start; this is heuristic
                sel.modify("move", "backward", "lineboundary");
                document.execCommand('insertParagraph');
                // Cursor might be at end of new line, may need to move it up.
            }
        } else {
            const T = getTextareaHelper(activeElement);
            const { lineStart } = getCurrentLineInfo(activeElement);
            const prevLineText = activeElement.value.substring(0, lineStart -1).split('\n').pop() || "";
            const indentation = prevLineText.match(/^\s*/)[0]; // Indent like previous line, or current if first
            const textToInsert = indentation + '\n';
            replaceText(activeElement, textToInsert, lineStart, lineStart, lineStart + indentation.length);
        }
        return;
    }

    // Alt+Down: Move Line Down (Textarea primarily)
    if (!ctrlKey && !event.shiftKey && event.altKey && event.key === 'ArrowDown') {
        if (activeElement.tagName.toLowerCase() === 'textarea') {
            event.preventDefault();
            event.stopPropagation();
            const T = getTextareaHelper(activeElement);
            const lines = T.el.value.split('\n');
            const { lineStart, lineEnd } = getCurrentLineInfo(activeElement);
            const cursorLineIndex = T.el.value.substring(0, lineStart).split('\n').length -1;

            if (cursorLineIndex < lines.length - 1) {
                const lineToMove = lines[cursorLineIndex];
                lines.splice(cursorLineIndex, 1);
                lines.splice(cursorLineIndex + 1, 0, lineToMove);
                
                const newText = lines.join('\n');
                const originalCursorPosInLine = T.el.selectionStart - lineStart;
                
                T.el.value = newText;
                
                let newGlobalLineStart = 0;
                for(let i=0; i < cursorLineIndex + 1; i++) {
                    newGlobalLineStart += lines[i].length +1;
                }
                T.setSelection(newGlobalLineStart + originalCursorPosInLine, newGlobalLineStart + originalCursorPosInLine);
            }
        }
        return;
    }
    
    // Alt+Up: Move Line Up (Textarea primarily)
    if (!ctrlKey && !event.shiftKey && event.altKey && event.key === 'ArrowUp') {
         if (activeElement.tagName.toLowerCase() === 'textarea') {
            event.preventDefault();
            event.stopPropagation();
            const T = getTextareaHelper(activeElement);
            const lines = T.el.value.split('\n');
            const { lineStart, lineEnd } = getCurrentLineInfo(activeElement);
            const cursorLineIndex = T.el.value.substring(0, lineStart).split('\n').length -1;

            if (cursorLineIndex > 0) {
                const lineToMove = lines[cursorLineIndex];
                lines.splice(cursorLineIndex, 1);
                lines.splice(cursorLineIndex - 1, 0, lineToMove);

                const newText = lines.join('\n');
                const originalCursorPosInLine = T.el.selectionStart - lineStart;
                T.el.value = newText;
                
                let newGlobalLineStart = 0;
                for(let i=0; i < cursorLineIndex - 1; i++) {
                    newGlobalLineStart += lines[i].length +1;
                }
                T.setSelection(newGlobalLineStart + originalCursorPosInLine, newGlobalLineStart + originalCursorPosInLine);
            }
        }
        return;
    }

    // Shift+Alt+Down: Copy Line Down
    if (!ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        if (activeElement.tagName.toLowerCase() === 'input') { // Duplicate content for input
            const originalText = activeElement.value;
            replaceText(activeElement, originalText + originalText, 0, originalText.length, originalText.length*2);
        } else {
            const { lineText, lineStart, lineEnd } = getCurrentLineInfo(activeElement);
            const textToInsert = (activeElement.value[lineEnd] === '\n' ? lineText + '\n' : lineText); // Preserve newline if present
            const cursorOffset = getSelectionDetails(activeElement).start - lineStart;
            replaceText(activeElement, textToInsert, lineEnd, lineEnd, lineEnd + cursorOffset);
        }
        return;
    }

    // Shift+Alt+Up: Copy Line Up
    if (!ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        if (activeElement.tagName.toLowerCase() === 'input') { // Duplicate content for input
            const originalText = activeElement.value;
            replaceText(activeElement, originalText + originalText, 0, originalText.length, originalText.length);
        } else {
            const { lineText, lineStart, lineEnd } = getCurrentLineInfo(activeElement);
            const textToInsert = lineText + (activeElement.value[lineEnd] === '\n' && lineStart > 0 ? '\n' : '');
            const cursorOffset = getSelectionDetails(activeElement).start - lineStart;
            replaceText(activeElement, textToInsert, lineStart, lineStart, lineStart + cursorOffset);
        }
        return;
    }

    // Ctrl+Z: Undo
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.stopPropagation();
        document.execCommand('undo');
        return;
    }

    // Ctrl+Y: Redo
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        event.stopPropagation();
        document.execCommand('redo');
        return;
    }
    
    // Ctrl+L: Select current line
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        event.stopPropagation();
        if (activeElement.tagName.toLowerCase() === 'input') {
            setSelection(activeElement, 0, activeElement.value.length);
        } else {
            const { lineStart, lineEnd } = getCurrentLineInfo(activeElement);
            // Include newline in selection if it exists, like VS Code
            const endPos = activeElement.value[lineEnd] === '\n' ? lineEnd + 1 : lineEnd;
            setSelection(activeElement, lineStart, endPos);
        }
        return;
    }

    // Ctrl+]: Indent Line/Selection
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key === ']') {
        event.preventDefault();
        event.stopPropagation();
        indentSelection(activeElement, 'indent');
        return;
    }

    // Ctrl+[: Outdent Line/Selection
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key === '[') {
        event.preventDefault();
        event.stopPropagation();
        indentSelection(activeElement, 'outdent');
        return;
    }

    // Home: Smart Home
    if (!ctrlKey && !event.shiftKey && !event.altKey && event.key === 'Home') {
        if (activeElement.isContentEditable) { /* TODO: Smart Home for contenteditable is complex */ return; }
        
        event.preventDefault();
        event.stopPropagation();
        const T = getTextareaHelper(activeElement);
        const { start: cursorPos } = T.getSelection();
        const { lineText, lineStart } = getCurrentLineInfo(activeElement);
        
        const firstNonWhitespacePos = lineStart + lineText.match(/^\s*/)[0].length;

        if (cursorPos === firstNonWhitespacePos && cursorPos !== lineStart) { // Already at first non-whitespace, and it's not col 0
            T.setSelection(lineStart, lineStart); // Go to true start
        } else {
            T.setSelection(firstNonWhitespacePos, firstNonWhitespacePos); // Go to first non-whitespace
        }
        return;
    }
    // End, Ctrl+Home, Ctrl+End are usually handled well by browser; not overriding for now.

    // Ctrl+/: Toggle Line Comment
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key === '/') {
        event.preventDefault();
        event.stopPropagation();
        toggleLineComment(activeElement, 'toggle');
        return;
    }

    // Shift+Alt+A: Toggle Block Comment
    if (!ctrlKey && event.shiftKey && event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        event.stopPropagation();
        toggleBlockComment(activeElement);
        return;
    }

    // Ctrl+D: Select word / Add next occurrence to selection (Simplified: Select word, then find next)
    if (ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        event.stopPropagation();
        handleCtrlD(activeElement);
        return;
    }
}

function indentSelection(element, direction) {
    if (element.isContentEditable) {
        document.execCommand(direction === 'indent' ? 'indent' : 'outdent');
        return;
    }

    const T = getTextareaHelper(element);
    const sel = T.getSelection();
    const text = T.el.value;
    const INDENT_CHAR = '\t';

    let { lineStart: firstLineStart } = getLineBoundaries(text, sel.start);
    let { lineStart: lastLineStart } = getLineBoundaries(text, sel.end - (sel.end > sel.start && text[sel.end-1] === '\n' ? 1 : 0) ); // Handle selection ending exactly on a newline

    let currentPos = firstLineStart;
    let newText = "";
    let prefixLengthChange = 0;
    let firstLinePrefixChange = 0;
    let iteration = 0;

    while(currentPos <= lastLineStart) {
        const { lineEnd } = getLineBoundaries(text, currentPos);
        let line = text.substring(currentPos, lineEnd);
        let currentLinePrefixChange = 0;

        if (direction === 'indent') {
            newText += INDENT_CHAR + line;
            currentLinePrefixChange = INDENT_CHAR.length;
        } else { // outdent
            if (line.startsWith(INDENT_CHAR)) {
                newText += line.substring(INDENT_CHAR.length);
                currentLinePrefixChange = -INDENT_CHAR.length;
            } else if (line.startsWith(" ")) { // outdent spaces if no tab
                 let spacesToTrim = 0;
                 for(let i=0; i < 4 && i < line.length; i++) { if(line[i] === ' ') spacesToTrim++; else break;}
                 if(spacesToTrim > 0) {
                    newText += line.substring(spacesToTrim);
                    currentLinePrefixChange = -spacesToTrim;
                 } else {
                    newText += line; // no change
                 }
            } else {
                newText += line; // no change
            }
        }
        prefixLengthChange += currentLinePrefixChange;
        if (iteration === 0) {
            firstLinePrefixChange = currentLinePrefixChange;
        }
        
        currentPos = lineEnd + 1; // Move to start of next line
        if (currentPos <= lastLineStart || (currentPos > lineEnd && lineEnd < text.length)) { // Add newline if not last line effectively processed
             newText += '\n';
        }
        iteration++;
        if (lineEnd >= text.length) break; // Reached end of text
    }
    
    const textAfterAffectedLines = text.substring(currentPos - (currentPos > 0 ? 1 : 0) ); // currentPos is start of line after last affected or EoF
                                                                                // Need to subtract 1 if it added a newline from last line
    
    const finalReplacedEnd = currentPos > 0 ? currentPos-1 : 0; // End of the last modified line including its newline
    
    // Manually construct the full new value
    T.el.value = text.substring(0, firstLineStart) + newText + (finalReplacedEnd < text.length ? text.substring(finalReplacedEnd) : "");

    let newSelStart = sel.start + firstLinePrefixChange;
    let newSelEnd = sel.end + prefixLengthChange;
    // Ensure selection start is not negative
    newSelStart = Math.max(firstLineStart, newSelStart);
    if (sel.start === sel.end) newSelEnd = newSelStart; // Keep cursor collapsed if it was
    else newSelEnd = Math.max(newSelStart, newSelEnd); // Ensure end is not before start
    
    T.setSelection(newSelStart, newSelEnd);
}


function toggleLineComment(element, mode = 'toggle') { // mode: 'toggle', 'comment', 'uncomment'
    if (element.isContentEditable) { /* Not well-defined for contenteditable */ return; }
    
    const T = getTextareaHelper(element);
    const sel = T.getSelection();
    const text = T.el.value;
    const COMMENT_PREFIX = '// ';

    let { lineStart: firstLineStart } = getLineBoundaries(text, sel.start);
    // For last line, if selection ends exactly at newline, consider the line before it
    let { lineStart: lastLineStart } = getLineBoundaries(text, sel.end - (sel.end > sel.start && text[sel.end-1] === '\n' ? 1 : 0) );

    let currentPos = firstLineStart;
    let newText = "";
    let prefixLengthChange = 0;
    let firstLinePrefixChange = 0;
    let iteration = 0;

    // Determine if all selected lines are commented (for toggle mode)
    let allCommented = true;
    if (mode === 'toggle') {
        let tempPos = firstLineStart;
        while(tempPos <= lastLineStart) {
            const { lineEnd: tempLineEnd } = getLineBoundaries(text, tempPos);
            const tempLine = text.substring(tempPos, tempLineEnd);
            if (!tempLine.trim().startsWith(COMMENT_PREFIX.trim()) && tempLine.trim() !== "") {
                allCommented = false;
                break;
            }
            if (tempLineEnd >= text.length) break;
            tempPos = tempLineEnd + 1;
        }
    }

    currentPos = firstLineStart; // Reset currentPos for main processing loop
    while(currentPos <= lastLineStart) {
        const { lineEnd } = getLineBoundaries(text, currentPos);
        let line = text.substring(currentPos, lineEnd);
        const leadingWhitespace = line.match(/^\s*/)[0];
        const trimmedLine = line.substring(leadingWhitespace.length);
        let currentLinePrefixChange = 0;

        const effectiveMode = (mode === 'toggle') ? (allCommented ? 'uncomment' : 'comment') : mode;

        if (effectiveMode === 'comment') {
            if (line.trim() !== "") { // Don't comment empty lines
                newText += leadingWhitespace + COMMENT_PREFIX + trimmedLine;
                currentLinePrefixChange = COMMENT_PREFIX.length;
            } else {
                newText += line;
            }
        } else { // uncomment
            if (trimmedLine.startsWith(COMMENT_PREFIX.trim())) {
                 // Remove prefix, preserving original indent relative to prefix
                if (trimmedLine.startsWith(COMMENT_PREFIX)) { // "// "
                    newText += leadingWhitespace + trimmedLine.substring(COMMENT_PREFIX.length);
                    currentLinePrefixChange = -COMMENT_PREFIX.length;
                } else { // "//"
                     newText += leadingWhitespace + trimmedLine.substring(COMMENT_PREFIX.trim().length);
                     currentLinePrefixChange = -COMMENT_PREFIX.trim().length;
                }
            } else {
                newText += line; // No change
            }
        }
        
        prefixLengthChange += currentLinePrefixChange;
        if (iteration === 0) {
            firstLinePrefixChange = currentLinePrefixChange;
        }
        
        currentPos = lineEnd + 1;
        if (currentPos <= lastLineStart || (currentPos > lineEnd && lineEnd < text.length)) {
             newText += '\n';
        }
        iteration++;
        if (lineEnd >= text.length) break;
    }

    const textAfterAffectedLines = text.substring(currentPos > 0 ? currentPos-1 : 0);
    const finalReplacedEnd = currentPos > 0 ? currentPos-1 : 0;

    T.el.value = text.substring(0, firstLineStart) + newText + (finalReplacedEnd < text.length ? text.substring(finalReplacedEnd) : "");
    
    let newSelStart = sel.start + firstLinePrefixChange;
    let newSelEnd = sel.end + prefixLengthChange;
    newSelStart = Math.max(firstLineStart, newSelStart); // Ensure selection doesn't go before line start
    if (sel.start === sel.end) newSelEnd = newSelStart;
    else newSelEnd = Math.max(newSelStart, newSelEnd);

    T.setSelection(newSelStart, newSelEnd);
}

function toggleBlockComment(element) {
    if (element.isContentEditable) { /* Not well-defined for contenteditable */ return; }

    const T = getTextareaHelper(element);
    const sel = T.getSelection();
    const text = T.el.value;
    const START_COMMENT = '/*';
    const END_COMMENT = '*/';
    
    const selectedText = text.substring(sel.start, sel.end);

    // Check if the selection is already block-commented
    // This is a simple check; nested or partial comments are complex.
    const isCommented = selectedText.startsWith(START_COMMENT) && selectedText.endsWith(END_COMMENT);

    if (isCommented) {
        // Uncomment: remove START_COMMENT and END_COMMENT
        const unwrappedText = selectedText.substring(START_COMMENT.length, selectedText.length - END_COMMENT.length);
        replaceText(element, unwrappedText, sel.start, sel.end);
        T.setSelection(sel.start, sel.start + unwrappedText.length);
    } else {
        // Comment: wrap with START_COMMENT and END_COMMENT
        const wrappedText = START_COMMENT + selectedText + END_COMMENT;
        replaceText(element, wrappedText, sel.start, sel.end);
        T.setSelection(sel.start, sel.start + wrappedText.length);
    }
}

function handleCtrlD(element) {
    const T = getTextareaHelper(element); // Works for input/textarea
    let selDetails = getSelectionDetails(element);
    let text = element.isContentEditable ? element.textContent : element.value;

    if (selDetails.collapsed) { // No selection, select word under cursor
        const cursor = selDetails.start;
        // Find word boundaries (simple regex based)
        let wordStart = text.substring(0, cursor).search(/[a-zA-Z0-9_]+$/);
        if (wordStart === -1 && cursor > 0 && /\W/.test(text[cursor-1])) wordStart = cursor; // If cursor is after non-word char
        else if (wordStart === -1) wordStart = 0; // Default to start if no word found before cursor
        
        let wordEndMatch = text.substring(cursor).match(/[a-zA-Z0-9_]+/);
        let wordEnd = wordEndMatch ? cursor + wordEndMatch[0].length : cursor;
        if(cursor === wordEnd && cursor > 0 && /\W/.test(text[cursor-1]) ) { // Cursor is after a word
             wordEnd = cursor;
        } else if (cursor === wordEnd && wordStart === cursor && text.length > cursor && /\W/.test(text[cursor])) { // Cursor is before a word
            wordStart = cursor; // Don't expand if on whitespace between words
        } else if (wordStart === wordEnd && text.length > cursor && !/\W/.test(text[cursor])) { // Cursor at beginning of a word
             wordEnd = cursor + text.substring(cursor).match(/[a-zA-Z0-9_]+/)[0].length;
        } else if (wordStart === wordEnd ) { // empty or all whitespace
            return; // Do nothing
        }


        if (wordStart !== -1 && wordEnd > wordStart) {
            lastSearchTermCtrlD = text.substring(wordStart, wordEnd);
            setSelection(element, wordStart, wordEnd);
        } else {
            lastSearchTermCtrlD = ""; // Reset if no word found
        }
    } else { // Text is already selected, use it for next search
        if (selDetails.selectedText === lastSearchTermCtrlD) { // Find next occurrence
            let nextOccurrence = text.indexOf(lastSearchTermCtrlD, selDetails.end);
            if (nextOccurrence !== -1) {
                setSelection(element, nextOccurrence, nextOccurrence + lastSearchTermCtrlD.length);
            } else { // Wrap around search from beginning
                nextOccurrence = text.indexOf(lastSearchTermCtrlD, 0);
                if (nextOccurrence !== -1 && nextOccurrence < selDetails.start) { // Found before current, wrap
                     setSelection(element, nextOccurrence, nextOccurrence + lastSearchTermCtrlD.length);
                } else {
                    // No other occurrences or only this one. Flash or indicate no more. (Not implemented)
                }
            }
        } else { // New selection, store it
             lastSearchTermCtrlD = selDetails.selectedText;
             // The selection is already as intended.
        }
    }
}


// --- Event Listener ---
// Use capture phase for keydown to catch it early, but be cautious.
// Using bubble phase (false) is generally safer. For this use case, bubble is fine.
document.addEventListener('keydown', handleKeyDown, false);

console.log("VS Keys Extension Loaded.");

// Placeholder for icon files (you need to create these)
// icon48.png, icon128.png
// For testing, you can skip adding actual icon files to the manifest,
// or use any small PNGs you have.