# RealtimeVision SDK

A TypeScript SDK for real-time AI vision analysis on live video streams and uploaded videos with sub-second latency.

## What It Does

RealtimeVision enables continuous AI inference on camera feeds or video files with ~300ms latency. The SDK handles WebRTC streaming, frame sampling, and model inference, providing a simple interface to get structured AI analysis of video content.

**This is a perception stream, not a conversational AI.** The SDK continuously analyzes video segments and returns independent results ~1 per second. Each result has no memory of previous frames—think of it like a smart sensor that watches and reports, not a chatbot that discusses what it sees.

Perfect for: text/OCR reading, object detection, safety monitoring, gesture recognition, accessibility features, document scanning, and real-time video analysis.

## Core Concept: Perception Streams

Unlike conversational vision APIs, RealtimeVision operates as a continuous perception pipeline:

1. **Capture**: Access device camera or stream uploaded video file
2. **Sample**: Extract frames at configurable ratio (default: 10% of frames)
3. **Bundle**: Create short video clips from sampled frames (default: 1 second clips)
4. **Analyze**: Send clips to AI models for inference
5. **Stream**: Receive structured results via WebSocket with latency metrics

This architecture enables:

- **Sub-second latency**: Results arrive ~300ms after frames are captured (with Overshoot models)
- **Efficient processing**: Sample only needed frames, reducing bandwidth by 80-95%
- **Continuous operation**: Stream processes indefinitely without accumulating state
- **Structured output**: JSON responses matching your schema

## Quick Start

### Installation

```bash
# Clone repository
git clone [your-repo-url]
cd realtime-vision

# Install dependencies
npm install

# Configure API endpoint
echo 'VITE_API_URL=https://your-api-endpoint' > .env
```

### Using Live Camera

```typescript
import { RealtimeVision } from "@sdk/client";

const vision = new RealtimeVision({
  apiUrl: import.meta.env.VITE_API_URL,
  prompt:
    "Read any visible text and return JSON: {text: string | null, confidence: number}",
  onResult: (result) => {
    console.log(result.result); // The AI's response
    console.log(`Latency: ${result.total_latency_ms}ms`); // e.g., 320ms
  },
  onError: (error) => {
    console.error("Stream error:", error);
  },
});

await vision.start();
// Camera is now streaming, results arrive ~1/second

// Update task while streaming
await vision.updatePrompt("Detect all visible objects");

await vision.stop();
```

### Using Video File

```typescript
import { RealtimeVision } from "@sdk/client";

// Get file from user input
const fileInput = document.querySelector('input[type="file"]');
const videoFile = fileInput.files[0];

const vision = new RealtimeVision({
  apiUrl: import.meta.env.VITE_API_URL,
  prompt: "Count people in the frame and return {count: number}",
  source: {
    type: "video",
    file: videoFile,
  },
  onResult: (result) => {
    const data = JSON.parse(result.result);
    console.log(`People count: ${data.count}`);
  },
});

await vision.start();
// Video file loops automatically, results arrive ~1/second
await vision.stop();
```

## Common Patterns

### Object Detection with Structured Output

```typescript
const vision = new RealtimeVision({
  apiUrl: import.meta.env.VITE_API_URL,
  prompt: "Detect all visible objects",
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
  onResult: (result) => {
    const data = JSON.parse(result.result);
    console.log(data.objects); // ["person", "car", "tree"]
    console.log(data.count); // 3
  },
});
```

### Text/OCR Reading

```typescript
const vision = new RealtimeVision({
  apiUrl: import.meta.env.VITE_API_URL,
  prompt:
    "Read any visible text. Return {text: string | null, confidence: number}",
  outputSchema: {
    type: "object",
    properties: {
      text: { type: ["string", "null"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["text", "confidence"],
  },
  onResult: (result) => {
    const data = JSON.parse(result.result);
    if (data.text && data.confidence > 0.8) {
      console.log("High confidence text:", data.text);
    }
  },
});
```

### State Monitoring

```typescript
const vision = new RealtimeVision({
  apiUrl: import.meta.env.VITE_API_URL,
  prompt:
    "Is the door open or closed? Return {state: 'open' | 'closed', confidence: number}",
  outputSchema: {
    type: "object",
    properties: {
      state: { type: "string", enum: ["open", "closed"] },
      confidence: { type: "number" },
    },
    required: ["state", "confidence"],
  },
  onResult: (result) => {
    const data = JSON.parse(result.result);
    console.log(
      `Door is ${data.state} (${Math.round(data.confidence * 100)}% confident)`,
    );
  },
});
```

### Client-Side Deduplication for Descriptions

Since each inference is independent, descriptions will vary. Deduplicate client-side:

```typescript
let lastDescription = "";

const vision = new RealtimeVision({
  apiUrl: import.meta.env.VITE_API_URL,
  prompt: "Describe the scene in one sentence",
  onResult: (result) => {
    const description = result.result;

    // Simple similarity check (you can use more sophisticated methods)
    if (description !== lastDescription) {
      console.log("Scene changed:", description);
      lastDescription = description;
      // Update UI, trigger action, etc.
    }
  },
});
```

### Video Preview Display

```typescript
const vision = new RealtimeVision({
  apiUrl: import.meta.env.VITE_API_URL,
  prompt: "Detect objects",
  onResult: (result) => {
    console.log(result.result);
  },
});

await vision.start();

// Display video preview
const videoElement = document.querySelector("video");
const stream = vision.getMediaStream();
if (stream && videoElement) {
  videoElement.srcObject = stream;
}
```

## Configuration Reference

### RealtimeVisionConfig

```typescript
interface RealtimeVisionConfig {
  // Required
  apiUrl: string; // API endpoint URL
  prompt: string; // Task description for AI
  onResult: (result: StreamInferenceResult) => void; // Result handler

  // Optional
  source?: StreamSource; // Video source (defaults to back camera)
  backend?: "overshoot" | "gemini"; // Model backend (default: "overshoot")
  model?: string; // Model name (default: "Qwen/Qwen3-VL-30B-A3B-Instruct")
  outputSchema?: object; // JSON Schema for structured output
  onError?: (error: Error) => void; // Error handler
  processing?: ProcessingConfig; // Frame sampling and clip configuration
  iceServers?: RTCIceServer[]; // WebRTC ICE servers
}
```

### StreamSource

```typescript
type StreamSource =
  | { type: "camera"; cameraFacing: "user" | "environment" }
  | { type: "video"; file: File };

// Examples:
source: { type: "camera", cameraFacing: "environment" }  // Back camera (default)
source: { type: "camera", cameraFacing: "user" }         // Front camera
source: { type: "video", file: videoFile }               // Uploaded video
```

### Processing Configuration

```typescript
interface ProcessingConfig {
  sampling_ratio?: number; // 0-1, default: 0.1 (sample 10% of frames)
  fps?: number; // 1-120, default: auto-detected from source
  clip_length_seconds?: number; // 0.1-60, default: 1.0
  delay_seconds?: number; // 0-60, default: 1.0
}
```

**Defaults (optimized for lowest latency):**

- `sampling_ratio: 0.1` - Sample 10% of frames (3fps from 30fps source)
- `fps: auto` - Uses camera's native framerate or 30fps for video files
- `clip_length_seconds: 1.0` - 1-second clips
- `delay_seconds: 1.0` - Process new clip every second

**When to adjust:**

- **Need more context?** → Increase `clip_length_seconds` to 2-5 (increases latency)
- **Analyzing slow-moving scenes?** → Decrease `sampling_ratio` to 0.05 (reduces compute)
- **Need faster results?** → Keep defaults (already optimized)
- **Processing high-motion video?** → Increase `sampling_ratio` to 0.2-0.5 (more detail)

## Available Models

### Overshoot Models (Recommended)

Optimized for low-latency real-time inference with ~300ms total latency:

```typescript
backend: "overshoot";

// Models (in order of speed/quality tradeoff):
model: "Qwen/Qwen3-VL-8B-Instruct"; // Fastest, ~200ms latency
model: "Qwen/Qwen3-VL-30B-A3B-Instruct"; // Best quality, ~300ms latency (default)
model: "OpenGVLab/InternVL3_5-30B-A3B"; // Alternative, similar performance
```

### Gemini Models

All Gemini models with video capability are supported:

```typescript
backend: "gemini";

// Available models:
model: "gemini-2.0-flash-exp";
model: "gemini-2.0-flash";
model: "gemini-2.0-flash-lite";
model: "gemini-2.5-flash";
model: "gemini-2.5-flash-lite";
model: "gemini-2.5-pro";
model: "gemini-3-flash-preview";
model: "gemini-3-pro-preview";
```

**Recommendation:** Use Overshoot models for lowest latency. They're specifically optimized for this streaming use case.

## Writing Effective Prompts

### ✅ Good Prompts (Detection & Extraction)

These work well for continuous perception:

```typescript
// Object detection
"Detect all visible objects and return {objects: string[], count: number}";

// Text reading
"Read any visible text. Return {text: string | null, confidence: number}";

// State monitoring
"Is the door open or closed? Return {state: 'open' | 'closed'}";

// Gesture recognition
"Detect hand gesture and return {gesture: 'thumbs_up' | 'wave' | 'peace' | 'none'}";

// Safety monitoring
"Detect if person is wearing hard hat. Return {wearing_hardhat: boolean, confidence: number}";

// Position tracking
"Detect people and return {count: number, positions: Array<'left'|'center'|'right'>}";
```

### ⚠️ Descriptive Prompts (Use with Deduplication)

These generate new content every second—use client-side deduplication:

```typescript
// Will generate different description each time
"Describe what you see in one sentence";

// Will generate new caption every second
"Write a brief caption for this scene";

// Changes constantly
"What's the most interesting thing visible?";
```

**Pattern:** For descriptions, deduplicate on client side (see Common Patterns section above).

### ❌ Avoid

```typescript
// Don't ask for conversational responses
"Tell me about what you see and why it's interesting"; // Too open-ended

// Don't request memory of previous frames
"What changed since last time?"; // SDK has no memory

// Don't ask for multi-step reasoning
"Analyze the scene, explain the context, and suggest actions"; // Too complex for perception stream
```

## API Reference

### Methods

```typescript
// Start camera/video and streaming
await vision.start();

// Stop streaming and cleanup resources
await vision.stop();

// Update prompt while streaming (no restart needed)
await vision.updatePrompt(newPrompt: string);

// Get MediaStream for video preview
vision.getMediaStream(): MediaStream | null;

// Get current stream ID
vision.getStreamId(): string | null;

// Check if stream is active
vision.isActive(): boolean;

// Submit user feedback (optional)
await vision.submitFeedback({
  rating: 4,           // 1-5
  category: "accuracy",
  feedback: "Works great for text detection"
});
```

### Result Object

```typescript
interface StreamInferenceResult {
  id: string; // Unique result ID
  stream_id: string; // Stream session ID
  model_backend: "gemini" | "overshoot";
  model_name: string; // Model used for inference
  prompt: string; // Prompt that generated this result
  result: string; // AI response (text or JSON string)
  inference_latency_ms: number; // Model processing time
  total_latency_ms: number; // End-to-end latency (capture to result)
  ok: boolean; // Success status
  error: string | null; // Error message if any
}
```

## Error Handling

```typescript
const vision = new RealtimeVision({
  apiUrl: import.meta.env.VITE_API_URL,
  prompt: "Detect objects",
  onResult: (result) => {
    if (!result.ok) {
      console.error("Inference error:", result.error);
      return;
    }
    console.log(result.result);
  },
  onError: (error) => {
    // Handle fatal errors (camera permission, network issues, etc.)
    if (error.message.includes("Permission denied")) {
      console.error("Camera permission denied");
      // Show UI to request permission
    } else if (error.message.includes("WebSocket")) {
      console.error("Network connection lost");
      // Show reconnection UI
    } else {
      console.error("Stream error:", error);
    }
  },
});

try {
  await vision.start();
} catch (error) {
  console.error("Failed to start stream:", error);
  // Handle startup errors
}
```

## Video File Usage

### Complete Example with File Input

```html
<!-- HTML -->
<input type="file" id="videoInput" accept="video/*" />
<button id="startBtn">Start Analysis</button>
<button id="stopBtn">Stop</button>
<video id="preview" autoplay muted></video>
<div id="results"></div>
```

```typescript
// JavaScript/TypeScript
const fileInput = document.getElementById("videoInput") as HTMLInputElement;
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const preview = document.getElementById("preview") as HTMLVideoElement;
const resultsDiv = document.getElementById("results");

let vision: RealtimeVision | null = null;

startBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    alert("Please select a video file");
    return;
  }

  vision = new RealtimeVision({
    apiUrl: import.meta.env.VITE_API_URL,
    prompt: "Describe what is happening in the video in one sentence",
    source: {
      type: "video",
      file: file,
    },
    onResult: (result) => {
      resultsDiv.innerHTML = `
        <div>
          <strong>Result:</strong> ${result.result}<br>
          <strong>Latency:</strong> ${result.total_latency_ms}ms
        </div>
      `;
    },
    onError: (error) => {
      console.error("Error:", error);
      alert(`Error: ${error.message}`);
    },
  });

  await vision.start();

  // Show video preview
  const stream = vision.getMediaStream();
  if (stream) {
    preview.srcObject = stream;
  }
});

stopBtn.addEventListener("click", async () => {
  if (vision) {
    await vision.stop();
    preview.srcObject = null;
    vision = null;
  }
});
```

### Video File Behavior

- **Automatic looping**: Video files loop continuously when they reach the end
- **FPS detection**: Uses 30 FPS as default for video files (can override in `processing.fps`)
- **Supported formats**: Any video format the browser can play (MP4, WebM, etc.)
- **Cleanup**: Video element and blob URL are automatically cleaned up on `stop()`

## Performance & Latency

### Expected Latency (Overshoot Models)

- **Inference latency**: 200-600ms (model processing time only)
- **Total latency**: 300-650ms (end-to-end: frame capture → result)

Both metrics are included in every result:

```typescript
onResult: (result) => {
  console.log(result.inference_latency_ms); // Model processing time
  console.log(result.total_latency_ms); // End-to-end latency
};
```

### Throughput

- **Result frequency**: ~1 per second (configurable via `delay_seconds`)
- **Frame sampling**: Reduces bandwidth by 80-95% vs full framerate
- **Concurrent streams**: Depends on backend capacity

### Optimization Tips

**For lowest latency (default configuration):**

```typescript
processing: {
  sampling_ratio: 0.1,
  clip_length_seconds: 1.0,
  delay_seconds: 1.0
}
```

**For more context (higher latency):**

```typescript
processing: {
  sampling_ratio: 0.2,          // More frames
  clip_length_seconds: 2.0,     // Longer clips
  delay_seconds: 1.5           // Slightly longer delay
}
```

**For high-motion video (more detail):**

```typescript
processing: {
  sampling_ratio: 0.3,          // Capture more motion
  clip_length_seconds: 1.5,
  delay_seconds: 1.0
}
```

## Use Cases

**Ideal for:**

- **Text/OCR reading**: Real-time text extraction from camera or video
- **Object detection**: Continuous monitoring of objects in frame
- **Safety monitoring**: PPE detection, hazard identification
- **Accessibility**: Scene description for visually impaired users
- **Gesture control**: Hand gesture recognition for interfaces
- **Document scanning**: Auto-capture when document is properly aligned
- **Quality control**: Defect detection on production lines
- **Sports analysis**: Player tracking, form analysis
- **Video file analysis**: Analyze pre-recorded videos with AI

**Not ideal for:**

- **Conversational AI about video**: Use a different API designed for chat
- **Tasks requiring memory**: Each inference is independent, no context between results
- **Long-form video understanding**: This is for real-time streams, not full video comprehension

## Important Notes

1. **No Memory Between Inferences**: The SDK has no memory between results. Each inference sees only the current clip. If you need state tracking (e.g., "scene changed"), implement it client-side.

2. **Latency Metrics**: Both `inference_latency_ms` (model time) and `total_latency_ms` (end-to-end) are provided in every result for performance monitoring.

3. **Camera Permissions**: The SDK requires camera permissions when using camera source. Handle denials gracefully with `onError`.

4. **Resource Cleanup**: Always call `stop()` to release camera/video and network resources. This closes WebSocket connections and stops media streams.

5. **No Browser Storage**: The SDK doesn't use localStorage/sessionStorage—all state is in-memory during the session.

6. **WebRTC Requirements**: Requires modern browser with WebRTC support. Works on mobile (iOS Safari 11+, Android Chrome 56+) and desktop (Chrome 56+, Firefox 44+, Safari 11+, Edge 79+).

7. **Video File Looping**: When using video files, the video automatically loops. Each loop is analyzed independently with no memory of previous loops.

8. **Structured Output**: When using `outputSchema`, the AI will return JSON matching your schema. Always parse the `result` string with `JSON.parse()` when using schemas.

## Development & Contributing

### Project Structure

```
├── sdk/
│   └── client/
│       ├── client.ts           # HTTP client for API
│       ├── RealtimeVision.ts   # Main SDK class
│       ├── types.ts            # TypeScript types
│       └── errors.ts           # Error classes
├── src/                        # Playground demo app
│   ├── components/
│   │   ├── ConfigView.tsx      # Configuration form
│   │   └── StreamView.tsx      # Live stream display
│   └── App.tsx                 # Main app
└── README.md
```

### Running the Playground

```bash
# Install dependencies
npm install

# Set API URL
echo 'VITE_API_URL=https://your-api-endpoint' > .env

# Start dev server
npm run dev
```

### Building

```bash
npm run build
```

## Future Development Guidelines

When extending this SDK:

- **Explicit defaults, not implicit fallbacks**: Throw errors on invalid states rather than silently falling back
- **Keep the perception stream model**: Not conversational, continuous monitoring
- **Prioritize latency visibility**: Always expose timing metrics
- **Maintain zero-config path**: Defaults should work well out of the box
- **Type safety**: Leverage TypeScript for better developer experience
- **Fail gracefully**: Provide actionable error messages

## Support

For questions, issues, or feature requests, contact the team or open an issue in the repository.

---

**Note:** This SDK is designed to be LLM-friendly for code generation. The patterns and examples enable AI assistants to quickly generate working demos for various use cases.
