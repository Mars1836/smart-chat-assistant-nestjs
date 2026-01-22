### Plugin (Tools) Backend Flow

Tài liệu này mô tả chi tiết kiến trúc và luồng chạy của **plugin / tools** trong backend NestJS.

---

### 1. Khái niệm & mục tiêu

- **Tool**: một khả năng mở rộng (plugin) mà chatbot có thể gọi trong lúc trả lời (giống Coze tools).
- **Action**: mỗi tool có thể có nhiều hành động (vd: `search`, `get_current_time`).
- **Executor**: lớp backend thực thi tool (gọi RAG, function nội bộ, HTTP API, v.v.).
- **Tool Registry**: cung cấp danh sách tools + schema parameters cho LLM.
- **Tool Executor Service**: nhận yêu cầu gọi tool, chạy executor tương ứng và log kết quả.

Hiện tại đã có 2 builtin tools seed sẵn:

- `rag_documents.search`: tìm context trong tài liệu bằng RAG.
- `datetime.get_current_time`: trả về thời gian hiện tại.

---

### 2. Data model

#### 2.1. `Tool` (`src/modules/tools/entities/tool.entity.ts`)

- Lưu metadata cho từng tool.
- Các trường chính:
  - `name`: unique, dùng để build function name gửi cho LLM (vd: `rag_documents`).
  - `display_name`, `description`, `category`, `is_enabled`.
  - `actions: ToolAction[]`: danh sách action của tool.
    - `ToolAction = { name, description, parameters }`.
    - `parameters` là JSON Schema dạng:
      - `{ type: 'OBJECT', properties: {...}, required: [...] }`.
  - `executor_type`: `'rag' | 'function' | 'http_api' | 'oauth_api' | 'database'`.
  - `executor_config`: config riêng cho từng executor (vd: `{ function: 'getCurrentTime' }`).
  - `auth_config`: cấu hình auth (oauth2, api_key, basic, none, ...).

Builtin tools được seed trong `src/database/seeds/tools.seed.ts`.

#### 2.2. `ChatbotTool` (`src/modules/tools/entities/chatbot-tool.entity.ts`)

Quan hệ many-to-many giữa `Chatbot` và `Tool` được tách thành entity riêng:

- Bảng: `chatbot_tools`.
- Các trường:
  - `chatbot_id`, `tool_id`.
  - `is_enabled`: tool này có được bật cho chatbot đó hay không.
  - `config_override`: override config per chatbot (JSONB).
  - `user_auth_tokens`: lưu token OAuth/API key per user nếu cần.

#### 2.3. `ToolExecutionLog` (`src/modules/tools/entities/tool-execution-log.entity.ts`)

- Bảng: `tool_execution_logs`.
- Lưu lịch sử chạy tool:
  - `chat_session_id` (conversation/session hiện tại).
  - `tool_id`.
  - `action_name` (vd: `search`, `get_current_time`). Có default `'default'`.
  - `input_params`, `output_result` (JSONB).
  - `status`: `'success' | 'error'`.
  - `error_message`, `execution_time_ms`.
  - `executed_at` (timestamp).

---

### 3. Services & Module

#### 3.1. `ToolsModule` (`src/modules/tools/tools.module.ts`)

- Imports:
  - `TypeOrmModule.forFeature([Tool, ChatbotTool, ToolExecutionLog])`.
  - `RagModule` (để dùng `RagService` cho RAG tools).
- Providers / Exports:
  - `ToolRegistryService`.
  - `ToolExecutorService`.

#### 3.2. `ToolRegistryService` (`src/modules/tools/tool-registry.service.ts`)

- **getToolsForChatbot(chatbotId)**
  - Query `chatbot_tools` với `is_enabled = true`.
  - Join sang `Tool` và filter các tool `is_enabled = true`.
  - Trả về list `Tool` mà chatbot được phép dùng.

- **formatForLLM(tools: Tool[])**
  - Mục tiêu: convert `Tool` + `actions` thành danh sách function cho LLM (Google AI Studio Function Calling).
  - Logic:
    - Với mỗi `tool` và mỗi `action` trong `tool.actions`:
      - Tạo 1 function:
        - `name`: `${tool.name}__${action.name}`  
          - Ví dụ:
            - `rag_documents__search`
            - `datetime__get_current_time`
        - `description`: `${tool.display_name}: ${action.description}`.
        - `parameters`: JSON schema đã normalize:
          - Nếu `action.parameters` đã có dạng `{ type, properties, required }` → giữ nguyên.
          - Nếu dạng cũ `{ field: { type, description } }` → wrap lại thành `{ type: 'OBJECT', properties: {...}, required: [] }`.
    - Kết quả: array functions gửi cho LLM.

- **getToolByName(name)**, **getBuiltInTools()** dùng cho quản trị / debug.

#### 3.3. `ToolExecutorService` (`src/modules/tools/tool-executor.service.ts`)

- Nhận trách nhiệm **thực thi tool** và log.

- **execute(toolName: string, params: any, context: ExecutionContext)**
  - `toolName` có thể là:
    - `"rag_documents"` → dùng action đầu tiên của tool.
    - `"rag_documents__search"` → chỉ rõ action.
  - Bước xử lý:
    1. Parse `toolName`:
       - Nếu có `'__'` → tách `[baseToolName, actionNameFromCall]`.
       - Nếu không → `baseToolName = toolName`, `actionNameFromCall = undefined`.
    2. Tìm `Tool` theo `baseToolName`:
       - Nếu không có → throw `NotFoundException`.
       - Nếu `!tool.is_enabled` → throw error.
    3. Xác định `resolvedActionName`:
       - `actionNameFromCall ?? tool.actions?.[0]?.name ?? 'default'`.
    4. Lấy executor tương ứng qua `getExecutor(tool)`:
       - Cache key: `${tool.executor_type}:${tool.id}`.
       - `executor_type === 'rag'` → `new RagExecutor(tool.executor_config, ragService)`.
       - `executor_type === 'function'` → `new FunctionExecutor(tool.executor_config)`.
       - Các loại khác hiện chưa support → throw error.
    5. Gọi `executor.execute(params, context)`.
    6. Ghi log qua `logExecution(...)` với:
       - `tool_id`, `action_name`, `chat_session_id`, `input_params`, `output_result`, `status`, `execution_time_ms`.

- **ExecutionContext** (`src/modules/tools/executors/base-executor.ts`):
  - `{ userId, workspaceId, chatbotId, sessionId? }`.

#### 3.4. Executors

- **BaseToolExecutor** (`base-executor.ts`):
  - Abstract class: `execute(params, context) → Promise<any>`.
  - Có `config` chung cho executor (vd: function name, API base URL, v.v.).

- **RagExecutor** (`rag-executor.ts`):
  - Nhận `config` + `RagService`.
  - `execute({ query, limit }, context)`:
    - Gọi `ragService.search(query, context.workspaceId, limit ?? 5)`.
    - Trả về `{ query, results, count }`.

- **FunctionExecutor** (`function-executor.ts`):
  - Map tên function → implementation nội bộ.
  - Hiện tại có:
    - `getCurrentTime(params, context)`:
      - Trả về `{ timestamp, timezone, formatted }`.
  - `config.function` trong `Tool.executor_config` quyết định function nào được gọi.

---

### 4. Luồng runtime (backend)

1. **Seed builtin tools** (`tools.seed.ts` chạy trong `src/database/seeds/seed.ts`):
   - Tạo/Update `Tool` records cho:
     - `rag_documents` (executor_type = `rag`, action `search`).
     - `datetime` (executor_type = `function`, action `get_current_time`). 

2. **Gán tools cho chatbot** (tương lai / TODO API):
   - Backend dùng entity `ChatbotTool` để:
     - Bật/tắt từng tool cho từng chatbot (`is_enabled`).
     - Lưu `config_override` nếu chatbot muốn override config mặc định của tool.
     - Lưu `user_auth_tokens` theo user nếu tool cần OAuth/API key.

3. **Khi FE khởi tạo một session chat với chatbot**:
   - Backend (chat service) có thể:
     - Dùng `ToolRegistryService.getToolsForChatbot(chatbotId)` để lấy tools.
     - Dùng `ToolRegistryService.formatForLLM(tools)` để build danh sách function gửi cho Gemini (khi implement function calling).

4. **Khi LLM yêu cầu gọi tool (function calling)** (thiết kế):
   - LLM trả về:
     - Tên function: ví dụ `"rag_documents__search"`.
     - Arguments (JSON) phù hợp với JSON Schema đã gửi.
   - Chat service sẽ gọi:
     - `toolExecutorService.execute(functionName, args, { userId, workspaceId, chatbotId, sessionId })`.
   - Nhận lại `result` từ executor (vd: context từ RAG).
   - Đưa kết quả này vào prompt tiếp theo để LLM trả lời cuối cùng cho user.

---

### 5. Điểm mở rộng trong tương lai

- Thêm executor mới:
  - `HttpApiExecutor` cho REST APIs.
  - `OAuthApiExecutor` cho các API cần OAuth2 (Google Calendar, Gmail, v.v.).
- Thêm controller/API cho:
  - Quản lý `Tool` (CRUD cho custom/community tools).
  - Quản lý `ChatbotTool` (bật/tắt tool cho từng chatbot, cấu hình auth).
- Tích hợp function calling thực tế với Gemini trong `AIStudioService` và `ChatbotsService.chat`.

