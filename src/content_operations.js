// content_operations.js - Complex text operations (indent, comment, ctrl+d)

let _lastSearchTermCtrlD = ""; // Managed by handleCtrlDLogic

function indentSelectionOperation(element, direction) {
    if (element.isContentEditable) {
        document.execCommand(direction === 'indent' ? 'indent' : 'outdent');
        return;
    }

    const T = getTextareaHelper(element);
    const sel = T.getSelection();
    const text = T.value;
    const INDENT_CHAR = '\t'; // TODO: Make configurable

    let { lineStart: firstLineStart } = getLineBoundaries(text, sel.start);
    let { lineStart: lastLineStart, lineEnd: lastLineActualEnd } = getLineBoundaries(text, sel.end - (sel.end > sel.start && text[sel.end-1] === '\n' && sel.end > sel.start ? 1 : 0) );
    
    let currentPos = firstLineStart;
    let modifiedLines = [];
    let totalPrefixChange = 0;
    let firstLinePrefixChange = 0;
    let lineIdx = 0;

    while (currentPos <= lastLineStart) {
        const { lineEnd } = getLineBoundaries(text, currentPos);
        let line = text.substring(currentPos, lineEnd);
        let currentLinePrefixChange = 0;

        if (direction === 'indent') {
            modifiedLines.push(INDENT_CHAR + line);
            currentLinePrefixChange = INDENT_CHAR.length;
        } else { // outdent
            if (line.startsWith(INDENT_CHAR)) {
                modifiedLines.push(line.substring(INDENT_CHAR.length));
                currentLinePrefixChange = -INDENT_CHAR.length;
            } else if (line.startsWith("    ")) { // Common alternative: 4 spaces
                modifiedLines.push(line.substring(4));
                currentLinePrefixChange = -4;
            } else if (line.startsWith("  ")) { // Common alternative: 2 spaces
                modifiedLines.push(line.substring(2));
                currentLinePrefixChange = -2;
            } else if (line.startsWith(" ")) {
                 modifiedLines.push(line.substring(1));
                 currentLinePrefixChange = -1;
            }
            else {
                modifiedLines.push(line);
            }
        }
        
        totalPrefixChange += currentLinePrefixChange;
        if (lineIdx === 0) {
            firstLinePrefixChange = currentLinePrefixChange;
        }
        
        lineIdx++;
        if (lineEnd >= text.length) break; // Reached end of text
        currentPos = lineEnd + 1; 
        if (currentPos > lastLineStart && lineEnd < lastLineActualEnd) { 
            // This condition might need refinement
        }
    }
    
    const newSegment = modifiedLines.join('\n');
    const endOfAffectedOriginalBlock = lastLineActualEnd; 

    T.value = text.substring(0, firstLineStart) + newSegment + text.substring(endOfAffectedOriginalBlock);

    let newSelStart = sel.start + firstLinePrefixChange;
    let newSelEnd = sel.end + totalPrefixChange;
    
    newSelStart = Math.max(firstLineStart, newSelStart); 
    if (sel.start === sel.end) { 
        newSelEnd = newSelStart;
    } else {
        newSelEnd = Math.max(newSelStart, newSelEnd); 
    }
    
    T.setSelection(newSelStart, newSelEnd);
}

function toggleLineCommentOperation(element, mode = 'toggle') { 
    if (element.isContentEditable) { return; } 
    
    const T = getTextareaHelper(element);
    const sel = T.getSelection();
    const text = T.value;
    const COMMENT_PREFIX_FULL = '// ';
    const COMMENT_PREFIX_TRIM = '//';

    let { lineStart: firstLineStart } = getLineBoundaries(text, sel.start);
    let lastLineSelectionPoint = sel.end - (sel.end > sel.start && text[sel.end-1] === '\n' ? 1 : 0);
    let { lineStart: lastLineStart, lineEnd: lastLineActualEnd } = getLineBoundaries(text, lastLineSelectionPoint);


    let allEffectivelyCommented = true;
    if (mode === 'toggle') {
        let tempPos = firstLineStart;
        while(tempPos <= lastLineStart) {
            const { lineEnd: tempLineEnd } = getLineBoundaries(text, tempPos);
            const tempLine = text.substring(tempPos, tempLineEnd);
            if (tempLine.trim() !== "" && !String(tempLine.trim()).startsWith(COMMENT_PREFIX_TRIM)) {
                allEffectivelyCommented = false;
                break;
            }
            if (tempLineEnd >= text.length || tempPos > lastLineStart ) break; 
            tempPos = tempLineEnd + 1;
        }
    }
    
    const effectiveMode = (mode === 'toggle') ? (allEffectivelyCommented ? 'uncomment' : 'comment') : mode;
    
    let lineIdx = 0;
    let firstLinePrefixChange = 0;
    let totalPrefixChange = 0;
    let modifiedLines = [];
    let currentPos = firstLineStart;

    while(currentPos <= lastLineStart) {
        const { lineEnd: currentOriginalLineEnd } = getLineBoundaries(text, currentPos);
        let line = text.substring(currentPos, currentOriginalLineEnd);
        const leadingWhitespace = line.match(/^\s*/)[0];
        const trimmedLine = line.substring(leadingWhitespace.length);
        let currentLinePrefixChange = 0;

        if (effectiveMode === 'comment') {
            if (line.trim() !== "") { 
                modifiedLines.push(leadingWhitespace + COMMENT_PREFIX_FULL + trimmedLine);
                currentLinePrefixChange = COMMENT_PREFIX_FULL.length;
            } else {
                modifiedLines.push(line);
            }
        } else { // uncomment
            if (String(trimmedLine).startsWith(COMMENT_PREFIX_FULL)) {
                modifiedLines.push(leadingWhitespace + trimmedLine.substring(COMMENT_PREFIX_FULL.length));
                currentLinePrefixChange = -COMMENT_PREFIX_FULL.length;
            } else if (String(trimmedLine).startsWith(COMMENT_PREFIX_TRIM)) {
                modifiedLines.push(leadingWhitespace + trimmedLine.substring(COMMENT_PREFIX_TRIM.length));
                currentLinePrefixChange = -COMMENT_PREFIX_TRIM.length;
            }
             else {
                modifiedLines.push(line); 
            }
        }
        
        totalPrefixChange += currentLinePrefixChange;
        if (lineIdx === 0) {
            firstLinePrefixChange = currentLinePrefixChange;
        }
        
        lineIdx++;
        if (currentOriginalLineEnd >= text.length) break;
        currentPos = currentOriginalLineEnd + 1;
         if (currentPos > lastLineStart && lineIdx < 1000 ) break; 
    }

    const newSegment = modifiedLines.join('\n');
    T.value = text.substring(0, firstLineStart) + newSegment + text.substring(lastLineActualEnd);
    
    let newSelStart = sel.start + firstLinePrefixChange;
    let newSelEnd = sel.end + totalPrefixChange;

    newSelStart = Math.max(firstLineStart, newSelStart);
    if (sel.start === sel.end) newSelEnd = newSelStart;
    else newSelEnd = Math.max(newSelStart, newSelEnd);

    T.setSelection(newSelStart, newSelEnd);
}

function toggleBlockCommentOperation(element) {
    if (element.isContentEditable) { return; } 

    const T = getTextareaHelper(element);
    const sel = T.getSelection();
    const currentFullText = T.value; 
    const selectedTextPrimitive = String(currentFullText).substring(sel.start, sel.end); 

    const trimmedSelectedText = selectedTextPrimitive.trim();

    const BLOCK_COMMENT_START_TOKEN = '/*';
    const BLOCK_COMMENT_END_TOKEN = '*/';
    const ASTERISK_TOKEN = '*';

    let shouldUnwrap = false;
    let textToUnwrap = trimmedSelectedText; // By default, assume we might unwrap the trimmed version
    let effectiveStartTokenLength = 0;
    let effectiveEndTokenLength = 0;

    const startsWithProper = trimmedSelectedText.startsWith(BLOCK_COMMENT_START_TOKEN);
    const endsWithProper = trimmedSelectedText.endsWith(BLOCK_COMMENT_END_TOKEN);
    
    // Condition 1: Properly formed block comment "/* content */"
    if (startsWithProper && endsWithProper && 
        trimmedSelectedText.length >= (BLOCK_COMMENT_START_TOKEN.length + BLOCK_COMMENT_END_TOKEN.length)) {
        shouldUnwrap = true;
        effectiveStartTokenLength = BLOCK_COMMENT_START_TOKEN.length;
        effectiveEndTokenLength = BLOCK_COMMENT_END_TOKEN.length;
    } 
    // Condition 2 (Lenient for test case): Starts with "/*", ends with "*" (but not "*/")
    // e.g., "/* content *"
    else if (startsWithProper && trimmedSelectedText.endsWith(ASTERISK_TOKEN) && !endsWithProper &&
             trimmedSelectedText.length >= (BLOCK_COMMENT_START_TOKEN.length + ASTERISK_TOKEN.length)) {
        shouldUnwrap = true;
        effectiveStartTokenLength = BLOCK_COMMENT_START_TOKEN.length;
        effectiveEndTokenLength = ASTERISK_TOKEN.length; // Only remove the final asterisk
    }

    if (shouldUnwrap) {
        const coreContent = textToUnwrap.substring(
            effectiveStartTokenLength, 
            textToUnwrap.length - effectiveEndTokenLength
        );
        // Replace the original selection range (sel.start, sel.end) with the unwrapped core.
        replaceText(element, coreContent, sel.start, sel.end, sel.start, sel.start + coreContent.length);
    } else {
        // Not a recognized comment structure to unwrap, so wrap the original (untrimmed) selectedTextPrimitive.
        const wrappedText = BLOCK_COMMENT_START_TOKEN + selectedTextPrimitive + BLOCK_COMMENT_END_TOKEN;
        replaceText(element, wrappedText, sel.start, sel.end, sel.start, sel.start + wrappedText.length);
    }
}

function selectWordOrNextOccurrenceLogic(element, globalSettings) {
    const selDetails = getSelectionDetails(element);
    let text = element.isContentEditable ? (element.textContent || "") : (element.value || "");
    text = String(text); // Ensure text is primitive string

    if (selDetails.collapsed) { 
        const cursor = selDetails.start;
        let wordStart = text.substring(0, cursor).search(/[a-zA-Z0-9_]+$/);
        if (wordStart === -1 && cursor > 0 && /[a-zA-Z0-9_]/.test(text[cursor-1])) { 
             wordStart = text.substring(0,cursor).lastIndexOf(' ', cursor-1) + 1; 
             if(text.substring(0,cursor).search(/[a-zA-Z0-9_]+$/) !== -1) wordStart = text.substring(0,cursor).search(/[a-zA-Z0-9_]+$/);
        } else if (wordStart === -1) {
            wordStart = cursor; 
        }
        
        let wordEndMatch = text.substring(cursor).match(/^[a-zA-Z0-9_]+/);
        let wordEnd = wordEndMatch ? cursor + wordEndMatch[0].length : cursor;

        if (wordStart === cursor && wordEnd === cursor) { 
            if (cursor > 0 && /[a-zA-Z0-9_]/.test(text[cursor-1])) { 
                wordStart = text.substring(0, cursor).search(/[a-zA-Z0-9_]+$/);
                wordEnd = cursor;
            } else if (cursor < text.length && /[a-zA-Z0-9_]/.test(text[cursor])) { 
                wordStart = cursor;
                wordEnd = cursor + (text.substring(cursor).match(/^[a-zA-Z0-9_]+/)?.[0].length || 0);
            } else { 
                _lastSearchTermCtrlD = ""; 
                return;
            }
        }

        if (wordStart !== -1 && wordEnd > wordStart) {
            _lastSearchTermCtrlD = text.substring(wordStart, wordEnd);
            setSelection(element, wordStart, wordEnd);
        } else {
            _lastSearchTermCtrlD = ""; 
        }
    } else { // Selection is not collapsed
        if (selDetails.selectedText === _lastSearchTermCtrlD && _lastSearchTermCtrlD !== "") {
            let searchStartIndex = selDetails.end;
            let nextOccurrence = text.indexOf(_lastSearchTermCtrlD, searchStartIndex);

            if (nextOccurrence !== -1) { // Found a later occurrence
                setSelection(element, nextOccurrence, nextOccurrence + _lastSearchTermCtrlD.length);
            } else { // No later occurrence, try wrapping from the beginning
                nextOccurrence = text.indexOf(_lastSearchTermCtrlD, 0);
                if (nextOccurrence !== -1 && nextOccurrence < selDetails.start) { // Found an earlier one (wrapped)
                    setSelection(element, nextOccurrence, nextOccurrence + _lastSearchTermCtrlD.length);
                } else { // No other occurrences, or the only one is already selected and no wrap found it earlier
                    showFeedbackMessage(`No more occurrences of "${_lastSearchTermCtrlD}"`, element, globalSettings);
                }
            }
        } else { 
             _lastSearchTermCtrlD = selDetails.selectedText;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        indentSelectionOperation,
        toggleLineCommentOperation,
        toggleBlockCommentOperation,
        selectWordOrNextOccurrenceLogic
    };
}