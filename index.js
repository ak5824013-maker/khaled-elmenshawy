export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN || '8868963824:AAHagJo8ZpkEaz_VGbW4UjSsl9Fy61J5s2s';
    const CHAT_ID = env.CHAT_ID || '-1003223801317';

    // 1. استقبال الـ Webhook من تليجرام بصمت (من غير ما البوت يبعت رسايل في الجروب)
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        
        if (update.message && update.message.chat.id.toString() === CHAT_ID) {
          const text = update.message.caption || update.message.text || '';
          
          if ((text.includes('#جديد') || text.includes('متوفر')) && update.message.photo) {
            const photoArray = update.message.photo;
            const photo = photoArray[photoArray.length - 1];
            const fileId = photo.file_id;
            
            const productId = `prod_${update.message.message_id}`; // بنخلي الـ ID برقم الرسالة عشان ميتكررش
            
            const productData = {
              id: productId,
              text: text,
              fileId: fileId,
              date: new Date().toISOString()
            };

            if (env.PRODUCTS_KV) {
              await env.PRODUCTS_KV.put(productId, JSON.stringify(productData));
              // تم إزالة رسالة الرد في الجروب بناءً على طلبك (الجروب هيفضل هادي تماماً)
            }
          }
        }
        return new Response('OK', { status: 200 });
      } catch (error) {
        return new Response('Error', { status: 500 });
      }
    }

    // 2. واجهة الموقع اللي بتعرض المنتجات (القديمة والجديدة)
    if (url.pathname === '/') {
        let productsHtml = '';
        if (env.PRODUCTS_KV) {
           const { keys } = await env.PRODUCTS_KV.list();
           // ترتيب المنتجات من الأحدث للقديم
           for (const key of keys.reverse()) {
               const value = await env.PRODUCTS_KV.get(key.name);
               if(value) {
                   const product = JSON.parse(value);
                   // بما إننا بنسحب الصور، عشان نعرضها بشكل مظبوط من تليجرام بنحتاج رابط الـ file_id
                   productsHtml += `
                    <div class="product-card">
                        <p>${product.text}</p>
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
            <title>مؤسسة خالد المنشاوي للألعاب</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; text-align: right; background: #f4f7f6; }
                header { background: #fff; padding: 20px; text-align: center; border-bottom: 2px solid #ddd; border-radius: 8px; margin-bottom: 20px; }
                .product-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
                .product-card { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            </style>
        </head>
        <body>
            <header>
                <h1>مؤسسة خالد المنشاوي</h1>
                <p>قائمة المنتجات المتاحة للطلب</p>
            </header>
            <main class="product-list">
                ${productsHtml || '<p style="text-align:center; grid-column: 1/-1;">لا توجد منتجات عرض حالياً. ابعت منتجات في الجروب بكلمة #جديد أو متوفر.</p>'}
            </main>
        </body>
        </html>
        `;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};
