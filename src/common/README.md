# 📦 Common Module

Thư mục này chứa các shared components, utilities, và helpers được sử dụng chung trong toàn bộ ứng dụng.

## 📁 Cấu trúc

```
common/
├── guards/                 # Authentication & Authorization guards
│   ├── jwt-auth.guard.ts
│   └── group-permissions.guard.ts
├── decorators/             # Custom decorators
│   ├── group-permissions.decorator.ts
│   └── current-user.decorator.ts
├── interfaces/             # Shared interfaces
│   ├── pagination.interface.ts
│   └── user-payload.interface.ts
├── dto/                    # Data Transfer Objects
│   └── pagination.dto.ts
├── filters/                # Exception filters
│   └── http-exception.filter.ts
├── interceptors/           # Request/Response interceptors
│   ├── transform.interceptor.ts
│   └── logging.interceptor.ts
├── constants/              # Application constants
│   ├── permissions.constant.ts
│   └── roles.constant.ts
├── utils/                  # Utility functions
│   └── pagination.util.ts
└── index.ts                # Barrel exports
```

## 🛡️ Guards

### JwtAuthGuard
Bảo vệ routes bằng JWT authentication.

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@CurrentUser() user: CurrentUserData) {
  return user;
}
```

### GroupPermissionsGuard
Kiểm tra quyền hạn trong group.

```typescript
@Post(':groupId/chatbot/configure')
@UseGuards(JwtAuthGuard, GroupPermissionsGuard)
@GroupPermissions('chatbot.configure')
async configureChatbot(@Param('groupId') groupId: string) {
  // Only users with chatbot.configure permission can access
}
```

## 🎨 Decorators

### @CurrentUser()
Lấy thông tin user từ JWT payload.

```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
getCurrentUser(@CurrentUser() user: CurrentUserData) {
  return { userId: user.sub, email: user.email };
}
```

### @GroupPermissions()
Yêu cầu permissions cho route.

```typescript
@GroupPermissions('email.send', 'email.send_group')
@UseGuards(JwtAuthGuard, GroupPermissionsGuard)
sendEmail() {
  // Requires email.send OR email.send_group
}
```

## 📄 DTOs

### PaginationDto
DTO cho pagination parameters.

```typescript
@Get('users')
getUsers(@Query() pagination: PaginationDto) {
  // pagination.page, pagination.limit, pagination.sortBy, pagination.sortOrder
}
```

## 🔍 Filters

### HttpExceptionFilter
Format exception responses.

```typescript
app.useGlobalFilters(new HttpExceptionFilter());
```

### AllExceptionsFilter
Catch tất cả exceptions.

```typescript
app.useGlobalFilters(new AllExceptionsFilter());
```

## 🔄 Interceptors

### TransformInterceptor
Transform response thành format chuẩn.

```typescript
app.useGlobalInterceptors(new TransformInterceptor());

// Response format:
{
  "data": { ... },
  "statusCode": 200,
  "message": "Success"
}
```

### LoggingInterceptor
Log request/response info.

```typescript
app.useGlobalInterceptors(new LoggingInterceptor());
// Logs: GET /api/users 200 - 45ms
```

## 🔑 Constants

### GROUP_PERMISSIONS
Tất cả permission strings.

```typescript
import { GROUP_PERMISSIONS } from '@/common/constants';

const permission = GROUP_PERMISSIONS.CHATBOT_CONFIGURE; // 'chatbot.configure'
```

### SYSTEM_ROLES & GROUP_ROLES
Role constants.

```typescript
import { SYSTEM_ROLES, GROUP_ROLES } from '@/common/constants';

const systemRole = SYSTEM_ROLES.ADMIN; // 'admin'
const groupRole = GROUP_ROLES.OWNER; // 'owner'
```

## 🛠️ Utils

### createPaginatedResult()
Tạo paginated response.

```typescript
import { createPaginatedResult } from '@/common/utils';

const result = createPaginatedResult(users, total, page, limit);
// Returns: { data, meta: { total, page, limit, totalPages, hasNextPage, hasPreviousPage } }
```

## 📝 Usage Examples

### Complete API Endpoint

```typescript
import {
  JwtAuthGuard,
  GroupPermissionsGuard,
  GroupPermissions,
  CurrentUser,
  PaginationDto,
  createPaginatedResult,
  GROUP_PERMISSIONS,
} from '@/common';

@Controller('groups/:groupId/members')
@UseGuards(JwtAuthGuard)
export class GroupMembersController {
  @Get()
  @GroupPermissions(GROUP_PERMISSIONS.MEMBER_VIEW)
  @UseGuards(GroupPermissionsGuard)
  async getMembers(
    @Param('groupId') groupId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const [members, total] = await this.service.findAll(groupId, pagination);
    return createPaginatedResult(members, total, pagination.page, pagination.limit);
  }
}
```

## 🔧 Integration

### Global Setup in main.ts

```typescript
import {
  AllExceptionsFilter,
  TransformInterceptor,
  LoggingInterceptor,
} from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  await app.listen(3000);
}
```

## 📚 Best Practices

1. ✅ Import from barrel file: `import { ... } from '@/common'`
2. ✅ Sử dụng constants thay vì hardcode strings
3. ✅ Apply guards ở controller level khi có thể
4. ✅ Sử dụng DTOs cho validation
5. ✅ Log errors và requests ở production

