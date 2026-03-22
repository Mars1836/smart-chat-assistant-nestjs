# API Giao dịch ví & Lịch sử token trong Workspace (cho Frontend)

Tài liệu mô tả API xem **giao dịch tiền** (nạp tiền, hoàn, điều chỉnh) và **lịch sử sử dụng token** trong một workspace. **Chỉ Owner và Admin** của workspace mới xem được.

**Base URL:** `{API_BASE}/workspaces/:workspaceId/billing`  
(Ví dụ: `http://localhost:4000/workspaces/7a92f7b6-2607-47a3-aa6f-97854a0c1e47/billing`)

**Header bắt buộc:**

```
Authorization: Bearer <accessToken>
```

---

## Phân quyền

| Vai trò workspace | Xem lịch sử giao dịch / token |
|-------------------|-------------------------------|
| **Owner**         | ✅ Có (mặc định)              |
| **Admin**         | ✅ Có (mặc định)              |
| **Editor**        | ❌ Không                      |
| **Viewer**        | ❌ Không                      |

- Backend dùng permission **`billing.view_transactions`**. Chỉ role **Owner** và **Admin** được cấp permission này (seed RBAC).
- Nếu user không phải Owner/Admin → **403 Forbidden**.

---

## 1. Lịch sử giao dịch ví & token

**GET** `/workspaces/:workspaceId/billing/transactions`

Trả về danh sách giao dịch của ví workspace: **topup** (nạp tiền), **usage** (trừ token), **refund**, **adjustment**. Gồm cả lịch sử dùng token (số input/output tokens) cho từng giao dịch type `usage`.

### Query params

| Param     | Type   | Mặc định   | Mô tả |
|----------|--------|------------|--------|
| `page`   | number | 1          | Trang |
| `limit`  | number | 10         | Số bản ghi mỗi trang |
| `sortBy` | string | `created_at` | Trường sắp xếp: `created_at`, `amount`, `type` |
| `sortOrder` | `ASC` \| `DESC` | `DESC` | Thứ tự |
| `type`   | string | —          | Lọc theo loại: `topup`, `usage`, `refund`, `adjustment` |

**Ví dụ:**

- `GET /workspaces/{id}/billing/transactions?page=1&limit=20`
- `GET /workspaces/{id}/billing/transactions?type=usage` (chỉ lịch sử dùng token)
- `GET /workspaces/{id}/billing/transactions?type=topup` (chỉ nạp tiền)

### Response thành công (200)

```json
{
  "data": [
    {
      "id": "uuid",
      "workspace_id": "workspace-uuid",
      "user_id": "user-uuid-1",
      "user": {
        "id": "user-uuid-1",
        "name": "Nguyễn Văn A",
        "email": "user@example.com"
      },
      "type": "usage",
      "amount": "-165.0000",
      "description": "LLM usage: provider=gemini, model=gemini-2.0-flash-lite, tokens=165",
      "llm_provider": "gemini",
      "llm_model": "gemini-2.0-flash-lite",
      "input_tokens": 120,
      "output_tokens": 45,
      "metadata": { "conversationId": "...", "chatbotId": "...", "phase": "answer" },
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "uuid-2",
      "workspace_id": "workspace-uuid",
      "user_id": "user-uuid-2",
      "user": {
        "id": "user-uuid-2",
        "name": "Trần Thị B",
        "email": "admin@example.com"
      },
      "type": "topup",
      "amount": "100.0000",
      "description": "Topup via SePay (session ABC123)",
      "llm_provider": null,
      "llm_model": null,
      "input_tokens": null,
      "output_tokens": null,
      "metadata": null,
      "created_at": "2024-01-14T08:00:00.000Z",
      "updated_at": "2024-01-14T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Ý nghĩa từng trường (trong `data[]`)

| Field           | Mô tả |
|-----------------|--------|
| `id`            | UUID giao dịch |
| `workspace_id`  | UUID workspace |
| `user_id`       | UUID thành viên (user) liên quan; **null** nếu không xác định (widget/khách, webhook cũ) |
| `user`          | Thông tin thành viên: **usage** = người dùng token, **topup** = người tạo phiên nạp (gọi API VietQR). Có `id`, `name`, `email`. **null** nếu `user_id` null |
| `type`          | `topup` \| `usage` \| `refund` \| `adjustment` |
| `amount`        | **usage:** số credits (token) đã sử dụng, lưu **âm** (vd. -165 = đã dùng 165 token). **topup/refund/adjustment:** số tiền (dương/âm tùy loại). |
| `description`   | Mô tả giao dịch |
| `llm_provider`  | Provider LLM (chỉ có khi `type === 'usage'`) |
| `llm_model`     | Model LLM (chỉ có khi `type === 'usage'`) |
| `input_tokens`  | Token đầu vào (chỉ có khi `type === 'usage'`) |
| `output_tokens` | Token đầu ra (chỉ có khi `type === 'usage'`) |
| `metadata`      | JSON bổ sung (vd. conversationId, chatbotId, phase) |
| `created_at`   | Thời điểm tạo |

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập hoặc token hết hạn |
| **403** | Không có quyền `billing.view_transactions` (chỉ Owner & Admin workspace) |
| **404** | Workspace không tồn tại (nếu backend trả 404) |

---

## 2. Áp dụng cho FE

1. **Điều kiện hiển thị menu/trang “Giao dịch” / “Lịch sử token”:**
   - Chỉ hiển thị cho user có vai trò **Owner** hoặc **Admin** trong workspace đó.
   - FE có thể dùng **GET /workspaces/:workspaceId** (hoặc API trả về role của user trong workspace) để biết role → chỉ khi role là Owner/Admin mới show link/ tab “Giao dịch” / “Lịch sử token”.

2. **Gọi API:**
   - Trang “Lịch sử giao dịch” / “Lịch sử token”: gọi **GET /workspaces/:workspaceId/billing/transactions** với `page`, `limit`, tùy chọn `type` (để tab “Tất cả” / “Nạp tiền” / “Dùng token”).
   - Nếu trả **403**: ẩn nội dung và có thể hiển thị thông báo “Chỉ Owner và Admin workspace mới xem được”.

3. **Hiển thị:**
   - Bảng/danh sách: cột Thời gian, **Thành viên** (dùng `user?.name` hoặc `user?.email`; nếu `user` null thì hiển thị "—" hoặc "Khách"), Loại (topup/usage/refund/adjustment), Số tiền, Mô tả; với `type === 'usage'` thêm cột Token (input_tokens + output_tokens).
   - **usage** = thành viên nào dùng token (chat trong app); **topup** = thành viên nào tạo phiên nạp (gọi API tạo VietQR). Widget/khách hoặc nạp qua webhook không có user → `user` null.
   - **usage:** `amount` = số credits (token) đã dùng, lưu âm → hiển thị "Đã dùng X credits" với X = `Math.abs(parseFloat(amount))` (hoặc dùng luôn `input_tokens + output_tokens`).
   - **topup/refund/adjustment:** `amount` = số tiền (dương/âm) → format theo locale (vd. VND hoặc CREDITS).
   - Phân trang: dùng `meta.total`, `meta.page`, `meta.limit`, `meta.hasNextPage` / `hasPreviousPage`.

4. **Permission:**
   - Backend đã cấu hình permission **`billing.view_transactions`** cho role **Owner** và **Admin**. FE chỉ cần ẩn/hiện theo role; khi gọi API nếu 403 thì xử lý thông báo như trên.
