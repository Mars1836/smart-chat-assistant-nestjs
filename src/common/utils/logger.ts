import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import moment from 'moment';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');

// ---- Paths & helpers --------------------------------------------------------
const logsRoot = path.join(__dirname, '..', '..', '..', 'logs');

function ensureDir(p: string): void {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (err) {
    console.error(`Failed to create directory ${p}:`, err);
  }
}

function yearKey(d: Date = new Date()): string {
  return String(d.getFullYear());
}
function monthKey(d: Date = new Date()): string {
  return String(d.getMonth() + 1).padStart(2, '0');
}
function dayKey(d: Date = new Date()): string {
  return String(d.getDate()).padStart(2, '0');
}
function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function filterLevels(levels: string[]) {
  return format((info) => (levels.includes(info.level) ? info : false))();
}

const logPrintf = format.printf(({ timestamp, level, message, stack }) => {
  const base = `${timestamp} ${level.toUpperCase()} ${message}`;
  return stack ? `${base}\n${stack}` : base;
});

const logPrintfNoTime = format.printf(({ level, message, stack }) => {
  const base = `${level.toUpperCase()} ${message}`;
  return stack ? `${base}\n${stack}` : base;
});

// ---- Factory to (re)build transports for a given day ------------------------
function buildDailyTransports(d: Date = new Date()) {
  const y = yearKey(d);
  const m = monthKey(d);
  const day = dayKey(d);
  const dayDir = path.join(logsRoot, y, m, day);
  ensureDir(dayDir);

  const commonFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.splat(),
    logPrintf,
  );

  // Rotate daily; filename includes %DATE% (YYYY-MM-DD) per datePattern
  const outT = new DailyRotateFile({
    dirname: dayDir,
    filename: '%DATE%-out.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    level: 'silly',
    format: format.combine(
      filterLevels(['info', 'http', 'verbose', 'debug', 'silly', 'warn']),
    ),
  });

  const errT = new DailyRotateFile({
    dirname: dayDir,
    filename: '%DATE%-err.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    level: 'silly',
    format: format.combine(filterLevels(['error'])),
  });

  [outT, errT].forEach((t) => {
    if (typeof t.on === 'function') {
      t.on('new', (filename: string) => {
        try {
          ensureDir(path.dirname(filename));
        } catch (err) {
          console.error(`Failed to create directory for ${filename}:`, err);
        }
      });
      t.on('rotate', (_oldFile: string, newFile: string) => {
        try {
          ensureDir(path.dirname(newFile));
        } catch (err) {
          console.error(`Failed to create directory for ${newFile}:`, err);
        }
      });
    }
  });

  if (outT.format) {
    outT.format = format.combine(commonFormat, outT.format);
  }
  if (errT.format) {
    errT.format = format.combine(commonFormat, errT.format);
  }

  return { outT, errT };
}

// ---- Create logger with current day transports ------------------------------
ensureDir(logsRoot);
let currentDateKey = dateKey();
let { outT, errT } = buildDailyTransports(new Date());

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [outT, errT],
});

// ---- Console transport (additionally log to terminal) ----------------------
logger.add(
  new transports.Console({
    format: format.combine(
      format.errors({ stack: true }),
      format.splat(),
      logPrintfNoTime,
    ),
  }),
);

// ---- Safe setTimeout to handle long delays ---------------------------------
function safeSetTimeout(fn: () => void, delay: number): NodeJS.Timeout {
  const MAX_TIMEOUT = 2147483647; // ~24.8 days
  if (delay > MAX_TIMEOUT) {
    return setTimeout(() => {
      safeSetTimeout(fn, delay - MAX_TIMEOUT);
    }, MAX_TIMEOUT);
  }
  return setTimeout(fn, delay);
}

// ---- Daily rotation scheduler ----------------------------------------------
function msUntilNextDay(): number {
  const now = moment();
  const nextDay = now.clone().add(1, 'day').startOf('day').add(5, 'seconds');
  const diff = nextDay.diff(now, 'milliseconds');
  const MAX_TIMEOUT = 2147483647;
  const MIN_TIMEOUT = 2000;
  if (!Number.isFinite(diff) || diff <= 0) {
    console.error(
      `Invalid timeout calculated (${diff}ms), using minimum timeout (${MIN_TIMEOUT}ms)`,
    );
    return MIN_TIMEOUT;
  }
  return Math.max(diff, MIN_TIMEOUT);
}

let dailyTimer: NodeJS.Timeout | null = null;
let fallbackTimer: NodeJS.Timeout | null = null;

function refreshTransportsIfDayChanged(): void {
  const nowKey = dateKey();
  if (nowKey === currentDateKey) return;
  try {
    logger.remove(outT);
  } catch (err) {
    console.error('Failed to remove outT transport:', err);
  }
  try {
    logger.remove(errT);
  } catch (err) {
    console.error('Failed to remove errT transport:', err);
  }
  if (typeof outT.close === 'function') {
    try {
      outT.close();
    } catch (err) {
      console.error('Failed to close outT transport:', err);
    }
  }
  if (typeof errT.close === 'function') {
    try {
      errT.close();
    } catch (err) {
      console.error('Failed to close errT transport:', err);
    }
  }
  const built = buildDailyTransports(new Date());
  outT = built.outT;
  errT = built.errT;
  logger.add(outT);
  logger.add(errT);
  currentDateKey = nowKey;
  logger.info(`Log directory rotated to day ${currentDateKey}`);
}

function scheduleDailyRotation(): void {
  const delay = msUntilNextDay();
  if (dailyTimer) clearTimeout(dailyTimer);
  dailyTimer = safeSetTimeout(() => {
    try {
      refreshTransportsIfDayChanged();
    } catch (error) {
      console.error('Error in daily rotation:', error);
    } finally {
      scheduleDailyRotation();
    }
  }, delay);

  if (fallbackTimer) clearInterval(fallbackTimer);
  fallbackTimer = setInterval(
    () => {
      try {
        refreshTransportsIfDayChanged();
      } catch (error) {
        console.error('Error in fallback rotation:', error);
      }
    },
    60 * 60 * 1000, // every 1 hour as fallback
  );
}

scheduleDailyRotation();

// ---- Console monkey-patch ---------------------------------------------------
const original = {
  log: console.log.bind(console),
  info: console.info ? console.info.bind(console) : console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug
    ? console.debug.bind(console)
    : console.log.bind(console),
};

const hasConsoleTransport = logger.transports.some(
  (t) => t instanceof transports.Console,
);

console.log = (...args: any[]) => {
  const msg = util.format(...args);
  logger.info(msg);
  if (!hasConsoleTransport) original.log(...args);
};
console.info = (...args: any[]) => {
  const msg = util.format(...args);
  logger.info(msg);
  if (!hasConsoleTransport) original.info(...args);
};
console.warn = (...args: any[]) => {
  const msg = util.format(...args);
  logger.warn(msg);
  if (!hasConsoleTransport) original.warn(...args);
};
console.error = (...args: any[]) => {
  const msg = util.format(...args);
  logger.error(msg);
  if (!hasConsoleTransport) original.error(...args);
};
console.debug = (...args: any[]) => {
  const msg = util.format(...args);
  logger.debug(msg);
  if (!hasConsoleTransport) original.debug(...args);
};

// ---- Morgan stream (HTTP access) -------------------------------------------
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export { logger };
