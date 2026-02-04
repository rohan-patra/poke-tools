export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class WebhookVerificationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'WEBHOOK_VERIFICATION_FAILED', 401, details);
    this.name = 'WebhookVerificationError';
  }
}

export class SubprocessError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SUBPROCESS_ERROR', 500, details);
    this.name = 'SubprocessError';
  }
}

export class PokeApiError extends AppError {
  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message, 'POKE_API_ERROR', statusCode, details);
    this.name = 'PokeApiError';
  }
}

export class SlackApiError extends AppError {
  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message, 'SLACK_API_ERROR', statusCode, details);
    this.name = 'SlackApiError';
  }
}
