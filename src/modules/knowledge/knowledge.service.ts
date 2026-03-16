import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Knowledge } from './entities/knowledge.entity';
import { ChatbotKnowledge } from './entities/chatbot-knowledge.entity';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { KnowledgeStatsSummaryDto } from './dto/knowledge-stats.dto';

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(Knowledge)
    private readonly knowledgeRepo: Repository<Knowledge>,
    @InjectRepository(ChatbotKnowledge)
    private readonly chatbotKnowledgeRepo: Repository<ChatbotKnowledge>,
  ) {}

  // =====================
  // KNOWLEDGE BASE CRUD
  // =====================

  async findAllByWorkspace(workspaceId: string): Promise<Knowledge[]> {
    return this.knowledgeRepo.find({
      where: { workspace_id: workspaceId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Knowledge> {
    const knowledge = await this.knowledgeRepo.findOne({
      where: { id },
      relations: ['documents'],
    });
    if (!knowledge) {
      throw new NotFoundException(`Knowledge base not found: ${id}`);
    }
    return knowledge;
  }

  async findOneByWorkspace(workspaceId: string, id: string): Promise<Knowledge> {
    const knowledge = await this.knowledgeRepo
      .createQueryBuilder('knowledge')
      .leftJoinAndSelect('knowledge.documents', 'documents')
      .where('knowledge.id = :id', { id })
      .andWhere('knowledge.workspace_id = :workspaceId', { workspaceId })
      .orderBy('documents.uploaded_at', 'DESC')
      .getOne();
    if (!knowledge) {
      throw new NotFoundException(`Knowledge base not found: ${id}`);
    }
    return knowledge;
  }

  async create(
    workspaceId: string,
    dto: CreateKnowledgeDto,
    userId?: string,
  ): Promise<Knowledge> {
    const knowledge = this.knowledgeRepo.create({
      workspace_id: workspaceId,
      name: dto.name,
      description: dto.description,
      icon: dto.icon,
      created_by_id: userId,
      status: 'active',
    });
    return this.knowledgeRepo.save(knowledge);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateKnowledgeDto,
  ): Promise<Knowledge> {
    const knowledge = await this.findOneByWorkspace(workspaceId, id);
    Object.assign(knowledge, dto);
    return this.knowledgeRepo.save(knowledge);
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const knowledge = await this.findOneByWorkspace(workspaceId, id);
    // Documents and vectors will be cascade deleted
    await this.knowledgeRepo.remove(knowledge);
  }

  /**
   * Update statistics after document changes
   */
  async updateStats(knowledgeId: string): Promise<void> {
    const knowledge = await this.knowledgeRepo.findOne({
      where: { id: knowledgeId },
      relations: ['documents'],
    });

    if (knowledge) {
      knowledge.document_count = knowledge.documents?.length || 0;
      knowledge.total_chunks = knowledge.documents?.reduce(
        (sum, doc) => sum + (doc.chunk_count || 0),
        0,
      ) || 0;
      knowledge.total_size = knowledge.documents?.reduce(
        (sum, doc) => sum + (Number(doc.size) || 0),
        0,
      ) || 0;
      await this.knowledgeRepo.save(knowledge);
    }
  }

  // =====================
  // CHATBOT KNOWLEDGE LINKING
  // =====================

  async getKnowledgeForChatbot(chatbotId: string): Promise<
    Array<{
      knowledge: Knowledge;
      is_enabled: boolean;
      priority: number;
    }>
  > {
    const links = await this.chatbotKnowledgeRepo.find({
      where: { chatbot_id: chatbotId },
      relations: ['knowledge'],
      order: { priority: 'DESC' },
    });

    return links.map((link) => ({
      knowledge: link.knowledge,
      is_enabled: link.is_enabled,
      priority: link.priority,
    }));
  }

  async getEnabledKnowledgeIdsForChatbot(chatbotId: string): Promise<string[]> {
    const links = await this.chatbotKnowledgeRepo.find({
      where: { chatbot_id: chatbotId, is_enabled: true },
      order: { priority: 'DESC' },
    });
    return links.map((l) => l.knowledge_id);
  }

  async addKnowledgeToChatbot(
    chatbotId: string,
    knowledgeId: string,
    priority = 0,
    isEnabled = true,
  ): Promise<ChatbotKnowledge> {
    // Check if already exists
    const existing = await this.chatbotKnowledgeRepo.findOne({
      where: { chatbot_id: chatbotId, knowledge_id: knowledgeId },
    });

    if (existing) {
      throw new BadRequestException('Knowledge already added to chatbot');
    }

    const link = this.chatbotKnowledgeRepo.create({
      chatbot_id: chatbotId,
      knowledge_id: knowledgeId,
      is_enabled: isEnabled,
      priority,
    });

    return this.chatbotKnowledgeRepo.save(link);
  }

  async updateChatbotKnowledge(
    chatbotId: string,
    knowledgeId: string,
    updates: { is_enabled?: boolean; priority?: number },
  ): Promise<ChatbotKnowledge> {
    const link = await this.chatbotKnowledgeRepo.findOne({
      where: { chatbot_id: chatbotId, knowledge_id: knowledgeId },
    });

    if (!link) {
      throw new NotFoundException('Knowledge not linked to chatbot');
    }

    if (updates.is_enabled !== undefined) {
      link.is_enabled = updates.is_enabled;
    }
    if (updates.priority !== undefined) {
      link.priority = updates.priority;
    }

    return this.chatbotKnowledgeRepo.save(link);
  }

  async removeKnowledgeFromChatbot(
    chatbotId: string,
    knowledgeId: string,
  ): Promise<void> {
    await this.chatbotKnowledgeRepo.delete({
      chatbot_id: chatbotId,
      knowledge_id: knowledgeId,
    });
  }

  async batchUpdateChatbotKnowledge(
    chatbotId: string,
    items: Array<{
      knowledge_id: string;
      is_enabled?: boolean;
      priority?: number;
    }>,
  ): Promise<ChatbotKnowledge[]> {
    const results: ChatbotKnowledge[] = [];

    for (const item of items) {
      let link = await this.chatbotKnowledgeRepo.findOne({
        where: { chatbot_id: chatbotId, knowledge_id: item.knowledge_id },
      });

      if (!link) {
        // Create new link
        link = this.chatbotKnowledgeRepo.create({
          chatbot_id: chatbotId,
          knowledge_id: item.knowledge_id,
          is_enabled: item.is_enabled ?? true,
          priority: item.priority ?? 0,
        });
      } else {
        // Update existing
        if (item.is_enabled !== undefined) link.is_enabled = item.is_enabled;
        if (item.priority !== undefined) link.priority = item.priority;
      }

      results.push(await this.chatbotKnowledgeRepo.save(link));
    }

    return results;
  }

  /**
   * Thống kê tổng quan knowledge bases trong toàn hệ thống (chỉ admin).
   */
  async getStatsSummary(): Promise<KnowledgeStatsSummaryDto> {
    const now = Date.now();
    const since7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const since30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      total_knowledge_bases,
      documentsAndSize,
      byStatusRows,
      knowledge_last_7_days,
      knowledge_last_30_days,
    ] = await Promise.all([
      this.knowledgeRepo.count(),
      this.knowledgeRepo
        .createQueryBuilder('k')
        .select('COALESCE(SUM(k.document_count), 0)', 'documents')
        .addSelect('COALESCE(SUM(k.total_size), 0)', 'size')
        .getRawOne<{ documents: string; size: string }>(),
      this.knowledgeRepo
        .createQueryBuilder('k')
        .select('k.status', 'status')
        .addSelect('COUNT(k.id)', 'count')
        .groupBy('k.status')
        .getRawMany<{ status: string; count: string }>(),
      this.knowledgeRepo
        .createQueryBuilder('k')
        .where('k.created_at >= :since', { since: since7Days })
        .getCount(),
      this.knowledgeRepo
        .createQueryBuilder('k')
        .where('k.created_at >= :since', { since: since30Days })
        .getCount(),
    ]);

    const by_status: Record<string, number> = {};
    for (const row of byStatusRows) {
      by_status[row.status] = parseInt(row.count, 10);
    }

    return {
      total_knowledge_bases,
      total_documents: parseInt(documentsAndSize?.documents ?? '0', 10),
      total_size: documentsAndSize?.size ?? '0',
      by_status,
      knowledge_last_7_days,
      knowledge_last_30_days,
    };
  }
}
