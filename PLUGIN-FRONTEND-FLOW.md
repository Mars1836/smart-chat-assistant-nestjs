### Plugin (Tools) Frontend Flow & APIs

Tài liệu này mô tả **luồng phía FE** và các API backend liên quan đến plugin/tools (Coze-like).

> Lưu ý: Một số API chưa được implement controller đầy đủ, nhưng được design ở đây để FE và BE có cùng contract.

---

### 0. Base URL & Auth header (FE cần biết)

- **Base API URL (dev mặc định)**: `http://localhost:4000`
  - Port lấy từ `smart-chat-assistant-nestjs/src/main.ts` (`process.env.PORT ?? 4000`).
- **Swagger**: `http://localhost:4000/api`
- **Auth header (Bearer JWT)**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`

---

### 1. Tổng quan luồng FE

Luồng chính gồm 3 phần:

1. **Cấu hình chatbot & tools** (trong dashboard):
   - Tạo / sửa chatbot.
   - Bật/tắt tools cho từng chatbot.
2. **Bắt đầu phiên chat**:
   - FE gọi API chat như hiện tại.
   - (Tương lai) FE có thể hiển thị danh sách tools mà chatbot được phép dùng.
3. **Runtime function calling**:
   - LLM (Gemini) được cấu hình với danh sách functions (tools).
   - Khi LLM yêu cầu gọi tool, backend thực thi tool và FE chỉ cần hiển thị kết quả cuối cùng.

FE **không cần tự gọi tool** trực tiếp, mà chỉ gọi **API chat**, backend lo phần function calling + tool execution.

---

### 2. Các thực thể liên quan

- `Chatbot` (config LLM, personality, language...).
- `Tool` (plugin định nghĩa khả năng).
- `ChatbotTool` (bật/tắt tool cho chatbot, config override, auth tokens).
- `ToolExecutionLog` (FE có thể hiển thị lịch sử chạy tool nếu cần, tương lai).

---

### 3. API hiện có (đã implement)

#### 3.1. Chatbot CRUD & Chat

Base URL: `http://localhost:4000`

- **Tạo chatbot**
  - `POST http://localhost:4000/workspaces/:workspaceId/chatbots`
  - Body: `CreateChatbotDto`
  - Auth: Bearer JWT + `WORKSPACE_PERMISSIONS.CHATBOT_CREATE`.

- **Danh sách chatbots (phân trang)**
  - `GET http://localhost:4000/workspaces/:workspaceId/chatbots?page=&limit=&sortBy=&sortOrder=`
  - Auth: `CHATBOT_VIEW`.

- **Chi tiết 1 chatbot**
  - `GET http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId`
  - Auth: `CHATBOT_VIEW`.

- **Cập nhật chatbot**
  - `PATCH http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId`
  - Body: `UpdateChatbotDto`
  - Auth: `CHATBOT_UPDATE`.

- **Xóa chatbot**
  - `DELETE http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId`
  - Auth: `CHATBOT_DELETE`.

- **Chat với chatbot (API chính FE dùng)**
  - `POST http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId/chat`
  - Body: `ChatDto`:
    - `conversation_id`: id conversation hiện tại.
    - `message`: tin nhắn user.
  - Response: `{ conversation_id, response, model, processingTime }`.
  - Auth: `CHATBOT_CHAT`.

Hiện tại API chat **chưa bật function calling**, nhưng đây sẽ là nơi tích hợp plugin.

---

### 4. API đề xuất cho Tools (thiết kế cho FE)

> Các API dưới đây **chưa có controller**, nhưng backend đã có entity + service (`Tool`, `ChatbotTool`, `ToolRegistryService`, `ToolExecutorService`). BE có thể implement theo spec này, FE có thể chuẩn bị code.

#### 4.1. Danh sách tất cả tools (dùng cho màn quản trị/global)

- **GET `http://localhost:4000/tools`**
  - Mô tả: Lấy danh sách tất cả tools (builtin + custom) - dùng cho màn quản trị global.
  - Query params (optional):
    - `category`: `'builtin' | 'custom' | 'community'`.
    - `enabled`: `true/false`.
  - Auth: Bearer JWT (không cần workspace permission).
  - Response (mẫu):
    ```json
    [
      {
        "id": "uuid",
        "name": "rag_documents",
        "display_name": "Search Documents",
        "description": "...",
        "category": "builtin",
        "is_enabled": true,
        "actions": [
          {
            "name": "search",
            "description": "Search for relevant information in documents",
            "parameters": {
              "type": "OBJECT",
              "properties": {
                "query": { "type": "string", "description": "The search query" },
                "limit": { "type": "number", "description": "Maximum number of results" }
              },
              "required": ["query"]
            }
          }
        ],
        "executor_type": "rag"
      }
    ]
    ```

#### 4.2. Danh sách tools có sẵn cho workspace (builtin + custom)

- **GET `http://localhost:4000/workspaces/:workspaceId/tools`**
  - Mô tả: Lấy danh sách tất cả tools có sẵn cho workspace (bao gồm plugin tự tạo + plugin có sẵn của hệ thống).
  - Backend logic:
    - Trả về tất cả `builtin` tools (hệ thống) + tất cả `custom` tools (plugin tự tạo).
    - Custom tools được chia sẻ cho tất cả workspace.
  - Auth: Bearer JWT + `WORKSPACE_PERMISSIONS.CHATBOT_VIEW`.
  - Response: Array of `Tool` (tương tự `/tools`).
  - Ví dụ FE gọi:
    ```javascript
    const response = await fetch(
      `http://localhost:4000/workspaces/${workspaceId}/tools`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const tools = await response.json();
    ```

#### 4.3. Danh sách tools được bật cho 1 chatbot

- **GET `http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId/tools`**
  - Mô tả: Lấy danh sách tools mà chatbot này đã được bật, kèm metadata (is_enabled, config_override).
  - Backend logic:
    - JOIN `ChatbotTool` với `Tool` để lấy thông tin tool + cấu hình chatbot-specific.
  - Auth: Bearer JWT + `WORKSPACE_PERMISSIONS.CHATBOT_VIEW`.
  - Response:
    ```json
    [
      {
        "tool": {
          "id": "uuid",
          "name": "rag_documents",
          "display_name": "Search Documents",
          "description": "...",
          "category": "builtin",
          "is_enabled": true,
          "actions": [...],
          "executor_type": "rag"
        },
        "chatbot_tool": {
          "id": "uuid",
          "is_enabled": true,
          "config_override": null
        }
      }
    ]
    ```
  - Ví dụ FE gọi:
    ```javascript
    const response = await fetch(
      `http://localhost:4000/workspaces/${workspaceId}/chatbots/${chatbotId}/tools`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const chatbotTools = await response.json();
    ```

#### 4.4. Bật/tắt tool cho chatbot

- **PUT `http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId/tools/:toolId`**
  - Mô tả: Bật/tắt 1 tool cho 1 chatbot + override config nếu cần.
  - Body:
    ```json
    {
      "is_enabled": true,
      "config_override": {
        "max_results": 10
      }
    }
    ```
  - Backend logic:
    - Upsert record `ChatbotTool`:
      - Set `is_enabled`, `config_override`.

- **DELETE `http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId/tools/:toolId`**
  - Mô tả: Tắt tool cho chatbot (có thể set `is_enabled = false` hoặc xóa record).

#### 4.5. Lấy danh sách functions cho LLM (debug/dev)

- **GET `http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId/tools/_/llm-schema`**
  - Mô tả: Trả về danh sách functions ở dạng đã format cho Gemini.
  - Backend logic:
    - `const tools = await toolRegistry.getToolsForChatbot(chatbotId);`
    - `const functions = toolRegistry.formatForLLM(tools);`
    - Trả về `functions`:
      ```json
      [
        {
          "name": "rag_documents__search",
          "description": "Search Documents: Search for relevant information in documents",
          "parameters": {
            "type": "OBJECT",
            "properties": {
              "query": { "type": "string", "description": "The search query" },
              "limit": { "type": "number", "description": "Maximum number of results" }
            },
            "required": ["query"]
          }
        },
        {
          "name": "datetime__get_current_time",
          "description": "Date & Time: Get the current date and time",
          "parameters": {
            "type": "OBJECT",
            "properties": {},
            "required": []
          }
        }
      ]
      ```

#### 4.5. (Tuỳ chọn) Gọi tool trực tiếp từ FE

Trong thiết kế chuẩn, **LLM là bên quyết định khi nào gọi tool**, backend là bên thực thi. Tuy nhiên, nếu bạn muốn FE có nút “chạy tool” riêng, có thể thêm API:

- **POST `http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId/tools/execute`**
  - Body:
    ```json
    {
      "tool_call": "rag_documents__search",
      "params": {
        "query": "luật nghỉ phép",
        "limit": 3
      },
      "session_id": "conversation-uuid"
    }
    ```
  - Backend logic:
    - Dùng `ToolExecutorService.execute(tool_call, params, { userId, workspaceId, chatbotId, sessionId })`.
    - Trả về `result` (vd: danh sách context).

---

### 5. Luồng FE chi tiết (từ UX đến API)

#### 5.1. Màn quản lý chatbot

**Use cases:** tạo/sửa chatbot, cấu hình LLM, bật/tắt plugin.

1. FE gọi `GET /workspaces/:workspaceId/chatbots` để list.
  2. FE gọi `GET http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId` khi mở chi tiết.
  3. Tab "Plugins / Tools":
    - FE gọi `GET http://localhost:4000/workspaces/:workspaceId/tools` để lấy danh sách tools có sẵn cho workspace (builtin + custom) - hiển thị checkboxes.
    - FE gọi `GET http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId/tools` để đánh dấu tool nào đang bật cho chatbot này (dựa vào `chatbot_tool.is_enabled`).
4. Khi user tick/bỏ tick một tool:
   - Gửi `PUT http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId/tools/:toolId` với `{ is_enabled, config_override }`.
5. Khi lưu cấu hình chatbot:
   - Gửi `PATCH http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId` cho các field của chatbot (không đụng tools).

#### 5.2. Màn chat

1. FE đảm bảo đã có:
   - `workspaceId`, `chatbotId`, `conversation_id`.
2. User gửi message mới:
   - FE gọi `POST http://localhost:4000/workspaces/:workspaceId/chatbots/:chatbotId/chat` với `{ conversation_id, message }`.
3. Backend trong tương lai sẽ:
   - Lấy tools đã bật: `getToolsForChatbot(chatbotId)`.
   - Gửi danh sách function (từ `formatForLLM`) cho Gemini qua `AIStudioService` (khi implement function calling).
   - Loop:
     1. Nhận response từ Gemini:
        - Nếu chỉ là text → trả luôn cho FE.
        - Nếu có function_call:
          - Gọi `ToolExecutorService.execute(functionName, args, context)`.
          - Đưa kết quả vào prompt tiếp theo.
     2. Kết thúc khi Gemini trả final answer.
4. FE chỉ việc hiển thị `response` cuối cùng và optional: hiển thị thêm “tool traces” nếu backend gửi kèm.

---

### 6. Gợi ý implement tiếp theo trên BE để hoàn thiện plugin

- Thêm `ToolsController` với các endpoint đã liệt kê ở mục 4.
- Bổ sung function calling vào `AIStudioService` (gửi `tools` vào request body của Gemini).
- Sửa `ChatbotsService.chat` để sử dụng tools:
  - Load tools qua `ToolRegistryService`.
  - Xử lý vòng lặp `model → tool → model`.
- Thêm API trả về lịch sử chạy tools (`tool_execution_logs`) nếu FE muốn hiển thị trong UI debug.

