// server.js
// السيرفر بتاع موقع "بازار العيال": بيعرض صفحة الكتالوج، وبيستقبل الأوردرات،
// وبيبعت كل أوردر جديد كرسالة على بوت التليجرام بتاع المحل.
//
// مكتوب بدون أي مكتبات خارجية (مش محتاج npm install خالص) عشان يبقى أبسط
// في التشغيل والنشر.

const http = require('http');
const fs = require('fs');
const path = require('path');

loadDotEnv();

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.warn(
    '[تنبيه] TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID مش متظبطين في متغيرات البيئة.\n' +
    'الموقع هيشتغل، بس إشعارات تليجرام مش هتتبعت لحد ما تظبطهم.'
  );
}

// الملفات الثابتة (الموقع نفسه) موجودة في نفس مجلد السيرفر - من غير مجلد public منفصل،
// عشان يبقى رفع/تحديث الملفات على GitHub أبسط (كل الملفات فلات من غير فولدرات فرعية).
const PUBLIC_DIR = __dirname;
const STATIC_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/products.js': 'products.js',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, telegramConfigured: Boolean(BOT_TOKEN && CHAT_ID) });
  }

  if (req.method === 'POST' && url.pathname === '/api/order') {
    return handleOrder(req, res);
  }

  if (req.method === 'GET') {
    return serveStatic(url.pathname, res);
  }

  res.writeHead(404);
  res.end('Not found');
});

function serveStatic(pathname, res) {
  // بنسمح فقط بالملفات المعروفة (index.html و products.js) - مفيش سيرفينج عام لأي ملف
  // في المجلد، عشان server.js و package.json و .env متتعرضش بالغلط.
  const fileName = STATIC_FILES[pathname];
  if (!fileName) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('الصفحة غير موجودة');
  }
  const fullPath = path.join(PUBLIC_DIR, fileName);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('الصفحة غير موجودة');
    }
    res.writeHead(200, { 'Content-Type': contentType(fullPath) });
    res.end(data);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

async function handleOrder(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: 'الطلب غير صالح' });
  }

  const { customerName, customerPhone, items, total } = body || {};

  if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
    return sendJson(res, 400, { ok: false, error: 'بيانات الأوردر ناقصة' });
  }

  const itemsText = items
    .map((it) => `• ${it.name} (كود ${it.id}) × ${it.qty} = ${it.qty * it.price} ج.م`)
    .join('\n');

  const now = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });

  const message =
    `🧸 أوردر جديد من الموقع\n\n` +
    `👤 الاسم: ${customerName}\n` +
    `📞 التليفون: ${customerPhone}\n\n` +
    `الأصناف:\n${itemsText}\n\n` +
    `💰 الإجمالي: ${total} ج.م\n` +
    `🕒 ${now}`;

  if (BOT_TOKEN && CHAT_ID) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: message }),
      });
      if (!tgRes.ok) {
        console.error('فشل إرسال رسالة تليجرام:', await tgRes.text());
      }
    } catch (err) {
      console.error('خطأ في الاتصال بتليجرام:', err.message);
    }
  } else {
    console.log('أوردر جديد (تليجرام مش متظبط بعد):\n', message);
  }

  return sendJson(res, 200, { ok: true });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  });
}

server.listen(PORT, () => {
  console.log(`السيرفر شغال على بورت ${PORT}`);
});
