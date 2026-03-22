# Hướng dẫn FE: Hiển thị Cards từ response Chat

Khi gọi API chat, response có thể kèm mảng `cards` (sản phẩm, bài viết, link). FE chỉ cần render một kiểu card chung, bấm vào mở `url`.

## 1. Response chat

```json
{
  "conversation_id": "...",
  "response": "Dưới đây là một số sản phẩm nổi bật...",
  "model": "gemini-2.0-flash-lite",
  "files": [],
  "uploaded_images": [],
  "cards": [
    {
      "type": "product",
      "title": "Omega Speedmaster Moonwatch",
      "description": "Chiếc đồng hồ Moonwatch nổi tiếng của Omega.",
      "imageUrl": "https://images.unsplash.com/photo-...",
      "url": "http://localhost:5500/shopdongho/product.html?slug=omega-speedmaster-moonwatch",
      "metadata": { "id": 2, "slug": "omega-speedmaster-moonwatch", "brand": "Omega", "price": 150000000 }
    },
    {
      "type": "link",
      "title": "Bài báo ví dụ",
      "description": "Snippet hoặc mô tả ngắn.",
      "imageUrl": null,
      "url": "https://example.com/article",
      "metadata": { "displayLink": "example.com" }
    }
  ],
  "processingTime": 1234
}
```

## 2. Cấu trúc một card (chung cho mọi type)

| Field        | Kiểu   | Bắt buộc | Mô tả |
|-------------|--------|----------|--------|
| `type`      | string | Có       | `product` \| `article` \| `link` — FE có thể style khác nhẹ theo type |
| `title`     | string | Có       | Tiêu đề hiển thị |
| `description` | string | Không  | Mô tả ngắn |
| `imageUrl`  | string | Không   | URL ảnh |
| `url`       | string | Có       | Link khi bấm vào card. **Product**: trang chi tiết sản phẩm (product.html?slug=...). **Article/Link**: URL bài báo hoặc link bên ngoài. FE nên mở bằng `<a href={url} target="_blank">` hoặc in-app. |
| `metadata`  | object | Không   | Tùy type: `price`, `brand`, `author`, `publishedAt`, ... |

## 3. Cách FE xử lý

1. **Sau khi nhận response chat** (từ API hoặc WebSocket):
   - Lưu `response.response` để hiển thị text.
   - Nếu `response.cards && response.cards.length > 0` → render thêm khối cards bên dưới (hoặc bên cạnh) tin nhắn bot.

2. **Render từng card:**
   - Dùng **một component/layout chung**: ảnh (nếu có) + title + description + (tùy type: giá / tác giả / v.v.).
   - Bấm vào card → mở `card.url` (vd: `window.open(card.url, '_blank')` hoặc `<a href={card.url} target="_blank">`).

3. **Tùy type (không bắt buộc):**
   - `type === 'product'` và `metadata.price` → hiển thị giá (format VNĐ).
   - `type === 'article'` và `metadata.author` / `metadata.publishedAt` → hiển thị tác giả / ngày.
   - `type === 'link'` → chỉ title + description + url.

## 4. Ví dụ HTML + JS (vanilla, dùng trong widget hoặc trang chat)

```html
<!-- Container tin nhắn bot -->
<div class="chat-message bot">
  <div class="message-text"></div>
  <div class="message-cards"></div>
</div>
```

```javascript
function formatPrice(n) {
  if (typeof n !== 'number') return n;
  return new Intl.NumberFormat('vi-VN').format(n) + '₫';
}

function renderCards(container, cards) {
  if (!container || !Array.isArray(cards) || cards.length === 0) return;
  container.innerHTML = cards.map(card => {
    const meta = card.metadata || {};
    let extra = '';
    if (card.type === 'product' && meta.price != null) {
      extra = `<span class="card-price">${formatPrice(meta.price)}</span>`;
    } else if (card.type === 'article' && meta.author) {
      extra = `<span class="card-meta">${meta.author}</span>`;
    }
    return `
      <a class="chat-card chat-card--${card.type}" href="${card.url}" target="_blank" rel="noopener">
        ${card.imageUrl ? `<img class="chat-card__img" src="${card.imageUrl}" alt="${card.title}" loading="lazy" />` : ''}
        <div class="chat-card__body">
          <h4 class="chat-card__title">${card.title}</h4>
          ${card.description ? `<p class="chat-card__desc">${card.description}</p>` : ''}
          ${extra}
        </div>
      </a>
    `;
  }).join('');
}

// Khi nhận response từ API chat:
const data = await fetch('/workspaces/.../chatbots/.../chat', { ... }).then(r => r.json());
document.querySelector('.message-text').textContent = data.response;
renderCards(document.querySelector('.message-cards'), data.cards || []);
```

## 5. Ví dụ CSS (gợi ý)

```css
.message-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.chat-card {
  display: flex;
  flex-direction: column;
  width: 180px;
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  border: 1px solid #eee;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.chat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.chat-card__img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.chat-card__body {
  padding: 10px 12px;
}

.chat-card__title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chat-card__desc {
  font-size: 12px;
  color: #666;
  margin: 0 0 6px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chat-card__price, .chat-card__meta {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}
```

## 6. Tóm tắt

- Luôn kiểm tra `response.cards` và chỉ render khi có phần tử.
- Một layout card chung: ảnh (optional) + title + description + (metadata tùy type).
- Bấm card → mở `card.url` (nên dùng `target="_blank"` cho link ngoài).
- Có thể thêm class theo `card.type` (vd `.chat-card--product`) để đổi màu/icon nhẹ nếu cần.
