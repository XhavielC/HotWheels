const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

// 1. Servidor Local HTTP con Soporte Completo de Audio Streaming (Range) y CORS
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, reqPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Prohibido');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 No encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;
    const range = req.headers.range;

    if (range && (ext === '.mp3' || ext === '.wav' || ext === '.ogg')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        res.end();
        return;
      }

      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n===============================================================`);
  console.log(`🚀 SERVIDOR LOCAL ACTIVO`);
  console.log(`💻 Local: http://localhost:${PORT}`);
  console.log(`===============================================================\n`);
  console.log(`⏳ Creando túnel Cloudflare seguro para compartir online...`);

  startCloudflareTunnel();
});

// 2. Crear Túnel Seguro Cloudflare (trycloudflare.com)
let tunnelProcess = null;

function startCloudflareTunnel() {
  tunnelProcess = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${PORT}`], {
    shell: true
  });

  let publicUrlFound = false;

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !publicUrlFound) {
      publicUrlFound = true;
      const publicUrl = match[0];
      fs.writeFileSync(path.join(PUBLIC_DIR, 'public-url.txt'), publicUrl, 'utf8');

      console.log(`\n***************************************************************`);
      console.log(`🎉 ¡PROYECTO HOT WHEELS COMPARTIDO EN LÍNEA!`);
      console.log(`***************************************************************`);
      console.log(`🔗 ENLACE PÚBLICO (HTTPS):`);
      console.log(`   👉 ${publicUrl}`);
      console.log(`\n💻 ENLACE LOCAL:`);
      console.log(`   👉 http://localhost:${PORT}`);
      console.log(`***************************************************************`);
      console.log(`✅ Cualquier persona con el enlace público puede abrirlo en`);
      console.log(`   su celular, tablet o computadora con música y 3D activo.`);
      console.log(`***************************************************************\n`);
    }
  };

  tunnelProcess.stdout.on('data', handleOutput);
  tunnelProcess.stderr.on('data', handleOutput);

  tunnelProcess.on('close', (code) => {
    console.log(`ℹ️ Túnel reiniciando (código ${code})...`);
    setTimeout(startCloudflareTunnel, 4000);
  });
}

process.on('SIGINT', () => {
  if (tunnelProcess) tunnelProcess.kill();
  process.exit();
});
