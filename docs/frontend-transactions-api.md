# API Quản lý & Thống kê Giao dịch (cho Frontend)

Tài liệu mô tả các API quản lý và thống kê **giao dịch thanh toán** (payments): danh sách, chi tiết, thống kê tổng quan và theo thời gian.

**Base URL:** `{API_BASE}/payments`  
(Ví dụ: `http://localhost:4000/payments`)

**Header bắt buộc cho mọi request:**

```
Authorization: Bearer <accessToken>
```

Lấy `accessToken` từ **POST /auth/login** hoặc **POST /auth/register** (xem [frontend-auth-api.md](./frontend-auth-api.md)).

---

## Phân quyền nhanh

| Endpoint | User thường | Admin |
|----------|-------------|--------|
| GET /payments | ✅ Chỉ giao dịch của mình | ✅ Tất cả, có thể lọc theo `user_id` |
| GET /payments/:id | ✅ Chỉ giao dịch của mình | ✅ Xem bất kỳ |
| GET /payments/stats/summary | ✅ Thống kê của mình | ✅ Toàn hệ thống hoặc theo `user_id` |
| GET /payments/stats/by-date | ✅ Thống kê của mình | ✅ Toàn hệ thống hoặc theo `user_id` |

---

## 1. Danh sách giao dịch

**GET** `/payments`

Trả về danh sách giao dịch có phân trang, lọc theo trạng thái/kênh. **User:** chỉ giao dịch của mình. **Admin:** tất cả, có thể lọc theo `user_id`.

### Query params

| Param | Type | Mặc định | Mô tả |
|-------|------|----------|--------|
| `page` | number | 1 | Trang |
| `limit` | number | 10 | Số bản ghi mỗi trang |
| `sortBy` | string | `created_at` | Trường sắp xếp: `created_at`, `amount` |
| `sortOrder` | `'ASC'` \| `'DESC'` | `DESC` | Thứ tự |
| `status` | string | — | Lọc theo trạng thái: `pending`, `success`, `failed` |
| `provider` | string | — | Lọc theo kênh: `zalopay`, `momo`, `bank` |
| `user_id` | string (UUID) | — | **Chỉ admin:** lọc giao dịch theo user |

**Ví dụ:**  
`GET /payments?page=1&limit=20&status=success&sortOrder=DESC`  
`GET /payments?user_id=550e8400-e29b-41d4-a716-446655440000` (admin)

### Response thành công (200)

```json
{
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "amount": "100000.00",
      "description": "Nạp tiền ví",
      "provider": "bank",
      "transaction_id": "TXN-2024-001",
      "status": "success",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Nguyễn Văn A",
        "email": "user@example.com"
      }
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

| Field (trong từng phần tử `data`) | Mô tả |
|-----------------------------------|--------|
| `id` | UUID giao dịch |
| `amount` | Số tiền (decimal dạng chuỗi) |
| `description` | Mô tả hoặc `null` |
| `provider` | Kênh thanh toán: `zalopay`, `momo`, `bank` |
| `transaction_id` | Mã giao dịch từ nhà cung cấp |
| `status` | `pending`, `success`, `failed` |
| `created_at`, `updated_at` | ISO 8601 |
| `user` | Thông tin user (có khi backend trả về; admin list thường có) |

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập hoặc token hết hạn |

---

## 2. Chi tiết một giao dịch

**GET** `/payments/:id`

**User:** chỉ xem được giao dịch của chính mình. **Admin:** xem bất kỳ giao dịch.

### Response thành công (200)

Cùng cấu trúc một phần tử trong `data` của **GET /payments** (id, amount, description, provider, transaction_id, status, created_at, updated_at, user).

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập |
| **403** | User cố xem giao dịch của người khác |
| **404** | Giao dịch không tồn tại |

---

## 3. Thống kê tổng quan giao dịch

**GET** `/payments/stats/summary`

Tổng số giao dịch, tổng tiền thành công, phân bổ theo trạng thái và kênh, số giao dịch thành công trong 7/30 ngày qua.  
**User:** thống kê của chính mình. **Admin:** toàn hệ thống; có thể truyền `user_id` để xem thống kê một user.

### Query params

| Param | Type | Mô tả |
|-------|------|--------|
| `user_id` | string (UUID) | **Chỉ admin:** thống kê theo user; bỏ trống = toàn hệ thống |

### Response thành công (200)

```json
{
  "total_count": 55,
  "total_amount_success": "15000000.00",
  "by_status": {
    "pending": 2,
    "success": 50,
    "failed": 3
  },
  "by_provider": {
    "zalopay": 10,
    "momo": 20,
    "bank": 25
  },
  "success_last_7_days": 5,
  "success_last_30_days": 12
}
```

| Field | Mô tả |
|-------|--------|
| `total_count` | Tổng số giao dịch (trong phạm vi user/admin đang xem) |
| `total_amount_success` | Tổng tiền các giao dịch **thành công** (chuỗi decimal) |
| `by_status` | Số giao dịch theo trạng thái: `pending`, `success`, `failed` |
| `by_provider` | Số giao dịch theo kênh: `zalopay`, `momo`, `bank` |
| `success_last_7_days` | Số giao dịch thành công trong 7 ngày qua |
| `success_last_30_days` | Số giao dịch thành công trong 30 ngày qua |

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập |
| **403** | User truyền `user_id` (chỉ admin mới được) |

---

## 4. Thống kê giao dịch theo thời gian

**GET** `/payments/stats/by-date`

Số giao dịch và **tổng tiền (chỉ giao dịch success)** theo từng **ngày**, **tuần** hoặc **tháng**. Dùng cho biểu đồ (chart).  
**User:** thống kê của mình. **Admin:** toàn hệ thống hoặc theo `user_id`.

### Query params

| Param | Type | Mặc định | Mô tả |
|-------|------|----------|--------|
| `from` | string (ISO date) | 30 ngày trước | Từ ngày (vd. `2024-01-01`) |
| `to` | string (ISO date) | Hôm nay | Đến ngày |
| `groupBy` | `day` \| `week` \| `month` | `day` | Nhóm theo ngày / tuần / tháng |
| `user_id` | string (UUID) | — | **Chỉ admin:** thống kê theo user |

**Ví dụ:**  
`GET /payments/stats/by-date?from=2024-01-01&to=2024-01-31&groupBy=day`

### Response thành công (200)

```json
[
  { "date": "2024-01-01", "count": 3, "amount": "500000.00" },
  { "date": "2024-01-02", "count": 1, "amount": "100000.00" },
  { "date": "2024-01-03", "count": 5, "amount": "1200000.00" }
]
```

| Field | Mô tả |
|-------|--------|
| `date` | Ngày/ tuần/ tháng (YYYY-MM-DD) |
| `count` | Số giao dịch trong kỳ |
| `amount` | Tổng tiền giao dịch **thành công** trong kỳ (chuỗi decimal) |

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập |
| **403** | User truyền `user_id` |

---

## Tóm tắt lỗi thường gặp

| Status | Ý nghĩa chung |
|--------|----------------|
| **401** | Thiếu hoặc sai token, token hết hạn → FE nên redirect login / refresh token |
| **403** | Đủ quyền đăng nhập nhưng không đủ quyền (vd: user xem giao dịch người khác, user dùng query `user_id`) |
| **404** | Giao dịch không tồn tại |

---

## Gợi ý tích hợp FE

1. **Trang “Lịch sử giao dịch” (user):** gọi **GET /payments** với `page`, `limit`, tùy chọn `status`, `provider`; hiển thị bảng + phân trang.
2. **Trang “Chi tiết giao dịch”:** **GET /payments/:id** (chỉ khi user sở hữu giao dịch đó hoặc là admin).
3. **Dashboard / Thống kê (user):** **GET /payments/stats/summary** (không truyền `user_id`) để hiển thị tổng quan; **GET /payments/stats/by-date?groupBy=day** (hoặc week/month) để vẽ biểu đồ số giao dịch và tổng tiền theo thời gian.
4. **Admin – Quản lý giao dịch:** **GET /payments** có thể dùng `user_id` để xem giao dịch của một user; **GET /payments/stats/summary?user_id=...** và **GET /payments/stats/by-date?user_id=...** để xem thống kê theo user.
5. **Số tiền:** backend trả về dạng chuỗi decimal (vd. `"100000.00"`); FE có thể `parseFloat` hoặc format hiển thị theo locale (vd. VND).
