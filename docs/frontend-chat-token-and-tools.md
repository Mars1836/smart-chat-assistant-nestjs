# Hiển thị Token usage & Tools đã dùng trong Chat (cho Frontend)

Tài liệu mô tả cách hiển thị **lượng token** và **tools (công cụ) đã sử dụng** cho mỗi tin nhắn bot trong giao diện chat, kèm nút **Details** để xem chi tiết.

---

## 1. Nguồn dữ liệu

- **Ngay sau khi gửi tin (POST chat):** Response của **POST /workspaces/:workspaceId/chatbots/:chatbotId/chat** luôn có `token_usage` và `tools_used`. Khi không có dữ liệu thật, backend trả mặc định: `token_usage: { input_tokens: 0, output_tokens: 0 }`, `tools_used: []`. **FE không cần hiển thị thông báo "chưa có dữ liệu"** — chỉ cần hiển thị số (0 tokens, 0 tools) khi giá trị là 0.
- **Khi load lại hội thoại:** **GET /messages/conversations/:conversationId** — message bot có thể có `token_usage` / `tools_used` hoặc `null` (tin cũ). FE nên **chuẩn hóa**: nếu `token_usage == null` thì coi như `{ input_tokens: 0, output_tokens: 0 }`; nếu `tools_used == null` thì coi như `[]`. Luôn hiển thị dòng footer (0 tokens · 0 tools) thay vì thông báo "chưa có dữ liệu".

| Field | Type | Mô tả |
|-------|------|--------|
| `token_usage` | `{ input_tokens, output_tokens }` hoặc `null` (GET messages) | POST chat luôn trả object (mặc định 0, 0). GET messages có thể `null` với tin cũ → FE chuẩn hóa thành 0, 0. |
| `tools_used` | Mảng hoặc `null` (GET messages) | POST chat luôn trả array (mặc định []). GET messages có thể `null` → FE chuẩn hóa thành `[]`. |

**Ví dụ message bot trong response:**

```json
{
  "id": "msg-uuid",
  "conversation_id": "conv-uuid",
  "sender_type": "bot",
  "sender_id": null,
  "content": "Theo chính sách đổi trả, bạn có 30 ngày...",
  "intent_id": null,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "token_usage": {
    "input_tokens": 120,
    "output_tokens": 45
  },
  "tools_used": [
    {
      "tool_name": "knowledge_search",
      "args": { "query": "chính sách đổi trả" },
      "result": { "answer": "...", "sources": [] }
    }
  ]
}
```

---

## 2. Gợi ý UI trong ô tin nhắn bot

### 2.1. Vị trí

- Đặt **dưới nội dung text** của tin nhắn bot (content), có thể là một dòng nhỏ (footer) trong bubble bot.
- Hiển thị cho **mọi tin nhắn bot** (`sender_type === 'bot'`). Khi không có dữ liệu, hiển thị **0 tokens · 0 tools** (không hiển thị thông báo "chưa có dữ liệu").

### 2.2. Dòng tóm tắt (summary)

- **Token:** Luôn hiển thị số token: `(token_usage?.input_tokens ?? 0) + (token_usage?.output_tokens ?? 0)`. Ví dụ: `"165 tokens"` hoặc `"In: 120 · Out: 45"`. Khi không có dữ liệu → hiển thị **0 tokens**.
- **Tools:** Luôn hiển thị số tools: `(tools_used?.length ?? 0)`. Ví dụ: `"2 tools"`. Khi không có → hiển thị **0 tools**.
- Mỗi phần có thể có nút **"Details"** để xem chi tiết. **Không hiển thị** thông báo kiểu "Chưa có dữ liệu token hoặc tools" — mặc định dùng 0 và [].

### 2.3. Khi bấm "Details" – Token

- **Nội dung chi tiết:**
  - **Input tokens:** `token_usage.input_tokens`
  - **Output tokens:** `token_usage.output_tokens`
  - **Tổng:** `input_tokens + output_tokens`
- Có thể hiển thị trong:
  - **Tooltip** khi hover vào "Details" (token), hoặc
  - **Drawer / Modal / Expand** dưới tin nhắn khi click "Details" (token).

**Ví dụ nội dung Details (Token):**

```
Token usage (lượt chat này)
────────────────────────────
Input:  120
Output:  45
─────────
Total:  165
```

### 2.4. Khi bấm "Details" – Tools

- **Nội dung chi tiết:** Liệt kê từng phần tử trong `tools_used`:
  - **Tool name:** `tool_name` (vd: `knowledge_search`, `shop__get_products`)
  - **Tham số (args):** hiển thị dạng đọc được (JSON format hoặc key-value).
  - **Kết quả (result):** có thể thu gọn (vd: chỉ hiện vài dòng hoặc nút "Expand" xem full JSON) vì `result` đôi khi dài.

**Ví dụ nội dung Details (Tools):**

```
Tools used (1)
────────────────────────────
1. knowledge_search
   Args:  { "query": "chính sách đổi trả" }
   Result: { "answer": "...", "sources": [...] }
   [Expand full result]
```

- Nếu có nhiều tools: hiển thị danh sách 1, 2, 3... mỗi cái có args + result (có thể accordion/collapse từng tool).

### 2.5. Gộp Token + Tools trong một "Details"

- Có thể dùng **một nút "Details"** cho cả tin nhắn bot:
  - Khi mở: tab hoặc section **Token** + section **Tools**.
  - Token: bảng hoặc dòng Input / Output / Total.
  - Tools: danh sách từng tool với tool_name, args, result (có thể copy JSON cho debug).

---

## 3. Cấu trúc dữ liệu chi tiết

### 3.1. `token_usage` (object hoặc null)

| Key | Type | Mô tả |
|-----|------|--------|
| `input_tokens` | number | Token đầu vào (prompt + context). |
| `output_tokens` | number | Token đầu ra (reply của bot). |

### 3.2. `tools_used` (array hoặc null)

Mỗi phần tử:

| Key | Type | Mô tả |
|-----|------|--------|
| `tool_name` | string | Tên tool (vd: `knowledge_search`, `shop__get_products`). |
| `args` | object | Tham số đã gửi cho tool (có thể có bất kỳ key nào). |
| `result` | any | Kết quả trả về (object, array, string, …). Có thể lớn; FE nên truncate hoặc expand on demand. |

- Nếu tool lỗi, `result` có thể là `{ error: "..." }`.
- FE có thể format `args` và `result` bằng `JSON.stringify(..., null, 2)` trong panel Details.

---

## 4. Chuẩn hóa dữ liệu (FE)

- **Token:** `const input = message.token_usage?.input_tokens ?? 0; const output = message.token_usage?.output_tokens ?? 0;` → luôn hiển thị "X tokens" (X = input + output). Không cần kiểm tra null để ẩn.
- **Tools:** `const count = message.tools_used?.length ?? 0;` → luôn hiển thị "Y tools". Không hiển thị thông báo "chưa có dữ liệu" — khi 0 thì hiển thị "0 tokens · 0 tools".

---

## 5. Tóm tắt

| Thành phần | Hiển thị | Mặc định khi không có |
|------------|----------|------------------------|
| Token | Luôn hiển thị cho tin bot | 0 tokens (`input_tokens: 0`, `output_tokens: 0`) |
| Tools | Luôn hiển thị cho tin bot | 0 tools (`[]`) |

- **POST chat:** backend luôn trả `token_usage` (object) và `tools_used` (array); khi không có thì trả `{ input_tokens: 0, output_tokens: 0 }` và `[]`.
- **GET messages:** tin cũ có thể `null` → FE chuẩn hóa thành 0 và [].
- **Không hiển thị** thông báo "Chưa có dữ liệu token hoặc tools". Chỉ hiển thị số (0 tokens · 0 tools) khi không có dữ liệu.
