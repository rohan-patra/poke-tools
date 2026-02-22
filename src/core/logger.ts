import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(env: 'development' | 'staging' | 'production'): Logger {
  return pino({
    level: env === 'development' ? 'debug' : 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: env === 'development',
      },
    },
    base: {
      service: 'poke-tools',
    },
    redact: [
      'req.headers.authorization',
      'req.headers["x-slack-signature"]',
      '*.token',
      '*.bearerToken',
      '*.signingSecret',
      '*.xoxc',
      '*.xoxd',
      '*.xoxp',
      '*.xoxb',
      '*.clientSecret',
      '*.clientPasswd',
      '*.BW_SESSION',
    ],
  });
}
