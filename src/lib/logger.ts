import fs from 'fs';
import path from 'path';

const LOG_FILE_PATH = path.join(process.cwd(), 'activity.log');
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function ensureLogFileAndRotation() {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const stats = fs.statSync(LOG_FILE_PATH);
      const age = Date.now() - stats.mtimeMs; // Use mtimeMs (modified time) to track age
      if (age > MAX_AGE_MS) {
        // Clear the file since it is older than 3 days
        fs.writeFileSync(
          LOG_FILE_PATH,
          `[${new Date().toISOString()}] [INFO] [SYSTEM] Log file cleared and rotated after 3 days.\n`,
          'utf-8'
        );
        return;
      }
    } else {
      fs.writeFileSync(
        LOG_FILE_PATH,
        `[${new Date().toISOString()}] [INFO] [SYSTEM] Activity log initiated.\n`,
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
