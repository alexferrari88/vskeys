// content_actions.js - High-level action handlers for shortcuts

async function handleCutLine(element, globalSettings) {
    const selDetails = getSelectionDetails(element);
    if (selDetails.collapsed && element.tagName.toLowerCase() !== 'input') {
        const { lineText, lineStart, lineEnd, fullText } = getCurrentLineInfo(element);
        const textToCut = fullText.substring(lineStart, lineEnd + (fullText[lineEnd] === '\n' ? 1 : 0) );
        if (textToCut.trim() === "" && fullText[lineEnd] !== '\n' && lineEnd === fullText.length) { // Cutting empty last line
             replaceText(element, "", lineStart, lineEnd, lineStart, lineStart);
             await navigator.clipboard.writeText("\n"); // VS Code cuts a newline
        } else {
            await navigator.clipboard.writeText(textToCut);
            replaceText(element, "", lineStart, lineEnd + (fullText[lineEnd] === '\n' ? 1 : 0), lineStart, lineStart);
        }
        showFeedbackMessage("Line Cut", element, globalSettings);
    } else {
        if (element.isContentEditable) {
            document.execCommand('cut'); // Relies on browser for contenteditable cut
        } else {
            if (!selDetails.selectedText && selDetails.collapsed) { // Input field, empty selection, treat as cut all
                 await navigator.clipboard.writeText(element.value);
                 replaceText(element, "", 0, element.value.length, 0, 0);
            } else {
                 await navigator.clipboard.writeText(selDetails.selectedText);
                 replaceText(element, "", selDetails.start, selDetails.end, selDetails.start, selDetails.start);
            }
        }
        showFeedbackMessage("Selection Cut", element, globalSettings);
    }
}

async function handleCopyLine(element, globalSettings) {
    const selDetails = getSelectionDetails(element);
    if (selDetails.collapsed && element.tagName.toLowerCase() !== 'input') {
        const { lineText, lineStart, lineEnd, fullText } = getCurrentLineInfo(element);
        const textToCopy = fullText.substring(lineStart, lineEnd + (fullText[lineEnd] === '\n' ? 1:0));
        if (lineText.trim() === "" && fullText[lineEnd] !== '\n' && lineEnd === fullText.length) { // Copying empty last line
            await navigator.clipboard.writeText("\n"); // VS Code copies a newline
        } else {
            await navigator.clipboard.writeText(textToCopy);
        }
        showFeedbackMessage("Line Copied", element, globalSettings);
    } else {
        if (element.isContentEditable) document.execCommand('copy');
        else {
            if (!selDetails.selectedText && selDetails.collapsed && element.tagName.toLowerCase() === 'input') { // Input field, empty selection, copy all
                await navigator.clipboard.writeText(element.value);
            } else {
                await navigator.clipboard.writeText(selDetails.selectedText);
            }
        }
        showFeedbackMessage("Selection Copied", element, globalSettings);
    }
}

async function handlePaste(element, globalSettings) {
    _extensionHandledPaste = true; 

    try {
        const textToPaste = await navigator.clipboard.readText();
        if (typeof textToPaste !== 'string') {
             showFeedbackMessage("Clipboard empty or unreadable", element, globalSettings);
             return;
        }

        const selDetails = getSelectionDetails(element);

        // VS Code Line Paste Behavior:
        // If clipboard contains a newline (likely a copied line) AND no text is selected at paste destination,
        // it should insert the clipboard content as a new line.
        const isVSCodeLinePasteScenario = textToPaste.includes('\n') && selDetails.collapsed;

        if (isVSCodeLinePasteScenario && element.tagName.toLowerCase() !== 'input') { // Exclude simple inputs from complex line paste
            let { lineStart, lineEnd, fullText } = getCurrentLineInfo(element);
            
            // Ensure pasted text ends with a newline if it's multi-line or intended as a full line
            let textToInsert = textToPaste;
            if (!textToInsert.endsWith('\n')) {
                textToInsert += '\n';
            }

            // Paste the new line(s) at the beginning of the current line, pushing existing content down.
            // The cursor should end up at the beginning of the line *after* the pasted content.
            if (element.isContentEditable) {
                // For contenteditable, moving to line start and inserting HTML with <br> might be more robust for new lines
                setSelection(element, lineStart, lineStart); // Move cursor to beginning of current line
                
                // Prepare HTML: escape HTML in textToPaste and replace \n with <br>
                const tempDiv = document.createElement('div');
                tempDiv.innerText = textToInsert.replace(/\n$/, ''); // textContent handles escaping
                let htmlToInsert = tempDiv.innerHTML.replace(/\n/g, '<br>');
                if (textToInsert.endsWith('\n')) htmlToInsert += '<br>';


                document.execCommand('insertHTML', false, htmlToInsert);
                // Cursor position after insertHTML can be unpredictable.
                // A more robust solution might involve range manipulation before/after.
            } else { // textarea
                replaceText(element, textToInsert, lineStart, lineStart);
                // replaceText by default places cursor at end of insertion.
                // For VSCode paste, cursor should be at the start of the next line.
                // Let's calculate that: lineStart + textToInsert.length
                setSelection(element, lineStart + textToInsert.length, lineStart + textToInsert.length);
            }
            showFeedbackMessage("Line Pasted (VS Code style)", element, globalSettings);

        } else { // Standard inline paste (replacing selection or inserting at cursor)
            if (element.isContentEditable) {
                document.execCommand('insertText', false, textToPaste);
            } else { // textarea or input
                replaceText(element, textToPaste, selDetails.start, selDetails.end, selDetails.start + textToPaste.length, selDetails.start + textToPaste.length);
            }
            showFeedbackMessage("Pasted", element, globalSettings);
        }

    } catch (err) {
        console.error("VS Keys - Paste error:", err);
        showFeedbackMessage("Paste failed (see console)", element, globalSettings);
    } finally {
        setTimeout(() => { _extensionHandledPaste = false; }, 50);
    }
}

function handleDeleteLine(element, globalSettings) {
    if (element.tagName.toLowerCase() === 'input') {
        replaceText(element, "", 0, element.value.length, 0, 0);
    } else {
        const { lineStart, lineEnd, fullText } = getCurrentLineInfo(element);
        const endPos = fullText[lineEnd] === '\n' ? lineEnd + 1 : lineEnd;
        replaceText(element, "", lineStart, endPos, lineStart, lineStart);
    }
    showFeedbackMessage("Line Deleted", element, globalSettings);
}

function handleInsertLineBelow(element, globalSettings) {
    if (element.isContentEditable) {
        const sel = window.getSelection();
        sel.modify("move", "forward", "lineboundary");
        document.execCommand('insertHTML', false, '<br>'); // More reliable than insertParagraph sometimes
        // Ideally, get indentation from current line and apply to new one.
        // This is complex in contenteditable.
    } else {
        const { lineEnd, lineText, fullText } = getCurrentLineInfo(element);
        const indentation = lineText.match(/^\s*/)[0];
        const textToInsert = '\n' + indentation;
        // If at the very end of the document and no newline, add one first
        let effectiveLineEnd = lineEnd;
        if (lineEnd === fullText.length && fullText[lineEnd-1] !== '\n' && lineEnd > 0) {
            // Needs to insert \n first, then new line with indent
            // For simplicity with replaceText, we just insert after current content
        }
        replaceText(element, textToInsert, effectiveLineEnd, effectiveLineEnd, effectiveLineEnd + textToInsert.length, effectiveLineEnd + textToInsert.length);
    }
    showFeedbackMessage("Line Inserted Below", element, globalSettings);
}

function handleInsertLineAbove(element, globalSettings) {
    if (element.isContentEditable) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            sel.modify("move", "backward", "lineboundary");
            const currentLineStartRange = sel.getRangeAt(0).cloneRange(); // Store cursor position

            // Try to get indentation. This is highly heuristic for contenteditable.
            const tempRange = currentLineStartRange.cloneRange();
            tempRange.setEnd(tempRange.startContainer, tempRange.startOffset); // Collapse to start
            // Try to get text of current line to sniff indent (very rough)
            let indent = "";
            try {
                const lineCheckRange = document.createRange();
                lineCheckRange.setStart(currentLineStartRange.startContainer, 0); // Start of current block/node
                lineCheckRange.setEnd(currentLineStartRange.startContainer, currentLineStartRange.startOffset);
                const textBeforeCursorInNode = lineCheckRange.toString();
                indent = textBeforeCursorInNode.match(/^\s*/)[0];
            } catch(e) {/*ignore*/}

            document.execCommand('insertHTML', false, indent + '<br>'); // Insert new line above (effectively)
            
            // Try to restore cursor to the *original* line's start, which is now one line down
            // This is also heuristic as DOM structure might have changed significantly
            try {
                sel.removeAllRanges();
                sel.addRange(currentLineStartRange); // This range is now relative to new structure
            } catch(e) {/* ignore */}
        }
    } else {
        const { lineStart, lineText, fullText } = getCurrentLineInfo(element);
        const indentation = lineText.match(/^\s*/)[0];
        const textToInsert = indentation + '\n';
        replaceText(element, textToInsert, lineStart, lineStart, lineStart + indentation.length, lineStart + indentation.length);
    }
    showFeedbackMessage("Line Inserted Above", element, globalSettings);
}

function handleMoveLine(element, direction, globalSettings) { 
    if (element.isContentEditable || element.tagName.toLowerCase() === 'input') {
        showFeedbackMessage("Move line: Textarea only", element, globalSettings); return;
    }
    const T = getTextareaHelper(element);
    const lines = T.value.split('\n');
    const { lineStart } = getCurrentLineInfo(element);
    const cursorLineIndex = T.value.substring(0, lineStart).split('\n').length -1;
    
    const originalSelStart = T.selectionStart;
    const originalSelEnd = T.selectionEnd;
    const startOffsetInLine = originalSelStart - lineStart;
    const endOffsetInLine = originalSelEnd - lineStart; // Could be different if selection spans multiple chars


    if (direction === 'down' && cursorLineIndex < lines.length - 1) {
        const lineToMove = lines.splice(cursorLineIndex, 1)[0];
        lines.splice(cursorLineIndex + 1, 0, lineToMove);
    } else if (direction === 'up' && cursorLineIndex > 0) {
        const lineToMove = lines.splice(cursorLineIndex, 1)[0];
        lines.splice(cursorLineIndex - 1, 0, lineToMove);
    } else {
        return; 
    }
    
    T.value = lines.join('\n');
    
    let newGlobalLineStart = 0;
    const targetLineIndex = direction === 'down' ? cursorLineIndex + 1 : cursorLineIndex - 1;
    for(let i=0; i < targetLineIndex; i++) {
        newGlobalLineStart += lines[i].length +1; 
    }
    // Ensure cursor stays within new line bounds
    const newLineLength = lines[targetLineIndex].length;
    const newCursorStart = Math.min(newGlobalLineStart + startOffsetInLine, newGlobalLineStart + newLineLength);
    const newCursorEnd = Math.min(newGlobalLineStart + endOffsetInLine, newGlobalLineStart + newLineLength);

    T.setSelection(newCursorStart, newCursorEnd);
    showFeedbackMessage(`Line Moved ${direction}`, element, globalSettings);
}

function handleCopyLineUpDown(element, direction, globalSettings) { 
    if (element.tagName.toLowerCase() === 'input') {
        const originalText = element.value;
        const selStart = element.selectionStart;
        const newText = direction === 'up' ? originalText + '\n' + originalText : originalText + '\n' + originalText; // Simplified for input
        replaceText(element, newText, 0, originalText.length, 
                    direction === 'up' ? selStart : selStart + originalText.length + 1,
                    direction === 'up' ? selStart : selStart + originalText.length + 1);
    } else {
        const { lineText, lineStart, lineEnd, fullText, currentSelection } = getCurrentLineInfo(element);
        const textToCopy = fullText.substring(lineStart, lineEnd) + (fullText[lineEnd] === '\n' || lineEnd === fullText.length ? '\n' : '');
        
        const cursorOffsetInLineStart = currentSelection.start - lineStart;
        const cursorOffsetInLineEnd = currentSelection.end - lineStart;

        if (direction === 'down') {
            replaceText(element, textToCopy, lineEnd + (fullText[lineEnd] === '\n' ? 1:0) , lineEnd + (fullText[lineEnd] === '\n' ? 1:0) );
            // Cursor moves to the *copied* line (VS Code behavior for copy down is cursor stays, for copy up it moves)
            // Let's make it consistent: cursor moves to the newly created line
            const newCursorLineStartPos = lineEnd + (fullText[lineEnd] === '\n' ? 1:0);
            setSelection(element, newCursorLineStartPos + cursorOffsetInLineStart, newCursorLineStartPos + cursorOffsetInLineEnd);

        } else { // up
            replaceText(element, textToCopy, lineStart, lineStart);
             // Cursor moves to the newly created (upper) line
            setSelection(element, lineStart + cursorOffsetInLineStart, lineStart + cursorOffsetInLineEnd);
        }
    }
    showFeedbackMessage(`Line Copied ${direction}`, element, globalSettings);
}

function handleUndo(element, globalSettings) { document.execCommand('undo'); showFeedbackMessage("Undo", element, globalSettings); }
function handleRedo(element, globalSettings) { document.execCommand('redo'); showFeedbackMessage("Redo", element, globalSettings); }

function handleSelectLine(element, globalSettings) {
    if (element.tagName.toLowerCase() === 'input') {
        setSelection(element, 0, element.value.length);
    } else {
        const { lineStart, lineEnd, fullText } = getCurrentLineInfo(element);
        const endPos = fullText[lineEnd] === '\n' ? lineEnd + 1 : lineEnd;
        setSelection(element, lineStart, endPos);
    }
    showFeedbackMessage("Line Selected", element, globalSettings);
}

function handleIndentSelection(element, direction, globalSettings) {
    indentSelectionOperation(element, direction); 
    showFeedbackMessage(direction === 'indent' ? "Indented" : "Outdented", element, globalSettings);
}

function handleSmartHome(element, globalSettings) {
    if (element.isContentEditable) {
        // Standard browser 'Home' is usually sufficient. Advanced smart home is too complex here.
        // Returning false would let the browser handle it if mainKeyDownHandler structure changes.
        // For now, we preventDefault if this handler is matched.
        showFeedbackMessage("Smart Home (ContentEditable: Native)", element, globalSettings);
        return false; // Let browser handle Home key for contenteditable
    }
    const T = getTextareaHelper(element);
    const { start: cursorPos } = T.getSelection();
    const { lineText, lineStart } = getCurrentLineInfo(element);
    const firstNonWhitespacePosInLine = lineText.match(/^\s*/)[0].length;
    const absoluteFirstNonWhitespace = lineStart + firstNonWhitespacePosInLine;

    if (cursorPos === absoluteFirstNonWhitespace && cursorPos !== lineStart) { // At first text, not col 0
        T.setSelection(lineStart, lineStart); // Go to true start
    } else { // Elsewhere, or at col 0
        T.setSelection(absoluteFirstNonWhitespace, absoluteFirstNonWhitespace); // Go to first non-whitespace
    }
    showFeedbackMessage("Smart Home", element, globalSettings);
    return true; // We handled it
}

function handleToggleLineCommentAction(element, mode, globalSettings) {
    toggleLineCommentOperation(element, mode); 
    showFeedbackMessage(mode === 'comment' ? "Line Comment Added" : mode === 'uncomment' ? "Line Comment Removed" : "Line Comment Toggled", element, globalSettings);
}

function handleToggleBlockCommentAction(element, globalSettings) {
    toggleBlockCommentOperation(element); 
    showFeedbackMessage("Block Comment Toggled", element, globalSettings);
}

function handleSelectWordOrNextOccurrenceAction(element, globalSettings) {
    selectWordOrNextOccurrenceLogic(element, globalSettings); 
    showFeedbackMessage("Selected Word / Next", element, globalSettings);
}

function transformSelectionText(element, transformFn, feedbackMsg, globalSettings) {
    const selDetails = getSelectionDetails(element);
    if (selDetails.collapsed) { 
        showFeedbackMessage("Select text to transform case", element, globalSettings);
        return;
    }
    const newText = transformFn(selDetails.selectedText);
    replaceText(element, newText, selDetails.start, selDetails.end, selDetails.start, selDetails.start + newText.length);
    showFeedbackMessage(feedbackMsg, element, globalSettings);
}

function handleToUpperCase(element, globalSettings) {
    transformSelectionText(element, (text) => text.toUpperCase(), "UPPERCASED", globalSettings);
}

function handleToLowerCase(element, globalSettings) {
    transformSelectionText(element, (text) => text.toLowerCase(), "lowercased", globalSettings);
}

function handleToTitleCase(element, globalSettings) {
    transformSelectionText(element, (text) => 
        text.toLowerCase().replace(/(?:^|\s|-)\S/g, char => char.toUpperCase()) // Improved Title Case for hyphens too
    , "Title Cased", globalSettings);
}

function handleTrimTrailingWhitespaceAction(element, globalSettings) {
    if (element.isContentEditable) {
        showFeedbackMessage("Trim Whitespace (Textarea/Input only)", element, globalSettings);
        return;
    }

    const T = getTextareaHelper(element);
    const sel = T.getSelection();
    const originalValue = T.value;
    let newValue = originalValue; // Initialize with original
    let newSelStart = sel.start;
    let newSelEnd = sel.end;
    let trimmed = false;

    if (sel.start === sel.end) { // No selection, trim current line
        const { lineStart, lineEnd, lineText } = getCurrentLineInfo(element);
        const trimmedLine = lineText.replace(/\s+$/, '');
        if (trimmedLine.length !== lineText.length) {
            newValue = originalValue.substring(0, lineStart) + trimmedLine + originalValue.substring(lineEnd);
            if (sel.start > lineStart + trimmedLine.length) { // Cursor was in trimmed part
                newSelStart = newSelEnd = lineStart + trimmedLine.length;
            }
            trimmed = true;
        }
    } else { // Selection exists, trim trailing whitespace on each selected line
        let { lineStart: firstLineStartSel } = getLineBoundaries(originalValue, sel.start);
        // Ensure lastLineActualEnd is the true end of the line containing sel.end
        let { lineStart: selEndLineStart, lineEnd: selEndLineEnd } = getLineBoundaries(originalValue, sel.end > sel.start ? sel.end -1 : sel.end);
        
        const affectedTextOriginal = originalValue.substring(firstLineStartSel, selEndLineEnd);
        const lines = affectedTextOriginal.split('\n');
        const trimmedLines = lines.map(line => line.replace(/\s+$/, ''));
        const newAffectedText = trimmedLines.join('\n');

        if (affectedTextOriginal !== newAffectedText) {
            newValue = originalValue.substring(0, firstLineStartSel) + newAffectedText + originalValue.substring(selEndLineEnd);
            const lengthDiff = affectedTextOriginal.length - newAffectedText.length;
            newSelEnd = Math.max(sel.start, sel.end - lengthDiff); // Adjust selection end
            trimmed = true;
        }
    }
    
    if (trimmed) {
        T.value = newValue;
        T.setSelection(newSelStart, newSelEnd);
        showFeedbackMessage("Trailing Whitespace Trimmed", element, globalSettings);
    } else {
        showFeedbackMessage("No trailing whitespace found", element, globalSettings);
    }
}