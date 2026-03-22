# FE: Thêm / sửa plugin – Cấu hình hiển thị Card (card_config)

Tài liệu cho phần FE **thêm plugin** (custom tool) và **sửa plugin**: cách hiển thị và gửi **card_config** theo từng action.

---

## 1. Vị trí trong form

- **Card config** thuộc **từng action**, không thuộc tool.
- Trong form thêm/sửa plugin:
  - Có danh sách **actions** (mỗi action: name, display_name, description, parameters, executor_config, …).
  - Với **mỗi action**, thêm một block (có thể thu gọn) **“Hiển thị dạng card trong chat”** hoặc **“Card config”**.

---

## 2. Khi nào hiển thị / bật card_config

- Chỉ nên bật **card_config** cho các action **trả về một danh sách** (list) mà bạn muốn hiển thị dạng card trong chat (sản phẩm, bài viết, link, …).
- Action trả về **một object** (chi tiết 1 sản phẩm, 1 bài viết) thường không cần card_config (hoặc để tắt).

Gợi ý UI:
- Checkbox hoặc toggle: **“Hiển thị kết quả dạng card trong chat”**.
- Khi bật → hiện thêm các field `list_path` và `field_mapping` bên dưới.

---

## 3. Cấu trúc dữ liệu gửi API

Payload tạo/cập nhật plugin (body của `POST /workspaces/:workspaceId/tools/custom` hoặc API sửa tool/action) có dạng:

```json
{
  "name": "my_plugin",
  "display_name": "Tên hiển thị",
  "description": "...",
  "executor_type": "generic_api",
  "executor_config": { ... },
  "actions": [
    {
      "name": "list_items",
      "display_name": "Lấy danh sách",
      "description": "...",
      "parameters": { ... },
      "executor_config": { ... },
      "card_config": {
        "enabled": true,
        "list_path": "data",
        "field_mapping": {
          "title": "name",
          "url": "link",
          "imageUrl": "thumbnail",
          "description": "snippet"
        }
      }
    }
  ]
}
```

- **card_config** là object **tùy chọn** trên mỗi action.
- Nếu không có `card_config` hoặc `enabled: false` → backend **không** tạo card từ action đó.

---

## 4. Các field trong card_config (form FE)

### 4.1. enabled (boolean, tùy chọn)

- **Ý nghĩa:** Bật/tắt việc “map kết quả action này thành card trong chat”.
- **Mặc định:** Nếu có `card_config` thì coi như bật (`true`).
- **FE:** Checkbox/toggle **“Hiển thị kết quả dạng card”**. Khi bật mới hiện `list_path` và `field_mapping`.

### 4.2. list_path (string, tùy chọn)

- **Ý nghĩa:** Đường dẫn trong **response JSON** của API tới **mảng** cần hiển thị card.
- **Ví dụ:**
  - API trả về `{ "data": [ ... ] }` → `list_path`: `"data"`.
  - API trả về `{ "response": { "items": [ ... ] } }` → `list_path`: `"response.items"`.
- **Để trống:** Backend tự thử lần lượt: `data`, `items`, `results`, `organic_results`, `list`.
- **FE:** Input text, placeholder ví dụ: `data` hoặc `response.items`. Label: **“Đường dẫn tới mảng trong response (ví dụ: data, items, response.list)”**.

### 4.3. field_mapping (object, tùy chọn)

- **Ý nghĩa:** Map từ **tên field chuẩn của card** sang **tên field thực tế** trong mỗi phần tử của mảng API.
- **Card chuẩn cần 4 field:** `title`, `url`, `imageUrl`, `description`.
- **Cách dùng:** Key = field chuẩn (title/url/imageUrl/description), value = tên field trong API.
  - API dùng `name` thay vì `title` → `"title": "name"`.
  - API dùng `link` thay vì `url` → `"url": "link"`.
  - API dùng `thumbnail` thay vì `imageUrl` → `"imageUrl": "thumbnail"`.
  - API dùng `snippet` thay vì `description` → `"description": "snippet"`.
- **FE:** 4 dòng (hoặc 4 cặp key-value):
  - **Title (card)** ← field API: input, placeholder `title` hoặc `name`.
  - **URL (card)** ← field API: input, placeholder `url` hoặc `link`.
  - **Image URL (card)** ← field API: input, placeholder `imageUrl` hoặc `thumbnail`.
  - **Description (card)** ← field API: input, placeholder `description` hoặc `snippet`.

Có thể build object `field_mapping` từ 4 input đó, chỉ gửi key nào user có điền (không cần gửi key value rỗng).

---

## 5. Gợi ý layout form (mỗi action)

```
[ Action: list_items                    ]
  Display name:   [ Lấy danh sách      ]
  Description:    [ ...                  ]
  Parameters:     ...
  Executor config: ...

  ┌─ Hiển thị dạng card trong chat ─────┐
  │ [x] Bật hiển thị card                │
  │                                      │
  │ Đường dẫn tới mảng: [ data        ]  │
  │   (vd: data, items, response.items)  │
  │                                      │
  │ Map field API → card:                │
  │   Title       ← [ name     ]         │
  │   URL         ← [ link     ]         │
  │   Image URL   ← [ thumbnail]         │
  │   Description ← [ snippet  ]          │
  └─────────────────────────────────────┘
```

- Khi “Bật hiển thị card” = false hoặc bỏ tick → gửi `card_config: null` hoặc không gửi `card_config` cho action đó.

---

## 6. Validation phía FE (gợi ý)

- **list_path:** Nếu có nhập thì trim, không bắt buộc.
- **field_mapping:** Chỉ gửi các key có value không rỗng (title, url, imageUrl, description).
- **enabled:** Boolean; nếu không tick thì có thể gửi `card_config: { enabled: false }` hoặc `card_config: null` tùy API/backend chấp nhận.

---

## 7. API endpoint liên quan

- **Tạo plugin:** `POST /workspaces/:workspaceId/tools/custom`  
  Body: CreateToolDto (có `actions[]`, mỗi action có thể có `card_config`).
- **Sửa plugin/tool:** Dùng API update tool/action tương ứng; payload action vẫn có thể gồm `card_config` (UpdateToolDto = partial CreateToolDto).

---

## 8. Tóm tắt type (TypeScript) cho FE

```ts
interface CardConfig {
  enabled?: boolean;
  list_path?: string;
  field_mapping?: {
    title?: string;      // tên field API cho title
    url?: string;        // tên field API cho url
    imageUrl?: string;   // tên field API cho ảnh
    description?: string; // tên field API cho mô tả
  };
}

interface PluginAction {
  name: string;
  display_name: string;
  description: string;
  parameters?: Record<string, unknown>;
  executor_config?: Record<string, unknown> | null;
  card_config?: CardConfig | null;
  // ... các field khác
}
```

Bạn chỉ cần thêm block form **card_config** cho từng action trong màn thêm/sửa plugin và gửi đúng cấu trúc trên trong body API.
