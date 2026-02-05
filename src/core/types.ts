import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config/index.js';
import type { Logger } from './logger.js';

export interface ModuleHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  endpoint?: string;
  details?: Record<string, unknown>;
}

export interface Module {
  name: string;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<ModuleHealth>;
}

export interface ModuleContext {
  config: AppConfig;
  logger: Logger;
  registerWebhook: (handler: WebhookHandler, endpoint: string) => string;
  registerMcpProxy: (handler: McpProxyHandler, endpoint: string) => string;
  registerPoller: (config: PollerConfig) => PollerHandle;
}

export interface WebhookHandler {
  name: string;
  handler: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export interface McpProxyHandler {
  name: string;
  proxy: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export interface PollerConfig {
  name: string;
  interval: number;
  immediate?: boolean;
  handler: () => Promise<void>;
  onError?: (error: Error) => void;
}

export interface PollerHandle {
  start: () => void;
  stop: () => void;
  trigger: () => Promise<void>;
  status: () => PollerStatus;
}

export interface PollerStatus {
  running: boolean;
  lastRun?: Date;
  lastError?: string;
  runCount: number;
}
