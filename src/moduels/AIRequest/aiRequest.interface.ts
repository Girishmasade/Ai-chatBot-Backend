import type { AIService } from "../service-config/service-config.types.js";
import type { ProviderName } from "../Provider/provider-config.types.js";
import type { AIRequestPriority, AIRequestStatus } from "./aiRequest.type.js";
import type { Document } from "mongoose";

// Document interface  (mirrors the Mongoose schema shape)
export interface IAIRequest {
  _id:            string;
  user:           Object;                // ObjectId ref → User
  service:        AIService;             // which AI service was invoked
  provider:       ProviderName;          // which provider handled it
  status:         AIRequestStatus;
  priority:       AIRequestPriority;

  /** The user-facing prompt / input text. */
  prompt:         string;

  /** Raw AI response payload (text, image URL, etc.). */
  response?:      string;

  /** Token cost charged for this request. */
  tokenCost:      number;

  /** Reference to the TokenTransaction created on consumption. */
  transactionId?: string;               // ObjectId ref → TokenTransaction

  /** Model identifier used by the provider (e.g. "llama-3.3-70b"). */
  model?:         string;

  /** Provider-reported latency in milliseconds. */
  latencyMs?:     number;

  /** Error message when status is FAILED. */
  errorMessage?:  string;

  /** Arbitrary metadata (tool calls, image dimensions, etc.). */
  metadata?:      Record<string, any>;

  /** IP address of the client that originated the request. */
  ip?:            string;

  createdAt:      Date;
  updatedAt:      Date;
}

// DTOs

export interface CreateAIRequestDTO {
  service:   AIService;
  prompt:    string;
  provider?: ProviderName;
  priority?: AIRequestPriority;
  model?:    string;
  metadata?: Record<string, any>;
}

export interface UpdateAIRequestDTO {
  status?:       AIRequestStatus;
  response?:     string;
  tokenCost?:    number;
  transactionId?: string;
  latencyMs?:    number;
  errorMessage?: string;
  metadata?:     Record<string, any>;
}

// Query / filter interface (for listing & admin dashboard)

export interface AIRequestQuery {
  userId?:    string;
  service?:   AIService;
  provider?:  ProviderName;
  status?:    AIRequestStatus;
  priority?:  AIRequestPriority;
  startDate?: string;             // ISO date string
  endDate?:   string;             // ISO date string
  page?:      number;
  limit?:     number;
  sortBy?:    "createdAt" | "tokenCost" | "latencyMs";
  sortOrder?: "asc" | "desc";
}

// API response shape (controller → client)

export interface AIRequestResponse {
  _id:         string;
  user:        string;
  service:     AIService;
  provider:    ProviderName;
  status:      AIRequestStatus;
  priority:    AIRequestPriority;
  prompt:      string;
  response?:   string;
  tokenCost:   number;
  model?:      string;
  latencyMs?:  number;
  errorMessage?: string;
  metadata?:   Record<string, any>;
  createdAt:   Date;
  updatedAt:   Date;
}
