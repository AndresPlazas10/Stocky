const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_CONFIG = {
  server: {
    port: 41780,
    enabled: true,
    allowedOrigins: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://stocky.app',
      'https://www.stocky.app'
    ]
  },
  printer: {
    name: '',
    portPath: '',
    baudRate: 9600,
    paperWidthMm: 80
  },
  receipt: {
    businessName: 'Sistema Stocky',
    footerMessage: 'Gracias por su compra',
    headerAlignment: 'center',
    footerAlignment: 'center',
    showVoluntaryTip: false,
    voluntaryTipValue: 0
  },
  auth: {
    token: ''
  }
};

const cloneDefaultConfig = () => JSON.parse(JSON.stringify(DEFAULT_CONFIG));

const ensureToken = (config) => {
  if (config.auth?.token) return config;
  return {
    ...config,
    auth: {
      ...(config.auth || {}),
      token: crypto.randomBytes(18).toString('hex')
    }
  };
};

const mergeConfig = (current, next) => ({
  ...current,
  ...next,
  server: { ...current.server, ...(next.server || {}) },
  printer: { ...current.printer, ...(next.printer || {}) },
  receipt: { ...current.receipt, ...(next.receipt || {}) },
  auth: { ...current.auth, ...(next.auth || {}) }
});

class ConfigStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'config.json');
    this.config = ensureToken(cloneDefaultConfig());
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.save();
        return this.config;
      }

      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.config = ensureToken(mergeConfig(cloneDefaultConfig(), parsed));
      this.save();
      return this.config;
    } catch {
      this.config = ensureToken(cloneDefaultConfig());
      this.save();
      return this.config;
    }
  }

  get() {
    return this.config;
  }

  update(partialConfig) {
    this.config = ensureToken(mergeConfig(this.config, partialConfig || {}));
    this.save();
    return this.config;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2));
  }
}

module.exports = { ConfigStore };
