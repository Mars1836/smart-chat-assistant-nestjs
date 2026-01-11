# 🌱 Database Seeds

## Mô tả

Thư mục này chứa các file seed để khởi tạo dữ liệu mặc định cho database.

## Cấu trúc

```
seeds/
├── seed.ts           # Entry point - Chạy tất cả seeds
├── rbac.seed.ts      # Seed RBAC data (roles & permissions)
└── README.md         # File này
```

## Cách sử dụng

### 1. Cài đặt dependencies

Đảm bảo đã cài đặt `tsx` để chạy TypeScript trực tiếp:

```bash
npm install -D tsx
```

### 2. Chạy seeds

```bash
# Chạy tất cả seeds
npm run seed

# Hoặc chạy trực tiếp
npx tsx src/database/seeds/seed.ts
```

### 3. Thêm script vào package.json

```json
{
  "scripts": {
    "seed": "tsx src/database/seeds/seed.ts"
  }
}
```

## Seeds hiện có

### 1. RBAC Seed (`rbac.seed.ts`)

Khởi tạo dữ liệu cho hệ thống phân quyền:

#### System Roles (2 roles)
- `admin`: Quản trị viên hệ thống
- `user`: Người dùng thường

#### Group Roles (3 roles)
- `owner` (level 1): Chủ group - Full quyền
- `moderator` (level 2): Quản lý viên
- `member` (level 3): Thành viên

#### Group Permissions (27 permissions)

| Category | Permissions |
|----------|-------------|
| **group** (3) | update, delete, settings |
| **member** (4) | invite, remove, role, view |
| **chatbot** (5) | configure, train, enable, view_logs, delete_data |
| **email** (4) | send, send_group, configure, view_history |
| **calendar** (4) | create, edit, delete, view |
| **document** (3) | upload, delete, view |
| **chat** (3) | send, delete, view_history |

#### Permission Assignment

**Owner** (27 permissions):
- Tất cả permissions

**Moderator** (23 permissions):
- Tất cả permissions trừ:
  - `group.delete`
  - `group.settings`
  - `member.role`
  - `chatbot.delete_data`

**Member** (8 permissions):
- `member.view`
- `email.send`
- `calendar.view`, `calendar.create`
- `document.view`, `document.upload`
- `chat.send`, `chat.view_history`

## Lưu ý

### Idempotent Seeds

Tất cả seeds được thiết kế để **idempotent** - có thể chạy nhiều lần mà không tạo duplicate data:

```typescript
const existingRoles = await roleRepo.count();
if (existingRoles === 0) {
  // Only seed if table is empty
}
```

### Database Connection

Seeds sử dụng cấu hình từ `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=chatbot
```

### Synchronize

Seeds **không** sử dụng `synchronize: true` để tránh thay đổi schema. Hãy đảm bảo:
1. Schema đã được tạo (bằng migration hoặc sync trước)
2. Tất cả entities đã được định nghĩa đúng

## Thêm seed mới

### Tạo file seed mới

```typescript
// src/database/seeds/users.seed.ts
import { DataSource } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export async function seedUsers(dataSource: DataSource): Promise<void> {
  console.log('🌱 Seeding users...');
  
  const userRepo = dataSource.getRepository(User);
  const existingUsers = await userRepo.count();
  
  if (existingUsers === 0) {
    const users = userRepo.create([
      {
        name: 'Admin User',
        email: 'admin@example.com',
        // ... other fields
      },
    ]);
    
    await userRepo.save(users);
    console.log('  ✓ Created users');
  }
}
```

### Import vào seed.ts

```typescript
import { seedUsers } from './users.seed';

async function runSeeds(): Promise<void> {
  // ...
  await seedRBAC(dataSource);
  await seedUsers(dataSource);
  // ...
}
```

## Troubleshooting

### Lỗi: Cannot find module

Đảm bảo đường dẫn entities đúng:

```typescript
entities: ['src/**/*.entity.ts'], // Development
// OR
entities: ['dist/**/*.entity.js'], // Production
```

### Lỗi: Database connection failed

Kiểm tra:
1. PostgreSQL đang chạy
2. Database đã được tạo
3. Credentials trong `.env` đúng

### Lỗi: Duplicate key value violates unique constraint

Seed đã được chạy trước đó. Seeds là idempotent nên sẽ skip nếu data đã tồn tại.

## Best Practices

1. ✅ **Idempotent**: Seeds có thể chạy nhiều lần
2. ✅ **Atomic**: Sử dụng transactions nếu cần
3. ✅ **Logging**: Log rõ ràng những gì đang làm
4. ✅ **Error handling**: Try-catch và cleanup
5. ✅ **Environment aware**: Sử dụng env variables
6. ✅ **Order matters**: Seed theo thứ tự dependencies

## Next Steps

- [ ] Thêm seed cho users (admin user, test users)
- [ ] Thêm seed cho groups (test groups)
- [ ] Thêm seed cho group members
- [ ] Thêm seed cho test conversations
- [ ] Tạo migration từ seeds

