// __tests__/unit/content_actions.unit.test.js
// Globally scoped variable to mimic the one in content_script.js that handlePaste modifies
global._extensionHandledPaste = false;

// Mock functions that content_actions.js expects to be global
const mockGetSelectionDetails = jest.fn();
const mockGetCurrentLineInfo = jest.fn();
const mockReplaceText = jest.fn();
const mockShowFeedbackMessage = jest.fn();
const mockSetSelection = jest.fn(); 
let mockGetTextareaHelper = jest.fn(); 
let mockGetLineBoundaries = jest.fn(); 

// Mock functions from content_operations.js
const mockIndentSelectionOperation = jest.fn();
const mockToggleLineCommentOperation = jest.fn();
const mockToggleBlockCommentOperation = jest.fn();
const mockSelectWordOrNextOccurrenceLogic = jest.fn();

// Assign mocks to global BEFORE requiring content_actions.js
global.getSelectionDetails = mockGetSelectionDetails;
global.getCurrentLineInfo = mockGetCurrentLineInfo;
global.replaceText = mockReplaceText;
global.showFeedbackMessage = mockShowFeedbackMessage;
global.setSelection = mockSetSelection; 

global.indentSelectionOperation = mockIndentSelectionOperation;
global.toggleLineCommentOperation = mockToggleLineCommentOperation;
global.toggleBlockCommentOperation = mockToggleBlockCommentOperation;
global.selectWordOrNextOccurrenceLogic = mockSelectWordOrNextOccurrenceLogic;

const mockClipboardReadText = jest.fn();
const mockClipboardWriteText = jest.fn();

jest.spyOn(global, 'navigator', 'get').mockImplementation(() => ({
    clipboard: {
        readText: mockClipboardReadText,
        writeText: mockClipboardWriteText,
    }
}));

const mockExecCommand = jest.fn();

if (typeof global.document !== 'undefined') {
    // @ts-ignore
    global.document.execCommand = mockExecCommand;
} else {
    // @ts-ignore
    global.document = { execCommand: mockExecCommand };
}

const originalCreateElement = global.document.createElement;
global.document.createElement = jest.fn((tagName) => {
    if (tagName.toLowerCase() === 'div') {
        const divMock = {
            _innerText: '',
            _innerHTML: '',
            // @ts-ignore
            style: {}, 
            appendChild: jest.fn(),
            // @ts-ignore
            parentNode: global.document.body, 
            remove: jest.fn(function() { if(this.parentNode) this.parentNode.removeChild(this); }),
            getBoundingClientRect: jest.fn(() => ({
                width: 100, height: 20, top: 10, left: 10, bottom: 30, right: 110,
                x: 10, y: 10, toJSON: () => {}
            })),
        };
        Object.defineProperty(divMock, 'innerText', {
            get: () => divMock._innerText,
            set: (val) => {
                divMock._innerText = String(val);
                divMock._innerHTML = String(val)
                                    .replace(/&/g, '&')
                                    .replace(/</g, '<')
                                    .replace(/>/g, '>'); 
            },
            configurable: true
        });
        Object.defineProperty(divMock, 'innerHTML', {
            get: () => divMock._innerHTML,
            set: (val) => {
                divMock._innerHTML = String(val);
                const temp = originalCreateElement.call(global.document, 'div');
                temp.innerHTML = String(val);
                divMock._innerText = temp.textContent || "";
            },
            configurable: true
        });
        return divMock;
    }
    const element = originalCreateElement.call(global.document, tagName);
    // @ts-ignore
    if (!element.style) element.style = {};
    // @ts-ignore
    if (!element.appendChild) element.appendChild = jest.fn();
    // @ts-ignore
    if (!element.getBoundingClientRect) {
        // @ts-ignore
        element.getBoundingClientRect = jest.fn(() => ({
            width: 100, height: 20, top: 10, left: 10, bottom: 30, right: 110,
            x: 10, y: 10, toJSON: () => {}
        }));
    }
    return element;
});


if (global.document && !global.document.body) {
    // @ts-ignore
    global.document.body = global.document.createElement('body');
    // @ts-ignore
    global.document.body.appendChild = jest.fn(); 
    // @ts-ignore
    global.document.body.removeChild = jest.fn();
    // @ts-ignore
    global.document.body.contains = jest.fn(() => true);
}


const mockSelectionObject = {
    removeAllRanges: jest.fn(),
    addRange: jest.fn(),
    getRangeAt: jest.fn(() => {
        return {
            selectNodeContents: jest.fn(),
            setEnd: jest.fn(),
            setStart: jest.fn(),
            collapse: jest.fn(),
            deleteContents: jest.fn(),
            insertNode: jest.fn(),
            // @ts-ignore
            commonAncestorContainer: global.document.body,
            // @ts-ignore
            startContainer: global.document.body,
            // @ts-ignore
            endContainer: global.document.body,
            startOffset: 0,
            endOffset: 0,
        };
    }),
    rangeCount: 1,
    toString: jest.fn(() => ""),
    modify: jest.fn(),
};

if (typeof global.window !== 'undefined') {
    // @ts-ignore
    global.window.getSelection = jest.fn(() => mockSelectionObject);
    // @ts-ignore
    if (global.window.innerHeight === undefined) global.window.innerHeight = 768;
    // @ts-ignore
    if (global.window.innerWidth === undefined) global.window.innerWidth = 1024;
    // @ts-ignore
    if (global.window.pageYOffset === undefined) global.window.pageYOffset = 0;
    // @ts-ignore
    if (global.window.pageXOffset === undefined) global.window.pageXOffset = 0;
} else {
    // @ts-ignore
    global.window = {
        getSelection: jest.fn(() => mockSelectionObject),
        innerHeight: 768,
        innerWidth: 1024,
        pageYOffset: 0,
        pageXOffset: 0,
    };
}

// Now require the module under test - moved after global mocks are fully set up.
const {
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
} = require('../../src/content_actions.js');


describe('Content Actions Unit Tests', () => {
    let mockElement;
    const mockGlobalSettings = { showFeedback: true, feedbackDuration: 100 };
    let sharedTextareaHelperInstance; 
    let currentTestNameForLog = ""; // Helper for logging

    beforeEach(() => {
        // @ts-ignore
        currentTestNameForLog = expect.getState().currentTestName; // Get current test name for logs
        jest.clearAllMocks(); 
        global._extensionHandledPaste = false; 
        mockExecCommand.mockReturnValue(true);
        mockSelectionObject.toString.mockReturnValue("");
        mockSelectionObject.rangeCount = 1;

        mockGetTextareaHelper = jest.fn();
        global.getTextareaHelper = mockGetTextareaHelper;
        
        mockGetLineBoundaries = jest.fn();
        mockGetLineBoundaries.mockImplementation((text, cursorPos) => {
            // Basic default implementation for getLineBoundaries if not specifically mocked by .mockReturnValueOnce
            // This helps tests that might call it unexpectedly or without a specific mock setup.
            if (typeof text !== 'string') text = "";
            let lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
            let lineEnd = text.indexOf('\n', cursorPos);
            if (lineEnd === -1) lineEnd = text.length;
            // console.log(`[Test Mock Impl (${currentTestNameForLog || "Unknown"})] getLineBoundaries called with cursorPos: ${cursorPos}, text: "${String(text).substring(0,30)}..." -> returning {${lineStart}, ${lineEnd}}`);
            return { lineStart, lineEnd };
        });
        global.getLineBoundaries = mockGetLineBoundaries;


        mockElement = {
            value: '',
            selectionStart: 0,
            selectionEnd: 0,
            tagName: 'TEXTAREA', 
            isContentEditable: false,
            focus: jest.fn(),
            split: (char) => String(mockElement.value).split(char),
            substring: (start, end) => String(mockElement.value).substring(start, end),
            innerHTML: '',
            textContent: '',
            // @ts-ignore
            getBoundingClientRect: jest.fn(() => ({ width: 100, height: 20, top: 10, left: 10, bottom: 30, right: 110, x:10, y:10, toJSON: () => {} })),
        };
        
        sharedTextareaHelperInstance = {
            el: mockElement, 
            get value() { return this.el.value; },
            set value(v) { 
                this.el.value = v; 
                if(this.el.isContentEditable) this.el.textContent = v; 
            },
            get selectionStart() { return this.el.selectionStart; },
            set selectionStart(s) { this.el.selectionStart = s; },
            get selectionEnd() { return this.el.selectionEnd; },
            set selectionEnd(e) { this.el.selectionEnd = e; },
            getSelection: jest.fn(function() { return ({ start: this.el.selectionStart, end: this.el.selectionEnd }); }),
            setSelection: jest.fn(function(start, end) {
                this.el.selectionStart = start;
                this.el.selectionEnd = end;
                global.setSelection(this.el, start, end); 
            }),
        };
        mockGetTextareaHelper.mockImplementation(elPassed => {
            sharedTextareaHelperInstance.el = elPassed || mockElement;
            return sharedTextareaHelperInstance;
        });

        mockGetSelectionDetails.mockImplementation(() => ({
            start: mockElement.selectionStart,
            end: mockElement.selectionEnd,
            selectedText: mockElement.isContentEditable ? 
                          String(mockElement.textContent).substring(mockElement.selectionStart, mockElement.selectionEnd) :
                          String(mockElement.value).substring(mockElement.selectionStart, mockElement.selectionEnd),
            collapsed: mockElement.selectionStart === mockElement.selectionEnd,
        }));

        // IMPORTANT: mockGetCurrentLineInfo uses global.getLineBoundaries.
        // So, when testing SUT functions that call getCurrentLineInfo, the mockGetLineBoundaries
        // will be called from within this mockGetCurrentLineInfo.
        mockGetCurrentLineInfo.mockImplementation(() => {
            const text = mockElement.isContentEditable ? String(mockElement.textContent) : String(mockElement.value);
            const cursorPos = mockElement.selectionStart;
            // This call uses the globally mocked getLineBoundaries
            const { lineStart, lineEnd } = global.getLineBoundaries(text, cursorPos); 
            
            return {
                lineText: text.substring(lineStart, lineEnd),
                lineStart,
                lineEnd,
                fullText: text,
                currentSelection: { start: mockElement.selectionStart, end: mockElement.selectionEnd }
            };
        });
        
        mockClipboardWriteText.mockResolvedValue(undefined);
        mockClipboardReadText.mockResolvedValue('');
    });


    describe('handleCutLine', () => {
        it('should cut line for textarea with empty selection', async () => {
            mockElement.value = "First line\nSecond line\nThird line";
            mockElement.selectionStart = mockElement.selectionEnd = "First line\n".length + 3; 
            
            // getCurrentLineInfo will call getLineBoundaries. Setup for that:
            // Cursor on "Sec[o]nd line". "Second line" starts at 11, ends at 22 (before \n).
            mockGetLineBoundaries.mockReturnValueOnce({ lineStart: 11, lineEnd: 22}); 

            await handleCutLine(mockElement, mockGlobalSettings);

            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith("Second line\n");
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "", 11, 23, 11, 11);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Line Cut", mockElement, mockGlobalSettings);
        });

        it('should cut selection for textarea with non-empty selection', async () => {
            mockElement.value = "Cut this selected text";
            mockElement.selectionStart = 4;
            mockElement.selectionEnd = 16; 
            mockGetSelectionDetails.mockReturnValue({
                start: 4, end: 16, selectedText: " this selected ", collapsed: false
            });
            // This path does not call getCurrentLineInfo or getLineBoundaries from SUT
            
            await handleCutLine(mockElement, mockGlobalSettings);

            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(" this selected ");
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "", 4, 16, 4, 4);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Selection Cut", mockElement, mockGlobalSettings);
        });

        it('should use document.execCommand for contenteditable', async () => {
            mockElement.isContentEditable = true;
            mockElement.tagName = 'DIV';
            mockGetSelectionDetails.mockReturnValue({ start: 0, end: 5, selectedText: "Hello", collapsed: false });

            await handleCutLine(mockElement, mockGlobalSettings);
            expect(mockExecCommand).toHaveBeenCalledWith('cut'); 
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Selection Cut", mockElement, mockGlobalSettings);
        });

        it('should cut entire content for input field with empty selection', async () => {
            mockElement.tagName = 'INPUT';
            mockElement.value = "Input content";
            mockElement.selectionStart = mockElement.selectionEnd = 0;
            mockGetSelectionDetails.mockReturnValue({ start: 0, end: 0, selectedText: "", collapsed: true });

            await handleCutLine(mockElement, mockGlobalSettings);

            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith("Input content");
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "", 0, "Input content".length, 0, 0);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Selection Cut", mockElement, mockGlobalSettings);
        });
    });

    describe('handleCopyLine', () => {
        it('should copy line with trailing newline for textarea empty selection', async () => {
            mockElement.value = "Line to copy\nNext line";
            mockElement.selectionStart = mockElement.selectionEnd = 0; 
            // getCurrentLineInfo will call getLineBoundaries.
            // "Line to copy" ends at index 12 (before \n).
            mockGetLineBoundaries.mockReturnValueOnce({lineStart: 0, lineEnd: 12});

            await handleCopyLine(mockElement, mockGlobalSettings);
            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith("Line to copy\n");
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Line Copied", mockElement, mockGlobalSettings);
        });
        
        it('should copy an empty line as a single newline character', async () => {
            mockElement.value = "First\n\nThird";
            mockElement.selectionStart = mockElement.selectionEnd = "First\n".length; // cursor on the empty line (index 6)
            // getCurrentLineInfo will call getLineBoundaries.
            // The empty line is at index 6, starts at 6, ends at 6.
            mockGetLineBoundaries.mockReturnValueOnce({lineStart: 6, lineEnd: 6}); 
            
            mockGetSelectionDetails.mockReturnValue({start:6, end:6, selectedText:"", collapsed:true});


            await handleCopyLine(mockElement, mockGlobalSettings);
            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith("\n");
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Line Copied", mockElement, mockGlobalSettings);
        });

        it('should copy selection as-is for textarea non-empty selection', async () => {
            mockElement.value = "Copy this selection";
            mockElement.selectionStart = 5;
            mockElement.selectionEnd = 9; 
            mockGetSelectionDetails.mockReturnValue({
                start: 5, end: 9, selectedText: "this", collapsed: false
            });

            await handleCopyLine(mockElement, mockGlobalSettings);
            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith("this");
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Selection Copied", mockElement, mockGlobalSettings);
        });
         it('should copy entire content for input field with empty selection', async () => {
            mockElement.tagName = 'INPUT';
            mockElement.value = "Input content to copy";
            mockElement.selectionStart = mockElement.selectionEnd = 0;
            mockGetSelectionDetails.mockReturnValue({ start: 0, end: 0, selectedText: "", collapsed: true });

            await handleCopyLine(mockElement, mockGlobalSettings);

            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith("Input content to copy");
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Input Content Copied", mockElement, mockGlobalSettings);
        });
    });

    describe('handlePaste', () => {
        it('should paste line correctly if clipboard ends with newline (textarea)', async () => {
            mockClipboardReadText.mockResolvedValue("Pasted line\n");
            mockElement.value = "Line 1\nLine 3";
            mockElement.selectionStart = mockElement.selectionEnd = "Line 1\n".length; // Cursor at start of "Line 3" (index 7)
            
            // getCurrentLineInfo will call getLineBoundaries for cursor at 7
            // "Line 3" starts at 7, ends at 13 (before end of string).
            mockGetLineBoundaries.mockReturnValueOnce({ lineStart: 7, lineEnd: 13 }); 
            mockGetSelectionDetails.mockReturnValue({ start: 7, end: 7, collapsed: true });

            await handlePaste(mockElement, mockGlobalSettings);

            expect(global._extensionHandledPaste).toBe(true);
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "Pasted line\n", 7, 7); 
            expect(mockSetSelection).toHaveBeenCalledWith(mockElement, 7 + "Pasted line\n".length, 7 + "Pasted line\n".length);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Line Pasted", mockElement, mockGlobalSettings);
        });

        it('should perform standard paste if clipboard does not end with newline (textarea)', async () => {
            mockClipboardReadText.mockResolvedValue("Pasted text");
            mockElement.value = "Some content";
            mockElement.selectionStart = mockElement.selectionEnd = 5; 
            mockGetSelectionDetails.mockReturnValue({ start: 5, end: 5, selectedText:"", collapsed: true });
            // This path doesn't call getCurrentLineInfo.
            
            await handlePaste(mockElement, mockGlobalSettings);

            expect(global._extensionHandledPaste).toBe(true);
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "Pasted text", 5, 5, 5 + "Pasted text".length, 5 + "Pasted text".length);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Pasted", mockElement, mockGlobalSettings);
        });

        it('should use execCommand("insertText") for standard paste in contenteditable', async () => {
            mockClipboardReadText.mockResolvedValue("Pasted CE text");
            mockElement.isContentEditable = true;
            mockElement.tagName = 'DIV';
            mockGetSelectionDetails.mockReturnValue({ start: 0, end: 0, selectedText:"", collapsed: true });
            // This path doesn't call getCurrentLineInfo.

            await handlePaste(mockElement, mockGlobalSettings);
            
            expect(global._extensionHandledPaste).toBe(true);
            expect(mockExecCommand).toHaveBeenCalledWith('insertText', false, "Pasted CE text");
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Pasted", mockElement, mockGlobalSettings);
        });

         it('should use execCommand("insertHTML") for line paste in contenteditable', async () => {
            mockClipboardReadText.mockResolvedValue("Pasted CE line\n"); 
            mockElement.isContentEditable = true;
            mockElement.tagName = 'DIV';
            mockElement.innerHTML = ""; 
            mockElement.textContent = "";
            mockElement.selectionStart = 0; mockElement.selectionEnd = 0;
            
            // getCurrentLineInfo will call getLineBoundaries. For empty content, lineStart=0, lineEnd=0.
            mockGetLineBoundaries.mockReturnValueOnce({ lineStart: 0, lineEnd: 0}); 
            mockGetSelectionDetails.mockReturnValue({ start: 0, end: 0, collapsed: true });

            await handlePaste(mockElement, mockGlobalSettings);
            
            expect(global._extensionHandledPaste).toBe(true);
            expect(mockSetSelection).toHaveBeenCalledWith(mockElement, 0, 0); 
            expect(mockExecCommand).toHaveBeenCalledWith('insertHTML', false, expect.stringContaining("Pasted CE line<br>"));
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Line Pasted", mockElement, mockGlobalSettings);
        });
    });

    describe('handleDeleteLine', () => {
        it('should delete the current line in textarea', async () => {
            mockElement.value = "Line one\nLine two to delete\nLine three";
            mockElement.selectionStart = mockElement.selectionEnd = "Line one\n".length + 5; // Cursor on "Line t[o] delete"
            // getCurrentLineInfo will call getLineBoundaries for cursor at 14.
            // "Line two to delete" starts at 9, ends at 27 (before \n).
            mockGetLineBoundaries.mockReturnValueOnce({lineStart: 9, lineEnd: 27});

            await handleDeleteLine(mockElement, mockGlobalSettings);
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "", 9, 28, 9, 9); 
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Line Deleted", mockElement, mockGlobalSettings);
        });

        it('should delete all content in input field', async () => {
            mockElement.tagName = 'INPUT';
            mockElement.value = "delete all this";
            // This path does not call getCurrentLineInfo
            await handleDeleteLine(mockElement, mockGlobalSettings);
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "", 0, "delete all this".length, 0, 0);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Line Deleted", mockElement, mockGlobalSettings);
        });
    });
    
    describe('handleSmartHome', () => {
        it('should go to first non-whitespace if at true line start (textarea)', () => {
            mockElement.value = "  indented line";
            mockElement.selectionStart = mockElement.selectionEnd = 0; 
            // SUT calls T.getSelection() -> mock
            // SUT calls getCurrentLineInfo() -> calls global.getLineBoundaries()
            // For "  indented line", line starts 0, ends 15.
            mockGetLineBoundaries.mockReturnValueOnce({ lineStart: 0, lineEnd: 15 }); 
            
            sharedTextareaHelperInstance.getSelection.mockReturnValue({start:0, end:0});

            const handled = handleSmartHome(mockElement, mockGlobalSettings);
            
            expect(sharedTextareaHelperInstance.setSelection).toHaveBeenCalledWith(2, 2); 
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Smart Home", mockElement, mockGlobalSettings);
            expect(handled).toBe(true);
        });

        it('should go to true line start if at first non-whitespace (textarea)', () => {
            mockElement.value = "  indented line";
            mockElement.selectionStart = mockElement.selectionEnd = 2; 
            mockGetLineBoundaries.mockReturnValueOnce({ lineStart: 0, lineEnd: 15 }); 
            sharedTextareaHelperInstance.getSelection.mockReturnValue({start:2, end:2});

            const handled = handleSmartHome(mockElement, mockGlobalSettings);

            expect(sharedTextareaHelperInstance.setSelection).toHaveBeenCalledWith(0, 0); 
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Smart Home", mockElement, mockGlobalSettings);
            expect(handled).toBe(true);
        });

        it('should return false for contenteditable to let browser handle it', () => {
            mockElement.isContentEditable = true;
            // This path does not call helpers that use getLineBoundaries
            const handled = handleSmartHome(mockElement, mockGlobalSettings);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Smart Home (ContentEditable: Native)", mockElement, mockGlobalSettings);
            expect(handled).toBe(false);
        });
    });

    describe('handleTrimTrailingWhitespaceAction', () => {
        it('should trim trailing whitespace from current line if no selection (textarea)', () => {
            mockElement.value = "Trim this line   \nNext line";
            mockElement.selectionStart = mockElement.selectionEnd = 5; // Cursor on "Trim [t]his line   "
            
            // Path calls getCurrentLineInfo, which calls getLineBoundaries.
            // For "Trim this line   ", line starts 0, ends 17 (before \n).
            mockGetLineBoundaries.mockReturnValueOnce({ lineStart: 0, lineEnd: 17 }); 
            
            sharedTextareaHelperInstance.getSelection.mockReturnValue({start:5, end:5});

            handleTrimTrailingWhitespaceAction(mockElement, mockGlobalSettings);

            expect(mockElement.value).toBe("Trim this line\nNext line"); 
            expect(sharedTextareaHelperInstance.setSelection).toHaveBeenCalledWith(5,5); 
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Trailing Whitespace Trimmed", mockElement, mockGlobalSettings);
        });

        it('should trim from selected lines (textarea)', () => {
            mockElement.value = "Line one   \nLine two  \nLine three"; // Length 11+1+10+1+10 = 33
            mockElement.selectionStart = 0;
            // Selection: "Line one   \nLine two  " (length 11+1+10 = 22)
            mockElement.selectionEnd = 22; 
            
            // getLineBoundaries(originalValue, sel.start=0) -> for "Line one   " (lineStart=0, lineEnd=11)
            mockGetLineBoundaries.mockReturnValueOnce({ lineStart: 0, lineEnd: 11 });
            // getLineBoundaries(originalValue, selEndForBoundarySearch=22) -> for "Line two  " (lineStart=12, lineEnd=22)
            mockGetLineBoundaries.mockReturnValueOnce({ lineStart: 12, lineEnd: 22 });

            sharedTextareaHelperInstance.getSelection.mockReturnValue({start:0, end: 22});

            handleTrimTrailingWhitespaceAction(mockElement, mockGlobalSettings);

            expect(mockElement.value).toBe("Line one\nLine two\nLine three"); 
            // Expected selection: "Line one\nLine two" (length 8+1+8 = 17)
            expect(sharedTextareaHelperInstance.setSelection).toHaveBeenCalledWith(0, 17); 
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Trailing Whitespace Trimmed", mockElement, mockGlobalSettings);
        });
        
        it('should show "No trailing whitespace" if none found (textarea)', () => {
            mockElement.value = "Clean line\nAnother clean one";
            mockElement.selectionStart = mockElement.selectionEnd = 0;
            // For "Clean line", lineStart=0, lineEnd=10.
            mockGetLineBoundaries.mockReturnValueOnce({ lineStart: 0, lineEnd: 10 }); 

            sharedTextareaHelperInstance.getSelection.mockReturnValue({start:0, end:0});

            handleTrimTrailingWhitespaceAction(mockElement, mockGlobalSettings);
            expect(mockElement.value).toBe("Clean line\nAnother clean one"); 
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("No trailing whitespace found", mockElement, mockGlobalSettings);
        });

        it('should show feedback if used on contenteditable', () => {
            mockElement.isContentEditable = true;
            handleTrimTrailingWhitespaceAction(mockElement, mockGlobalSettings);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Trim Whitespace (Textarea/Input only)", mockElement, mockGlobalSettings);
        });
    });
    
    ['handleIndentSelection', 'handleToggleLineCommentAction', 'handleSelectWordOrNextOccurrenceAction'].forEach(handlerName => {
        describe(handlerName, () => {
            it('should call the corresponding operation/logic function and show feedback', () => {
                let mockOpFnToVerify;
                let feedbackText = "Action Done";
                let arg1;

                switch(handlerName) {
                    case 'handleIndentSelection': 
                        mockOpFnToVerify = mockIndentSelectionOperation; 
                        feedbackText = "Indented"; 
                        arg1 = 'indent';
                        break;
                    case 'handleToggleLineCommentAction': 
                        mockOpFnToVerify = mockToggleLineCommentOperation; 
                        feedbackText = "Line Comment Toggled"; 
                        arg1 = 'toggle';
                        break;
                    case 'handleSelectWordOrNextOccurrenceAction': 
                        mockOpFnToVerify = mockSelectWordOrNextOccurrenceLogic; 
                        feedbackText = "Selected Word / Next"; 
                        break;
                }
                
                const actionFn = eval(handlerName); 
                if(arg1 !== undefined) actionFn(mockElement, arg1, mockGlobalSettings);
                else actionFn(mockElement, mockGlobalSettings);

                expect(mockOpFnToVerify).toHaveBeenCalledWith(mockElement, expect.anything());
                if(arg1) expect(mockOpFnToVerify).toHaveBeenCalledWith(mockElement, arg1); 
                else expect(mockOpFnToVerify).toHaveBeenCalledWith(mockElement, mockGlobalSettings); 

                expect(mockShowFeedbackMessage).toHaveBeenCalledWith(feedbackText, mockElement, mockGlobalSettings);
            });
        });
    });

     describe('handleToggleBlockCommentAction', () => {
        it('should call toggleBlockCommentOperation and show feedback', () => {
            handleToggleBlockCommentAction(mockElement, mockGlobalSettings);
            expect(mockToggleBlockCommentOperation).toHaveBeenCalledWith(mockElement);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Block Comment Toggled", mockElement, mockGlobalSettings);
        });
    });
    
    describe('transformSelectionText (called by toUpperCase, toLowerCase, toTitleCase)', () => {
        it('should transform selected text to UPPERCASE', () => {
            mockElement.value = "make me upper";
            mockElement.selectionStart = 8; mockElement.selectionEnd = 13; 
            mockGetSelectionDetails.mockReturnValue({start:8, end:13, selectedText:"upper", collapsed:false});

            handleToUpperCase(mockElement, mockGlobalSettings);
            expect(mockReplaceText).toHaveBeenCalledWith(mockElement, "UPPER", 8, 13, 8, 8+"UPPER".length);
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("UPPERCASED", mockElement, mockGlobalSettings);
        });
         it('should show feedback if selection is collapsed for case transformation', () => {
            mockGetSelectionDetails.mockReturnValue({start:0, end:0, selectedText:"", collapsed:true});
            handleToLowerCase(mockElement, mockGlobalSettings);
            expect(mockReplaceText).not.toHaveBeenCalled();
            expect(mockShowFeedbackMessage).toHaveBeenCalledWith("Select text to transform case", mockElement, mockGlobalSettings);
        });
    });
});