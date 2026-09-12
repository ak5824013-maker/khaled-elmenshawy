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

            let cleanCaption = caption.trim();
            let lines = cleanCaption.split('\n');
            let mainTitle = lines[0] ? lines[0].trim() : '';
            let subCode = lines[1] ? lines[1].trim() : '';

            let productKey = '';
            if (mainTitle && mainTitle.length > 2) {
              let combined = (mainTitle + "_" + subCode).replace(/[^a-zA-Z0-9آ-ي]/g, '_');
              productKey = `prod_${combined}`;
            } else {
              if (env.PRODUCTS_KV) {
                const { keys } = await env.PRODUCTS_KV.list();
                if (keys.length > 0) {
                  productKey = keys[keys.length - 1].name;
                } else {
                  productKey = `prod_${update.message.message_id}`;
                }
              } else {
                productKey = `prod_${update.message.message_id}`;
              }
            }

            let existingData = await env.PRODUCTS_KV.get(productKey);
            let productData;

            if (existingData) {
              productData = JSON.parse(existingData);
              if (!productData.imageUrls.includes(imageUrl)) {
                productData.imageUrls.push(imageUrl);
              }
              if (cleanCaption && cleanCaption.length >= (productData.text || '').length) {
                productData.text = cleanCaption;
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

    if (url.pathname === '/checkout' && request.method === 'POST') {
      try {
        const orderData = await request.json();
        const { customerName, customerPhone, customerAddress, items } = orderData;

        let orderText = `🚨 طلب جديد من الموقع!\n\n`;
        orderText += `👤 الاسم: ${customerName}\n`;
        orderText += `📞 التليفون: ${customerPhone}\n`;
        orderText += `📍 العنوان: ${customerAddress}\n\n`;
        orderText += `🛒 الأصناف المطلوبة:\n`;

        items.forEach((item, index) => {
          orderText += `${index + 1}. ${item.title} (الكمية: ${item.qty})\n`;
        });

        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: orderText
          })
        });

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ success: false }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === '/') {
        let productsArray = [];
        if (env.PRODUCTS_KV) {
           const { keys } = await env.PRODUCTS_KV.list();
           for (const key of keys.reverse()) {
               const value = await env.PRODUCTS_KV.get(key.name);
               if(value) {
                   productsArray.push(JSON.parse(value));
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
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f7f6; color: #333; }
                header { background: #2c3e50; color: #fff; padding: 20px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                header h1 { margin: 0 0 5px 0; font-size: 24px; }
                header p { margin: 0; color: #bdc3c7; font-size: 14px; }
                .container { max-width: 1200px; margin: 20px auto; padding: 0 15px; }
                .search-bar { width: 100%; padding: 12px 20px; font-size: 16px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; outline: none; }
                .product-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
                .product-card { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; }
                .image-gallery { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 12px; }
                .image-gallery img { width: 100%; height: 180px; object-fit: cover; border-radius: 6px; flex: 1; min-width: 120px; }
                .product-card p { white-space: pre-wrap; line-height: 1.5; font-size: 13px; font-weight: bold; margin: 0 0 12px 0; }
                .btn-add { background: #27ae60; color: #fff; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
                .btn-add:hover { background: #219653; }
                .cart-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #2c3e50; color: #fff; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 -2px 10px rgba(0,0,0,0.2); z-index: 1000; }
                .cart-bar button { background: #e74c3c; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; }
                .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 2000; }
                .modal-content { background: #fff; padding: 25px; border-radius: 10px; width: 90%; max-width: 450px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
                .modal-content h2 { margin-top: 0; font-size: 20px; color: #2c3e50; }
                .modal-content input { width: 100%; padding: 10px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
                .modal-content button.submit-order { background: #27ae60; color: #fff; width: 100%; padding: 12px; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer; }
                .modal-content button.close-modal { background: #95a5a6; color: #fff; width: 100%; padding: 8px; border: none; border-radius: 6px; margin-top: 8px; cursor: pointer; }
            </style>
        </head>
        <body>
            <header>
                <h1>مؤسسة خالد المنشاوي</h1>
                <p>قائمة الأصناف المتاحة للطلب الفوري</p>
            </header>
            
            <div class="container">
                <input type="text" id="searchBox" class="search-bar" placeholder="ابحث باسم الصنف أو الكود..." onkeyup="filterProducts()">
                
                <main class="product-list" id="productList">
                    ${productsArray.map(product => {
                        let imagesHtml = '';
                        if (product.imageUrls && product.imageUrls.length > 0) {
                            imagesHtml = '<div class="image-gallery">';
                            product.imageUrls.forEach(img => {
                                imagesHtml += `<img src="${img}" alt="product">`;
                            });
                            imagesHtml += '</div>';
                        }
                        let titleLine = product.text.split('\n')[0] || 'منتج';
                        return `
                        <div class="product-card" data-title="${product.text.toLowerCase()}">
                            <div>
                                ${imagesHtml}
                                <p>${product.text.replace(/\n/g, '<br>')}</p>
                            </div>
                            <button class="btn-add" onclick="addToCart('${titleLine.replace(/'/g, "")}')">إضافة للسلة 🛒</button>
                        </div>
                        `;
                    }).join('') || '<p style="text-align:center; grid-column: 1/-1;">لا توجد منتجات معروضة حالياً.</p>'}
                </main>
            </div>

            <div class="cart-bar" id="cartBar" style="display:none;">
                <span id="cartCount">تم اختيار 0 صنف</span>
                <button onclick="openCheckoutModal()">إتمام الطلب وعمل الفاتورة 📋</button>
            </div>

            <div class="modal" id="checkoutModal">
                <div class="modal-content">
                    <h2>تأكيد الطلب</h2>
                    <p style="font-size: 13px; color: #666; margin-bottom: 15px;">أدخل بياناتك لتصل الفاتورة للإدارة وسنتواصل معك فوراً.</p>
                    <input type="text" id="custName" placeholder="الاسم الكريم">
                    <input type="text" id="custPhone" placeholder="رقم الهاتف (تليفون/موبايل)">
                    <input type="text" id="custAddress" placeholder="العنوان بالتفصيل">
                    <button class="submit-order" onclick="submitOrder()">إرسال الطلب الآن</button>
                    <button class="close-modal" onclick="closeCheckoutModal()">إلغاء</button>
                </div>
            </div>

            <script>
                let cart = [];

                function addToCart(title) {
                    cart.push({ title: title, qty: 1 });
                    updateCartBar();
                }

                function updateCartBar() {
                    const cartBar = document.getElementById('cartBar');
                    const cartCount = document.getElementById('cartCount');
                    if (cart.length > 0) {
                        cartBar.style.display = 'flex';
                        cartCount.innerText = 'تم اختيار ' + cart.length + ' صنف في السلة';
                    } else {
                        cartBar.style.display = 'none';
                    }
                }

                function openCheckoutModal() {
                    document.getElementById('checkoutModal').style.display = 'flex';
                }

                function closeCheckoutModal() {
                    document.getElementById('checkoutModal').style.display = 'none';
                }

                function submitOrder() {
                    const name = document.getElementById('custName').value;
                    const phone = document.getElementById('custPhone').value;
                    const address = document.getElementById('custAddress').value;

                    if (!name || !phone) {
                        alert('من فضلك اكتب الاسم ورقم الهاتف على الأقل.');
                        return;
                    }

                    fetch('/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            customerName: name,
                            customerPhone: phone,
                            customerAddress: address,
                            items: cart
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if(data.success) {
                            alert('✅ تم إرسال طلبك بنجاح! سيتم مراجعته والتواصل معك قريباً.');
                            cart = [];
                            updateCartBar();
                            closeCheckoutModal();
                        } else {
                            alert('حدث خطأ، حاول مرة أخرى.');
                        }
                    });
                }

                function filterProducts() {
                    let query = document.getElementById('searchBox').value.toLowerCase();
                    let cards = document.querySelectorAll('.product-card');
                    cards.forEach(card => {
                        let text = card.getAttribute('data-title');
                        if (text.includes(query)) {
                            card.style.display = 'flex';
                        } else {
                            card.style.display = 'none';
                        }
                    });
                }
            </script>
        </body>
        </html>
        `;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};
