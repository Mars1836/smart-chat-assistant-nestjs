# API Model & Giá token (LLM Models) – Cho Frontend

Tài liệu mô tả **hai chức năng** và API tương ứng:

1. **Màn hình bảng giá token (client)** – Cho user xem tham khảo giá theo model (input/output per 1K tokens).
2. **Quản lý model & giá (admin hệ thống)** – CRUD model, sửa giá cho system admin.

**Base URL:** `{API_BASE}/llm-models`  
(Ví dụ: `http://localhost:4000/llm-models`)

**Header bắt buộc (mọi API):**

```
Authorization: Bearer <accessToken>
```

---

# Chức năng 1: Màn hình bảng giá token (cho client)

## Mục đích

Hiển thị cho **user đã đăng nhập** (client) một màn hình tham khảo giá token theo từng model: giá input (per 1K tokens) và giá output (per 1K tokens). User không cần quyền admin, chỉ cần có access token hợp lệ.

## API dùng cho màn hình

### GET `/llm-models/pricing`

- **Phân quyền:** Bất kỳ user đã đăng nhập (chỉ cần `JwtAuthGuard`).
- **Mô tả:** Trả về **toàn bộ** danh sách model và giá (không phân trang), dùng để render bảng/cards bảng giá.

### Response thành công (200)

Mảng các object, mỗi phần tử:

| Field                       | Type   | Mô tả |
|-----------------------------|--------|--------|
| `id`                        | string | UUID |
| `provider`                  | string | Ví dụ: `gemini`, `openai` |
| `model`                     | string | Tên model |
| `display_name`              | string \| null | Tên hiển thị (ưu tiên dùng cho UI) |
| `price_per_1k_input_tokens` | string | Giá per 1K **input** tokens (decimal dạng string) |
| `price_per_1k_output_tokens`| string | Giá per 1K **output** tokens (decimal dạng string) |
| `created_at`                | string | ISO timestamp |
| `updated_at`                | string | ISO timestamp |

**Ví dụ:**

```json
[
  {
    "id": "uuid-1",
    "provider": "gemini",
    "model": "gemini-2.0-flash-lite",
    "price_per_1k_input_tokens": "0.0005",
    "price_per_1k_output_tokens": "0.0015",
    "display_name": "Gemini 2.0 Flash Lite",
    "created_at": "2025-02-26T00:00:00.000Z",
    "updated_at": "2025-02-26T00:00:00.000Z",
    "created_by_id": null
  },
  {
    "id": "uuid-2",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "price_per_1k_input_tokens": "0.0008",
    "price_per_1k_output_tokens": "0.003",
    "display_name": "GPT-4o Mini",
    "created_at": "2025-02-26T00:00:00.000Z",
    "updated_at": "2025-02-26T00:00:00.000Z",
    "created_by_id": null
  }
]
```

### Gợi ý triển khai FE (màn hình client)

- Route ví dụ: `/pricing`, `/billing/pricing`, `/token-pricing`.
- Gọi **GET** `/llm-models/pricing` khi vào màn (hoặc khi tab/menu "Bảng giá" được mở).
- Hiển thị bảng hoặc card list: cột **Model** (dùng `display_name` hoặc `model`), **Giá input (/1K token)**, **Giá output (/1K token)**. Có thể format số từ string (vd. `0.0005` → "0.0005" hoặc làm tròn tùy thiết kế).
- Có thể nhóm theo `provider` (Gemini, OpenAI, …) nếu muốn.

---

# Chức năng 2: Quản lý model & giá (admin hệ thống)

## Mục đích

Cho **system admin** (user có `system_role = admin`) thêm/sửa/xóa model và **sửa giá** (input/output per 1K tokens). Các API dưới đây đều yêu cầu **System Admin**.

## Phân quyền

- Chỉ user có **system_role = admin** mới gọi được các API trong mục này.
- Nếu không phải admin → **403 Forbidden** (message: "Chỉ quản trị viên hệ thống (admin) mới được thực hiện thao tác này").

## Danh sách API quản lý

### 1. Danh sách model (có phân trang) – Admin

**GET** `/llm-models`

**Query params:**

| Param       | Type   | Mặc định    | Mô tả |
|------------|--------|-------------|--------|
| `page`     | number | 1           | Trang |
| `limit`    | number | 10          | Số bản ghi mỗi trang (tối đa 100) |
| `sortBy`   | string | `created_at`| Trường sắp xếp: `provider`, `model`, `price_per_1k_input_tokens`, `price_per_1k_output_tokens`, `created_at`, `updated_at` |
| `sortOrder`| `ASC` \| `DESC` | `ASC` | Thứ tự |

**Response 200:** Paginated với `data` (mảng LlmModel) và `meta` (total, page, limit, totalPages, hasNextPage, hasPreviousPage).

---

### 2. Chi tiết một model – Admin

**GET** `/llm-models/:id`

**Response 200:** Một object model (id, provider, model, price_per_1k_input_tokens, price_per_1k_output_tokens, display_name, created_at, updated_at, created_by_id).

**Response 404:** Không tìm thấy.

---

### 3. Tạo model mới – Admin

**POST** `/llm-models`

**Body (JSON):**

| Field                        | Type   | Bắt buộc | Mô tả |
|-----------------------------|--------|----------|--------|
| `provider`                  | string | Có       | Ví dụ: `gemini`, `openai` (tối đa 50 ký tự) |
| `model`                     | string | Có       | Tên model (tối đa 120 ký tự) |
| `price_per_1k_input_tokens` | number | Có       | Giá per 1K input tokens (credits), ≥ 0 |
| `price_per_1k_output_tokens`| number | Có       | Giá per 1K output tokens (credits), ≥ 0 |
| `display_name`              | string | Không    | Tên hiển thị (tối đa 150 ký tự) |

**Ví dụ:**

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo",
  "price_per_1k_input_tokens": 0.01,
  "price_per_1k_output_tokens": 0.03,
  "display_name": "GPT-4 Turbo"
}
```

**Response 201:** Bản ghi vừa tạo.

**Response 409:** Đã tồn tại cặp `provider` + `model`.

---

### 4. Cập nhật model (sửa giá, tên hiển thị) – Admin

**PATCH** `/llm-models/:id`

**Body (JSON)** – tất cả optional:

| Field                        | Type   | Mô tả |
|-----------------------------|--------|--------|
| `price_per_1k_input_tokens` | number | Giá per 1K input tokens, ≥ 0 |
| `price_per_1k_output_tokens`| number | Giá per 1K output tokens, ≥ 0 |
| `display_name`              | string \| null | Tên hiển thị (gửi `null` để xóa) |

**Ví dụ:**

```json
{
  "price_per_1k_input_tokens": 0.001,
  "price_per_1k_output_tokens": 0.002
}
```

**Response 200:** Bản ghi đã cập nhật.

**Response 404:** Không tìm thấy.

---

### 5. Xóa model – Admin

**DELETE** `/llm-models/:id`

**Response 200:** `{ "message": "Deleted" }`

**Response 404:** Không tìm thấy.

---

## Gợi ý triển khai FE (màn hình quản lý admin)

- Route ví dụ: `/admin/llm-models`, `/system/models`.
- Chỉ hiển thị menu/route này khi user là **system admin** (kiểm tra `system_role` hoặc quyền tương đương).
- **Danh sách:** Gọi **GET** `/llm-models?page=1&limit=20`, hiển thị bảng có cột: Model (display_name/model), Provider, Giá input/1K, Giá output/1K, Thao tác (Sửa / Xóa).
- **Sửa giá:** Mở form/modal, load chi tiết **GET** `/llm-models/:id`, gửi **PATCH** `/llm-models/:id` với `price_per_1k_input_tokens`, `price_per_1k_output_tokens`, `display_name` (tùy chỉnh).
- **Thêm model:** Form tạo mới, gửi **POST** `/llm-models` với đủ provider, model, hai giá, display_name (optional).
- **Xóa:** Confirm rồi gọi **DELETE** `/llm-models/:id`, sau đó refresh danh sách.

---

## Ghi chú chung

- **Bảng:** `llm_models`. Giá lưu riêng **input** và **output** (per 1K tokens).
- **Billing:** Công thức trừ ví: `(input_tokens * price_per_1k_input_tokens + output_tokens * price_per_1k_output_tokens) / 1000`. Nếu không có bản ghi tương ứng (provider+model) thì giá = 0 (không trừ balance).
- **Client chỉ xem:** Dùng **GET** `/llm-models/pricing`. Admin thêm/sửa/xóa qua **GET/POST/PATCH/DELETE** `/llm-models` (và **GET** `/llm-models/:id`).
