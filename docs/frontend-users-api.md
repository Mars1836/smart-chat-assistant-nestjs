# API Quản lý User (cho Frontend)

Tài liệu mô tả các API quản lý user: xem profile, danh sách user (admin), tạo/sửa/xóa user.

**Base URL:** `{API_BASE}/users`  
(Ví dụ: `http://localhost:4000/users`)

**Header bắt buộc cho mọi request:**

```
Authorization: Bearer <accessToken>
```

Lấy `accessToken` từ **POST /auth/login** hoặc **POST /auth/register** (xem [frontend-auth-api.md](./frontend-auth-api.md)).

---

## Phân quyền nhanh

| Endpoint | User thường | Admin |
|----------|-------------|--------|
| GET /users/profile | ✅ Xem/sửa profile mình | ✅ |
| GET /users | ❌ 403 | ✅ Danh sách user |
| GET /users/:id | ✅ Chỉ :id = mình | ✅ Xem bất kỳ user |
| POST /users | ❌ 403 | ✅ Tạo user |
| PATCH /users/profile | ✅ Sửa mình | ✅ |
| PATCH /users/:id | ✅ Chỉ :id = mình | ✅ Sửa bất kỳ user |
| DELETE /users/:id | ❌ (chỉ admin, không xóa mình) | ✅ Xóa user khác (không xóa mình) |
| GET /users/stats/summary | ❌ 403 | ✅ Thống kê tổng quan |
| GET /users/stats/by-date | ❌ 403 | ✅ Thống kê theo ngày/tuần/tháng |

---

## 1. Lấy profile user hiện tại

**GET** `/users/profile`

Lấy thông tin user đang đăng nhập. Không cần truyền `id`.

### Response thành công (200)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Nguyễn Văn A",
  "email": "user@example.com",
  "avatar_url": "https://example.com/avatar.jpg",
  "language": "vi",
  "system_role_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

| Field | Mô tả |
|-------|--------|
| `id` | UUID user |
| `name` | Tên hiển thị |
| `email` | Email |
| `avatar_url` | URL avatar hoặc `null` |
| `language` | Mã ngôn ngữ (mặc định `vi`) |
| `system_role_id` | UUID vai trò hệ thống hoặc `null` |
| `created_at`, `updated_at` | ISO 8601 |

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập hoặc token hết hạn |
| **404** | User không tồn tại (hiếm) |

---

## 2. Lấy danh sách users (chỉ Admin)

**GET** `/users`

Phân trang, sắp xếp. **Chỉ admin** mới gọi được.

### Query params

| Param | Type | Mặc định | Mô tả |
|-------|------|----------|--------|
| `page` | number | 1 | Trang |
| `limit` | number | 10 | Số bản ghi mỗi trang |
| `sortBy` | string | (tùy backend) | Trường sắp xếp, ví dụ `created_at`, `name` |
| `sortOrder` | `'ASC'` \| `'DESC'` | (tùy backend) | Thứ tự |

**Ví dụ:** `GET /users?page=1&limit=20&sortBy=created_at&sortOrder=DESC`

### Response thành công (200)

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Nguyễn Văn A",
      "email": "user@example.com",
      "avatar_url": null,
      "language": "vi",
      "system_role_id": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập |
| **403** | Không phải admin |

---

## 3. Lấy chi tiết một user

**GET** `/users/:id`

- **User thường:** chỉ được gọi khi `:id` chính là `id` của mình (giống profile).
- **Admin:** được xem bất kỳ user nào.

### Response thành công (200)

Cùng cấu trúc object user như **GET /users/profile** (id, name, email, avatar_url, language, system_role_id, created_at, updated_at).

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập |
| **403** | User thường cố xem user khác |
| **404** | User không tồn tại |

---

## 4. Tạo user mới (chỉ Admin)

**POST** `/users`

**Chỉ admin** mới tạo được user.

### Request body (CreateUserDto)

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|--------|
| `name` | string | Có | Tên (tối đa 100 ký tự) |
| `email` | string | Có | Email (unique) |
| `password` | string | Tùy | Mật khẩu (tối thiểu 6 ký tự); bắt buộc nếu không có `google_id` |
| `google_id` | string | Tùy | Google ID nếu đăng nhập Google |
| `avatar_url` | string | Tùy | URL avatar |
| `language` | string | Tùy | Mặc định `vi` |
| `system_role_id` | string | Tùy | UUID vai trò hệ thống |

**Ví dụ:**

```json
{
  "name": "Nguyễn Văn B",
  "email": "user2@example.com",
  "password": "Password@123"
}
```

### Response thành công (201)

Trả về object user vừa tạo (cùng cấu trúc như GET /users/profile), **không** kèm password.

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **400** | Dữ liệu không hợp lệ (validation) |
| **401** | Chưa đăng nhập |
| **403** | Không phải admin |
| **409** | Email đã tồn tại |

---

## 5. Cập nhật profile (user hiện tại)

**PATCH** `/users/profile`

Cập nhật chính user đang đăng nhập. Không truyền `id` trong URL.

### Request body (UpdateUserDto)

Tất cả field đều **tùy chọn**; chỉ gửi field cần đổi.

| Field | Type | Mô tả |
|-------|------|--------|
| `name` | string | Tên (tối đa 100 ký tự) |
| `email` | string | Email (unique) |
| `password` | string | Mật khẩu mới (nên tối thiểu 6 ký tự) |
| `avatar_url` | string | URL avatar |
| `language` | string | Mã ngôn ngữ |
| `system_role_id` | string \| null | Vai trò (thường chỉ admin mới đổi) |

**Ví dụ:**

```json
{
  "name": "Tên mới",
  "language": "en"
}
```

### Response thành công (200)

Trả về object user sau khi cập nhật (cùng cấu trúc như GET /users/profile).

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **400** | Dữ liệu không hợp lệ |
| **401** | Chưa đăng nhập |
| **404** | User không tồn tại |
| **409** | Email đã được user khác dùng |

---

## 6. Cập nhật user theo id

**PATCH** `/users/:id`

- **User thường:** chỉ được sửa khi `:id` là chính mình (tương đương PATCH /users/profile).
- **Admin:** được sửa bất kỳ user nào (kể cả đổi `system_role_id`).

### Request body

Giống **PATCH /users/profile** (UpdateUserDto): name, email, password, avatar_url, language, system_role_id (tùy chọn).

### Response thành công (200)

Object user sau khi cập nhật.

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **400** | Dữ liệu không hợp lệ |
| **401** | Chưa đăng nhập |
| **403** | User thường cố sửa user khác |
| **404** | User không tồn tại |
| **409** | Email trùng với user khác |

---

## 7. Xóa user

**DELETE** `/users/:id`

- **Chỉ admin** mới xóa được user.
- **Không được xóa chính mình:** nếu `:id` = user đang đăng nhập → 403.

### Request

Không body. Chỉ cần header `Authorization: Bearer <accessToken>`.

### Response thành công (200)

Backend có thể trả về message hoặc object xác nhận (tùy implementation).

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập |
| **403** | Không phải admin, hoặc đang cố xóa chính mình |
| **404** | User không tồn tại |

---

## 8. Thống kê tổng quan user (chỉ Admin)

**GET** `/users/stats/summary`

Trả về tổng số user, số user theo vai trò (admin, user, no_role), và số user mới trong 7 ngày / 30 ngày qua. Dùng cho dashboard admin.

### Response thành công (200)

```json
{
  "total": 55,
  "by_role": {
    "admin": 2,
    "user": 50,
    "no_role": 3
  },
  "new_last_7_days": 5,
  "new_last_30_days": 12
}
```

| Field | Mô tả |
|-------|--------|
| `total` | Tổng số user |
| `by_role` | Số user theo vai trò: `admin`, `user`, `no_role` (chưa gán role) |
| `new_last_7_days` | Số user tạo trong 7 ngày qua |
| `new_last_30_days` | Số user tạo trong 30 ngày qua |

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập |
| **403** | Không phải admin |

---

## 9. Thống kê user theo thời gian (chỉ Admin)

**GET** `/users/stats/by-date`

Số user tạo mới theo từng **ngày**, **tuần** hoặc **tháng** trong khoảng `from`–`to`. Dùng để vẽ biểu đồ (chart).

### Query params

| Param | Type | Mặc định | Mô tả |
|-------|------|----------|--------|
| `from` | string (ISO date) | 30 ngày trước | Từ ngày (vd. `2024-01-01`) |
| `to` | string (ISO date) | Hôm nay | Đến ngày |
| `groupBy` | `day` \| `week` \| `month` | `day` | Nhóm theo ngày / tuần / tháng |

**Ví dụ:** `GET /users/stats/by-date?from=2024-01-01&to=2024-01-31&groupBy=day`

### Response thành công (200)

```json
[
  { "date": "2024-01-01", "count": 3 },
  { "date": "2024-01-02", "count": 1 },
  { "date": "2024-01-03", "count": 5 }
]
```

| Field | Mô tả |
|-------|--------|
| `date` | Ngày/ tuần/ tháng (YYYY-MM-DD) |
| `count` | Số user tạo trong kỳ đó |

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Chưa đăng nhập |
| **403** | Không phải admin |

---

## Tóm tắt lỗi thường gặp

| Status | Ý nghĩa chung |
|--------|----------------|
| **401** | Thiếu hoặc sai token, token hết hạn → FE nên redirect login / refresh token |
| **403** | Đủ quyền đăng nhập nhưng không đủ quyền thao tác (ví dụ user gọi GET /users, hoặc xóa chính mình) |
| **404** | User không tồn tại |
| **409** | Xung đột dữ liệu (thường là email đã tồn tại) |

---

## Gợi ý tích hợp FE

1. **Sau login/register** đã có `id`, `name`, `email`, `system_role` từ auth API; dùng ngay để hiển thị và phân quyền, không bắt buộc gọi GET /users/profile ngay.
2. **Trang “Profile của tôi”:** dùng **GET /users/profile** và **PATCH /users/profile**.
3. **Trang quản lý user (admin):** danh sách **GET /users** (page, limit), chi tiết **GET /users/:id**, sửa **PATCH /users/:id**, xóa **DELETE /users/:id**, tạo **POST /users**.
4. **Dashboard thống kê (admin):** **GET /users/stats/summary** cho tổng quan; **GET /users/stats/by-date?from=&to=&groupBy=day** cho biểu đồ user mới theo thời gian.
5. **Hiển thị tên vai trò:** response user có `system_role_id`; để hiển thị tên (vd. "Admin", "User") FE có thể:
   - Dùng luôn `system_role` từ login/register cho user hiện tại, hoặc
   - Gọi **GET /system-roles** (nếu có) rồi map `system_role_id` → tên.
