// worker.js
// السيرفر بتاع موقع "بازار العيال" - بصيغة Cloudflare Worker (مع Static Assets).
// بيعرض صفحة الكتالوج (من فولدر public)، وبيستقبل الأوردرات على /api/order،
// وبيبعت كل أوردر جديد كرسالة على بوت التليجرام بتاع المحل.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return jsonResponse(200, {
        ok: true,
        telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/order') {
      return handleOrder(request, env);
    }

    // أي حاجة تانية (index.html, products.js, ...) بتتقرأ من فولدر public تلقائي
    return env.ASSETS.fetch(request);
  },
};

async function handleOrder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(400, { ok: false, error: 'الطلب غير صالح' });
  }

  const { customerName, customerPhone, items, total } = body || {};

  if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
    return jsonResponse(400, { ok: false, error: 'بيانات الأوردر ناقصة' });
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

  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = env.TELEGRAM_CHAT_ID;

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

  return jsonResponse(200, { ok: true });
}

function jsonResponse(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
