export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN || '8868963824:AAHagJo8ZpkEaz_VGbW4UjSsl9Fy61J5s2s';
    const CHAT_ID = env.CHAT_ID || '-1003223801317';

    // 1. استقبال أي صورة جديدة من التليجرام بصمت ورفعها للموقع فوراً
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        
        if (update.message && update.message.chat.id.toString() === CHAT_ID) {
          // بنقبل أي رسالة فيها صورة، حتى لو من غير كلمات مفتاحية
          if (update.message.photo) {
            const photoArray = update.message.photo;
            const photo = photoArray[photoArray.length - 1];
            const fileId = photo.file_id;
            
            // النص أو تفاصيل المنتج (الاسم، الكود، السعر)
            const caption = update.message.caption || update.message.text || 'منتج جديد';
            const productId = `prod_${update.message.message_id}`;
            
            // جلب رابط الصورة المباشر من تليجرام عشان تظهر في الموقع
            const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
            const fileData = await res.json();
            let imageUrl = '';
            if (fileData.ok) {
              const filePath = fileData.result.file_path;
              imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
            }

            const productData = {
              id: productId,
              text: caption,
              imageUrl: imageUrl,
              date: new Date().toISOString()
            };

            if (env.PRODUCTS_KV) {
              await env.PRODUCTS_KV.put(productId, JSON.stringify(productData));
            }
          }
        }
        return new Response('OK', { status: 200 });
      } catch (error) {
        return new Response('Error', { status: 500 });
      }
    }

    // 2. واجهة الموقع لعرض المنتجات بالصور والتفاصيل
    if (url.pathname === '/') {
        let productsHtml = '';
        if (env.PRODUCTS_KV) {
           const { keys } = await env.PRODUCTS_KV.list();
           for (const key of keys.reverse()) {
               const value = await env.PRODUCTS_KV.get(key.name);
               if(value) {
                   const product = JSON.parse(value);
                   productsHtml += `
                    <div class="product-card">
                        ${product.imageUrl ? `<img src="${product.imageUrl}" alt="product">` : ''}
                        <p>${product.text.replace(/\n/g, '<br>')}</p>
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
                .product-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
                .product-card { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .product-card img { width: 100%; height: 200px; object-fit: cover; border-radius: 6px; margin-bottom: 10px; }
                .product-card p { white-space: pre-wrap; line-height: 1.6; color: #333; font-weight: bold; }
            </style>
        </head>
        <body>
            <header>
                <h1>مؤسسة خالد المنشاوي</h1>
                <p>قائمة الأصناف المتاحة للطلب</p>
            </header>
            <main class="product-list">
                ${productsHtml || '<p style="text-align:center; grid-column: 1/-1;">لا توجد منتجات معروضة حالياً.</p>'}
            </main>
        </body>
        </html>
        `;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};
