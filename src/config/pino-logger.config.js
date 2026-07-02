export const pinoLoggerConfig = {
  pinoHttp: {
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              levelFirst: true,
              translateTime: 'yyyy-mm-dd HH:MM:ss.l',
              ignore: 'pid,hostname',
              singleLine: false,
              messageFormat: '{context} {msg}',
            },
          }
        : undefined,
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'req.headers["api-key"]',
        '*.password',
        '*.Password',
        '*.PASSWORD',
        '*.token',
        '*.Token',
        '*.accessToken',
        '*.refreshToken',
        '*.access_token',
        '*.refresh_token',
        '*.apiKey',
        '*.api_key',
        '*.API_KEY',
        '*.cedula',
        '*.numeroDocumento',
        '*.numero_documento',
        '*.dni',
        '*.ssn',
        '*.email',
        '*.mfaCode',
        '*.codigo',
        '*.code',
        '*.verificationCode',
        '*.otp',
        '*.cardNumber',
        '*.cvv',
        '*.pin',
        '*.baseUrl',
      ],
      remove: true,
    },
    formatters: {
      level: (label) => ({
        level: label,
      }),
      bindings: (bindings) => ({
        ...(process.env.NODE_ENV !== 'production' && {
          pid: bindings.pid,
          hostname: bindings.hostname,
        }),
      }),
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    autoLogging: {
      ignore: (req) =>
        [
          '/grpc.reflection.v1.ServerReflection',
          '/grpc.reflection.v1alpha.ServerReflection',
          '/calificaciones.v1.HealthService',
        ].some((path) => req.url?.startsWith(path)),
    },
    customProps: () => ({
      context: 'gRPC',
      microservice: 'academico-calificaciones',
    }),
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn';
      }
      if (res.statusCode >= 500 || err) {
        return 'error';
      }
      if (res.statusCode >= 300 && res.statusCode < 400) {
        return 'silent';
      }
      return 'info';
    },
    customSuccessMessage: (req) => `${req.method} ${req.url} completed`,
    customErrorMessage: (req) => `${req.method} ${req.url} failed`,
  },
};
