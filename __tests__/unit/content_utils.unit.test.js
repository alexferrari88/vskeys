// __tests__/unit/content_utils.unit.test.js

const { DEFAULT_GLOBAL_SETTINGS } = require('../../src/common.js');

// Mock global navigator for IS_MAC_COMMON in common.js
global.navigator = {
    platform: 'MacIntel' // or 'Win32', 'Linux x86_64' for non-Mac
};
// const { IS_MAC_COMMON } = require('../../src/common.js'); // Not directly used in these tests

const {
    isEditable,
    getSelectionDetails,
    setSelection,
    getTextareaHelper, 
    getLineBoundaries,
    getCurrentLineInfo,
    replaceText,
    showFeedbackMessage, 
    FEEDBACK_MESSAGE_CLASS
} = require('../../src/content_utils.js');


describe('content_utils.js', () => {
    let testElement;

    const createElement = (type = 'input', attributes = {}, makeContentEditable = false) => {
        const el = document.createElement(type);
        Object.keys(attributes).forEach(attr => {
            if (attr === 'value' && (type === 'input' || type === 'textarea')) {
                el.value = attributes[attr];
            } else if (attr === 'innerHTML' && makeContentEditable) { // Use innerHTML for CE setup
                el.innerHTML = attributes[attr];
            } else if (attr === 'textContent' && makeContentEditable) {
                 el.textContent = attributes[attr];
            }
            else {
                 el[attr] = attributes[attr];
            }
        });
        if (makeContentEditable) {
            el.setAttribute('contenteditable', 'true');
            // Test-side JSDOM workaround: Ensure 'isContentEditable' property is true.
            // Real browsers derive .isContentEditable (boolean) from the attribute.
            Object.defineProperty(el, 'isContentEditable', {
                value: true,
                configurable: true,
                writable: true
            });
        }
        document.body.appendChild(el);
        return el;
    };

    afterEach(() => {
        document.body.innerHTML = '';
        const feedback = document.querySelector(`.${FEEDBACK_MESSAGE_CLASS}`);
        if(feedback) feedback.remove();
    });

    describe('isEditable', () => {
        it('should identify standard text input as editable', () => {
            testElement = createElement('input', { type: 'text' });
            expect(isEditable(testElement)).toBe(true);
        });

        it('should identify textarea as editable', () => {
            testElement = createElement('textarea');
            expect(isEditable(testElement)).toBe(true);
        });

        it('should identify contenteditable div as editable', () => {
            testElement = createElement('div', {}, true); 
            expect(isEditable(testElement)).toBe(true);
        });

        it('should identify input without type as editable (defaults to text)', () => {
            testElement = createElement('input');
            expect(isEditable(testElement)).toBe(true);
        });

        it('should identify specific input types as editable', () => {
            ['search', 'url', 'tel', 'password', 'email', 'number'].forEach(type => {
                testElement = createElement('input', { type });
                expect(isEditable(testElement)).toBe(true);
            });
        });

        it('should identify non-editable elements', () => {
            testElement = createElement('div'); 
            expect(isEditable(testElement)).toBe(false);
            testElement = createElement('input', { type: 'checkbox' });
            expect(isEditable(testElement)).toBe(false);
            testElement = createElement('button');
            expect(isEditable(testElement)).toBe(false);
        });

        it('should identify disabled elements as not editable', () => {
            testElement = createElement('input', { type: 'text', disabled: true });
            expect(isEditable(testElement)).toBe(false);
            testElement = createElement('textarea', { disabled: true });
            expect(isEditable(testElement)).toBe(false);
            
            testElement = createElement('div', {}, true);
            testElement.disabled = true; 
            expect(isEditable(testElement)).toBe(false);
        });

        it('should identify readonly elements as not editable', () => {
            testElement = createElement('input', { type: 'text', readOnly: true });
            expect(isEditable(testElement)).toBe(false);
            testElement = createElement('textarea', { readOnly: true });
            expect(isEditable(testElement)).toBe(false);
        });

        it('should return false for null or undefined element', () => {
            expect(isEditable(null)).toBe(false);
            expect(isEditable(undefined)).toBe(false);
        });
    });

    describe('getLineBoundaries', () => {
        const text = "First line\nSecond line\nThird line";
        it('should get boundaries for a line in the middle', () => {
            expect(getLineBoundaries(text, 15)).toEqual({ lineStart: 11, lineEnd: 22 });
        });
        it('should get boundaries for the first line', () => {
            expect(getLineBoundaries(text, 3)).toEqual({ lineStart: 0, lineEnd: 10 });
        });
        it('should get boundaries for the last line', () => {
            expect(getLineBoundaries(text, 25)).toEqual({ lineStart: 23, lineEnd: 33 });
        });
        it('should handle cursor at the beginning of a line', () => {
            expect(getLineBoundaries(text, 11)).toEqual({ lineStart: 11, lineEnd: 22 }); 
        });
        it('should handle cursor at the end of a line (before newline)', () => {
            expect(getLineBoundaries(text, 10)).toEqual({ lineStart: 0, lineEnd: 10 }); 
        });
        it('should handle cursor at the end of text (no trailing newline)', () => {
            expect(getLineBoundaries(text, 33)).toEqual({ lineStart: 23, lineEnd: 33 }); 
        });
        it('should handle text with no newlines', () => {
            const singleLineText = "Just one line";
            expect(getLineBoundaries(singleLineText, 5)).toEqual({ lineStart: 0, lineEnd: 13 });
        });
        it('should handle empty text', () => {
            expect(getLineBoundaries("", 0)).toEqual({ lineStart: 0, lineEnd: 0 });
        });
        it('should handle cursor position 0', () => {
            expect(getLineBoundaries(text, 0)).toEqual({ lineStart: 0, lineEnd: 10 });
        });
         it('should handle text starting with newline', () => {
            const textStartsWithNL = "\nSecond line";
            expect(getLineBoundaries(textStartsWithNL, 0)).toEqual({lineStart: 0, lineEnd: 0}); 
            expect(getLineBoundaries(textStartsWithNL, 1)).toEqual({lineStart: 1, lineEnd: 12}); 
        });
        it('should handle text ending with newline', () => {
            const textEndsWithNL = "First line\n";
            expect(getLineBoundaries(textEndsWithNL, 9)).toEqual({ lineStart: 0, lineEnd: 10 });
            expect(getLineBoundaries(textEndsWithNL, 11)).toEqual({ lineStart: 11, lineEnd: 11 });
        });
         it('should handle cursor at the very end of text with trailing newline', () => {
            const textWithTrailingNL = "Hello\nWorld\n"; // length 12. Cursor at 12 is after the last \n
            expect(getLineBoundaries(textWithTrailingNL, 12)).toEqual({ lineStart: 12, lineEnd: 12 });
        });
         it('should handle cursor right before a newline', () => {
            const text = "Line1\nLine2";
            expect(getLineBoundaries(text, 5)).toEqual({lineStart:0, lineEnd:5}); // Cursor at end of "Line1"
        });

    });

    describe('getSelectionDetails & setSelection', () => {
        describe('Input/Textarea', () => {
            beforeEach(() => {
                testElement = createElement('textarea', { value: 'Hello world' });
                testElement.focus(); 
            });

            it('should get selection details for collapsed cursor', () => {
                testElement.setSelectionRange(3, 3);
                const details = getSelectionDetails(testElement);
                expect(details).toEqual({ start: 3, end: 3, selectedText: "", collapsed: true });
            });

            it('should get selection details for a selection', () => {
                testElement.setSelectionRange(0, 5); 
                const details = getSelectionDetails(testElement);
                expect(details).toEqual({ start: 0, end: 5, selectedText: "Hello", collapsed: false });
            });

            it('should set a collapsed cursor', () => {
                setSelection(testElement, 6, 6);
                expect(testElement.selectionStart).toBe(6);
                expect(testElement.selectionEnd).toBe(6);
            });

            it('should set a selection range', () => {
                setSelection(testElement, 6, 11); 
                expect(testElement.selectionStart).toBe(6);
                expect(testElement.selectionEnd).toBe(11);
                expect(testElement.value.substring(testElement.selectionStart, testElement.selectionEnd)).toBe("world");
            });
        });

        describe('ContentEditable', () => {
            const setupContentEditable = (htmlContentOrText) => {
                // Use the enhanced createElement that also sets isContentEditable for JSDOM
                testElement = createElement('div', { innerHTML: htmlContentOrText }, true);
                testElement.focus();

                const selectRangeManually = (startNode, startOffset, endNode, endOffset) => {
                    if (!document.body.contains(startNode) && startNode !== testElement) { /* console.warn("Start node not in body for test selection") */ }
                    if (endNode && !document.body.contains(endNode) && endNode !== testElement) { /* console.warn("End node not in body for test selection") */ }

                    const range = document.createRange();
                    try {
                        range.setStart(startNode, startOffset);
                        range.setEnd(endNode, endOffset);
                        window.getSelection().removeAllRanges();
                        window.getSelection().addRange(range);
                    } catch (e) {
                        // console.warn("JSDOM manual selectRange helper error:", e.message);
                    }
                };
                return { element: testElement, selectRangeManually };
            };

            it('should get basic selection details for contenteditable (collapsed)', () => {
                const { element, selectRangeManually } = setupContentEditable('Hello world');
                const textNode = element.firstChild;
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    selectRangeManually(textNode, 3, textNode, 3); 
                    const details = getSelectionDetails(element);
                    expect(details.collapsed).toBe(true);
                    expect(details.selectedText).toBe("");
                    expect(details.start).toBe(3); // JSDOM specific, might be less reliable
                    expect(details.end).toBe(3);
                } else { fail("Test setup failed: no text node"); }
            });

            it('should get basic selection details for contenteditable (selection)', () => {
                const { element, selectRangeManually } = setupContentEditable('Hello world');
                const textNode = element.firstChild; 
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    selectRangeManually(textNode, 0, textNode, 5); 
                    const details = getSelectionDetails(element);
                    expect(details.selectedText).toBe("Hello"); 
                    expect(details.collapsed).toBe(false); 
                    expect(details.start).toBe(0);
                    expect(details.end).toBe(5);
                } else { fail("Test setup failed: no text node"); }
            });
            
            it('should get selection details with mixed content (selecting "two")', () => {
                const { element, selectRangeManually } = setupContentEditable('One <b>two</b> three');
                const boldTag = element.querySelector('b');
                if (boldTag && boldTag.firstChild && boldTag.firstChild.nodeType === Node.TEXT_NODE) {
                    const boldTextNode = boldTag.firstChild; // "two"
                    selectRangeManually(boldTextNode, 0, boldTextNode, 3); 
                    const details = getSelectionDetails(element);
                    expect(details.selectedText).toBe("two");
                    expect(details.start).toBe(4); // "One " is 4 chars. "two" starts after that.
                    expect(details.end).toBe(7);
                    expect(details.collapsed).toBe(false);
                } else { fail("Test setup for mixed content failed"); }
            });


            it('should set basic selection in contenteditable (collapsed)', () => {
                const { element } = setupContentEditable('Hello world');
                setSelection(element, 3, 3); 
                const selection = window.getSelection();
                expect(selection.isCollapsed).toBe(true); // Standard property
                if(selection.anchorNode && selection.anchorNode.nodeType === Node.TEXT_NODE){
                    expect(selection.anchorOffset).toBe(3); 
                }
            });

            it('should set basic selection in contenteditable (range)', () => {
                const { element } = setupContentEditable('Hello world');
                setSelection(element, 0, 5); 
                const selection = window.getSelection();
                expect(selection.toString()).toBe("Hello"); 
                if (selection.rangeCount > 0) { 
                    expect(selection.getRangeAt(0).collapsed).toBe(false); 
                } else { fail("No range found in selection");}
            });

             it('setSelection in empty contenteditable', () => {
                const { element } = setupContentEditable('');
                setSelection(element, 0, 0);
                const selection = window.getSelection();
                expect(selection.isCollapsed).toBe(true);
                if (selection.rangeCount > 0) {
                    // In JSDOM, for an empty CE, startContainer is often the element itself.
                    expect(selection.getRangeAt(0).startContainer).toBe(element);
                    expect(selection.getRangeAt(0).startOffset).toBe(0);
                } else { fail("No range found in selection for empty CE"); }
            });
             it('setSelection at end of contenteditable', () => {
                const { element } = setupContentEditable('Test');
                setSelection(element, 4, 4); // Cursor after "Test"
                const selection = window.getSelection();
                expect(selection.isCollapsed).toBe(true);
                if(selection.anchorNode && selection.anchorNode.nodeType === Node.TEXT_NODE){
                    expect(selection.anchorNode.textContent).toBe('Test');
                    expect(selection.anchorOffset).toBe(4);
                } else if (selection.anchorNode === element) {
                    // Fallback if selection is on the element itself
                    expect(selection.anchorOffset).toBeGreaterThanOrEqual(1); // e.g. 1 child (the text node)
                }
            });
        });
    });

    describe('getCurrentLineInfo', () => {
        it('for textarea - middle line', () => {
            testElement = createElement('textarea', { value: "Line one\nLine two\nLine three" });
            testElement.focus();
            testElement.setSelectionRange(12, 12); 
            const info = getCurrentLineInfo(testElement);
            expect(info.lineText).toBe("Line two");
            expect(info.lineStart).toBe(9);
            expect(info.lineEnd).toBe(17);
            expect(info.fullText).toBe("Line one\nLine two\nLine three");
        });

        it('for contenteditable - basic case with BR', () => {
            testElement = createElement('div', { innerHTML: 'First line<br>Second line is here<br>Third line' }, true);
            testElement.focus();

            // Simulate cursor on "Second line is here" (e.g. at start of it)
            // The text "Second line is here" starts at index 11 of full normalized text
            setSelection(testElement, 11, 11); 
            
            const info = getCurrentLineInfo(testElement);
            expect(info.fullText).toBe("First line\nSecond line is here\nThird line"); // Due to BR normalization
            expect(info.lineText).toBe("Second line is here");
            expect(info.lineStart).toBe(11); 
            expect(info.lineEnd).toBe(30);   
        });
    });
    
    describe('replaceText', () => {
        describe('Textarea/Input', () => {
            it('should replace selected text and update cursor', () => {
                testElement = createElement('textarea', { value: "Hello beautiful world" });
                testElement.focus();
                testElement.setSelectionRange(6, 15); 
                
                replaceText(testElement, "wonderful", 6, 15);
                expect(testElement.value).toBe("Hello wonderful world");
                expect(testElement.selectionStart).toBe(6 + "wonderful".length);
                expect(testElement.selectionEnd).toBe(6 + "wonderful".length);
            });

            it('should insert text at cursor position', () => {
                testElement = createElement('textarea', { value: "Hello world" });
                testElement.focus();
                testElement.setSelectionRange(6, 6); 

                replaceText(testElement, "new ", 6, 6);
                expect(testElement.value).toBe("Hello new world");
                expect(testElement.selectionStart).toBe(6 + "new ".length);
                expect(testElement.selectionEnd).toBe(6 + "new ".length);
            });

            it('should replace text with explicit new cursor positions', () => {
                testElement = createElement('textarea', { value: "Hello world" });
                testElement.focus();
                replaceText(testElement, "Goodbye", 0, 5, 0, 7); 
                expect(testElement.value).toBe("Goodbye world");
                expect(testElement.selectionStart).toBe(0);
                expect(testElement.selectionEnd).toBe(7);
            });
        });

        describe('ContentEditable', () => {
            // JSDOM's execCommand('insertText') is limited. These tests will verify basic behavior.
            // The replaceText function tries execCommand first.

            it('should replace selected text in simple contenteditable', () => {
                testElement = createElement('div', {textContent: 'Hello beautiful world'}, true);
                setSelection(testElement, 6, 15); // Select "beautiful"
                
                replaceText(testElement, "wonderful", 6, 15); 
                expect(testElement.textContent).toBe("Hello wonderful world");
                
                const details = getSelectionDetails(testElement);
                expect(details.start).toBe(6 + "wonderful".length); 
                expect(details.collapsed).toBe(true);
            });

            it('should insert text at cursor in simple contenteditable', () => {
                testElement = createElement('div', {textContent: 'Hello world'}, true);
                setSelection(testElement, 6, 6); // Cursor after "Hello "
                replaceText(testElement, "new ", 6, 6);
                expect(testElement.textContent).toBe("Hello new world");

                const details = getSelectionDetails(testElement);
                expect(details.start).toBe(6 + "new ".length);
                expect(details.collapsed).toBe(true);
            });
            
            it('should replace text across simple mixed contenteditable (JSDOM may simplify structure)', () => {
                testElement = createElement('div', {innerHTML: 'One <b>Two</b> Three'}, true);
                // textContent becomes "OneTwoThree" or "One Two Three" depending on JSDOM normalization
                // Let's assume "OneTwoThree" for offset calculation in this simplified test.
                // Original text: "One Two Three" (textContent including space from HTML)
                // Select " Two " (start=3, end=8)
                setSelection(testElement, 3, 8); 
                
                replaceText(testElement, "CompletelyNew", 3, 8);
                // JSDOM's execCommand might result in "OneCompletelyNewThree"
                // Or manual manipulation might if execCommand fails.
                expect(testElement.textContent).toBe("OneCompletelyNewThree");

                const details = getSelectionDetails(testElement);
                expect(details.start).toBe(3 + "CompletelyNew".length);
                expect(details.collapsed).toBe(true);
            });
        });
    });
    
    describe('showFeedbackMessage', () => {
        beforeAll(() => {
            jest.useFakeTimers();
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it('should create a feedback message element and append to body', () => {
            const mockSettings = { ...DEFAULT_GLOBAL_SETTINGS, showFeedback: true, feedbackDuration: 100 };
            showFeedbackMessage("Test Message", null, mockSettings);

            const feedbackEl = document.querySelector(`.${FEEDBACK_MESSAGE_CLASS}`);
            expect(feedbackEl).not.toBeNull();
            expect(feedbackEl.textContent).toBe("Test Message");
            expect(document.body.contains(feedbackEl)).toBe(true);

            jest.advanceTimersByTime(mockSettings.feedbackDuration + 300 + 10); 
            expect(document.querySelector(`.${FEEDBACK_MESSAGE_CLASS}`)).toBeNull();
        });

        it('should not show feedback if showFeedback is false', () => {
            const mockSettings = { ...DEFAULT_GLOBAL_SETTINGS, showFeedback: false, feedbackDuration: 100 };
            showFeedbackMessage("Test Message No Show", null, mockSettings);
            expect(document.querySelector(`.${FEEDBACK_MESSAGE_CLASS}`)).toBeNull();
        });

         it('should reuse and update existing feedback element if called quickly', () => {
            const mockSettings = { ...DEFAULT_GLOBAL_SETTINGS, showFeedback: true, feedbackDuration: 5000 };
            showFeedbackMessage("First Message", null, mockSettings);
            let feedbackEl = document.querySelector(`.${FEEDBACK_MESSAGE_CLASS}`);
            expect(feedbackEl).not.toBeNull();
            expect(feedbackEl.textContent).toBe("First Message");

            showFeedbackMessage("Second Message", null, mockSettings);
            feedbackEl = document.querySelector(`.${FEEDBACK_MESSAGE_CLASS}`); 
            expect(feedbackEl).not.toBeNull();
            expect(feedbackEl.textContent).toBe("Second Message");
            
            const allFeedbackElements = document.querySelectorAll(`.${FEEDBACK_MESSAGE_CLASS}`);
            expect(allFeedbackElements.length).toBe(1); 


            jest.advanceTimersByTime(mockSettings.feedbackDuration + 300 + 10);
            expect(document.querySelector(`.${FEEDBACK_MESSAGE_CLASS}`)).toBeNull();
        });
    });

});