const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.APK_PORT || 4174;
const APK_DIR = path.join(__dirname, '..', 'public', 'apk');

app.get('/apk/:file', (req, res) => {
  const file = req.params.file;
  if (!file || !file.endsWith('.apk')) {
    res.status(404).send('Not found');
    return;
  }

  const filePath = path.join(APK_DIR, file);
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment');
  res.sendFile(filePath, (err) => {
    if (!err) return;
    if (res.headersSent) return;
    res.status(err.statusCode || 500).send('Error serving APK');
  });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`APK server running on http://0.0.0.0:${PORT}`);
});
