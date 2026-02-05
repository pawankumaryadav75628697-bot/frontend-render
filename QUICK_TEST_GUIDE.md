# Quick Testing Guide - Proctoring Features

## 🚀 Quick Start Testing

### 1. Start the Exam
```
1. Navigate to coding exam
2. Click "Start Proctored Exam"
3. Allow camera and microphone
4. Wait for "✅ Face detection monitoring started" in console
```

### 2. Test Face Detection (9 seconds to violation)
```
Action: Cover camera with hand
Expected:
  3s  → ⚠️ No face detected! Count: 1/3
  6s  → ⚠️ No face detected! Count: 2/3 + Toast warning
  9s  → 🚨 VIOLATION + Alert banner + Warning 1/3
```

### 3. Test Copy-Paste Blocking
```
Test A: Copy from problem description
  Action: Select text, Ctrl+C
  Expected: 🚫 Copy blocked! + Violation

Test B: Copy within editor
  Action: Select code in editor, Ctrl+C
  Expected: 📋 Copy within editor allowed

Test C: Paste large code (>100 chars)
  Action: Paste 200 chars of code
  Expected: 🚫 Large paste blocked! + Violation + Warning

Test D: Paste small snippet (<100 chars)
  Action: Paste "const x = 5"
  Expected: 📋 Small paste allowed
```

### 4. Test Tab Switching
```
Action: Press Alt+Tab or click another window
Expected: 🚨 Tab switch detected + Violation
```

### 5. Test Fullscreen Exit
```
Action: Press Esc or F11
Expected: 🚨 Exited fullscreen + Violation
```

### 6. Test 3-Strike System
```
Trigger 3 violations (any combination):
  Violation 1 → Warning 1/3 + Alert banner
  Violation 2 → Warning 2/3 + Alert banner
  Violation 3 → 🚫 EXAM TERMINATED + Modal
```

## 📊 What to Check in Console

### Successful Initialization
```
🔒 Initializing enhanced proctoring for coding exam
✅ Camera initialized for face detection
✅ Microphone initialized for audio detection
🔍 Starting face detection monitoring...
✅ Face detection monitoring started
```

### Face Detection Working
```
👤 Face detection result: ✅ DETECTED (Count: 1/3)
🔍 Face detection analysis: {
  faceDetected: '✅ YES',
  skinToneRatio: '15.2%',
  ...
}
```

### Copy-Paste Blocking Working
```
🚫 Copy blocked! Attempt #1
🚫 Large paste blocked! 250 characters. Attempt #1
📋 Small paste allowed: 12 characters
```

### Violations Triggered
```
🚨 VIOLATION: Face not detected for too long!
Violation recorded for attempt ...
⚠️ Warning 1/3: Face not visible in camera
```

## ✅ Testing Checklist

- [ ] Camera preview shows live video
- [ ] Console shows monitoring started
- [ ] Face detection works (cover camera = violation)
- [ ] Copy blocked outside editor
- [ ] Copy allowed inside editor
- [ ] Large paste blocked (>100 chars)
- [ ] Small paste allowed (<100 chars)
- [ ] Tab switch triggers violation
- [ ] Fullscreen exit triggers violation
- [ ] Warning alerts appear
- [ ] 3 violations = exam terminated
- [ ] Termination modal shows

## 🐛 Common Issues

### Camera not working
- Check browser permissions
- Try different browser (Chrome recommended)
- Refresh page

### Face detection not triggering
- Check console for "Face detection monitoring started"
- Look for detection analysis logs
- Verify camera preview is active

### Copy-paste not blocked
- Check console for event listener attachment
- Verify proctoring is initialized
- Try in different element (outside editor)

### No violations showing
- Check violation count in status bar
- Look for alert banners
- Verify callbacks are working

## 🎯 Expected Behavior Summary

| Feature | Action | Result | Time |
|---------|--------|--------|------|
| Face Detection | Cover camera | Violation after 3 checks | 9s |
| Copy Block | Ctrl+C outside editor | Immediate block | 0s |
| Paste Block | Paste >100 chars | Immediate block | 0s |
| Tab Switch | Alt+Tab | Immediate violation | 0s |
| Fullscreen Exit | Press Esc | Immediate violation | 0s |
| 3 Violations | Any combination | Exam terminated | N/A |

## 📝 Notes

- All violations are logged to console
- Each violation counts toward 3-strike limit
- Face detection is most lenient (9 seconds)
- Copy-paste is instant block
- Tab/fullscreen violations are instant
- Termination is automatic and irreversible

## 🔧 Quick Fixes

### Adjust face detection sensitivity
File: `codingExamProctoringService.js` line 26
```javascript
this.maxNoFaceCount = 3; // Change to 2 (stricter) or 5 (lenient)
```

### Adjust paste threshold
File: `codingExamProctoringService.js` line 718
```javascript
if (pastedText.length > 100) { // Change to 50 or 200
```

### Disable specific feature (testing only)
Comment out in `addEventListeners()` method
```javascript
// document.addEventListener('copy', this.handleCopy, true);
```
