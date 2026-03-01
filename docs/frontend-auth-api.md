# API Đăng nhập & Xác thực (cho Frontend)

Tài liệu mô tả API auth và **phân quyền theo vai trò (user / admin)** để FE hiển thị đúng menu và chức năng.

**Base URL:** `{API_BASE}/auth`  
(Ví dụ: `http://localhost:4000/auth`)

---

## Phân quyền: User và Admin

Hệ thống có **2 vai trò cấp hệ thống** (`system_roles`):

| Vai trò | Giá trị `system_role` | Mô tả |
|---------|------------------------|--------|
| **Admin** | `"admin"` | Quản trị viên hệ thống – quản lý server, users, cấu hình toàn cục. FE nên hiển thị menu/quản lý admin, quản lý user, v.v. |
| **User**  | `"user"`  | Người dùng thường – tạo workspace, dùng chatbot, quản lý nội dung trong workspace của mình. |

- Sau khi **đăng nhập** hoặc **đăng ký**, response đã có sẵn **`id`**, **`name`**, **`email`**, **`system_role`** (cùng với `accessToken`, `refreshToken`). FE có thể **chuyển trang ngay** theo `system_role` mà không cần gọi thêm GET /auth/profile.
- **Luồng FE gợi ý:**
  1. User đăng nhập (hoặc đăng ký) → nhận `accessToken`, `refreshToken`, `id`, `name`, `email`, **`system_role`**.
  2. Lưu token và thông tin user (kể cả `system_role`) vào state/context.
  3. Dựa vào `system_role` chuyển trang ngay:
     - `system_role === 'admin'` → chuyển đến trang admin / hiển thị menu quản trị.
     - `system_role === 'user'` hoặc `null` → chuyển đến trang user (workspace, chatbot, v.v.).
  4. (Tùy chọn) Khi cần làm mới thông tin user, gọi **GET /auth/profile**.

---

## 1. Đăng nhập (Login)

**POST** `/auth/login`

Xác thực bằng email và mật khẩu. Response trả về token **và** thông tin user (id, name, email, **system_role**) để FE chuyển trang ngay theo role.

### Request body

| Field      | Type   | Bắt buộc | Mô tả                          |
|------------|--------|----------|---------------------------------|
| `email`    | string | Có       | Email đăng nhập                 |
| `password` | string | Có       | Mật khẩu (tối thiểu 6 ký tự)    |

**Ví dụ:**

```json
{
  "email": "admin@example.com",
  "password": "Admin@123"
}
```

### Response thành công (200)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "System Admin",
  "email": "admin@example.com",
  "system_role": "admin"
}
```

| Field          | Mô tả |
|----------------|--------|
| `accessToken`  | JWT dùng cho mọi request cần đăng nhập. Header: `Authorization: Bearer <accessToken>`. |
| `refreshToken` | JWT dùng để đổi access token khi hết hạn. |
| `id`           | UUID user. |
| `name`         | Tên hiển thị. |
| `email`        | Email đăng nhập. |
| `system_role`  | `"admin"` \| `"user"` \| `null`. Dùng để chuyển trang ngay sau login (admin vs user). |

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **400** | Dữ liệu không hợp lệ (email/password format). |
| **401** | Email hoặc mật khẩu sai (`Invalid credentials`). |

---

## 2. Lấy thông tin user và vai trò (Profile)

**GET** `/auth/profile`

Lấy thông tin user đang đăng nhập **và vai trò hệ thống (user / admin)**. FE **nên gọi sau login** để lưu `system_role` và điều khiển hiển thị menu/quyền.

### Headers

```
Authorization: Bearer <accessToken>
```

### Response thành công (200)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com",
  "name": "System Admin",
  "system_role": "admin"
}
```

| Field         | Type   | Mô tả |
|---------------|--------|--------|
| `id`          | string | UUID user. |
| `email`       | string | Email. |
| `name`        | string | Tên hiển thị. |
| `system_role` | string \| null | Vai trò hệ thống: **`"admin"`** (quản trị viên) hoặc **`"user"`** (người dùng thường). `null` nếu chưa gán role. |

**FE dùng `system_role`:**
- `system_role === 'admin'` → hiển thị menu/quản lý admin, quản lý user, v.v.
- `system_role === 'user'` hoặc `null` → chỉ hiển thị chức năng user.

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **401** | Thiếu token hoặc token không hợp lệ / hết hạn. |

---

## 3. Đăng ký (Register)

**POST** `/auth/register`

Tạo tài khoản mới. Response cùng format với login: token + **id, name, email, system_role** (user mới thường `system_role = null`). FE có thể chuyển trang ngay theo `system_role`.

### Request body

| Field        | Type   | Bắt buộc | Mô tả |
|-------------|--------|----------|--------|
| `name`      | string | Có       | Họ tên (2–100 ký tự) |
| `email`     | string | Có       | Email hợp lệ |
| `password`  | string | Có       | Mật khẩu: tối thiểu 6 ký tự, có ít nhất 1 chữ và 1 số |
| `language`  | string | Không   | `"vi"` \| `"en"`, mặc định `"vi"` |
| `avatar_url`| string | Không   | URL ảnh đại diện |

### Response thành công (201)

Cùng format với login: `{ "accessToken", "refreshToken", "id", "name", "email", "system_role" }`.

### Lỗi

| Status | Ý nghĩa |
|--------|---------|
| **400** | Validation. |
| **409** | Email đã tồn tại (`Email already exists`). |

---

## 4. Refresh token

**POST** `/auth/refresh`

Đổi refresh token lấy access token mới.

### Request body

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

### Response thành công (200)

```json
{ "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

---

## 5. Đổi mật khẩu

**POST** `/auth/change-password`

Đổi mật khẩu theo email (không bắt buộc đăng nhập).

### Request body

| Field         | Type   | Bắt buộc | Mô tả |
|--------------|--------|----------|--------|
| `email`      | string | Có       | Email tài khoản |
| `newPassword`| string | Có       | Mật khẩu mới: tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số |

---

## 6. Luồng FE: Login và chuyển trang theo User / Admin

1. User gửi **POST /auth/login** với `email`, `password`.
2. Nếu thành công → response có `accessToken`, `refreshToken`, **`id`**, **`name`**, **`email`**, **`system_role`**.
3. Lưu token và thông tin user (kể cả `system_role`) vào state/context.
4. **Chuyển trang ngay** theo `system_role`:
   - **`system_role === 'admin'`** → chuyển đến trang admin (menu quản trị, quản lý user, v.v.).
   - **`system_role === 'user'` hoặc `null`** → chuyển đến trang user (workspace, chatbot).
5. Mọi request API cần đăng nhập: gửi header `Authorization: Bearer <accessToken>`.
6. Khi API trả 401 (token hết hạn): gọi **POST /auth/refresh** với `refreshToken` → lưu `accessToken` mới và retry; nếu refresh lỗi → đăng xuất, chuyển về màn login.

---

## 7. Tóm tắt endpoint

| Method | Path                  | Mô tả                    | Cần token? |
|--------|------------------------|---------------------------|------------|
| POST   | `/auth/login`          | Đăng nhập                 | Không      |
| POST   | `/auth/register`       | Đăng ký                   | Không      |
| GET    | `/auth/profile`        | Thông tin user + **role** | Có (Bearer) |
| POST   | `/auth/refresh`       | Đổi access token          | Không (body: refreshToken) |
| POST   | `/auth/change-password`| Đổi mật khẩu              | Không      |
