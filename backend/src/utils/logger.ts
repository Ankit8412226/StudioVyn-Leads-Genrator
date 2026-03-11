import winston from 'winston';

const { combine, timestamp, printf } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${level.toUpperCase()}: ${message}${metaString}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: combine(timestamp(), logFormat),
  transports: [new winston.transports.Console()],
});
