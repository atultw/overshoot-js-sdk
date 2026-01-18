import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RealtimeVision } from "../RealtimeVision";

describe("RealtimeVision - PNG Stream", () => {
  let mockFetch: any;
  let mockWebSocket: any;

  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stream_id: "test-stream-id",
        webrtc: { type: "answer", sdp: "mock-sdp" },
        lease: { ttl_seconds: 300 },
      }),
    });
    global.fetch = mockFetch;

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      onopen: null as any,
      onmessage: null as any,
      onerror: null as any,
      onclose: null as any,
    };

    // @ts-ignore
    global.WebSocket = vi.fn(() => mockWebSocket);

    // Mock RTCPeerConnection
    const mockPeerConnection = {
      addTrack: vi.fn(),
      createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "mock-sdp" }),
      setLocalDescription: vi.fn(),
      setRemoteDescription: vi.fn(),
      localDescription: { type: "offer", sdp: "mock-sdp" },
      close: vi.fn(),
      onicecandidate: null as any,
      oniceconnectionstatechange: null as any,
    };

    // @ts-ignore
    global.RTCPeerConnection = vi.fn(() => mockPeerConnection);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("PNG Stream Configuration", () => {
    it("should accept png-stream source type with default dimensions", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "https://api.test.com",
          apiKey: "test-key",
          prompt: "test prompt",
          source: {
            type: "png-stream",
          },
          onResult: () => {},
        });
      }).not.toThrow();
    });

    it("should accept png-stream with custom dimensions", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "https://api.test.com",
          apiKey: "test-key",
          prompt: "test prompt",
          source: {
            type: "png-stream",
            width: 1920,
            height: 1080,
            targetFps: 30,
          },
          onResult: () => {},
        });
      }).not.toThrow();
    });

    it("should reject negative width", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "https://api.test.com",
          apiKey: "test-key",
          prompt: "test prompt",
          source: {
            type: "png-stream",
            width: -100,
          },
          onResult: () => {},
        });
      }).toThrow("png-stream width must be positive");
    });

    it("should reject negative height", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "https://api.test.com",
          apiKey: "test-key",
          prompt: "test prompt",
          source: {
            type: "png-stream",
            height: -100,
          },
          onResult: () => {},
        });
      }).toThrow("png-stream height must be positive");
    });

    it("should reject invalid targetFps (too low)", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "https://api.test.com",
          apiKey: "test-key",
          prompt: "test prompt",
          source: {
            type: "png-stream",
            targetFps: 0,
          },
          onResult: () => {},
        });
      }).toThrow("targetFps must be between");
    });

    it("should reject invalid targetFps (too high)", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "https://api.test.com",
          apiKey: "test-key",
          prompt: "test prompt",
          source: {
            type: "png-stream",
            targetFps: 150,
          },
          onResult: () => {},
        });
      }).toThrow("targetFps must be between");
    });

    it("should accept valid targetFps", () => {
      expect(() => {
        new RealtimeVision({
          apiUrl: "https://api.test.com",
          apiKey: "test-key",
          prompt: "test prompt",
          source: {
            type: "png-stream",
            targetFps: 60,
          },
          onResult: () => {},
        });
      }).not.toThrow();
    });
  });

  describe("pushFrame method", () => {
    let vision: RealtimeVision;

    beforeEach(() => {
      vision = new RealtimeVision({
        apiUrl: "https://api.test.com",
        apiKey: "test-key",
        prompt: "test prompt",
        source: {
          type: "png-stream",
          width: 640,
          height: 480,
        },
        onResult: () => {},
      });
    });

    it("should throw error if called before start()", async () => {
      const blob = new Blob(["fake-image-data"], { type: "image/png" });
      await expect(vision.pushFrame(blob)).rejects.toThrow(
        "Stream is not running",
      );
    });

    it("should throw error if source type is not png-stream", async () => {
      const cameraVision = new RealtimeVision({
        apiUrl: "https://api.test.com",
        apiKey: "test-key",
        prompt: "test prompt",
        source: {
          type: "camera",
          cameraFacing: "user",
        },
        onResult: () => {},
      });

      // Mock getUserMedia
      const mockStream = {
        getVideoTracks: () => [
          {
            getSettings: () => ({ frameRate: 30 }),
          },
        ],
        getTracks: () => [],
      };
      // @ts-ignore
      navigator.mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      };

      await cameraVision.start();
      const blob = new Blob(["fake-image-data"], { type: "image/png" });
      await expect(cameraVision.pushFrame(blob)).rejects.toThrow(
        "pushFrame() can only be used with png-stream source type",
      );
      await cameraVision.stop();
    });
  });

  describe("Canvas Stream Creation", () => {
    it("should create canvas with default dimensions", async () => {
      const vision = new RealtimeVision({
        apiUrl: "https://api.test.com",
        apiKey: "test-key",
        prompt: "test prompt",
        source: {
          type: "png-stream",
        },
        onResult: () => {},
      });

      // Mock canvas methods
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }),
        captureStream: vi.fn().mockReturnValue({
          getVideoTracks: () => [{}],
        }),
        remove: vi.fn(),
      };

      vi.spyOn(document, "createElement").mockReturnValue(
        mockCanvas as any,
      );

      await vision.start();

      expect(mockCanvas.width).toBe(1280); // Default width
      expect(mockCanvas.height).toBe(720); // Default height
      expect(mockCanvas.captureStream).toHaveBeenCalledWith(30); // Default FPS

      await vision.stop();
    });

    it("should create canvas with custom dimensions", async () => {
      const vision = new RealtimeVision({
        apiUrl: "https://api.test.com",
        apiKey: "test-key",
        prompt: "test prompt",
        source: {
          type: "png-stream",
          width: 1920,
          height: 1080,
          targetFps: 60,
        },
        onResult: () => {},
      });

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }),
        captureStream: vi.fn().mockReturnValue({
          getVideoTracks: () => [{}],
        }),
        remove: vi.fn(),
      };

      vi.spyOn(document, "createElement").mockReturnValue(
        mockCanvas as any,
      );

      await vision.start();

      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1080);
      expect(mockCanvas.captureStream).toHaveBeenCalledWith(60);

      await vision.stop();
    });
  });
});
