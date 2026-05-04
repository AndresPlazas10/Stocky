let SerialPort;

const loadSerialPort = () => {
  if (SerialPort) return SerialPort;
  try {
    ({ SerialPort } = require('serialport'));
    return SerialPort;
  } catch {
    return null;
  }
};

const listPorts = async () => {
  const LoadedSerialPort = loadSerialPort();
  if (!LoadedSerialPort) return [];

  const ports = await LoadedSerialPort.list();
  return ports.map((port) => ({
    path: port.path,
    manufacturer: port.manufacturer || '',
    friendlyName: port.friendlyName || '',
    serialNumber: port.serialNumber || '',
    pnpId: port.pnpId || ''
  }));
};

const printBuffer = ({ portPath, baudRate = 9600, buffer }) => new Promise((resolve, reject) => {
  const LoadedSerialPort = loadSerialPort();
  if (!LoadedSerialPort) {
    reject(new Error('Dependencia serialport no instalada'));
    return;
  }

  if (!portPath) {
    reject(new Error('Puerto COM no configurado'));
    return;
  }

  const port = new LoadedSerialPort({
    path: portPath,
    baudRate: Number(baudRate) || 9600,
    autoOpen: false
  });

  port.open((openErr) => {
    if (openErr) {
      reject(openErr);
      return;
    }

    port.write(buffer, (writeErr) => {
      if (writeErr) {
        port.close(() => reject(writeErr));
        return;
      }

      port.drain((drainErr) => {
        port.close(() => {
          if (drainErr) reject(drainErr);
          else resolve({ ok: true });
        });
      });
    });
  });
});

module.exports = { listPorts, printBuffer };
