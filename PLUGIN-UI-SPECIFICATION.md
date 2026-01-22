# Plugin UI Specification

## Overview

Hệ thống plugin có 3 cấp độ:
1. **Global Plugins**: Tất cả tools có sẵn trong hệ thống
2. **Workspace Plugins**: Tools đã được add vào workspace
3. **Chatbot Plugins**: Tools đã được enable cho chatbot cụ thể

## Authentication Types

| Type | Ai cấu hình | Mô tả |
|------|------------|-------|
| `none` | Không cần | Plugin không yêu cầu auth (RAG, DateTime) |
| `oauth2` | **Mỗi User** | User tự kết nối tài khoản của họ (Gmail, Slack) |
| `api_key` | **Admin** | Admin workspace nhập API key 1 lần, dùng chung |

---

## 1. Workspace Plugins Page

**Route:** `/workspaces/:workspaceId/plugins`

### 1.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Workspace Plugins                                    [+ Add Plugin] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🔍 Search Documents              [Enabled ✓]      [⚙️]      │    │
│  │ Search workspace documents using RAG                         │    │
│  │ Auth: None                                                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📧 Gmail                         [Enabled ✓]      [⚙️]      │    │
│  │ Access and manage Gmail emails                               │    │
│  │ Auth: OAuth2  │  🔗 Connected as user@gmail.com  [Disconnect]│    │
│  │               │  ⚠️ Not connected                [Connect]   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🌤️ Weather                       [Disabled]       [⚙️]      │    │
│  │ Get weather information                                      │    │
│  │ Auth: API Key │ ✅ Configured                    [Edit Key]  │    │
│  │               │ ❌ Not configured                [Set Key]   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 API Calls

```typescript
// Get workspace plugins (with user's OAuth status)
GET /workspaces/:workspaceId/tools
Headers: Authorization: Bearer <jwt>

// Response
[
  {
    "id": "uuid",
    "name": "gmail",
    "display_name": "Gmail",
    "description": "...",
    "category": "builtin",
    "is_enabled": true,
    "auth_config": {
      "type": "oauth2",
      "oauth": { "scopes": [...] }
    },
    "actions": [...],
    "workspace_tool": {              // null nếu chưa add vào workspace
      "is_enabled": true,
      "config_override": {},
      "added_at": "2026-01-20T..."
    },
    "user_auth_status": {            // Chỉ có khi auth_config.type = "oauth2"
      "connected": true,
      "profile": {
        "email": "user@gmail.com",
        "name": "User Name",
        "picture": "https://..."
      },
      "connected_at": "2026-01-20T..."
    }
  }
]
```

---

## 2. OAuth Connection Flow (Gmail, Slack, etc.)

### 2.1 UI Flow

```
User clicks [Connect] button
       │
       ▼
┌──────────────────────────────────────┐
│  Connect Gmail Account               │
│                                      │
│  You will be redirected to Google    │
│  to authorize access to your Gmail.  │
│                                      │
│  Permissions requested:              │
│  • Read emails                       │
│  • Send emails                       │
│  • Modify labels                     │
│                                      │
│  [Cancel]              [Continue →]  │
└──────────────────────────────────────┘
       │
       ▼ (Click Continue)
       │
  Redirect to Google OAuth
       │
       ▼
  User logs in & grants permission
       │
       ▼
  Redirect back to:
  /workspaces/:wid/plugins?connected=true&tool=gmail&email=user@gmail.com
       │
       ▼
┌──────────────────────────────────────┐
│  ✅ Gmail Connected!                 │
│                                      │
│  Connected as: user@gmail.com        │
│                                      │
│  You can now use Gmail actions       │
│  in your chatbots.                   │
│                                      │
│  [Done]                              │
└──────────────────────────────────────┘
```

### 2.2 API Calls

```typescript
// Step 1: Get OAuth authorization URL
GET /workspaces/:workspaceId/tools/:toolId/oauth/authorize
Headers: Authorization: Bearer <jwt>

// Response
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&scope=...&state=...",
  "state": "base64-encoded-state"
}

// Step 2: Redirect user to url (window.location.href = url OR window.open(url))

// Step 3: Google redirects to /oauth/google/callback?code=...&state=...
// Backend processes and redirects to frontend with status

// Step 4: Check connection status (polling or after redirect)
GET /workspaces/:workspaceId/tools/:toolId/oauth/status
Headers: Authorization: Bearer <jwt>

// Response
{
  "connected": true,
  "profile": {
    "email": "user@gmail.com",
    "name": "User Name",
    "picture": "https://lh3.googleusercontent.com/..."
  },
  "connected_at": "2026-01-20T14:30:00Z"
}

// Disconnect
DELETE /workspaces/:workspaceId/tools/:toolId/oauth/disconnect
Headers: Authorization: Bearer <jwt>
```

### 2.3 React Example Code

```tsx
// ConnectOAuthButton.tsx
const ConnectOAuthButton = ({ workspaceId, toolId, toolName }) => {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/tools/${toolId}/oauth/authorize`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { url } = await response.json();
      
      // Option 1: Full redirect
      window.location.href = url;
      
      // Option 2: Popup (for better UX)
      const popup = window.open(url, 'oauth', 'width=600,height=700');
      
      // Poll for completion
      const interval = setInterval(async () => {
        const status = await checkOAuthStatus(workspaceId, toolId);
        if (status.connected) {
          clearInterval(interval);
          popup?.close();
          onConnected(status);
        }
      }, 2000);
      
    } catch (error) {
      toast.error('Failed to start OAuth flow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} loading={loading}>
      Connect {toolName}
    </Button>
  );
};
```

---

## 3. API Key Configuration Flow (Weather, etc.)

### 3.1 UI Flow

```
Admin clicks [Set API Key] button
       │
       ▼
┌──────────────────────────────────────┐
│  Configure Weather API               │
│                                      │
│  API Key:                            │
│  ┌────────────────────────────────┐  │
│  │ ********************************│  │
│  └────────────────────────────────┘  │
│                                      │
│  Get your API key from:              │
│  https://openweathermap.org/api      │
│                                      │
│  [Cancel]                   [Save]   │
└──────────────────────────────────────┘
```

### 3.2 API Calls

```typescript
// Update workspace tool config (Admin only)
PUT /workspaces/:workspaceId/tools/:toolId
Headers: Authorization: Bearer <jwt>
Body:
{
  "config_override": {
    "api_key": "sk-xxxxxxxxxxxx"
  }
}

// Response
{
  "id": "...",
  "workspace_tool": {
    "is_enabled": true,
    "config_override": {
      "api_key": "sk-xxxx****xxxx"  // Masked for security
    }
  }
}
```

---

## 4. Plugin Detail / Actions Page

**Route:** `/workspaces/:workspaceId/plugins/:toolId`

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Plugins                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📧 Gmail                                              [Enabled ✓]  │
│  Access and manage Gmail emails                                     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Authentication                                               │    │
│  │ Type: OAuth2                                                 │    │
│  │ Status: ✅ Connected as user@gmail.com                       │    │
│  │                                         [Disconnect]         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Actions (5)                                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ☑️ list_emails      List Emails                              │    │
│  │    List emails from inbox or a specific label                │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ ☑️ get_email        Get Email                                │    │
│  │    Get details of a specific email by ID                     │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ ☑️ send_email       Send Email                               │    │
│  │    Send an email                                             │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ ☐ mark_as_read     Mark as Read                              │    │
│  │    Mark email(s) as read                                     │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ ☐ mark_as_unread   Mark as Unread                            │    │
│  │    Mark email(s) as unread                                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [Remove from Workspace]                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Add Plugin Modal

### 5.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Add Plugin to Workspace                                      [✕]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔍 Search plugins...                                               │
│                                                                      │
│  Built-in Plugins                                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🔍 Search Documents                              [+ Add]     │    │
│  │    Search workspace documents using RAG                      │    │
│  │    Auth: None                                                │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ 📧 Gmail                                         [+ Add]     │    │
│  │    Access and manage Gmail emails                            │    │
│  │    Auth: OAuth2 (Users connect their own accounts)           │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ 🌤️ Weather                                       [+ Add]     │    │
│  │    Get weather information                                   │    │
│  │    Auth: API Key (Admin configures once)                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Custom Plugins (Coming soon)                                       │
│  Create your own plugins with OpenAPI spec                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 API Call

```typescript
// Add plugin to workspace
POST /workspaces/:workspaceId/tools
Headers: Authorization: Bearer <jwt>
Body:
{
  "tool_id": "uuid-of-gmail-tool",
  "is_enabled": true,
  "config_override": {}  // Optional initial config
}
```

---

## 6. Chatbot Plugin Settings

**Route:** `/workspaces/:workspaceId/chatbots/:chatbotId/plugins`

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Chatbot: Customer Support Bot                                      │
│  Plugin Settings                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Enable plugins for this chatbot                                    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ [✓] 🔍 Search Documents                                      │    │
│  │     Actions: search (enabled)                                │    │
│  │     └─ [✓] search - Search workspace documents               │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ [✓] 📧 Gmail                                                 │    │
│  │     ⚠️ Requires OAuth - Users must connect their account     │    │
│  │     Actions: 3 of 5 enabled                                  │    │
│  │     └─ [✓] list_emails - List Emails                         │    │
│  │     └─ [✓] get_email - Get Email                             │    │
│  │     └─ [✓] send_email - Send Email                           │    │
│  │     └─ [ ] mark_as_read - Mark as Read                       │    │
│  │     └─ [ ] mark_as_unread - Mark as Unread                   │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ [ ] 🌤️ Weather                                               │    │
│  │     ❌ API Key not configured (Admin required)               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [Save Changes]                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 API Calls

```typescript
// Get chatbot plugins with action-level status
GET /workspaces/:workspaceId/chatbots/:chatbotId/tools
Headers: Authorization: Bearer <jwt>

// Enable/disable tool for chatbot
PUT /workspaces/:workspaceId/chatbots/:chatbotId/tools/:toolId
Body: { "is_enabled": true }

// Enable/disable specific action
PUT /workspaces/:workspaceId/chatbots/:chatbotId/tools/:toolId/actions/:actionId
Body: { "is_enabled": false }

// Batch update actions
POST /workspaces/:workspaceId/chatbots/:chatbotId/tools/:toolId/actions/batch
Body: {
  "actions": [
    { "action_id": "uuid1", "is_enabled": true },
    { "action_id": "uuid2", "is_enabled": false }
  ]
}
```

---

## 7. Chat Interface - OAuth Not Connected

Khi user chat và chatbot cần dùng plugin OAuth nhưng user chưa connect:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Chat with Customer Support Bot                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [User]: Check my latest emails                                     │
│                                                                      │
│  [Bot]: ┌─────────────────────────────────────────────────────┐     │
│         │ 🔗 Gmail Connection Required                         │     │
│         │                                                      │     │
│         │ To access your emails, please connect your           │     │
│         │ Gmail account first.                                 │     │
│         │                                                      │     │
│         │ [Connect Gmail]                                      │     │
│         └─────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. State Management (React/Vue)

```typescript
// useWorkspacePlugins.ts
interface Plugin {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: 'builtin' | 'custom';
  is_enabled: boolean;
  auth_config: {
    type: 'none' | 'oauth2' | 'api_key';
    oauth?: { scopes: string[] };
    api_key?: { param_name: string };
  };
  actions: PluginAction[];
  workspace_tool: {
    is_enabled: boolean;
    config_override: Record<string, any>;
  } | null;
  user_auth_status: {
    connected: boolean;
    profile: { email: string; name: string; picture: string } | null;
  } | null;
}

interface PluginAction {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_enabled: boolean;
}

// Hook
const useWorkspacePlugins = (workspaceId: string) => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch plugins
  useEffect(() => {
    fetchPlugins();
  }, [workspaceId]);

  const addPlugin = async (toolId: string) => { ... };
  const removePlugin = async (toolId: string) => { ... };
  const updatePluginConfig = async (toolId: string, config: any) => { ... };
  const connectOAuth = async (toolId: string) => { ... };
  const disconnectOAuth = async (toolId: string) => { ... };

  return { plugins, loading, addPlugin, removePlugin, connectOAuth, ... };
};
```

---

## 9. API Endpoints Summary

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/workspaces/:wid/tools` | List all plugins for workspace |
| POST | `/workspaces/:wid/tools` | Add plugin to workspace |
| PUT | `/workspaces/:wid/tools/:tid` | Update plugin config |
| DELETE | `/workspaces/:wid/tools/:tid` | Remove plugin from workspace |
| GET | `/workspaces/:wid/tools/:tid/oauth/authorize` | Get OAuth URL |
| GET | `/workspaces/:wid/tools/:tid/oauth/status` | Check OAuth status |
| DELETE | `/workspaces/:wid/tools/:tid/oauth/disconnect` | Disconnect OAuth |
| GET | `/workspaces/:wid/chatbots/:cid/tools` | Get chatbot plugins |
| PUT | `/workspaces/:wid/chatbots/:cid/tools/:tid` | Toggle chatbot plugin |
| PUT | `/workspaces/:wid/chatbots/:cid/tools/:tid/actions/:aid` | Toggle action |
| POST | `/workspaces/:wid/chatbots/:cid/tools/:tid/actions/batch` | Batch toggle |

---

## 10. Color Coding & Icons

| Status | Color | Icon |
|--------|-------|------|
| Connected | Green | ✅ |
| Not Connected | Orange/Yellow | ⚠️ |
| Disabled | Gray | ⭕ |
| Error | Red | ❌ |
| Enabled | Blue | ☑️ |

| Auth Type | Icon | Badge |
|-----------|------|-------|
| None | 🔓 | - |
| OAuth2 | 🔐 | "User Auth" |
| API Key | 🔑 | "Admin Config" |
