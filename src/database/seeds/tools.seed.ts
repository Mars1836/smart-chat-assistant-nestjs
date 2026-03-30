import { DataSource, In } from 'typeorm';
import { Tool } from '../../modules/tools/entities/tool.entity';
import { ToolAction } from '../../modules/tools/entities/tool-action.entity';
import { ToolExecutionLog } from '../../modules/tools/entities/tool-execution-log.entity';
import { WorkspaceTool } from '../../modules/tools/entities/workspace-tool.entity';
import { ChatbotTool } from '../../modules/tools/entities/chatbot-tool.entity';
import { ChatbotToolAction } from '../../modules/tools/entities/chatbot-tool-action.entity';
import { UserToolCredential } from '../../modules/tools/entities/user-tool-credential.entity';

interface ToolSeedData {
  name: string;
  display_name: string;
  description: string;
  category: 'builtin' | 'custom' | 'community';
  is_enabled: boolean;
  executor_type: 'generic_api' | 'function' | 'database';
  executor_config: Record<string, any>;
  auth_config: Record<string, any> | null;
  icon_url?: string;
  actions: Array<{
    name: string;
    display_name: string;
    description: string;
    parameters: Record<string, any>;
    executor_config?: Record<string, any>;
    sort_order?: number;
  }>;
}

export async function seedTools(dataSource: DataSource): Promise<void> {
  console.log('📦 Seeding built-in tools...');

  const toolRepo = dataSource.getRepository(Tool);
  const actionRepo = dataSource.getRepository(ToolAction);
  const logRepo = dataSource.getRepository(ToolExecutionLog);
  const workspaceToolRepo = dataSource.getRepository(WorkspaceTool);
  const chatbotToolRepo = dataSource.getRepository(ChatbotTool);
  const chatbotToolActionRepo = dataSource.getRepository(ChatbotToolAction);
  const userToolCredentialRepo = dataSource.getRepository(UserToolCredential);

  // =====================
  // Cleanup removed tools (safe to run repeatedly)
  // =====================
  const removedToolNames = ['pollinations_image_generator'] as const;

  const removedTools = await toolRepo.find({
    where: { name: In(removedToolNames) },
    select: ['id', 'name'],
  });

  if (removedTools.length > 0) {
    console.log(
      `🧹 Cleaning up removed tools: ${removedTools.map((t) => t.name).join(', ')}`,
    );
    for (const t of removedTools) {
      // Delete all related rows first to avoid FK constraint errors
      // Order matters: children -> parent
      await chatbotToolActionRepo.delete({ tool_id: t.id });
      await chatbotToolRepo.delete({ tool_id: t.id });
      await workspaceToolRepo.delete({ tool_id: t.id });
      await userToolCredentialRepo.delete({ tool_id: t.id });
      await actionRepo.delete({ tool_id: t.id });
      await logRepo.delete({ tool_id: t.id });

      await toolRepo.delete({ id: t.id });
    }
    console.log('🧹 Cleanup done.');
  }

  const builtinTools: ToolSeedData[] = [
    // NOTE: RAG is now handled via Knowledge system (not as a plugin)
    // Each workspace has Knowledge bases, and chatbots select which to use

    // =====================
    // GMAIL (Generic API with OAuth)
    // =====================
    {
      name: 'gmail',
      display_name: 'Gmail',
      description:
        'Access and manage Gmail emails. Requires OAuth2 authentication.',
      category: 'builtin',
      is_enabled: true,
      executor_type: 'generic_api',
      executor_config: {
        base_url: 'https://gmail.googleapis.com/gmail/v1',
        auth_type: 'oauth2',
      },
      auth_config: {
        type: 'oauth2',
        oauth: {
          authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
          token_url: 'https://oauth2.googleapis.com/token',
          scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
          ],
        },
      },
      actions: [
        {
          name: 'list_emails',
          display_name: 'List Emails',
          description: 'List emails from inbox or a specific label',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: {
                type: 'string',
                description:
                  'Gmail search query (e.g., "is:unread", "from:example@gmail.com")',
              },
              maxResults: {
                type: 'number',
                description:
                  'Maximum number of emails to return (default: 10, max: 500)',
              },
              pageToken: {
                type: 'string',
                description: 'Page token for pagination',
              },
            },
            required: [],
          },
          executor_config: {
            method: 'GET',
            endpoint: '/users/me/messages',
            params: {
              query: {
                q: '{{query}}',
                maxResults: '{{maxResults}}',
                pageToken: '{{pageToken}}',
              },
            },
          },
          sort_order: 0,
        },
        {
          name: 'get_email',
          display_name: 'Get Email',
          description: 'Get details of a specific email by ID',
          parameters: {
            type: 'OBJECT',
            properties: {
              emailId: {
                type: 'string',
                description: 'The Gmail message ID',
              },
              format: {
                type: 'string',
                description:
                  'Format of the email (full, metadata, minimal, raw). Default: full',
                enum: ['full', 'metadata', 'minimal', 'raw'],
              },
            },
            required: ['emailId'],
          },
          executor_config: {
            method: 'GET',
            endpoint: '/users/me/messages/{{emailId}}',
            params: {
              query: {
                format: '{{format}}',
              },
            },
          },
          sort_order: 1,
        },
        {
          name: 'send_email',
          display_name: 'Send Email',
          description: 'Send an email',
          parameters: {
            type: 'OBJECT',
            properties: {
              to: {
                type: 'string',
                description:
                  'Recipient email address(es), comma-separated for multiple',
              },
              subject: {
                type: 'string',
                description: 'Email subject',
              },
              body: {
                type: 'string',
                description: 'Email body (plain text or HTML)',
              },
              cc: {
                type: 'string',
                description: 'CC email address(es), comma-separated',
              },
              bcc: {
                type: 'string',
                description: 'BCC email address(es), comma-separated',
              },
              isHtml: {
                type: 'boolean',
                description: 'Whether the body is HTML (default: false)',
              },
            },
            required: ['to', 'subject', 'body'],
          },
          executor_config: {
            method: 'POST',
            endpoint: '/users/me/messages/send',
            pre_process: 'gmail_encode_message',
            params: {
              body: {
                raw: '{{_computed.encoded_message}}',
              },
            },
          },
          sort_order: 2,
        },
        {
          name: 'mark_as_read',
          display_name: 'Mark as Read',
          description: 'Mark email(s) as read',
          parameters: {
            type: 'OBJECT',
            properties: {
              emailIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of Gmail message IDs to mark as read',
              },
            },
            required: ['emailIds'],
          },
          executor_config: {
            method: 'POST',
            endpoint: '/users/me/messages/batchModify',
            params: {
              body: {
                ids: '{{emailIds}}',
                removeLabelIds: ['UNREAD'],
              },
            },
          },
          sort_order: 3,
        },
        {
          name: 'mark_as_unread',
          display_name: 'Mark as Unread',
          description: 'Mark email(s) as unread',
          parameters: {
            type: 'OBJECT',
            properties: {
              emailIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of Gmail message IDs to mark as unread',
              },
            },
            required: ['emailIds'],
          },
          executor_config: {
            method: 'POST',
            endpoint: '/users/me/messages/batchModify',
            params: {
              body: {
                ids: '{{emailIds}}',
                addLabelIds: ['UNREAD'],
              },
            },
          },
          sort_order: 4,
        },
      ],
    },

    // =====================
    // GOOGLE CALENDAR (Generic API with OAuth)
    // =====================
    {
      name: 'google_calendar',
      display_name: 'Google Calendar',
      description:
        'Access and manage Google Calendar events. Requires OAuth2 authentication.',
      category: 'builtin',
      is_enabled: true,
      executor_type: 'generic_api',
      executor_config: {
        base_url: 'https://www.googleapis.com/calendar/v3',
        auth_type: 'oauth2',
      },
      auth_config: {
        type: 'oauth2',
        oauth: {
          authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
          token_url: 'https://oauth2.googleapis.com/token',
          scopes: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
          ],
        },
      },
      actions: [
        {
          name: 'list_events',
          display_name: 'List Events',
          description:
            'List events from the user primary calendar. Prefer natural ranges like today, tomorrow, this week, or a specific date instead of raw ISO timestamps.',
          parameters: {
            type: 'OBJECT',
            properties: {
              relativeRange: {
                type: 'string',
                description:
                  'Natural time range. Use values like today, tomorrow, this_week, next_7_days when the user speaks naturally.',
                enum: ['today', 'tomorrow', 'this_week', 'next_7_days'],
              },
              date: {
                type: 'string',
                description:
                  'Specific date in YYYY-MM-DD format if the user provides an exact calendar day.',
              },
              timeMin: {
                type: 'string',
                description:
                  'Optional explicit start time in ISO 8601 format. Use only when needed.',
              },
              timeMax: {
                type: 'string',
                description:
                  'Optional explicit end time in ISO 8601 format. Use only when needed.',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of events to return. Default 10.',
              },
              orderBy: {
                type: 'string',
                enum: ['startTime', 'updated'],
                description: 'Sort order for events. Default startTime.',
              },
              q: {
                type: 'string',
                description: 'Optional free-text query to filter events.',
              },
            },
            required: [],
          },
          executor_config: {
            method: 'GET',
            endpoint: '/calendars/primary/events',
            pre_process: 'google_calendar_prepare_list_events',
            params: {
              query: {
                timeMin: '{{timeMin}}',
                timeMax: '{{timeMax}}',
                maxResults: '{{maxResults}}',
                orderBy: '{{orderBy}}',
                q: '{{q}}',
                singleEvents: 'true',
              },
            },
            success_message:
              'Retrieved {{_response.items.length}} calendar events from Google Calendar.',
          },
          sort_order: 0,
        },
        {
          name: 'get_event',
          display_name: 'Get Event',
          description: 'Get details of a Google Calendar event by event ID.',
          parameters: {
            type: 'OBJECT',
            properties: {
              eventId: {
                type: 'string',
                description: 'Google Calendar event ID',
              },
            },
            required: ['eventId'],
          },
          executor_config: {
            method: 'GET',
            endpoint: '/calendars/primary/events/{{eventId}}',
          },
          sort_order: 1,
        },
        {
          name: 'create_event',
          display_name: 'Create Event',
          description:
            'Create a new event on the user primary Google Calendar. Prefer simple intent-aware fields like date, relativeDay, startTime, endTime, and durationMinutes instead of raw ISO datetime strings.',
          parameters: {
            type: 'OBJECT',
            properties: {
              summary: {
                type: 'string',
                description: 'Event title',
              },
              description: {
                type: 'string',
                description: 'Event description',
              },
              location: {
                type: 'string',
                description: 'Event location',
              },
              relativeDay: {
                type: 'string',
                description:
                  'Natural day reference when the user says today or tomorrow.',
                enum: ['today', 'tomorrow'],
              },
              date: {
                type: 'string',
                description:
                  'Specific event date in YYYY-MM-DD format when the user gives a concrete date.',
              },
              startTime: {
                type: 'string',
                description:
                  'Event start time in HH:mm format, for example 09:00.',
              },
              endTime: {
                type: 'string',
                description:
                  'Event end time in HH:mm format, for example 10:00.',
              },
              durationMinutes: {
                type: 'number',
                description:
                  'Optional duration in minutes if endTime is not available.',
              },
              startDateTime: {
                type: 'string',
                description:
                  'Optional explicit start time in ISO 8601 format. Use only when the natural fields are not enough.',
              },
              endDateTime: {
                type: 'string',
                description:
                  'Optional explicit end time in ISO 8601 format. Use only when the natural fields are not enough.',
              },
              timeZone: {
                type: 'string',
                description:
                  'Time zone, e.g. Asia/Ho_Chi_Minh. Default is Asia/Ho_Chi_Minh.',
              },
            },
            required: ['summary'],
          },
          executor_config: {
            method: 'POST',
            endpoint: '/calendars/primary/events',
            pre_process: 'google_calendar_prepare_create_event',
            params: {
              body: {
                summary: '{{summary}}',
                description: '{{description}}',
                location: '{{location}}',
                start: {
                  dateTime: '{{startDateTime}}',
                  timeZone: '{{timeZone}}',
                },
                end: {
                  dateTime: '{{endDateTime}}',
                  timeZone: '{{timeZone}}',
                },
              },
            },
            success_message:
              'Created calendar event "{{_response.summary}}" successfully.',
          },
          sort_order: 2,
        },
        {
          name: 'delete_event',
          display_name: 'Delete Event',
          description:
            'Delete an event from the user primary Google Calendar by event ID. If the user only describes the event naturally, the system should list events first, resolve the target event, then call this action.',
          parameters: {
            type: 'OBJECT',
            properties: {
              eventId: {
                type: 'string',
                description: 'Google Calendar event ID to delete',
              },
            },
            required: ['eventId'],
          },
          executor_config: {
            method: 'DELETE',
            endpoint: '/calendars/primary/events/{{eventId}}',
            success_message: 'Deleted Google Calendar event successfully.',
          },
          sort_order: 3,
        },
      ],
    },

    // =====================
    // DATE & TIME (Function)
    // =====================
    {
      name: 'datetime',
      display_name: 'Date & Time',
      description: 'Get current date and time information',
      category: 'builtin',
      is_enabled: true,
      executor_type: 'function',
      executor_config: {},
      auth_config: { type: 'none' },
      actions: [
        {
          name: 'get_current_time',
          display_name: 'Get Current Time',
          description:
            'Get the current date and time (includes weekday, day, month, year, time)',
          parameters: {
            type: 'OBJECT',
            properties: {
              timezone: {
                type: 'string',
                description:
                  'Timezone (e.g., "Asia/Ho_Chi_Minh", "UTC"). Default: Asia/Ho_Chi_Minh',
              },
            },
            required: [],
          },
          executor_config: {
            function: 'get_current_time',
          },
          sort_order: 0,
        },
      ],
    },

    // =====================
    // WEATHER (Example Generic API with API Key)
    // =====================
    {
      name: 'weather',
      display_name: 'Weather',
      description: 'Get current weather information for any location',
      category: 'builtin',
      is_enabled: true, // Enabled (requires OPENWEATHER_API_KEY in .env)
      executor_type: 'generic_api',
      executor_config: {
        base_url: 'https://api.openweathermap.org/data/2.5',
        auth_type: 'api_key',
      },
      auth_config: {
        type: 'api_key',
        api_key: {
          param_type: 'query',
          param_name: 'appid',
          value: process.env.OPENWEATHER_API_KEY,
        },
      },
      actions: [
        {
          name: 'get_current_weather',
          display_name: 'Get Current Weather',
          description:
            'Get current weather data including temperature, conditions, humidity, wind, etc. for a specific city.',
          parameters: {
            type: 'OBJECT',
            properties: {
              city: {
                type: 'string',
                description: 'City name (e.g., "London", "Ho Chi Minh City")',
              },
              units: {
                type: 'string',
                description:
                  'Units: "metric" (Celsius), "imperial" (Fahrenheit). Default: metric',
                enum: ['metric', 'imperial'],
                default: 'metric',
              },
            },
            required: ['city'],
          },
          executor_config: {
            method: 'GET',
            endpoint: '/weather',
            params: {
              query: {
                q: '{{city}}',
                units: '{{units}}',
              },
            },
            // Removed response_transform to allow access to full response (including coord)
            success_message:
              'Current weather in {{_response.name}}: {{_response.main.temp}}° (Feels like {{_response.main.feels_like}}°). Condition: {{_response.weather.0.description}}.',
          },
          sort_order: 0,
        },
        {
          name: 'get_forecast_weather',
          display_name: 'Get 5-Day Forecast',
          description:
            'Get weather forecast for the next 5 days with 3-hour intervals.',
          parameters: {
            type: 'OBJECT',
            properties: {
              city: {
                type: 'string',
                description: 'City name (e.g., "London", "Ho Chi Minh City")',
              },
              units: {
                type: 'string',
                description:
                  'Units: "metric" (Celsius), "imperial" (Fahrenheit). Default: metric',
                enum: ['metric', 'imperial'],
                default: 'metric',
              },
            },
            required: ['city'],
          },
          executor_config: {
            method: 'GET',
            endpoint: '/forecast',
            params: {
              query: {
                q: '{{city}}',
                units: '{{units}}',
              },
            },
            success_message: 'Forecast retrieved for {{_response.city.name}}.',
          },
          sort_order: 1,
        },
        {
          name: 'get_air_pollution',
          display_name: 'Get Air Pollution',
          description:
            'Get current, forecast, and historical air pollution data (AQI, CO, NO, NO2, O3, SO2, PM2.5, PM10, NH3). Requires latitude and longitude.',
          parameters: {
            type: 'OBJECT',
            properties: {
              lat: {
                type: 'number',
                description: 'Latitude',
              },
              lon: {
                type: 'number',
                description: 'Longitude',
              },
            },
            required: ['lat', 'lon'],
          },
          executor_config: {
            method: 'GET',
            endpoint: '/air_pollution',
            params: {
              query: {
                lat: '{{lat}}',
                lon: '{{lon}}',
              },
            },
            success_message:
              'Air pollution data retrieved. AQI: {{_response.list.0.main.aqi}}',
          },
          sort_order: 2,
        },
      ],
    },

    // =====================
    // GOOGLE SEARCH (SerpApi - thay thế CSE)
    // =====================
    // Requires: SERPAPI_API_KEY in .env
    // Đăng ký API key tại: https://serpapi.com/
    {
      name: 'google_search',
      display_name: 'Google Search',
      description:
        'Tìm kiếm trên web qua Google (SerpApi). Dùng khi câu hỏi cần thông tin thực tế, cập nhật (tin tức, luật, số liệu, định nghĩa…) mà chatbot không chắc chắn hoặc không có trong knowledge. Nếu không có thông tin hãy sử dụng tool google_search',
      category: 'builtin',
      is_enabled: true,
      executor_type: 'generic_api',
      executor_config: {
        base_url: 'https://serpapi.com/search',
      },
      auth_config: {
        type: 'api_key',
        api_key: {
          param_type: 'query',
          param_name: 'api_key',
          value: process.env.SERPAPI_API_KEY,
        },
      },
      actions: [
        {
          name: 'search',
          display_name: 'Search',
          description:
            'Tìm kiếm thông tin trên web. Trả về tiêu đề, snippet và link của các kết quả tìm kiếm. HÃY ƯU TIÊN dùng action này khi câu trả lời không chắc chắn, hoặc khi người dùng hỏi về thông tin mới, số liệu, quy định pháp luật, định nghĩa hoặc kiến thức không nằm trong knowledge hiện có.',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: {
                type: 'string',
                description: 'Từ khóa hoặc câu hỏi cần tìm kiếm',
              },
              num: {
                type: 'number',
                description: 'Số kết quả trả về (mặc định 5)',
                default: 5,
              },
            },
            required: ['query'],
          },
          executor_config: {
            method: 'GET',
            endpoint: '',
            params: {
              query: {
                engine: 'google',
                q: '{{query}}',
                num: '{{num}}',
              },
            },
            response_transform: 'organic_results',
          },
          sort_order: 0,
        },
      ],
    },

    // =====================
    // EXCEL GENERATOR (Function)
    // =====================
    // =====================
    {
      name: 'excel_generator',
      display_name: 'Excel Generator',
      description: 'Generate Excel files from data',
      category: 'builtin',
      is_enabled: true,
      executor_type: 'function',
      executor_config: {},
      auth_config: { type: 'none' },
      actions: [
        {
          name: 'create_file',
          display_name: 'Create Excel File',
          description: 'Create an Excel file with provided data',
          parameters: {
            type: 'OBJECT',
            properties: {
              filename: {
                type: 'string',
                description: 'Name of the file (without extension)',
              },
              columns: {
                type: 'array',
                description: 'Array of column definitions {header, key, width}',
                items: {
                  type: 'object',
                  properties: {
                    header: { type: 'string' },
                    key: { type: 'string' },
                    width: { type: 'number' },
                  },
                },
              },
              data: {
                type: 'array',
                description: 'Array of data objects',
                items: { type: 'object' },
              },
            },
            required: ['data'],
          },
          executor_config: {
            function: 'generate_excel',
          },
          sort_order: 0,
        },
      ],
    },

    // =====================
    // OCR (Function - Gemini Vision)
    // =====================
    {
      name: 'ocr',
      display_name: 'OCR - Nhận dạng văn bản từ ảnh',
      description:
        'Trích xuất văn bản từ hình ảnh (OCR) sử dụng Gemini Vision. Hỗ trợ ảnh từ URL công khai.',
      category: 'builtin',
      is_enabled: true,
      executor_type: 'function',
      executor_config: {},
      auth_config: { type: 'none' },
      actions: [
        {
          name: 'extract_text',
          display_name: 'Extract Text',
          description:
            'Trích xuất toàn bộ văn bản từ hình ảnh. Truyền URL công khai của ảnh (jpg, png, webp, gif). Ví dụ: https://example.com/image.jpg',
          parameters: {
            type: 'OBJECT',
            properties: {
              imageUrl: {
                type: 'string',
                description:
                  'URL công khai của hình ảnh cần OCR (ví dụ: https://file.example.com/image.jpg)',
              },
            },
            required: ['imageUrl'],
          },
          executor_config: {
            function: 'ocr_extract_text',
          },
          sort_order: 0,
        },
      ],
    },
  ];

  for (const toolData of builtinTools) {
    const { actions, ...toolInfo } = toolData;

    let tool = await toolRepo.findOne({
      where: { name: toolInfo.name },
      relations: ['actions'],
    });

    if (tool) {
      console.log(`  ↻ Updating tool: ${toolInfo.name}`);
      // Update tool info
      Object.assign(tool, toolInfo);
      tool = await toolRepo.save(tool);

      // Delete existing actions and recreate
      await actionRepo.delete({ tool_id: tool.id });
    } else {
      console.log(`  + Creating tool: ${toolInfo.name}`);
      tool = await toolRepo.save(toolRepo.create(toolInfo));
    }

    // Create actions
    for (const actionData of actions) {
      const action = actionRepo.create({
        tool_id: tool.id,
        name: actionData.name,
        display_name: actionData.display_name,
        description: actionData.description,
        parameters: actionData.parameters,
        executor_config: actionData.executor_config || null,
        sort_order: actionData.sort_order || 0,
        is_enabled: true,
      });
      await actionRepo.save(action);
      console.log(`    + Action: ${actionData.name}`);
    }
  }

  console.log('✓ Built-in tools seeded\n');
}
