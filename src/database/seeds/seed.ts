import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { config } from 'dotenv';

// Load environment variables
config();

const dataSourceOptions: PostgresConnectionOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'chatbot',
  entities: ['src/modules/**/*.entity.ts'],
  synchronize: false, // Don't auto sync in seed script
};

async function runSeeds(): Promise<void> {
  console.log('🚀 Starting database seeding...\n');
  console.log('📝 Database config:', {
    host: dataSourceOptions.host,
    port: dataSourceOptions.port,
    database: dataSourceOptions.database,
  });
  console.log('');

  const dataSource = new DataSource(dataSourceOptions);

  try {
    await dataSource.initialize();
    console.log('✓ Database connected\n');

    // NOTE: RBAC seeding is now handled automatically by RbacSeedService (OnModuleInit)
    // No manual seeding needed for roles, permissions, and role-permissions
    console.log('ℹ️  RBAC data will be seeded automatically when app starts (RbacSeedService)');
    
    // Add other seed functions here as needed
    // await seedUsers(dataSource);
    // await seedWorkspaces(dataSource);

    console.log('🎉 All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await dataSource.destroy();
    console.log('✓ Database connection closed');
  }
}

// Run seeds
void runSeeds()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
