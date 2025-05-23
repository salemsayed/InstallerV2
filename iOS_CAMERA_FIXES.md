# iOS Safari Camera Fixes - Advanced Scan Component

## Overview
This document outlines the comprehensive fixes implemented for iOS Safari camera issues in the advanced-scan.tsx component, based on the latest research and WebKit bug reports.

## Key Issues Addressed

### 1. iOS Safari Video Element Initialization
**Problem**: iOS Safari has strict requirements for video element setup and autoplay policies.

**Solution**: 
- Proper attribute sequence: Set `playsInline`, `muted`, `autoplay=false` BEFORE setting `srcObject`
- Use both property assignment AND attribute setting for compatibility with older iOS versions
- Manual play control instead of relying on autoplay
- Force video reset with `video.load()` before setting new stream

### 2. Camera Constraints Strategy
**Problem**: iOS Safari is sensitive to resolution constraints and may fail with specific video constraints.

**Solution**:
- Remove resolution constraints entirely for iOS - let Safari choose optimal settings
- Use progressive fallback: specific constraints → basic constraints → ultra-basic (`video: true`)
- Only specify `facingMode: "environment"` for iOS

### 3. Video Loading and Play Strategy
**Problem**: iOS video may not play consistently due to timing and state management issues.

**Solution**:
- Multiple play attempts with progressive delays (1s, 2s, 3s, 4s, 5s)
- Comprehensive event handling: `loadeddata`, `loadedmetadata`, `canplay`, `canplaythrough`, `playing`
- Fallback acceptance: If video has any data (`readyState >= 1`) after max attempts, proceed anyway
- Extended timeout: 20 seconds for iOS vs 15 seconds for other mobile devices

### 4. OCR Processing Optimization
**Problem**: iOS requires different handling for video frame processing and text recognition.

**Solution**:
- More lenient readyState requirements: `readyState >= 1` for iOS vs `readyState >= 3` for desktop
- Check for video paused state and attempt to resume playback if needed
- Use PNG format instead of JPEG for better text recognition
- Higher image quality for iOS (0.95 vs 0.9)
- Disable image smoothing for sharper text edges

### 5. Canvas and Frame Processing
**Problem**: iOS Safari may have issues with canvas operations and video frame extraction.

**Solution**:
- Handle cases where video dimensions are 0
- Fallback dimensions: `video.videoWidth || video.offsetWidth || 640`
- Error handling for `drawImage()` operations
- Optimized canvas sizing with device pixel ratio limiting

### 6. Resource Cleanup
**Problem**: iOS Safari requires proper cleanup to prevent memory leaks and state corruption.

**Solution**:
- Comprehensive stream track stopping with logging
- Video element reset: pause, clear srcObject, clear src, call load()
- Event listener cleanup to prevent memory leaks
- Proper Tesseract worker termination

## Technical Implementation Details

### Video Element Setup
```typescript
// Critical iOS Safari video setup sequence
video.srcObject = null; // Reset first

// iOS-specific attributes - MUST be set before srcObject
video.playsInline = true;
video.muted = true;
video.autoplay = false; // Don't use autoplay - manually control play
video.controls = false;
video.preload = "metadata";

// Set attributes as well for older iOS versions
video.setAttribute('playsinline', 'true');
video.setAttribute('webkit-playsinline', 'true');
video.setAttribute('muted', 'true');

// Now set the stream
video.srcObject = stream;
```

### Camera Constraints
```typescript
// Progressive camera constraint strategy for iOS
let videoConstraints: any = {
  facingMode: "environment"
};

// Don't specify resolution constraints for iOS - let it choose optimal
if (!isIOS) {
  videoConstraints.width = { ideal: isMobile ? 720 : 1280 };
  videoConstraints.height = { ideal: isMobile ? 480 : 720 };
}
```

### Video Playing Strategy
```typescript
const attemptPlay = async () => {
  if (resolved || loadAttempts >= maxAttempts) return;
  
  loadAttempts++;
  console.log(`Play attempt ${loadAttempts} on ${isIOS ? 'iOS' : 'mobile'}`);
  
  try {
    await video.play();
    
    // Wait a bit then check if it's actually playing
    setTimeout(() => {
      if (!resolved && !video.paused && video.readyState >= 2) {
        console.log("Video playing successfully");
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve();
      } else if (!resolved && loadAttempts < maxAttempts) {
        // Try again after a delay
        setTimeout(attemptPlay, 1000);
      }
    }, 500);
    
  } catch (playError) {
    console.warn(`Play attempt ${loadAttempts} failed:`, playError);
    
    if (loadAttempts < maxAttempts) {
      // Try again after progressively longer delays
      setTimeout(attemptPlay, loadAttempts * 1000);
    } else if (!resolved) {
      // Final fallback - just check if video has some data
      if (video.readyState >= 1) {
        console.log("Video has some data, continuing anyway");
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve();
      }
    }
  }
};
```

### OCR Processing for iOS
```typescript
// Enhanced readyState and playing checks for iOS
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// For iOS, be more lenient with readyState but ensure video is actually playing
const minReadyState = isMobile ? 1 : 3; // iOS: HAVE_METADATA, Desktop: HAVE_FUTURE_DATA
const isVideoReady = video.readyState >= minReadyState && !video.paused;

// On iOS, try to resume playing if paused
if (isIOS && video.paused && video.readyState >= 1) {
  console.log("Attempting to resume iOS video playback");
  video.play().catch(err => console.warn("Failed to resume video:", err));
}

// Get image data for OCR processing - optimize quality for text recognition
const imageQuality = isIOS ? 0.95 : 0.9; // Higher quality for iOS
const imageData = canvas.toDataURL('image/png', imageQuality); // Use PNG for text
```

## Debugging Features

### Enhanced Debug Panel
- Real-time video state monitoring (readyState, paused, dimensions, etc.)
- iOS/mobile device detection
- Stream status and error tracking
- Loading step progression
- OCR processing metrics

### Video State Monitoring
```typescript
const [videoState, setVideoState] = useState<{
  readyState: number;
  paused: boolean;
  currentTime: number;
  duration: number;
  videoWidth: number;
  videoHeight: number;
  hasStream: boolean;
}>
```

## Known iOS Safari Limitations

1. **PWA Mode Issues**: iOS Safari in PWA/home screen mode has additional restrictions
2. **Low Power Mode**: Video may not work in iOS low power mode
3. **Control Center**: Pulling down control center can kill camera stream
4. **Permission Handling**: Camera permissions can get corrupted, requiring device restart
5. **Canvas Operations**: Some canvas operations may fail silently

## Testing Recommendations

1. Test on actual iOS devices (not just simulator)
2. Test in both Safari browser and PWA (home screen) mode
3. Test with low power mode enabled/disabled
4. Test with different iOS versions (especially latest)
5. Test camera permission denial/approval scenarios
6. Test app backgrounding/foregrounding scenarios

## Related WebKit Bugs

- Bug #252465: PWA HTML Video Element issues with getUserMedia()
- Bug #181663: Video Element canvas capture issues on iOS
- Various iOS Safari autoplay and video element issues

## Performance Optimizations

- Slower OCR scanning interval (1.5s vs 1s) for better iOS performance
- Limited device pixel ratio scaling for mobile performance
- PNG format for better text recognition quality
- Enhanced text preprocessing for better OCR accuracy

## Future Considerations

- Monitor iOS Safari updates for video handling improvements
- Consider fallback UI for iOS-specific issues
- Implement user guidance for iOS-specific limitations
- Monitor WebKit bug reports for resolution status 