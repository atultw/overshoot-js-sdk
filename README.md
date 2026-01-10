# RealtimeVision SDK

A TypeScript SDK for real-time AI vision analysis on live video streams with sub-second latency.

## What It Does

RealtimeVision enables developers to run continuous AI inference on live camera feeds **or uploaded video files** with extremely low latency (~300ms). The SDK handles the complexity of WebRTC streaming, frame sampling, bundling, and model inference, providing a simple interface to get structured AI analysis of what the camera sees.

**Key concept**: This is a **perception stream**, not a conversational AI. The SDK continuously analyzes video segments (clips) and returns structured results ~1 per second. Each result is independent with no memory of previous frames - think of it like a smart sensor that watches and reports, not a chatbot that discusses what it sees.

## Quick Start

### Using Camera

```typescript
import { RealtimeVision } from "@overshoot/realtime-vision";

const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  prompt:
    "Read any visible text and return JSON: {text: string | null, confidence: number}",
  onResult: (result, raw) => {
    console.log(result.result); // The AI's response
    console.log(`Latency: ${raw.total_latency_ms}ms`); // e.g., 320ms
  },
});

await vision.start();
// Camera is now streaming, results arrive ~1/second
await vision.stop();
```

### Using Video File

```typescript
import { RealtimeVision } from "@overshoot/realtime-vision";

// Get file from user input
const fileInput = document.querySelector('input[type="file"]');
const videoFile = fileInput.files[0];

const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  prompt: "Detect all objects in the video and count them",
  source: {
    type: "video",
    file: videoFile,
  },
  onResult: (result, raw) => {
    console.log(result.result);
  },
});

await vision.start();
// Video file is now streaming and looping, results arrive ~1/second
await vision.stop();
```

## Architecture Overview

The SDK operates in a continuous pipeline:

1. **Video Capture**: Accesses device camera via WebRTC **or** streams from an uploaded video file
2. **Frame Sampling**: Samples frames at configurable ratio (e.g., 10% of 30fps = 3fps)
3. **Clip Creation**: Bundles sampled frames into short video clips (1-10 seconds)
4. **Inference**: Sends clips to AI models for analysis
5. **Results**: Returns structured JSON via WebSocket with latency metrics

This architecture enables:

- **Low latency**: Models see recent frames within ~300ms
- **Efficient processing**: Sample only needed frames
- **Continuous operation**: Stream processes indefinitely
- **Structured output**: JSON responses matching your schema
- **Flexible input**: Use live camera or pre-recorded video files

## Configuration & Defaults

### Sane Defaults

The SDK provides carefully tuned defaults that work well for most use cases:

```typescript
{
  // Video source (NEW!)
  source: {
    type: "camera",
    cameraFacing: "environment"  // Back camera on mobile, any on desktop
  },

  // Processing defaults (auto-optimized)
  sampling_ratio: 0.1,        // Sample 10% of frames (3fps from 30fps source)
  fps: <from_camera>,         // Uses camera's native framerate (or 30fps for video files)
  clip_length_seconds: 1.0,   // 1-second clips (range: 1-10 seconds)
  delay_seconds: 1.0,         // Process every 1 second (range: 1-clip_length)

  // Model defaults
  backend: "overshoot",       // Use Overshoot's optimized models
  model: "Qwen/Qwen3-VL-30B-A3B-Instruct", // Fast, accurate VLM
}
```

### Tuning Guidelines

- **sampling_ratio**: 0.1-0.5 for 30fps streams. Higher = more detail, more compute
- **clip_length_seconds**: 1-10 seconds. Longer clips = more context, higher latency
- **delay_seconds**: 1 to clip_length seconds. How often to process new clips
- **fps**: Usually leave as auto-detected from camera (30fps fallback for video files)

**Example configurations:**

```typescript
// Fast & responsive (default)
{ sampling_ratio: 0.1, clip_length_seconds: 1.0, delay_seconds: 1.0 }

// More context, still fast
{ sampling_ratio: 0.2, clip_length_seconds: 2.0, delay_seconds: 1.5 }

// Maximum detail
{ sampling_ratio: 0.5, clip_length_seconds: 5.0, delay_seconds: 3.0 }
```

## Available Models

### Overshoot Models (Recommended)

Optimized for low-latency real-time inference:

- **Qwen3-VL-30B-A3B-Instruct** (default) - 30B MoE, best quality, ~300ms latency
- **Qwen3-VL-8B-Instruct** - 8B dense, faster, ~200ms latency
- **InternVL-30B-MoE** - 30B MoE alternative, similar performance

```typescript
const vision = new RealtimeVision({
  backend: "overshoot",
  model: "Qwen/Qwen3-VL-30B-A3B-Instruct", // or "Qwen/Qwen3-VL-8B-Instruct"
  // ...
});
```

### Gemini Models

All Gemini models with video capability are supported:

```typescript
const vision = new RealtimeVision({
  backend: "gemini",
  model: "gemini-2.0-flash-exp", // or other Gemini video models
  // ...
});
```

**Note**: Overshoot models are specifically optimized for this streaming use case and typically achieve lower latency.

## Performance

### Expected Latency

**Overshoot models**:

- **Inference latency**: 300-600ms (model processing time)
- **Total latency**: 350-650ms (end-to-end, frame capture to result)

**Latency is exposed in every result**:

```typescript
onResult: (result, raw) => {
  console.log(raw.inference_latency_ms); // Model processing time
  console.log(raw.total_latency_ms); // End-to-end latency
};
```

### Throughput

- **Results frequency**: ~1 per second (configurable via `delay_seconds`)
- **Concurrent streams**: Depends on backend capacity
- **Frame sampling**: Reduces bandwidth by 80-95% compared to full framerate

## API Reference

### Constructor

```typescript
new RealtimeVision(config: RealtimeVisionConfig)
```

### Configuration

```typescript
interface RealtimeVisionConfig {
  apiUrl: string; // Required: API endpoint
  prompt: string; // Required: Task description
  onResult: (result, raw) => void; // Required: Result handler

  // Video source configuration (NEW!)
  source?: StreamSource; // Defaults to camera with environment facing

  // Optional
  backend?: "overshoot" | "gemini";
  model?: string;
  outputSchema?: Record<string, any>; // JSON Schema for structured output
  onError?: (error: Error) => void;

  // DEPRECATED: Use source instead
  cameraFacing?: "user" | "environment";

  processing?: {
    sampling_ratio?: number;
    fps?: number;
    clip_length_seconds?: number;
    delay_seconds?: number;
  };
  iceServers?: RTCIceServer[];
}

// StreamSource type
type StreamSource =
  | { type: "camera"; cameraFacing: "user" | "environment" }
  | { type: "video"; file: File };
```

### Methods

```typescript
await vision.start(); // Start camera/video & streaming
await vision.stop(); // Stop & cleanup
await vision.updatePrompt(newPrompt); // Change task while running
vision.getMediaStream(); // Get MediaStream for video preview
vision.getStreamId(); // Get current stream ID
vision.isActive(); // Check if running
```

## Structured Output

Use JSON Schema to get type-safe, validated responses:

```typescript
const vision = new RealtimeVision({
  prompt: "Detect objects and return structured data",
  outputSchema: {
    type: "object",
    properties: {
      objects: {
        type: "array",
        items: { type: "string" },
      },
      count: { type: "integer" },
    },
    required: ["objects", "count"],
  },
  onResult: (result, raw) => {
    const data = JSON.parse(result.result);
    console.log(data.objects); // ["person", "car", "tree"]
    console.log(data.count); // 3
  },
});
```

## Writing Effective Prompts

### ✅ Good Prompts (Detection & Extraction)

These work well for continuous perception:

```typescript
// Object detection
"Detect all visible objects and return JSON: {objects: string[], count: number}";

// Text reading
"Read any visible text. Return {text: string | null, confidence: number}";

// State monitoring
"Is the door open or closed? Return {state: 'open' | 'closed'}";

// Structured extraction
"Detect people and return {count: number, positions: Array<'left'|'center'|'right'>}";
```

Be wise about open-ended generation, it is possible but rarely intuitive:

```typescript
// These generate NEW content every second:
"Describe what you see"; // Different description each time
"Write a caption for this scene"; // New caption every second
"Tell me what's interesting"; // Changes constantly
```

### 💡 Pattern: Use Client-Side Deduplication

If you need descriptions, it can be helpful sometimes to deduplicate on the client:

```typescript
let lastDescription = "";

onResult: (result) => {
  const description = result.result;
  if (similarity(description, lastDescription) < 0.8) {
    console.log("Scene changed:", description);
    lastDescription = description;
  }
  // Otherwise ignore - same scene
};
```

## Use Cases

Perfect for:

- **Text/OCR reading** - Real-time text extraction from camera or video
- **Safety monitoring** - PPE detection, hazard identification
- **Accessibility** - Scene description for visually impaired
- **Gesture control** - Hand gesture recognition
- **Document scanning** - Auto-capture when document is aligned
- **Sports analysis** - Player tracking, form analysis
- **Video file analysis** - Analyze pre-recorded videos with AI (NEW!)

Not ideal for:

- **Conversational AI about video** - Use a different API
- **Long-form video analysis** - This is for live streams
- **High-precision tasks requiring memory** - Each stream window is independent

## Video File Support

### Using Video Files

The SDK now supports analyzing uploaded video files in addition to live camera feeds. Video files are automatically looped for continuous analysis:

```typescript
const vision = new RealtimeVision({
  apiUrl: "https://api.overshoot.ai",
  prompt: "Count the number of people in each frame",
  source: {
    type: "video",
    file: videoFile, // File object from input element
  },
  onResult: (result) => {
    console.log(result.result);
  },
});

await vision.start();
```

### Video File Behavior

- **Looping**: Video files automatically loop when they reach the end
- **FPS**: Uses 30 FPS as default for video files (can be overridden in processing config)
- **Cleanup**: Video element and blob URL are properly cleaned up on stop()
- **Formats**: Supports any video format the browser can play (MP4, WebM, etc.)

### Complete Example with File Input

```typescript
// HTML
<input type="file" id="videoInput" accept="video/*" />
<button id="startBtn">Start Analysis</button>
<button id="stopBtn">Stop</button>

// JavaScript
const fileInput = document.getElementById('videoInput');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

let vision = null;

startBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) {
    alert('Please select a video file');
    return;
  }

  vision = new RealtimeVision({
    apiUrl: 'https://api.overshoot.ai',
    prompt: 'Describe what is happening in the video',
    source: {
      type: 'video',
      file: file,
    },
    onResult: (result) => {
      console.log('Analysis:', result.result);
    },
    onError: (error) => {
      console.error('Error:', error);
    },
  });

  await vision.start();
  console.log('Video analysis started');
});

stopBtn.addEventListener('click', async () => {
  if (vision) {
    await vision.stop();
    console.log('Video analysis stopped');
  }
});
```

## Important Notes

1. **State Management**: The SDK has no memory between inferences. If you need state (e.g., "scene changed"), manage it client-side.

2. **Latency Metrics**: Both `inference_latency_ms` (model time) and `total_latency_ms` (end-to-end) are provided in every result for performance monitoring.

3. **Camera Permissions**: The SDK requires camera permissions when using camera source. Handle denials gracefully with `onError`.

4. **Cleanup**: Always call `stop()` to release camera/video and network resources.

5. **No Browser Storage**: The SDK doesn't use localStorage/sessionStorage - all state is in-memory during the session.

6. **WebRTC Requirements**: Requires modern browser with WebRTC support. Works on mobile (iOS Safari, Android Chrome) and desktop.

7. **Network**: Uses WebSocket for results. Ensure your environment allows WebSocket connections.

8. **Video File Looping**: When using video files, the video automatically loops. Each loop is analyzed independently with no memory of previous loops.

## Migration Guide

### Upgrading from Previous Versions

If you're using the `cameraFacing` property, it will continue to work but is now deprecated:

```typescript
// Old way (still works)
const vision = new RealtimeVision({
  cameraFacing: "environment",
  // ...
});

// New way (recommended)
const vision = new RealtimeVision({
  source: {
    type: "camera",
    cameraFacing: "environment",
  },
  // ...
});
```

## Future Development Guide

When extending this SDK or creating new features:

- **Explicit defaults, not implicit fallbacks**: do not silently fallback on wrong states, prefer to throw an error. Defaults should be clear and well defined.
- **Keep the perception stream mental model**: Not conversational, continuous monitoring
- **Prioritize latency visibility**: Always expose timing metrics
- **Maintain defaults**: Keep the zero-config path working well
- **Type safety**: Leverage TypeScript for better DX
- **Error handling**: Fail gracefully, provide actionable error messages

This SDK is designed to be LLM-friendly for code generation. The patterns and examples should enable AI assistants to quickly generate working demos for various use cases.
