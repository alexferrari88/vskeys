// __tests__/unit/content_operations.unit.test.js

// Mock dependencies from content_utils.js
const mockGetTextareaHelper = jest.fn();
const mockGetSelectionDetails = jest.fn();

// Define mockSetSelection with implementation to update element state
const mockSetSelection = jest.fn((element, start, end) => {
    if (element) { 
        element.selectionStart = start;
        element.selectionEnd = end;
    }
});

const mockReplaceText = jest.fn();
const mockGetLineBoundaries = jest.fn();
const mockGetCurrentLineInfo = jest.fn(); 
const mockShowFeedbackMessage = jest.fn();

// Assign mocks to global for content_operations.js to access them
global.getTextareaHelper = mockGetTextareaHelper;
global.getSelectionDetails = mockGetSelectionDetails;
global.setSelection = mockSetSelection; // Use the implemented mock
global.replaceText = mockReplaceText;
global.getLineBoundaries = mockGetLineBoundaries;
global.getCurrentLineInfo = mockGetCurrentLineInfo; 
global.showFeedbackMessage = mockShowFeedbackMessage;


jest.mock('../../src/content_utils.js', () => ({
    getTextareaHelper: mockGetTextareaHelper,
    getSelectionDetails: mockGetSelectionDetails,
    setSelection: mockSetSelection, // Ensure module mock also uses the implemented one
    replaceText: mockReplaceText,
    getLineBoundaries: mockGetLineBoundaries,
    getCurrentLineInfo: mockGetCurrentLineInfo,
    showFeedbackMessage: mockShowFeedbackMessage,
}));


const {
    indentSelectionOperation,
    toggleLineCommentOperation,
    toggleBlockCommentOperation,
    selectWordOrNextOccurrenceLogic,
} = require('../../src/content_operations.js');

const mockGlobalSettings = {
    showFeedback: true, 
};


describe('content_operations.js', () => {

    const setupTextareaMocks = (initialValue, selectionStart, selectionEnd, isContentEditable = false) => {
        const mockElement = { 
            value: initialValue,
            selectionStart: selectionStart,
            selectionEnd: selectionEnd,
            isContentEditable: isContentEditable, 
            textContent: isContentEditable ? initialValue : null, 
        };
        
        // T object directly reflects mockElement's current state
        mockGetTextareaHelper.mockReturnValue({
            el: mockElement, 
            get value() { return mockElement.value; },
            set value(v) { 
                mockElement.value = v; 
                if (mockElement.isContentEditable) mockElement.textContent = v;
            },
            get selectionStart() { return mockElement.selectionStart; },
            set selectionStart(v) { mockElement.selectionStart = v; },
            get selectionEnd() { return mockElement.selectionEnd; },
            set selectionEnd(v) { mockElement.selectionEnd = v; },
            getSelection: () => ({ start: mockElement.selectionStart, end: mockElement.selectionEnd }),
            setSelection: (start, end) => { 
                mockElement.selectionStart = start;
                mockElement.selectionEnd = end;
                global.setSelection(mockElement, start, end); 
            },
        });

        mockGetSelectionDetails.mockImplementation((elPassed) => {
            const targetElement = (elPassed === mockElement || (elPassed && typeof elPassed.value === 'string')) ? elPassed : mockElement;
            const currentVal = targetElement.isContentEditable ? targetElement.textContent : targetElement.value;
            const currentSelStart = targetElement.selectionStart;
            const currentSelEnd = targetElement.selectionEnd;

            return {
                start: currentSelStart,
                end: currentSelEnd,
                selectedText: String(currentVal).substring(currentSelStart, currentSelEnd),
                collapsed: currentSelStart === currentSelEnd,
            };
        });
        
        mockGetLineBoundaries.mockImplementation((text, cursorPos) => {
            if (typeof text !== 'string') text = "";
            let lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
            let lineEnd = text.indexOf('\n', cursorPos);
            if (lineEnd === -1) lineEnd = text.length;
            return { lineStart, lineEnd };
        });

        mockReplaceText.mockImplementation((elementPassedToReplaceText, newText, start, end, newCursorStart, newCursorEnd) => {
            const targetElementForReplace = (elementPassedToReplaceText === mockElement || (elementPassedToReplaceText && typeof elementPassedToReplaceText.value === 'string')) ? elementPassedToReplaceText : mockElement;
            
            const prevValue = targetElementForReplace.value;
            targetElementForReplace.value = String(prevValue).substring(0, start) + newText + String(prevValue).substring(end); 
            if (targetElementForReplace.isContentEditable) targetElementForReplace.textContent = targetElementForReplace.value;

            const finalCursorStart = newCursorStart !== undefined ? newCursorStart : start + newText.length;
            const finalCursorEnd = newCursorEnd !== undefined ? newCursorEnd : finalCursorStart;
            
            targetElementForReplace.selectionStart = finalCursorStart;
            targetElementForReplace.selectionEnd = finalCursorEnd;
        });

        return {
            mockElement, 
            getCurrentValue: () => mockElement.value, 
            getCurrentSelection: () => ({ start: mockElement.selectionStart, end: mockElement.selectionEnd }),
        };
    };
    
    function resetInternalCtrlDTerm(element) {
        const originalValue = element.value;
        const originalStart = element.selectionStart;
        const originalEnd = element.selectionEnd;

        element.value = "reset"; 
        element.selectionStart = 0; 
        element.selectionEnd = 0; 
        selectWordOrNextOccurrenceLogic(element, mockGlobalSettings); 
        
        element.selectionStart = 0; 
        element.selectionEnd = 0; 
        element.value = "  "; 
        selectWordOrNextOccurrenceLogic(element, mockGlobalSettings); 

        element.value = originalValue;
        element.selectionStart = originalStart;
        element.selectionEnd = originalEnd;
        jest.clearAllMocks(); 
    }


    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('indentSelectionOperation', () => {
        it('should indent a single line at cursor', () => {
            const { mockElement, getCurrentValue, getCurrentSelection } = setupTextareaMocks("line one\nline two", 13, 13);
            indentSelectionOperation(mockElement, 'indent');
            expect(getCurrentValue()).toBe("line one\n\tline two");
            expect(getCurrentSelection()).toEqual({ start: 13 + 1, end: 13 + 1 });
        });

        it('should outdent a single line at cursor', () => {
            const { mockElement, getCurrentValue, getCurrentSelection } = setupTextareaMocks("line one\n\tline two", 14, 14); 
            indentSelectionOperation(mockElement, 'outdent');
            expect(getCurrentValue()).toBe("line one\nline two");
            expect(getCurrentSelection()).toEqual({ start: 14 - 1, end: 14 - 1 });
        });

        it('should indent multiple selected lines', () => {
            const initialText = "alpha\nbeta\ngamma";
            const { mockElement, getCurrentValue } = setupTextareaMocks(initialText, 0, initialText.length);
            indentSelectionOperation(mockElement, 'indent');
            expect(getCurrentValue()).toBe("\talpha\n\tbeta\n\tgamma");
            expect(mockSetSelection).toHaveBeenCalledWith(mockElement, 1, initialText.length + 3);
        });

        it('should outdent multiple selected lines with mixed indentation', () => {
            const initialText = "\tline one\n    line two\n  line three\nline four";
            const selStart = 0; 
            const selEnd = initialText.indexOf("line four") -1; 
            const { mockElement, getCurrentValue } = setupTextareaMocks(initialText, selStart, selEnd);
            indentSelectionOperation(mockElement, 'outdent');
            expect(getCurrentValue()).toBe("line one\nline two\nline three\nline four");
        });

        it('should not outdent if no leading tab or standard spaces', () => {
            const { mockElement, getCurrentValue, getCurrentSelection } = setupTextareaMocks("line one", 0, 0);
            indentSelectionOperation(mockElement, 'outdent');
            expect(getCurrentValue()).toBe("line one");
            expect(getCurrentSelection()).toEqual({ start: 0, end: 0 });
        });
         it('should correctly indent/outdent with selection ending on newline', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("line one\nline two", 0, 9);
            indentSelectionOperation(mockElement, 'indent');
            expect(getCurrentValue()).toBe("\tline one\nline two"); 
            expect(mockSetSelection).toHaveBeenCalledWith(mockElement, 1, 9 + 1);
        });
    });

    describe('toggleLineCommentOperation', () => {
        it('should comment out a single line', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("my code", 0, 7);
            toggleLineCommentOperation(mockElement, 'comment');
            expect(getCurrentValue()).toBe("// my code");
        });

        it('should uncomment a single line', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("// my code", 0, 10);
            toggleLineCommentOperation(mockElement, 'uncomment');
            expect(getCurrentValue()).toBe("my code");
        });
        
        it('should toggle comment on a single line (comment)', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("my code", 0, 7);
            toggleLineCommentOperation(mockElement, 'toggle');
            expect(getCurrentValue()).toBe("// my code");
        });

        it('should toggle comment on a single line (uncomment)', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("// my code", 0, 10);
            toggleLineCommentOperation(mockElement, 'toggle');
            expect(getCurrentValue()).toBe("my code");
        });

        it('should comment multiple lines', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("line1\nline2", 0, 11);
            toggleLineCommentOperation(mockElement, 'comment');
            expect(getCurrentValue()).toBe("// line1\n// line2");
        });

        it('should uncomment multiple lines (all commented)', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("// line1\n// line2", 0, 17);
            toggleLineCommentOperation(mockElement, 'uncomment');
            expect(getCurrentValue()).toBe("line1\nline2");
        });
        
        it('should toggle comment on multiple lines (mixed -> all comment)', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("line1\n// line2\nline3", 0, 23);
            toggleLineCommentOperation(mockElement, 'toggle');
            expect(getCurrentValue()).toBe("// line1\n// // line2\n// line3"); 
        });

        it('should toggle comment on multiple lines (all commented -> all uncomment)', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("// line1\n// line2\n// line3", 0, 26);
            toggleLineCommentOperation(mockElement, 'toggle');
            expect(getCurrentValue()).toBe("line1\nline2\nline3");
        });

        it('should not comment empty lines', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("line1\n\nline3", 0, 12); 
            toggleLineCommentOperation(mockElement, 'comment');
            expect(getCurrentValue()).toBe("// line1\n\n// line3");
        });
         it('should preserve leading whitespace when commenting/uncommenting', () => {
            const { mockElement, getCurrentValue } = setupTextareaMocks("  line1\n    // line2", 0, 20);
            toggleLineCommentOperation(mockElement, 'toggle'); 
            expect(getCurrentValue()).toBe("  // line1\n    // // line2");
        });
    });
    
    describe('toggleBlockCommentOperation', () => {
        it('should add block comment to selection', () => {
            const { mockElement } = setupTextareaMocks("some text here", 5, 9); 
            toggleBlockCommentOperation(mockElement);
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "/*text*/", 5, 9, 5, 5 + "/*text*/".length);
        });

        it('should remove block comment from selection', () => {
            const { mockElement } = setupTextareaMocks("before /*commented part*/ after", 7, 24); 
            toggleBlockCommentOperation(mockElement);
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "commented part", 7, 24, 7, 7 + "commented part".length);
        });

        it('should add block comment if selection partially overlaps existing block comment', () => {
            const { mockElement } = setupTextareaMocks("/* outer */ text /* inner */", 12, 17); 
            toggleBlockCommentOperation(mockElement);
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "/*text */", 12, 17, 12, 12 + "/*text */".length);
        });
         it('should handle empty selection by wrapping nothing', () => {
            const { mockElement } = setupTextareaMocks("some text", 5, 5); 
            toggleBlockCommentOperation(mockElement);
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "/**/", 5, 5, 5, 5 + "/**/".length);
        });
    });

    describe('selectWordOrNextOccurrenceLogic', () => {
        it('should select word under cursor if selection is collapsed', () => {
            const { mockElement } = setupTextareaMocks("first second third", 0,0); 
            resetInternalCtrlDTerm(mockElement); 
            mockElement.value = "first second third"; 
            mockElement.selectionStart = 7; mockElement.selectionEnd = 7; 

            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings);
            expect(mockSetSelection).toHaveBeenCalledWith(mockElement, 6, 12); 
        });

        it('should select next occurrence if current selection matches last search term', () => {
            const { mockElement } = setupTextareaMocks("word1 word2 word1 word3", 0, 0); 
            resetInternalCtrlDTerm(mockElement);
            mockElement.value = "word1 word2 word1 word3";
            mockElement.selectionStart = 0; mockElement.selectionEnd = 0;
            
            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings); 
            expect(mockSetSelection).toHaveBeenLastCalledWith(mockElement, 0, 5); 

            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings); 
            expect(mockSetSelection).toHaveBeenLastCalledWith(mockElement, 12, 17); 
        });
        
        it('should wrap around to find first occurrence if at end', () => {
            const { mockElement } = setupTextareaMocks("term another term", 0, 0); 
            resetInternalCtrlDTerm(mockElement);
            mockElement.value = "term another term";
            mockElement.selectionStart = 0; mockElement.selectionEnd = 0;

            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings); 
            expect(mockSetSelection).toHaveBeenLastCalledWith(mockElement, 0, 4); 

            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings); 
            expect(mockSetSelection).toHaveBeenLastCalledWith(mockElement, 13, 17); 

            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings); 
            expect(mockSetSelection).toHaveBeenLastCalledWith(mockElement, 0, 4); 
        });

        it('should show feedback if no more occurrences found after current selection', () => {
            const { mockElement } = setupTextareaMocks("unique last", 0, 0);
            resetInternalCtrlDTerm(mockElement); 
            mockElement.value = "unique last"; 
            mockElement.selectionStart = 7; 
            mockElement.selectionEnd = 7;

            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings); 
            expect(mockSetSelection).toHaveBeenLastCalledWith(mockElement, 7, 11); 
            
            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings); 
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith(expect.stringContaining("No more occurrences of \"last\""), mockElement, mockGlobalSettings);
            expect(mockSetSelection).toHaveBeenCalledTimes(1); 
            expect(mockElement.selectionStart).toBe(7); 
            expect(mockElement.selectionEnd).toBe(11);
        });


        it('should select word at start of string if cursor is at 0 and word starts there', () => {
            const { mockElement } = setupTextareaMocks("word rest",0,0); 
            resetInternalCtrlDTerm(mockElement);
            mockElement.value = "word rest";
            mockElement.selectionStart = 0; mockElement.selectionEnd = 0;
            
            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings);
            expect(mockSetSelection).toHaveBeenCalledWith(mockElement, 0, 4); 
        });

        it('should do nothing if cursor is on whitespace and no prior search term (_lastSearchTermCtrlD is empty)', () => {
            const { mockElement } = setupTextareaMocks("word1  word2", 0,0); 
            resetInternalCtrlDTerm(mockElement); 
            mockElement.value = "word1  word2"; 
            mockElement.selectionStart = 6; mockElement.selectionEnd = 6; 

            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings);
            expect(mockSetSelection).not.toHaveBeenCalled(); 
        });

         it('should select word if cursor is immediately after it', () => {
            const { mockElement } = setupTextareaMocks("word ", 0,0); 
            resetInternalCtrlDTerm(mockElement);
            mockElement.value = "word "; 
            mockElement.selectionStart = 4; mockElement.selectionEnd = 4;
            
            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings);
            expect(mockSetSelection).toHaveBeenCalledWith(mockElement, 0, 4); 
        });

        it('should re-select the current word if selection is not collapsed but does not match _lastSearchTermCtrlD', () => {
            const { mockElement } = setupTextareaMocks("first second third",0,0);
            resetInternalCtrlDTerm(mockElement);
            mockElement.value = "first second third";
            mockElement.selectionStart = 0; mockElement.selectionEnd = 0;

            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings); 
            expect(mockSetSelection).toHaveBeenLastCalledWith(mockElement, 0, 5); 
            
            mockElement.selectionStart = 6; 
            mockElement.selectionEnd = 12; 
            mockSetSelection.mockClear(); 

            selectWordOrNextOccurrenceLogic(mockElement, mockGlobalSettings); 
            expect(mockSetSelection).not.toHaveBeenCalled();
        });
    });
});