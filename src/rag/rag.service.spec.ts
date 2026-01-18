import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from './rag.service';
import { OpenAiService } from './openai.service';
import { VectorStoreService } from './vector-store.service';

describe('RagService', () => {
  let service: RagService;
  let openAiService: OpenAiService;
  let vectorStoreService: VectorStoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: OpenAiService,
          useValue: {
            getEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
            getChatCompletion: jest.fn().mockResolvedValue('Mocked answer'),
          },
        },
        {
          provide: VectorStoreService,
          useValue: {
            addDocument: jest.fn().mockResolvedValue(undefined),
            similaritySearch: jest.fn().mockResolvedValue([
              { id: '1', text: 'Context 1', metadata: {}, vector: [0.1, 0.2, 0.3] },
            ]),
          },
        },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
    openAiService = module.get<OpenAiService>(OpenAiService);
    vectorStoreService = module.get<VectorStoreService>(VectorStoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should ingest text', async () => {
    await service.ingest('Test content');
    expect(openAiService.getEmbedding).toHaveBeenCalledWith('Test content');
    expect(vectorStoreService.addDocument).toHaveBeenCalled();
  });

  it('should answer question', async () => {
    const answer = await service.ask('Test question');
    expect(openAiService.getEmbedding).toHaveBeenCalledWith('Test question');
    expect(vectorStoreService.similaritySearch).toHaveBeenCalled();
    expect(openAiService.getChatCompletion).toHaveBeenCalledWith(
      'Test question',
      'Context 1',
    );
    expect(answer).toBe('Mocked answer');
  });
});
