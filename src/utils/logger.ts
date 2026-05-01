import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

// Add file transport for production
if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE) {
  const logDir = path.dirname(process.env.LOG_FILE || './logs/app.log');

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Add file transport
  transports.push(
    new winston.transports.File({
      filename: process.env.LOG_FILE || './logs/app.log',
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      ),
      maxsize: parseInt(
        process.env.LOG_MAX_SIZE?.replace('m', '000000') || '20000000'
      ),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
    })
  );

  // Add error file transport
  transports.push(
    new winston.transports.File({
      filename: process.env.LOG_ERROR_FILE || './logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      ),
      maxsize: parseInt(
        process.env.LOG_MAX_SIZE?.replace('m', '000000') || '20000000'
      ),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object with a 'write' function for morgan
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export { logger };
export default logger;
