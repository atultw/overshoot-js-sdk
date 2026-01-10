import type {
  StreamCreateRequest,
  StreamCreateResponse,
  KeepaliveResponse,
  StreamConfigResponse,
  FeedbackCreateRequest,
  FeedbackResponse,
  StatusResponse,
  ErrorResponse,
} from "./types";
import {
  ApiError,
  ValidationError,
  NotFoundError,
  NetworkError,
  ServerError,
} from "./errors";

type ClientConfig = {
  baseUrl: string;
};

export class StreamClient {
  private baseUrl: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          error: "unknown_error",
          message: response.statusText,
        }));

        const message = errorData.message || errorData.error;

        if (response.status === 422 || response.status === 400) {
          throw new ValidationError(
            message,
            errorData.request_id,
            errorData.details,
          );
        }
        if (response.status === 404) {
          throw new NotFoundError(message, errorData.request_id);
        }
        if (response.status >= 500) {
          throw new ServerError(
            message,
            errorData.request_id,
            errorData.details,
          );
        }

        throw new ApiError(
          message,
          response.status,
          errorData.request_id,
          errorData.details,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new NetworkError(`Network error: ${error.message}`, error);
      }

      throw new NetworkError("Unknown network error");
    }
  }

  async createStream(
    request: StreamCreateRequest,
  ): Promise<StreamCreateResponse> {
    return this.request<StreamCreateResponse>("/streams", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async renewLease(streamId: string): Promise<KeepaliveResponse> {
    return this.request<KeepaliveResponse>(`/streams/${streamId}/keepalive`, {
      method: "POST",
    });
  }

  async updatePrompt(
    streamId: string,
    prompt: string,
  ): Promise<StreamConfigResponse> {
    return this.request<StreamConfigResponse>(
      `/streams/${streamId}/config/prompt`,
      {
        method: "PATCH",
        body: JSON.stringify({ prompt }),
      },
    );
  }

  async submitFeedback(
    streamId: string,
    feedback: FeedbackCreateRequest,
  ): Promise<StatusResponse> {
    return this.request<StatusResponse>(`/streams/${streamId}/feedback`, {
      method: "POST",
      body: JSON.stringify(feedback),
    });
  }

  async getAllFeedback(): Promise<FeedbackResponse[]> {
    return this.request<FeedbackResponse[]>("/streams/feedback", {
      method: "GET",
    });
  }

  connectWebSocket(streamId: string): WebSocket {
    const wsUrl = this.baseUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");
    return new WebSocket(`${wsUrl}/ws/streams/${streamId}`);
  }

  async healthCheck(): Promise<string> {
    const url = `${this.baseUrl}/healthz`;
    const response = await fetch(url);
    return response.text();
  }
}
