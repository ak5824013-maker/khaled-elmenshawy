export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN || '8868963824:AAHagJo8ZpkEaz_VGbW4UjSsl9Fy61J5s2s';
    const CHAT_ID = env.CHAT_ID || '-1003223801317';

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        
        if (update.message && update.message.chat.id.toString() === CHAT_ID) {
          if (update.message.photo) {
            const photoArray = update.message.photo;
            const photo = photoArray[photoArray.length - 1];
            const fileId = photo.file_id;
            
            let caption = update.message.caption || update.message.text || '';
            
            const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
            const fileData = await res.json();
            let imageUrl = '';
            if (fileData.ok) {
              const filePath = fileData.result.file_path;
              imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
            }

            // تحديد مفتاح الصنف (لو في ألبوم، أو لو الصنف ليه نفس الاسم أو الكود في أول سطر)
            let productKey = '';
            let cleanCaption = caption.trim();
            
            if (update.message.media_group_id) {
              productKey = `group_${update.message.media_group_id}`;
            } else {
              let firstLine = cleanCaption.split('\n')[0].replace(/[^a-zA-Z0-9آ-ي]/g, '_');
              if (firstLine && firstLine.length > 2) {
                productKey = `prod_${firstLine}`;
              } else {
                // لو الصورة متبعتش معاها كلام، بندمجها مع آخر منتج نزل في الـ KV عشان نمنع تكرار الكروت الفاضية
                if (env.PRODUCTS_KV) {
                  const { keys } = await env.PRODUCTS_KV.list();
                  if (keys.length > 0) {
                    productKey = keys[keys.length - 1].name; // بنحطها على آخر صنف نزل
                  } else {
                    productKey = `prod_${update.message.message_id}`;
                  }
                } else {
                  productKey = `prod_${update.message.message_id}`;
                }
              }
            }

            let existingData = await env.PRODUCTS_KV.get(productKey);
            let productData;

            if (existingData) {
              productData = JSON.parse(existingData);
              if (!productData.imageUrls.includes(imageUrl)) {
                productData.imageUrls.push(imageUrl); // إضافة الصورة الجديدة لنفس الصنف
              }
              if (cleanCaption && cleanCaption.length > (productData.text || '').length) {
                productData.text = cleanCaption; // تحديث النص لو الوصف هو الأكمل
              }
            } else {
              productData = {
                id: productKey,
                text: cleanCaption || 'صنف متاح للطلب',
                imageUrls: [imageUrl],
                date: new Date().toISOString()
              };
            }

            if (env.PRODUCTS_KV) {
              await env.PRODUCTS_KV.put(productKey, JSON.stringify(productData));
            }
          }
        }
        return new Response('OK', { status: 200 });
      } catch (error) {
        return new Response('Error', { status: 500 });
      }
    }

    if (url.pathname === '/') {
        let productsHtml = '';
        if (env.PRODUCTS_KV) {
           const { keys } = await env.PRODUCTS_KV.list();
           for (const key of keys.reverse()) {
               const value = await env.PRODUCTS_KV.get(key.name);
               if(value) {
                   const product = JSON.parse(value);
                   
                   let imagesHtml = '';
                   if (product.imageUrls && product.imageUrls.length > 0) {
                       imagesHtml = '<div class="image-gallery">';
                       product.imageUrls.forEach(img => {
                           imagesHtml += `<img src="${img}" alt="product">`;
                       });
                       imagesHtml += '</div>';
                   }

                   productsHtml += `
                    <div class="product-card">
                        ${imagesHtml}
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
                .product-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
                .product-card { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .image-gallery { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; padding-bottom: 5px; }
                .image-gallery img { width: 100%; height: 210px; object-fit: cover; border-radius: 6px; flex: 1; min-width: 140px; }
                .product-card p { white-space: pre-wrap; line-height: 1.6; color: #333; font-weight: bold; font-size: 14px; margin: 0; }
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
