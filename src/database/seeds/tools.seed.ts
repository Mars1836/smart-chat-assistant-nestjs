import { DataSource } from 'typeorm';
import { Tool } from '../../modules/tools/entities/tool.entity';
import { ToolAction } from '../../modules/tools/entities/tool-action.entity';

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
          description: 'Get the current date and time',
          parameters: {
            type: 'OBJECT',
            properties: {
              timezone: {
                type: 'string',
                description:
                  'Timezone (e.g., "Asia/Ho_Chi_Minh", "UTC"). Default: UTC',
              },
            },
            required: [],
          },
          executor_config: {
            function: 'getCurrentTime',
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
      is_enabled: false, // Disabled by default - needs API key
      executor_type: 'generic_api',
      executor_config: {
        base_url: 'https://api.openweathermap.org/data/2.5',
        auth_type: 'api_key',
        api_key_header: 'appid', // OpenWeatherMap uses query param, but this shows the pattern
      },
      auth_config: {
        type: 'api_key',
        api_key: {
          param_type: 'query', // 'query' or 'header'
          param_name: 'appid',
        },
      },
      actions: [
        {
          name: 'get_current',
          display_name: 'Get Current Weather',
          description: 'Get current weather for a city',
          parameters: {
            type: 'OBJECT',
            properties: {
              city: {
                type: 'string',
                description: 'City name (e.g., "London", "Ho Chi Minh City")',
              },
              units: {
                type: 'string',
                description: 'Units: "metric" (Celsius), "imperial" (Fahrenheit)',
                enum: ['metric', 'imperial'],
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
            response_transform: 'main',
            success_message:
              'Weather in {{city}}: {{_response.temp}}° (feels like {{_response.feels_like}}°)',
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
