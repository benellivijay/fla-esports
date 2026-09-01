class Logger {
  static info(message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`\x1b[36m[INFO]\x1b[0m \x1b[90m${timestamp}\x1b[0m ${message}`, ...args);
  }

  static success(message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`\x1b[32m[SUCCESS]\x1b[0m \x1b[90m${timestamp}\x1b[0m ${message}`, ...args);
  }

  static warn(message, ...args) {
    const timestamp = new Date().toISOString();
    console.warn(`\x1b[33m[WARN]\x1b[0m \x1b[90m${timestamp}\x1b[0m ${message}`, ...args);
  }

  static error(message, ...args) {
    const timestamp = new Date().toISOString();
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[90m${timestamp}\x1b[0m ${message}`, ...args);
  }

  static security(message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`\x1b[35m[SECURITY]\x1b[0m \x1b[90m${timestamp}\x1b[0m ${message}`, ...args);
  }
}

module.exports = Logger;
