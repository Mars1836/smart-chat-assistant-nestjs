# Chatbots Module

Module quản lý chatbot cho mỗi workspace, tích hợp với **Google AI Studio (Gemini API)**.

## Features

- ✅ Tạo/Cập nhật/Xóa chatbot cho workspace
- ✅ Cấu hình tính cách chatbot (personality)
- ✅ Tùy chỉnh LLM model (Gemini 1.5 Flash, Pro, etc.)
- ✅ Điều chỉnh temperature, max tokens
- ✅ Chat với chatbot qua API
- ✅ Test kết nối AI Studio
- ✅ List available models

## Setup

### 1. Get Google AI Studio API Key

1. Visit: https://aistudio.google.com/app/apikey
2. Login with Google account
3. Create new API key
4. Copy API key

### 2. Configure Environment

Add to `.env`:

```env
GOOGLE_AI_STUDIO_API_KEY=your_api_key_here
```

### 3. Test Connection

```bash
curl -X GET http://localhost:3000/workspaces/{workspaceId}/chatbot/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workspaces/:id/chatbot` | Create chatbot |
| GET | `/workspaces/:id/chatbot` | Get chatbot info |
| PATCH | `/workspaces/:id/chatbot` | Update chatbot |
| DELETE | `/workspaces/:id/chatbot` | Delete chatbot |
| POST | `/workspaces/:id/chatbot/chat` | Chat with chatbot |
| GET | `/workspaces/:id/chatbot/models` | List models |
| GET | `/workspaces/:id/chatbot/test` | Test connection |

See: [CHATBOT_API_EXAMPLES.md](../../../CHATBOT_API_EXAMPLES.md)

## Configuration

### LLM Models

- `gemini-1.5-flash` (recommended) - Fast, cost-effective
- `gemini-1.5-pro` - Higher quality
- `gemini-1.0-pro` - Older model

### Temperature (0-1)

- `0.0-0.3`: Deterministic, consistent
- `0.4-0.7`: Balanced (default: 0.7)
- `0.8-1.0`: Creative, diverse

### Max Tokens

- `500-1000`: Short (default: 1000)
- `1000-2000`: Detailed
- `2000+`: Long

## Architecture

```
ChatbotsModule
├── chatbots.controller.ts    # API endpoints
├── chatbots.service.ts        # Business logic
├── entities/
│   └── chatbot.entity.ts      # Database entity
└── dto/
    ├── create-chatbot.dto.ts
    ├── update-chatbot.dto.ts
    └── chat.dto.ts

Common/Providers
└── aistudio.ts                # Google AI Studio integration
```

## Security

- ✅ Only workspace owner can create/update/delete chatbot
- ✅ API key never exposed to client
- ✅ JWT auth required for all endpoints
- ✅ Workspace members can chat (TODO: check membership)

## Pricing

Google AI Studio (Gemini API):

- **Free tier**: 15 requests/minute, 1500 requests/day
- **Gemini 1.5 Flash**: Free for low usage
- **Gemini 1.5 Pro**: Paid after quota

Check: https://ai.google.dev/pricing

