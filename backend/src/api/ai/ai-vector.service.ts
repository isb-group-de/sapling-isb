import { Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { AiVectorIndexService } from './ai-vector-index.service';
import { AiVectorSearchService } from './ai-vector-search.service';
import {
  VectorizeEntityDto,
  VectorizeEntityResponseDto,
} from './dto/vectorization.dto';

@Injectable()
export class AiVectorService {
  constructor(
    private readonly indexService: AiVectorIndexService,
    private readonly searchService: AiVectorSearchService,
  ) {}

  async vectorizeEntity(
    dto: VectorizeEntityDto,
  ): Promise<VectorizeEntityResponseDto> {
    return this.indexService.vectorizeEntity(dto);
  }

  async searchVectorDocuments(
    entityHandle: string,
    query: string,
    user: PersonItem,
    limit = 5,
  ): Promise<Record<string, unknown>> {
    return this.searchService.searchVectorDocuments(
      entityHandle,
      query,
      user,
      limit,
    );
  }
}
