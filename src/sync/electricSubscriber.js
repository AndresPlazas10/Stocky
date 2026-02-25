import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { logger } from '../utils/logger.js';

export class ElectricSubscriber {
  constructor({ db, shapes = [] } = {}) {
    this.db = db;
    this.shapes = shapes;
    this.running = false;
  }

  async start() {
    if (!LOCAL_SYNC_CONFIG.electricPullEnabled) return;
    if (this.running) return;
    this.running = true;
    logger.info('[sync] Electric subscriber iniciado (stub Fase B)', {
      shapes: this.shapes.map((shape) => shape.key)
    });
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    logger.info('[sync] Electric subscriber detenido');
  }

  async applyRemoteCursor(shapeKey, cursor, lsn = null) {
    if (!this.db) return;
    await this.db.setSyncState(shapeKey, { cursor, lsn });
  }
}

export default ElectricSubscriber;

