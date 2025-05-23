// src/content_actions.js
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
    let textToCopy = ""; // Initialize as empty string
    let feedback = "Selection Copied";

    if (selDetails.collapsed && element.tagName.toLowerCase() !== 'input') {
        
        const { lineStart, lineEnd, fullText } = getCurrentLineInfo(element);
        
        textToCopy = fullText.substring(lineStart, lineEnd); // Get the content of the line

        // CRITICAL: Ensure the copied "line" ALWAYS includes a newline character at the end.
        // This makes its content distinguishable for our paste logic.
        if (!textToCopy.endsWith('\n')) {
            textToCopy += '\n';
        }
        
        feedback = "Line Copied";

    } else { // Normal selection copy or input field copy
        
        if (element.isContentEditable) {
            // Contenteditable copy is complex. Browser's execCommand is used.
            // This means our paste logic might not identify it as a "line copy"
            // unless the copied HTML somehow translates to text ending in \n.
            // This is a known challenge for contenteditable.
            const didCopy = document.execCommand('copy');
            
            showFeedbackMessage(feedback, element, globalSettings);
            // We cannot reliably ensure \n is appended here for contenteditable without complex HTML parsing.
            // The paste logic will treat it as a standard paste.
            return; 
        } else { // textarea or input
            textToCopy = selDetails.selectedText;
            if (selDetails.collapsed && element.tagName.toLowerCase() === 'input') {
                textToCopy = element.value; 
                feedback = "Input Content Copied";
            }
            // For regular selection copy in textarea/input, we do NOT force a newline.
            // Only for "line copy" (empty selection context).
        }
    }

    if (typeof textToCopy === 'string' && textToCopy.length > 0) { // Only write if there's something to copy
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            showFeedbackMessage(feedback, element, globalSettings);
        } catch (err) {
            showFeedbackMessage("Copy failed (clipboard API error)", element, globalSettings);
        }
    } else if (selDetails.collapsed && element.tagName.toLowerCase() !== 'input' && textToCopy === '\n') {
        // Special case: copying an "empty" line still means copying the newline.
         try {
            await navigator.clipboard.writeText(textToCopy);
            showFeedbackMessage(feedback, element, globalSettings);
        } catch (err) {
            showFeedbackMessage("Copy failed (clipboard API error)", element, globalSettings);
        }
    }
    else {
        showFeedbackMessage("Nothing to copy", element, globalSettings);
    }
}

async function handlePaste(element, globalSettings) {
    
    _extensionHandledPaste = true; // Set flag: extension is attempting to handle

    try {
        const textToPaste = await navigator.clipboard.readText();
        
        if (typeof textToPaste !== 'string') {
             showFeedbackMessage("Clipboard empty or unreadable", element, globalSettings);
             return; 
        }

        const selDetails = getSelectionDetails(element);
        const clipboardContentIsLine = textToPaste.endsWith('\n');

        if (clipboardContentIsLine && selDetails.collapsed && element.tagName.toLowerCase() !== 'input') {
            let { lineStart, fullText } = getCurrentLineInfo(element);
            let textToInsert = textToPaste; 

            if (element.isContentEditable) {
                setSelection(element, lineStart, lineStart); 
                
                const tempDiv = document.createElement('div');
                tempDiv.innerText = textToInsert.replace(/\n$/, ''); 
                let htmlToInsert = tempDiv.innerHTML.replace(/\n/g, '<br>'); 
                if (textToInsert.endsWith('\n') && !htmlToInsert.endsWith('<br>')) {
                    htmlToInsert += '<br>';
                }
                document.execCommand('insertHTML', false, htmlToInsert);
                
            } else { // textarea
                replaceText(element, textToInsert, lineStart, lineStart);
                const newCursorPos = lineStart + textToInsert.length;
                setSelection(element, newCursorPos, newCursorPos);
            }
            showFeedbackMessage("Line Pasted", element, globalSettings);
        } else { 
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
        document.execCommand('insertHTML', false, '<br>');
    } else {
        const { lineEnd, lineText, fullText } = getCurrentLineInfo(element);
        const indentation = lineText.match(/^\s*/)[0];
        const textToInsert = '\n' + indentation;
        let effectiveLineEnd = lineEnd;
        replaceText(element, textToInsert, effectiveLineEnd, effectiveLineEnd, effectiveLineEnd + textToInsert.length, effectiveLineEnd + textToInsert.length);
    }
    showFeedbackMessage("Line Inserted Below", element, globalSettings);
}

function handleInsertLineAbove(element, globalSettings) {
    if (element.isContentEditable) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            sel.modify("move", "backward", "lineboundary");
            const currentLineStartRange = sel.getRangeAt(0).cloneRange(); 
            let indent = "";
            try {
                const lineCheckRange = document.createRange();
                lineCheckRange.setStart(currentLineStartRange.startContainer, 0); 
                lineCheckRange.setEnd(currentLineStartRange.startContainer, currentLineStartRange.startOffset);
                const textBeforeCursorInNode = lineCheckRange.toString();
                indent = textBeforeCursorInNode.match(/^\s*/)[0];
            } catch(e) {/*ignore*/}
            document.execCommand('insertHTML', false, indent + '<br>');
            try {
                sel.removeAllRanges();
                sel.addRange(currentLineStartRange); 
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
    const endOffsetInLine = originalSelEnd - lineStart; 

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
        const newText = direction === 'up' ? originalText + '\n' + originalText : originalText + '\n' + originalText; 
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
            const newCursorLineStartPos = lineEnd + (fullText[lineEnd] === '\n' ? 1:0);
            setSelection(element, newCursorLineStartPos + cursorOffsetInLineStart, newCursorLineStartPos + cursorOffsetInLineEnd);

        } else { // up
            replaceText(element, textToCopy, lineStart, lineStart);
            setSelection(element, lineStart + cursorOffsetInLineStart, lineStart + cursorOffsetInLineEnd);
        }
    }
    showFeedbackMessage(`Line Copied ${direction}`, element, globalSettings);
}


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
        showFeedbackMessage("Smart Home (ContentEditable: Native)", element, globalSettings);
        return false; 
    }
    const T = getTextareaHelper(element);
    const { start: cursorPos } = T.getSelection();
    const { lineText, lineStart } = getCurrentLineInfo(element);
    const firstNonWhitespacePosInLine = lineText.match(/^\s*/)[0].length;
    const absoluteFirstNonWhitespace = lineStart + firstNonWhitespacePosInLine;

    if (cursorPos === absoluteFirstNonWhitespace && cursorPos !== lineStart) { 
        T.setSelection(lineStart, lineStart); 
    } else { 
        T.setSelection(absoluteFirstNonWhitespace, absoluteFirstNonWhitespace); 
    }
    showFeedbackMessage("Smart Home", element, globalSettings);
    return true; 
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
        text.toLowerCase().replace(/(?:^|\s|-)\S/g, char => char.toUpperCase())
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
    let newValue = originalValue; 
    let newSelStart = sel.start;
    let newSelEnd = sel.end;
    let trimmed = false;

    if (sel.start === sel.end) { // No selection, trim current line
        const { lineStart, lineEnd, lineText } = getCurrentLineInfo(element); // This calls mocked getLineBoundaries
        const trimmedLine = lineText.replace(/\s+$/, '');
        if (trimmedLine.length !== lineText.length) {
            newValue = originalValue.substring(0, lineStart) + trimmedLine + originalValue.substring(lineEnd);
            if (sel.start > lineStart + trimmedLine.length) { 
                newSelStart = newSelEnd = lineStart + trimmedLine.length;
            }
            trimmed = true;
        }
    } else { // Selection exists, trim trailing whitespace on each selected line
        let { lineStart: firstLineStartSel } = getLineBoundaries(originalValue, sel.start); // Direct call 1
        
        let selEndForBoundarySearch = sel.end;
        // If selection ends ON a newline, we want the boundary for the character BEFORE that newline.
        if(sel.end > 0 && originalValue[sel.end-1] === '\n' && sel.end > sel.start) {
             selEndForBoundarySearch = sel.end -1;
        }
        // This call determines the end of the block of text to process for trimming.
        let {lineEnd: selEndLineEnd} = getLineBoundaries(originalValue, selEndForBoundarySearch); // Direct call 2

        const affectedTextOriginal = originalValue.substring(firstLineStartSel, selEndLineEnd);
        const lines = affectedTextOriginal.split('\n');
        const trimmedLines = lines.map(line => line.replace(/\s+$/, ''));
        const newAffectedText = trimmedLines.join('\n');

        if (affectedTextOriginal !== newAffectedText) {
            newValue = originalValue.substring(0, firstLineStartSel) + newAffectedText + originalValue.substring(selEndLineEnd);
            const lengthDiff = affectedTextOriginal.length - newAffectedText.length;
            
            newSelStart = sel.start; 
            newSelEnd = Math.max(newSelStart, sel.end - lengthDiff);

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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleCutLine,
        handleCopyLine,
        handlePaste,
        handleDeleteLine,
        handleInsertLineBelow,
        handleInsertLineAbove,
        handleMoveLine,
        handleCopyLineUpDown,
        handleSelectLine,
        handleIndentSelection,
        handleSmartHome,
        handleToggleLineCommentAction,
        handleToggleBlockCommentAction,
        handleSelectWordOrNextOccurrenceAction,
        handleToUpperCase,
        handleToLowerCase,
        handleToTitleCase,
        handleTrimTrailingWhitespaceAction
    };
}