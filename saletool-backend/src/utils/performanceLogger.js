/**
 * Performance Logger Utility
 * 
 * Tracks time spent in:
 * - Database operations (DB)
 * - API calls (external APIs)
 * - Backend logic (business logic processing)
 */

class PerformanceLogger {
  constructor() {
    this.metrics = {
      db: {
        total: 0,
        operations: []
      },
      api: {
        total: 0,
        calls: []
      },
      logic: {
        total: 0,
        operations: []
      }
    };
    this.startTime = Date.now();
  }

  /**
   * Start timing an operation
   */
  start() {
    return Date.now();
  }

  /**
   * End timing and record DB operation
   */
  recordDB(operation, duration, details = {}) {
    this.metrics.db.total += duration;
    this.metrics.db.operations.push({
      operation,
      duration,
      ...details
    });
  }

  /**
   * End timing and record API call
   */
  recordAPI(service, endpoint, duration, details = {}) {
    this.metrics.api.total += duration;
    this.metrics.api.calls.push({
      service,
      endpoint,
      duration,
      ...details
    });
  }

  /**
   * End timing and record backend logic operation
   */
  recordLogic(operation, duration, details = {}) {
    this.metrics.logic.total += duration;
    this.metrics.logic.operations.push({
      operation,
      duration,
      ...details
    });
  }

  /**
   * Wrap an async function to automatically track DB operations
   */
  async trackDB(operation, fn, details = {}) {
    const start = this.start();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordDB(operation, duration, details);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordDB(operation, duration, { ...details, error: true });
      throw error;
    }
  }

  /**
   * Wrap an async function to automatically track API calls
   */
  async trackAPI(service, endpoint, fn, details = {}) {
    const start = this.start();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordAPI(service, endpoint, duration, details);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordAPI(service, endpoint, duration, { ...details, error: true });
      throw error;
    }
  }

  /**
   * Wrap an async function to automatically track backend logic
   */
  async trackLogic(operation, fn, details = {}) {
    const start = this.start();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordLogic(operation, duration, details);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordLogic(operation, duration, { ...details, error: true });
      throw error;
    }
  }

  /**
   * Get total time elapsed
   */
  getTotalTime() {
    return Date.now() - this.startTime;
  }

  /**
   * Get formatted metrics summary
   */
  getSummary() {
    const total = this.getTotalTime();
    return {
      total: total,
      db: {
        total: this.metrics.db.total,
        percentage: total > 0 ? ((this.metrics.db.total / total) * 100).toFixed(1) : '0.0',
        operations: this.metrics.db.operations.length,
        breakdown: this.metrics.db.operations
      },
      api: {
        total: this.metrics.api.total,
        percentage: total > 0 ? ((this.metrics.api.total / total) * 100).toFixed(1) : '0.0',
        calls: this.metrics.api.calls.length,
        breakdown: this.metrics.api.calls
      },
      logic: {
        total: this.metrics.logic.total,
        percentage: total > 0 ? ((this.metrics.logic.total / total) * 100).toFixed(1) : '0.0',
        operations: this.metrics.logic.operations.length,
        breakdown: this.metrics.logic.operations
      }
    };
  }

  /**
   * Get raw metrics (for storage) - only totals, no detailed breakdowns
   */
  getMetrics() {
    return {
      total: this.getTotalTime(),
      db: {
        total: this.metrics.db.total
      },
      api: {
        total: this.metrics.api.total
      },
      logic: {
        total: this.metrics.logic.total
      }
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      db: { total: 0, operations: [] },
      api: { total: 0, calls: [] },
      logic: { total: 0, operations: [] }
    };
    this.startTime = Date.now();
  }
}

export default PerformanceLogger;

