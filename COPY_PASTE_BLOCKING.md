# Copy-Paste Blocking Features

## Overview

The proctoring system now includes comprehensive copy-paste blocking to prevent students from copying exam content or pasting external code during coding exams.

**Important:** Copy-paste operations are **silently blocked** without triggering violations or showing alerts. This provides a seamless experience while maintaining exam integrity.

## Features Implemented

### 1. **Copy Blocking** 📋🚫
- Blocks copying content from exam questions
- Allows copying within the code editor (Monaco Editor)
- Logs all copy attempts to console
- **No violations recorded** - silent blocking only

### 2. **Paste Blocking** 📥🚫
- **Smart Detection**: Blocks large pastes (>100 characters)
- **Allows Small Pastes**: Variable names, small snippets (<100 chars)
- **Content Analysis**: Detects and blocks external code
- **Silent Blocking**: No alerts or warnings shown to student

### 3. **Cut Blocking** ✂️🚫
- Blocks cutting content from exam questions
- Allows cutting within code editor
- Tracks all cut attempts
- **No violations recorded** - silent blocking only

### 4. **Drag & Drop Blocking** 🖱️🚫
- Prevents dragging content out of exam
- Blocks dropping external files/content
- Prevents drag-and-drop cheating methods
- **No violations recorded** - silent blocking only

### 5. **Clipboard Monitoring** 📊
- Tracks copy/paste/cut attempt counts in console
- Logs content length for analysis
- Records target elements for debugging
- **Does not affect violation count or exam termination**

## How It Works

### Copy Protection
```javascript
// Allowed: Copy within code editor
Ctrl+C in Monaco Editor ✅ → Logged but allowed

// Blocked: Copy from exam questions
Ctrl+C on problem description ❌ → Silently blocked (no alert)
```

### Paste Protection
```javascript
// Allowed: Small pastes
Paste "myVariable" (11 chars) ✅ → Allowed

// Blocked: Large pastes (likely external code)
Paste 500 lines of code ❌ → Silently blocked (no alert)
```

### Smart Detection
The system analyzes:
- **Content Length**: >100 characters = suspicious
- **Target Element**: Monaco editor vs other elements
- **Paste Frequency**: Multiple large pastes = violation

## Testing Copy-Paste Blocking

### Test 1: Copy from Problem Description
1. Select text from the problem description
2. Press **Ctrl+C** or right-click → Copy
3. **Expected**: 
   - Console: `🚫 Copy blocked silently. Attempt #1`
   - Copy operation prevented
   - **No alert shown to student**
   - **No violation recorded**

### Test 2: Copy within Code Editor
1. Select code in the Monaco editor
2. Press **Ctrl+C**
3. **Expected**:
   - Console: `📋 Copy within editor allowed`
   - Copy works normally
   - No blocking

### Test 3: Paste Large Code
1. Copy 200+ characters of code from external source
2. Try to paste into editor with **Ctrl+V**
3. **Expected**:
   - Console: `🚫 Large paste blocked silently. 250 characters. Attempt #1`
   - Paste prevented
   - **No alert shown to student**
   - **No violation recorded**

### Test 4: Paste Small Snippet
1. Copy "const x = 5" (12 characters)
2. Paste into editor
3. **Expected**:
   - Console: `📋 Small paste allowed: 12 characters`
   - Paste works
   - No blocking

### Test 5: Drag and Drop
1. Try to drag text from problem to editor
2. **Expected**:
   - Console: `🚫 Drag operation blocked silently`
   - Drag prevented
   - **No alert or violation**

### Test 6: Drop External File
1. Try to drop a .txt or .js file into browser
2. **Expected**:
   - Console: `🚫 Drop operation blocked silently`
   - Drop prevented
   - **No alert or violation**

## Console Output Examples

### Successful Copy Block (Silent)
```
🚫 Copy blocked silently. Attempt #1
```

### Large Paste Block (Silent)
```
🚫 Large paste blocked silently. 347 characters. Attempt #1
```

### Allowed Operations
```
📋 Copy within editor allowed
📋 Small paste allowed: 15 characters
✂️ Cut within editor allowed
```

### Drag/Drop Block (Silent)
```
🚫 Drag operation blocked silently
🚫 Drop operation blocked silently
```

## Configuration

### Adjust Paste Threshold
Edit `codingExamProctoringService.js` line 718:

```javascript
// Current: Block pastes > 100 characters
if (pastedText.length > 100) {

// More lenient: Block pastes > 200 characters
if (pastedText.length > 200) {

// Stricter: Block pastes > 50 characters
if (pastedText.length > 50) {
```

### Disable Copy-Paste Blocking (Not Recommended)
Comment out in `addEventListeners()` method:

```javascript
// Copy-paste blocking
// document.addEventListener('copy', this.handleCopy, true);
// document.addEventListener('paste', this.handlePaste, true);
// document.addEventListener('cut', this.handleCut, true);
```

## Violation Details Recorded

Each copy-paste violation records:

### Copy Violation
```json
{
  "type": "copy_attempt",
  "timestamp": "2025-10-18T03:45:12.000Z",
  "metadata": {
    "attempts": 1,
    "description": "Attempted to copy content from exam",
    "target": "DIV"
  }
}
```

### Paste Violation
```json
{
  "type": "paste_attempt",
  "timestamp": "2025-10-18T03:46:30.000Z",
  "metadata": {
    "attempts": 1,
    "contentLength": 347,
    "description": "Attempted to paste large content (likely external code)",
    "target": "TEXTAREA",
    "preview": "function solve(arr) { const n = arr.length; for..."
  }
}
```

### Drag/Drop Violation
```json
{
  "type": "drop_attempt",
  "timestamp": "2025-10-18T03:47:15.000Z",
  "metadata": {
    "description": "Attempted to drop external content into exam",
    "dataTypes": ["text/plain", "text/html"]
  }
}
```

## User Experience

### When Copy is Blocked
- Operation silently prevented
- No visual feedback (to avoid disruption)
- Logged in console for monitoring

### When Large Paste is Blocked
- Operation prevented
- **Toast notification**: "⚠️ Warning 1/3: Unauthorized paste operation detected"
- **Alert banner** if violation threshold reached
- Console log with details

### Allowed Operations
- Small pastes work seamlessly
- Copy/paste within editor works normally
- No interruption to legitimate coding

## Integration with Violation System

**Important:** Copy-paste operations do **NOT** count toward the 3-strike system.

- Copy/paste/cut/drag/drop are **silently blocked**
- **No violations recorded** in the database
- **No warnings shown** to students
- **Does not trigger exam termination**

The 3-strike system only applies to:
1. Face detection failures
2. Tab switching
3. Window focus loss
4. Fullscreen exits
5. Audio detection
6. Blocked keyboard shortcuts

## Keyboard Shortcuts Blocked

In addition to copy-paste, these shortcuts are blocked:

- **Ctrl+C** (outside editor) - Copy
- **Ctrl+V** (large content) - Paste
- **Ctrl+X** (outside editor) - Cut
- **Ctrl+A** (outside editor) - Select All
- **Ctrl+Shift+I** - DevTools
- **Ctrl+U** - View Source
- **F12** - DevTools
- **Right-click** - Context Menu

## Browser Compatibility

✅ **Fully Supported:**
- Chrome 90+
- Edge 90+
- Firefox 88+

⚠️ **Partial Support:**
- Safari 14+ (some clipboard events may behave differently)

## Security Notes

### What is Protected:
✅ Problem descriptions
✅ Test cases
✅ Sample inputs/outputs
✅ Exam instructions
✅ Large code pastes

### What is Allowed:
✅ Copy/paste within code editor
✅ Small snippets (<100 chars)
✅ Variable names
✅ Short code fragments
✅ Normal typing

## Troubleshooting

### Issue: Can't paste anything in editor
**Cause**: Paste content is >100 characters
**Solution**: 
- Type the code manually
- Paste in smaller chunks (<100 chars each)
- Adjust threshold in configuration

### Issue: Copy within editor is blocked
**Cause**: Monaco editor class not detected
**Solution**: Check console for target element, ensure `.monaco-editor` class exists

### Issue: False positives on paste
**Cause**: Threshold too low
**Solution**: Increase paste threshold from 100 to 150-200 characters

### Issue: Students can still paste
**Cause**: Event listeners not attached
**Solution**: 
- Check console for "✅ Face detection monitoring started"
- Verify proctoring is initialized
- Check browser console for errors

## Advanced Features

### Content Analysis
The system can be extended to analyze pasted content:
- Detect code patterns
- Check for common solutions
- Compare with known answers
- Flag suspicious patterns

### Machine Learning Integration
Future enhancements could include:
- AI-based code similarity detection
- Plagiarism checking
- Style analysis
- Typing pattern recognition

## Best Practices

### For Administrators:
1. **Test thoroughly** before live exams
2. **Communicate rules** to students
3. **Monitor console logs** during exams
4. **Review violations** after exam
5. **Adjust thresholds** based on exam type

### For Students:
1. **Type code manually** - best practice
2. **Use small pastes** for variable names
3. **Copy within editor** is allowed
4. **Don't try to circumvent** - violations are logged
5. **Ask for help** if legitimate paste is blocked

## Monitoring Dashboard

Administrators can view:
- Total copy attempts
- Total paste attempts
- Blocked operations count
- Violation timeline
- Student-wise statistics

## Reporting

Each exam attempt records:
```javascript
{
  copyAttempts: 3,
  pasteAttempts: 2,
  cutAttempts: 1,
  dragAttempts: 0,
  dropAttempts: 1,
  totalViolations: 7
}
```

## Summary

The copy-paste blocking system provides:
- ✅ **Comprehensive protection** against code copying
- ✅ **Smart detection** of suspicious pastes
- ✅ **Minimal disruption** to legitimate work
- ✅ **Detailed logging** for review
- ✅ **Integration** with 3-strike system
- ✅ **Configurable thresholds** for flexibility

This ensures exam integrity while allowing students to code naturally within the editor.
