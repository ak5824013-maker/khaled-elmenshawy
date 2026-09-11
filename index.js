// هنحط الـ Token والـ Chat ID كمتغيرات بيئية (Environment Variables) في Cloudflare لزيادة الأمان
// بس عشان التجربة، ممكن نكتبهم هنا مؤقتاً (يفضل تحطهم في إعدادات Cloudflare)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN || '8868963824:AAHagJo8ZpkEaz_VGbW4UjSsl9Fy61J5s2s'; // توكن البوت
    const CHAT_ID = env.CHAT_ID || '-1003223801317'; // رقم الجروب الخاص

    // 1. مسار لاستقبال التحديثات من تليجرام (Webhook)
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        
        // التأكد إن الرسالة جاية من الجروب بتاعنا
        if (update.message && update.message.chat.id.toString() === CHAT_ID) {
          const text = update.message.caption || update.message.text || '';
          
          // شرط: لو الرسالة فيها كلمة "#جديد" أو "متوفر" وصورة
          if ((text.includes('#جديد') || text.includes('متوفر')) && update.message.photo) {
            
            // نجيب أكبر حجم للصورة
            const photoArray = update.message.photo;
            const photo = photoArray[photoArray.length - 1];
            const fileId = photo.file_id;
            
            // توليد كود فريد للمنتج
            const productId = `prod_${Date.now()}`;
            
            // تفاصيل المنتج اللي هنحفظها
            const productData = {
              id: productId,
              text: text.replace('#جديد', '').replace('متوفر', '').trim(),
              fileId: fileId,
              date: new Date().toISOString()
            };

            // حفظ المنتج في قاعدة البيانات KV
            // افترضنا إن اسم الـ KV Namespace هو "PRODUCTS_KV"
            if (env.PRODUCTS_KV) {
              await env.PRODUCTS_KV.put(productId, JSON.stringify(productData));
              
              // إرسال رسالة تأكيد للجروب إن المنتج اتضاف للموقع
              await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: CHAT_ID,
                  text: '✅ تم إضافة الصنف للموقع بنجاح!'
                })
              });
            }
          }
          
          // شرط للحذف: لو عدلت الرسالة وكتبت "خلص"
          if (update.edited_message && update.edited_message.chat.id.toString() === CHAT_ID) {
             const editedText = update.edited_message.caption || update.edited_message.text || '';
             if(editedText.includes('خلص') || editedText.includes('نفذ')) {
                // هنا بنحتاج منطق للبحث عن المنتج وحذفه (هنطوره في الخطوة القادمة)
                // مؤقتاً بنبعت رسالة تنبيه
                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: '⚠️ تم استلام تحديث بنفاد الكمية (سيتم برمجتها للحذف من الموقع).'
                  })
                });
             }
          }
        }
        return new Response('OK', { status: 200 });
      } catch (error) {
        return new Response('Error processing webhook', { status: 500 });
      }
    }

    // 2. مسار لعرض واجهة الموقع (HTML)
    if (url.pathname === '/') {
        // هنا المفروض نحط كود الـ HTML بتاع موقعك اللي جبناه من الرابط
        // هنستدعي المنتجات من الـ KV ونعرضها
        
        let productsHtml = '';
        if (env.PRODUCTS_KV) {
           const { keys } = await env.PRODUCTS_KV.list();
           for (const key of keys) {
               const value = await env.PRODUCTS_KV.get(key.name);
               if(value) {
                   const product = JSON.parse(value);
                   // ملحوظة: التليجرام مش بيدينا الرابط المباشر للصورة على طول، لازم نجيبه عن طريق file_id
                   // للتبسيط في دي الخطوة، هنعرض النص، وفي الخطوة القادمة هنظبط جلب الصور
                   productsHtml += `
                    <div style="border:1px solid #ccc; padding: 10px; margin: 10px;">
                        <p>${product.text}</p>
                        <small>تم الإضافة: ${product.date}</small>
                    </div>
                   `;
               }
           }
        }

        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>خالد المنشاوي</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; text-align: right; }
                header { background: #f8f9fa; padding: 20px; text-align: center; border-bottom: 2px solid #ddd; }
                .product-list { display: flex; flex-wrap: wrap; justify-content: center; }
            </style>
        </head>
        <body>
            <header>
                <h1>خالد المنشاوي</h1>
                <p>اختار الأصناف اللي عايزها وابعت الطلب</p>
            </header>
            <main class="product-list">
                ${productsHtml || '<p>لا توجد منتجات حالياً.</p>'}
            </main>
        </body>
        </html>
        `;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};
