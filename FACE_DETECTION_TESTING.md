# Face Detection Testing Guide

## What I Fixed

### 1. **Reduced Detection Threshold**
- Changed from **5 failures** to **3 failures** before violation
- Now triggers violation after **9 seconds** (3 checks × 3 seconds) instead of 15 seconds

### 2. **More Lenient Detection Algorithm**
- **Skin tone threshold**: 3-50% (was 5-40%)
- **Brightness tolerance**: More forgiving for different lighting
- **Edge detection**: Lowered from 10 to 8 edges
- **Scoring system**: 3 out of 4 conditions must pass (was all 4)

### 3. **Enhanced Logging**
- Every detection attempt logs to console
- Shows detailed analysis of why face was/wasn't detected
- Displays countdown: "Count: 1/3", "Count: 2/3", "Count: 3/3"

### 4. **Immediate Visual Feedback**
- Status bar shows: "✓ Detected", "🔍 Checking...", or "⚠️ WARNING"
- Toast warnings appear after 2nd failure
- Clear indication when face is not visible

## How to Test Face Detection

### Step 1: Open Browser Console
1. Press **F12** to open Developer Tools
2. Go to **Console** tab
3. Keep it open during testing

### Step 2: Start the Exam
1. Navigate to a coding exam
2. Click "Start Proctored Exam"
3. Allow camera and microphone access

### Step 3: Watch the Console Logs
You should see:
```
🔍 Starting face detection monitoring...
✅ Face detection monitoring started (checking every 3 seconds)
```

Every 3 seconds, you'll see:
```
👤 Face detection result: ✅ DETECTED (Count: 1/3)
🔍 Face detection analysis: {
  faceDetected: '✅ YES',
  skinToneRatio: '15.2%',
  brightRatio: '23.4%',
  darkRatio: '12.1%',
  edgePixels: 45,
  conditions: {
    hasSkinTone: '✅',
    notOverexposed: '✅',
    notUnderexposed: '✅',
    hasFeatures: '✅'
  },
  conditionsPassed: '4/4'
}
```

### Step 4: Test Face Covering
1. **Cover the camera** with your hand or object
2. Watch the console - you should see:
   ```
   ⚠️ No face detected! Count: 1/3
   🔍 Face detection analysis: {
     faceDetected: '❌ NO',
     ...
   }
   ```

3. After **2nd failure** (6 seconds):
   - Console shows: `⚠️ No face detected! Count: 2/3`
   - Toast warning appears: "⚠️ Face not visible! 1 more failure(s) will trigger violation!"
   - Status bar shows: "⚠️ WARNING"

4. After **3rd failure** (9 seconds):
   - Console shows: `🚨 VIOLATION: Face not detected for too long!`
   - Violation alert banner appears
   - Warning count increases: "Warnings: 1/3"

### Step 5: Verify Violation Alert
After 3rd failure, you should see:
- ⚠️ **Red alert banner** at top
- **Toast notification**: "⚠️ Warning 1/3: Face not visible in camera. 2 warning(s) remaining!"
- **Status bar** shows violation count

### Step 6: Test Recovery
1. **Uncover the camera**
2. Console should show:
   ```
   ✅ Face detected again, resetting counter
   👤 Face detection result: ✅ DETECTED (Count: 1/3)
   ```
3. Status bar returns to: "✓ Detected"

## Troubleshooting

### If Face Detection Never Triggers:

#### Check 1: Camera Stream Active?
Look for the small camera preview in the top-right corner. If it's black or frozen:
- Refresh the page
- Re-grant camera permissions
- Try a different browser (Chrome/Edge recommended)

#### Check 2: Console Errors?
Look for errors like:
- `Face detection skipped - inactive or no stream`
- `Error analyzing frame`
- `ImageCapture failed`

#### Check 3: Detection Analysis
Look at the console output when you cover the camera:
```javascript
🔍 Face detection analysis: {
  faceDetected: '❌ NO',
  skinToneRatio: '2.1%',    // Should drop when covered
  brightRatio: '85.3%',     // May be high if light passes through
  darkRatio: '5.2%',        // Should increase when covered
  edgePixels: 3,            // Should drop significantly
  conditions: {
    hasSkinTone: '❌',      // Should fail
    notOverexposed: '❌',   // May fail if too bright
    notUnderexposed: '✅',
    hasFeatures: '❌'       // Should fail
  },
  conditionsPassed: '1/4'   // Should be < 3
}
```

### If Detection is Too Sensitive:

Edit `codingExamProctoringService.js` line 26:
```javascript
this.maxNoFaceCount = 5; // Increase from 3 to 5 (15 seconds)
```

### If Detection is Not Sensitive Enough:

Edit `codingExamProctoringService.js` line 26:
```javascript
this.maxNoFaceCount = 2; // Decrease from 3 to 2 (6 seconds)
```

## Expected Behavior Timeline

| Time | Event | Console Log | UI Feedback |
|------|-------|-------------|-------------|
| 0s | Cover camera | - | - |
| 3s | 1st check fails | `⚠️ No face detected! Count: 1/3` | Status: "🔍 Checking..." |
| 6s | 2nd check fails | `⚠️ No face detected! Count: 2/3` | Status: "⚠️ WARNING" + Toast |
| 9s | 3rd check fails | `🚨 VIOLATION: Face not detected for too long!` | Alert banner + Warning 1/3 |

## Common Issues

### Issue: "Face not detected" but face is visible
**Solution**: Adjust lighting or camera angle. Check console for which condition is failing:
- Low `skinToneRatio`? → Improve lighting
- High `darkRatio`? → Add more light
- Low `edgePixels`? → Move closer to camera

### Issue: Detection works but no violation triggered
**Solution**: Check that `recordViolation` is being called in console. Look for:
```
🚨 VIOLATION: Face not detected for too long!
Violation recorded for attempt ...
```

### Issue: Violation recorded but no alert shown
**Solution**: Check React component callbacks. Look for:
```
✅ Face detected callback triggered
⚠️ No face detected callback: 2/3
```

## Debug Mode

To enable more verbose logging, add this to the console:
```javascript
localStorage.setItem('DEBUG_PROCTORING', 'true');
```

Then refresh the page. You'll see additional debug information.

## Testing Checklist

- [ ] Camera preview shows live video
- [ ] Console shows "Face detection monitoring started"
- [ ] Face detected when visible (✅ in console)
- [ ] Face not detected when covered (❌ in console)
- [ ] Counter increments: 1/3, 2/3, 3/3
- [ ] Toast warning at 2/3
- [ ] Status bar shows WARNING at 2/3
- [ ] Violation triggered at 3/3
- [ ] Alert banner appears
- [ ] Warning count increases (1/3, 2/3, 3/3)
- [ ] Exam terminates after 3 violations
- [ ] Termination modal appears

## Performance Notes

- Face detection runs every **3 seconds**
- Each check takes ~100-300ms
- Minimal CPU usage (~2-5%)
- Works in background tab (but triggers tab switch violation)

## Browser Compatibility

✅ **Fully Supported:**
- Chrome 90+
- Edge 90+
- Firefox 88+

⚠️ **Limited Support:**
- Safari 14+ (ImageCapture API not available, uses fallback)

❌ **Not Supported:**
- Internet Explorer
- Older mobile browsers

## Next Steps

If face detection is still not working after following this guide:
1. Share the console logs
2. Describe what you see in the UI
3. Mention which browser you're using
4. Check if camera preview is working
