# Dữ liệu plugin (payload mẫu)

## Shop đồng hồ Luxe Time (`shop-watch-plugin.payload.json`)

Payload để **tạo plugin custom** gọi API cửa hàng đồng hồ (shopdonghobe). Dùng cho API:

- **Tạo plugin**: `POST /workspaces/:workspaceId/tools/custom`
- Body: nội dung file `shop-watch-plugin.payload.json`

### Cách dùng

1. Đảm bảo backend shop đồng hồ chạy (vd: `http://localhost:5000`).
2. Gọi API với token workspace có quyền `WORKSPACE_MANAGE_PLUGINS`:

```http
POST http://localhost:4000/workspaces/{workspaceId}/tools/custom
Authorization: Bearer <JWT>
Content-Type: application/json
```

Body: copy toàn bộ nội dung từ `shop-watch-plugin.payload.json`.

3. (Tuỳ chọn) Đổi `executor_config.base_url` trong payload nếu shop chạy ở URL khác (vd: `https://shop.example.com`), hoặc cấu hình override khi cài vào workspace.

### Actions trong plugin

| Action | Mô tả ngắn |
|--------|------------|
| `get_hot_products` | Danh sách sản phẩm hot (query: `limit`) |
| `get_product_by_slug` | Chi tiết sản phẩm theo slug |
| `get_product_by_id` | Chi tiết sản phẩm theo id |
| `get_similar_products` | Sản phẩm tương tự (slug + limit) |
| `list_products` | Danh sách có lọc (brand, gender, search, minPrice, maxPrice) |
| `list_brands` | Danh sách thương hiệu |

Sau khi tạo xong, cài plugin vào workspace (nếu chưa tự cài), rồi gán plugin cho chatbot để LLM gọi khi khách hỏi về sản phẩm.

### Hiển thị dạng card (chat response)

Action nào **trả về danh sách** và muốn hiển thị dạng card trong chat thì thêm `card_config` trong action:

```json
"card_config": {
  "enabled": true,
  "list_path": "data",
  "field_mapping": { "title": "name", "url": "url", "imageUrl": "imageUrl", "description": "description" }
}
```

- **enabled**: `true` = bật map kết quả thành card (mặc định bật nếu có `card_config`).
- **list_path**: đường dẫn trong result đến mảng (vd: `"data"`, `"items"`, `"response.list"`). Bỏ trống thì tự thử `data` / `items` / `results` / ...
- **field_mapping**: map key chuẩn card → key API (title, url, imageUrl, description). Nếu API dùng `name` thay `title`, đặt `"title": "name"`; nếu dùng `link` thay `url`, đặt `"url": "link"`.
