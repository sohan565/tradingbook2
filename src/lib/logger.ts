import fs from 'fs';
import path from 'path';

const LOG_FILE_PATH = path.join(process.cwd(), 'activity.log');
const CREATED_FILE_PATH = path.join(process.cwd(), '.log_created');
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function ensureLogFileAndRotation() {
  try {
    let shouldRotate = false;
    let birthTime = Date.now();

    if (fs.existsSync(LOG_FILE_PATH)) {
      if (fs.existsSync(CREATED_FILE_PATH)) {
        try {
          const content = fs.readFileSync(CREATED_FILE_PATH, 'utf-8').trim();
          birthTime = parseInt(content, 10);
          if (isNaN(birthTime)) {
            birthTime = Date.now();
            fs.writeFileSync(CREATED_FILE_PATH, birthTime.toString(), 'utf-8');
          }
        } catch {
          birthTime = Date.now();
          fs.writeFileSync(CREATED_FILE_PATH, birthTime.toString(), 'utf-8');
        }
      } else {
        // Log exists but timestamp doesn't - create it
        fs.writeFileSync(CREATED_FILE_PATH, birthTime.toString(), 'utf-8');
      }

      const age = Date.now() - birthTime;
      if (age > MAX_AGE_MS) {
        shouldRotate = true;
      }
    } else {
      // No log file exists - initialize both
      shouldRotate = true;
    }

    if (shouldRotate) {
      const now = Date.now();
      fs.writeFileSync(CREATED_FILE_PATH, now.toString(), 'utf-8');
      fs.writeFileSync(
        LOG_FILE_PATH,
        `[${new Date().toISOString()}] [INFO] [SYSTEM] Log file cleared and rotated after 3 days.\n`,
        'utf-8'
      );
    }
  } catch (err) {
    console.error('Error during log rotation:', err);
  }
}

export const logger = {
  info: (category: string, message: string) => {
    ensureLogFileAndRotation();
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [INFO] [${category}] ${message}\n`;
    try {
      fs.appendFileSync(LOG_FILE_PATH, line, 'utf-8');
    } catch (err) {
      console.error('Failed to write to activity.log:', err);
    }
  },
  warn: (category: string, message: string) => {
    ensureLogFileAndRotation();
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [WARN] [${category}] ${message}\n`;
    try {
      fs.appendFileSync(LOG_FILE_PATH, line, 'utf-8');
    } catch (err) {
      console.error('Failed to write to activity.log:', err);
    }
  },
  error: (category: string, message: string) => {
    ensureLogFileAndRotation();
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [ERROR] [${category}] ${message}\n`;
    try {
      fs.appendFileSync(LOG_FILE_PATH, line, 'utf-8');
    } catch (err) {
      console.error('Failed to write to activity.log:', err);
    }
  }
};
