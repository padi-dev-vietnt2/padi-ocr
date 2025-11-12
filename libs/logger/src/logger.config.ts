import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

const { combine, colorize, timestamp, metadata, printf } = winston.format;

const setColor = (
  text: string,
  color: 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'white' | 'gray',
): string => {
  const colors: Record<string, string> = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  };

  const reset = '\x1b[0m';
  return `${colors[color] || ''}${text}${reset}`;
};

const nestLikeFormat = printf((info) => {
  const { level, message, context, timestamp } = info;
  const pid = process.pid;
  const date = new Date(timestamp as never).toLocaleString('en-GB');
  const upperLevel = level.toUpperCase();
  if (upperLevel === 'INFO') {
    return `[Nest] ${pid}  - ${setColor(date, 'white')}     ${setColor('LOG', 'green')} ${setColor(`[${(context as any) || 'App'}]`, 'yellow')} ${setColor(`${message as string}`, 'green')}`;
  }

  return `[Nest] ${pid}  - ${date}     ${upperLevel} [${(context as any) || 'App'}] ${message as string}`;
});

const filterIgnoreMessages = winston.format((info) => {
  if (info?.level !== 'info') {
    return info;
  }

  const { context } = info;
  const pattern = /^[a-z0-9_]+$/i;
  if (typeof context === 'string' && context?.length && pattern.test(context)) {
    return false;
  }

  return info;
})();

export const loggerOptions: WinstonModuleOptions = {
  level: 'silly',
  transports: [
    new winston.transports.Console({
      format: combine(timestamp(), nestLikeFormat, colorize({ all: true })),
    }),
    new winston.transports.DailyRotateFile({
      level: 'silly',
      dirname: `logs`,
      filename: '%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: combine(
        filterIgnoreMessages,
        metadata(),
        timestamp(),
        printf(({ timestamp, ...props }) => {
          return JSON.stringify({ timestamp, ...props });
        }),
      ),
    }),
  ],
};
