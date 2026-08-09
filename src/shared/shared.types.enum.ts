// Auth & Access Control

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  USER = "USER",
}

// General / Financial

export enum Currency {
  USD = "USD",
  INR = "INR",
  EUR = "EUR",
  GBP = "GBP",
}

// Subscription

export enum SubscriptionPlanType {
  FREE = "free",
  DAILY = "daily",
  MONTHLY = "monthly",
  YEARLY = "yearly",
  CUSTOM = "custom",
}

export enum UserSubscriptionStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

// AI Services

export enum ServiceType {
  CHAT = "CHAT",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  BUSINESS = "BUSINESS",
  ASSETS = "ASSETS",
}

export enum AIProvider {
  OPENAI = "OPENAI",
  ANTHROPIC = "ANTHROPIC",
  GEMINI = "GEMINI",
  GROK = "GROK",
  DEEPSEEK = "DEEPSEEK",
}

// Token System

export enum TokenTransactionType {
  PURCHASE = "PURCHASE",                     // user bought a token package
  CONSUMPTION = "CONSUMPTION",               // AI request deducted tokens
  REFUND = "REFUND",                         // admin/system refund
  BONUS = "BONUS",                           // signup bonus, promo credit
  ADJUSTMENT = "ADJUSTMENT",                 // manual admin correction
  SUBSCRIPTION_GRANT = "SUBSCRIPTION_GRANT", // new cycle allotment issued
  ROLLOVER_CARRY = "ROLLOVER_CARRY",         // leftover moved into grace bucket
  EXPIRY = "EXPIRY",                         // unused tokens forfeited
}

export enum TokenBucket {
  PURCHASED = "PURCHASED",           // non-expiring (signup bonus, packages, refunds)
  CURRENT_CYCLE = "CURRENT_CYCLE",   // this cycle's subscription allotment
  CARRY_OVER = "CARRY_OVER", 
  Wallet = "Wallet",        // rolled-over tokens, 1-cycle grace, then forfeited
}

export enum TokenPackageStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

// Audit Logging

export enum AuditAction {
  // Subscription Plan (admin)
  SUBSCRIPTION_PLAN_CREATED = "SUBSCRIPTION_PLAN_CREATED",
  SUBSCRIPTION_PLAN_UPDATED = "SUBSCRIPTION_PLAN_UPDATED",
  SUBSCRIPTION_PLAN_DELETED = "SUBSCRIPTION_PLAN_DELETED",

  // User Subscription
  USER_SUBSCRIPTION_CREATED = "USER_SUBSCRIPTION_CREATED",
  USER_SUBSCRIPTION_CANCELLED = "USER_SUBSCRIPTION_CANCELLED",
  USER_SUBSCRIPTION_EXPIRED = "USER_SUBSCRIPTION_EXPIRED",
  USER_SUBSCRIPTION_RENEWED = "USER_SUBSCRIPTION_RENEWED",

  // Token Wallet
  WALLET_ADJUSTMENT = "WALLET_ADJUSTMENT",
  WALLET_REFUND = "WALLET_REFUND",

  // Token Package (admin)
  TOKEN_PACKAGE_CREATED = "TOKEN_PACKAGE_CREATED",
  TOKEN_PACKAGE_UPDATED = "TOKEN_PACKAGE_UPDATED",
  TOKEN_PACKAGE_STATUS_TOGGLED = "TOKEN_PACKAGE_STATUS_TOGGLED",

  // Provider & Service Config
  PROVIDER_CREATED = "PROVIDER_CREATED",
  PROVIDER_UPDATED = "PROVIDER_UPDATED",
  PROVIDER_DELETED = "PROVIDER_DELETED",
  PROVIDER_STATUS_TOGGLED = "PROVIDER_STATUS_TOGGLED",
  SERVICE_CONFIG_UPDATED = "SERVICE_CONFIG_UPDATED",

  // User Management
  USER_ROLE_CHANGED = "USER_ROLE_CHANGED",
  USER_BANNED = "USER_BANNED",
  USER_UNBANNED = "USER_UNBANNED",

  // Auth
  ADMIN_LOGIN = "ADMIN_LOGIN",
  ADMIN_PASSWORD_RESET = "ADMIN_PASSWORD_RESET",
}

export enum AuditModule {
  SUBSCRIPTION_PLAN = "SUBSCRIPTION_PLAN",
  USER_SUBSCRIPTION = "USER_SUBSCRIPTION",
  TOKEN_WALLET = "TOKEN_WALLET",
  TOKEN_TRANSACTION = "TOKEN_TRANSACTION",
  TOKEN_PACKAGE = "TOKEN_PACKAGE",
  PROVIDER_CONFIG = "PROVIDER_CONFIG",
  SERVICE_CONFIG = "SERVICE_CONFIG",
  USER = "USER",
  AUTH = "AUTH",
}

// Background Jobs

export enum BullMQQueue {
  SUBSCRIPTION_RENEWAL = "subscription-renewal",
  TOKEN_EXPIRY = "token-expiry",
  EMAIL = "email",
  AUDIT_ARCHIVAL = "audit-archival",
  ANALYTICS_AGGREGATION = "analytics-aggregation",
  WEBHOOK_RETRY = "webhook-retry",
}

export enum JobName {
  PROCESS_SUBSCRIPTION_RENEWAL = "process-subscription-renewal",
  PROCESS_SUBSCRIPTION_EXPIRY = "process-subscription-expiry",
  SEND_EMAIL = "send-email",
  AGGREGATE_DAILY_ANALYTICS = "aggregate-daily-analytics",
  ARCHIVE_AUDIT_LOGS = "archive-audit-logs",
  // Added while wiring the BullMQ layer — BullMQQueue.TOKEN_EXPIRY and
  // BullMQQueue.WEBHOOK_RETRY existed with no corresponding job names.
  PROCESS_TOKEN_EXPIRY = "process-token-expiry",
  RETRY_WEBHOOK_DELIVERY = "retry-webhook-delivery",
}