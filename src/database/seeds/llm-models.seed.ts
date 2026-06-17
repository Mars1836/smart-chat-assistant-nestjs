import { DataSource } from 'typeorm';
import { LlmModel } from '../../modules/billing/entities/llm-model.entity';

const defaultModels: Array<{
  provider: string;
  model: string;
  price_per_1k_input_tokens: string;
  price_per_1k_output_tokens: string;
  display_name: string | null;
}> = [
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash-lite',
    price_per_1k_input_tokens: '0.0005',
    price_per_1k_output_tokens: '0.0015',
    display_name: 'Gemini 2.0 Flash Lite',
  },
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    price_per_1k_input_tokens: '0.001',
    price_per_1k_output_tokens: '0.003',
    display_name: 'Gemini 2.0 Flash',
  },
  {
    provider: 'gemini',
    model: 'gemini-2.5-flash-lite',
    price_per_1k_input_tokens: '0.0005',
    price_per_1k_output_tokens: '0.0015',
    display_name: 'Gemini 2.5 Flash Lite',
  },
  {
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    price_per_1k_input_tokens: '0.0025',
    price_per_1k_output_tokens: '0.01',
    display_name: 'Gemini 2.5 Pro',
  },
  {
    provider: 'gemini',
    model: 'gemini-pro-latest',
    price_per_1k_input_tokens: '0.001',
    price_per_1k_output_tokens: '0.003',
    display_name: 'Gemini Pro Latest',
  },
  {
    provider: 'gemini',
    model: 'gemini-flash-latest',
    price_per_1k_input_tokens: '0.001',
    price_per_1k_output_tokens: '0.003',
    display_name: 'Gemini Flash Latest',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    price_per_1k_input_tokens: '0.0008',
    price_per_1k_output_tokens: '0.003',
    display_name: 'GPT-4o Mini',
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    price_per_1k_input_tokens: '0.0025',
    price_per_1k_output_tokens: '0.01',
    display_name: 'GPT-4o',
  },
];

export async function seedLlmModels(dataSource: DataSource): Promise<void> {
  console.log('💰 Seeding LLM models (pricing)...');
  const repo = dataSource.getRepository(LlmModel);
  for (const row of defaultModels) {
    const existing = await repo.findOne({
      where: { provider: row.provider, model: row.model },
    });
    if (!existing) {
      await repo.save(repo.create(row));
      console.log(`  + ${row.provider}/${row.model}`);
    }
  }
  console.log('✓ LLM models seeded');
}
