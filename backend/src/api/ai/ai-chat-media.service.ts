import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { AiChatAttachmentItem } from '../../entity/AiChatAttachmentItem';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { AiChatTranscriptionItem } from '../../entity/AiChatTranscriptionItem';
import { DocumentItem } from '../../entity/DocumentItem';
import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { PersonItem } from '../../entity/PersonItem';
import { DocumentService } from '../document/document.service';
import { ImportService } from '../import/import.service';
import type { ImportBatchSummaryDto } from '../import/import.types';
import { extractClientTimeContext } from './ai-client-time.utils';
import { AiChatPersistenceService } from './ai-chat-persistence.service';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import {
  buildAssistantSpeechDescription,
  buildAssistantSpeechFailurePayload,
  buildAssistantSpeechFilename,
  buildAssistantSpeechPayload,
  normalizeAssistantSpeechText,
  prepareAssistantSpeechText,
} from './ai-speech.utils';
import type { AiPreparedSpeechText } from './ai.types';
import {
  AiChatTranscriptionResponseDto,
  CreateAiChatTranscriptionDto,
} from './dto/transcription.dto';
import { CreateAiChatMessageSpeechDto } from './dto/chat.dto';
import {
  synthesizeOpenAiSpeech,
  transcribeOpenAiAudio,
} from './openai-ai.runtime';
import { AI_ASSISTANT_SPEECH_INSTRUCTIONS } from './prompts/ai.prompts';
import {
  buildAssistantSpeechDescriptor,
  buildTranscriptionResponse,
  extractMessageSpeechPayload,
  sanitizeChatAttachment,
  sanitizeChatMessage,
  shouldReuseAssistantSpeech,
  withMessageSpeechPayload,
} from './ai-response.utils';

export type AiChatAttachmentUploadResponse = {
  attachment: AiChatAttachmentItem;
  importBatch: ImportBatchSummaryDto;
};

@Injectable()
export class AiChatMediaService {
  constructor(
    private readonly em: EntityManager,
    private readonly documentService: DocumentService,
    private readonly providerRegistry: AiProviderRegistryService,
    @Inject(forwardRef(() => ImportService))
    private readonly importService: ImportService,
    private readonly chatPersistence: AiChatPersistenceService,
  ) {}

  async createChatAttachment(
    file: Express.Multer.File | undefined,
    user: PersonItem,
    options: {
      sessionHandle?: number | null;
      purpose?: string | null;
    } = {},
  ): Promise<AiChatAttachmentUploadResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('ai.chatAttachmentFileRequired');
    }

    this.assertSupportedImportAttachmentFile(file);
    const person = await this.chatPersistence.requireManagedUser(user);
    const session = options.sessionHandle
      ? await this.chatPersistence.findOwnedSession(options.sessionHandle, user)
      : null;
    const importBatch = await this.importService.analyzeCsv(file, person);
    const batchHandle = this.requireImportBatchHandle(importBatch);
    const document = await this.documentService.uploadDocument(
      file,
      'importBatch',
      String(batchHandle),
      'document',
      person,
      this.buildImportAttachmentDocumentDescription(file, importBatch, session),
    );
    const attachment = this.em.create(AiChatAttachmentItem, {
      session,
      message: null,
      person,
      document,
      importBatch: { handle: batchHandle } as ImportBatchItem,
      purpose: options.purpose?.trim() || 'importAnalysis',
      filename: file.originalname,
      mimeType: file.mimetype || null,
      byteLength: file.size,
      status: 'analyzed',
      summaryPayload: this.buildImportAttachmentSummary(importBatch),
      errorPayload: null,
    });

    this.em.persist(attachment);
    await this.em.flush();

    return {
      attachment: sanitizeChatAttachment(attachment),
      importBatch,
    };
  }

  async ensureAssistantMessageSpeech(
    handle: number,
    user: PersonItem,
    dto: CreateAiChatMessageSpeechDto = {},
  ): Promise<AiChatMessageItem> {
    const person = await this.chatPersistence.requireManagedUser(user);
    const message = await this.chatPersistence.findOwnedMessage(handle, user);

    if (message.role !== 'assistant') {
      throw new BadRequestException(
        'ai.speechOnlySupportedForAssistantMessages',
      );
    }

    const existingSpeechPayload = extractMessageSpeechPayload(
      message.responsePayload,
    );
    const existingDocumentHandle =
      existingSpeechPayload?.documentHandle ?? null;
    const requestedSpeechTarget =
      dto.providerHandle?.trim() || dto.modelHandle?.trim()
        ? await this.providerRegistry.resolveSpeechTarget(
            dto.providerHandle ?? null,
            dto.modelHandle ?? null,
          )
        : null;
    const requestedSpeechDescriptor = buildAssistantSpeechDescriptor(
      requestedSpeechTarget,
    );

    if (existingDocumentHandle != null) {
      const existingDocument = await this.em.findOne(DocumentItem, {
        handle: existingDocumentHandle,
      });

      if (
        existingDocument &&
        shouldReuseAssistantSpeech(
          existingSpeechPayload,
          requestedSpeechTarget ? requestedSpeechDescriptor : null,
        )
      ) {
        return sanitizeChatMessage(message);
      }
    }

    const normalizedSpeechText = normalizeAssistantSpeechText(message.content);
    let preparedSpeechText: AiPreparedSpeechText = {
      text: normalizedSpeechText,
      sourceTextLength: normalizedSpeechText.length,
      wasTruncated: false,
    };
    let speechDescriptor = buildAssistantSpeechDescriptor(null);

    try {
      const speechTarget =
        requestedSpeechTarget ??
        (await this.providerRegistry.resolveSpeechTarget());
      speechDescriptor = buildAssistantSpeechDescriptor(speechTarget);
      preparedSpeechText = prepareAssistantSpeechText(
        message.content,
        speechTarget.maxInputLength,
      );

      if (!preparedSpeechText.text) {
        throw new BadRequestException('ai.speechInputEmpty');
      }

      const audioBuffer = await synthesizeOpenAiSpeech({
        provider: speechTarget.provider,
        model: speechTarget.model.providerModel,
        voice: speechTarget.voice,
        input: preparedSpeechText.text,
        responseFormat: speechTarget.fileExtension,
        instructions: String(AI_ASSISTANT_SPEECH_INSTRUCTIONS),
        speed: speechTarget.speed,
      });
      const document = await this.documentService.uploadDocument(
        {
          buffer: audioBuffer,
          originalname: buildAssistantSpeechFilename(
            message,
            speechTarget.fileExtension,
          ),
          mimetype: speechTarget.mimeType,
          size: audioBuffer.length,
        } as Express.Multer.File,
        'aiChatMessage',
        String(message.handle ?? ''),
        'aiChatAudio',
        person,
        buildAssistantSpeechDescription(message),
      );

      message.responsePayload = withMessageSpeechPayload(
        message.responsePayload,
        buildAssistantSpeechPayload(
          preparedSpeechText,
          document,
          speechDescriptor,
        ),
      );
      await this.em.flush();
      return sanitizeChatMessage(message);
    } catch (error) {
      message.responsePayload = withMessageSpeechPayload(
        message.responsePayload,
        buildAssistantSpeechFailurePayload(
          preparedSpeechText,
          error,
          speechDescriptor,
        ),
      );
      await this.em.flush();
      throw error;
    }
  }

  async createChatTranscription(
    dto: CreateAiChatTranscriptionDto,
    file: Express.Multer.File | undefined,
    user: PersonItem,
  ): Promise<AiChatTranscriptionResponseDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('ai.transcriptionFileRequired');
    }

    const person = await this.chatPersistence.requireManagedUser(user);
    const session = dto.sessionHandle
      ? await this.chatPersistence.findOwnedSession(dto.sessionHandle, user)
      : null;
    const target = await this.providerRegistry.resolveTranscriptionTarget(
      dto.providerHandle ?? null,
      dto.modelHandle ?? null,
    );
    const clientTimeContext = extractClientTimeContext(dto);
    const transcription = this.em.create(AiChatTranscriptionItem, {
      session,
      person,
      provider: target.provider,
      model: target.model,
      status: 'processing',
      mimeType: file.mimetype,
      byteLength: file.size,
      durationSeconds: dto.durationSeconds ?? null,
      transcript: null,
      detectedLanguage: null,
      requestPayload: {
        routeName: dto.routeName ?? null,
        url: dto.url ?? null,
        pageTitle: dto.pageTitle ?? null,
        language: dto.language ?? null,
        clientCurrentDateTime:
          clientTimeContext?.currentDate?.toISOString() ?? null,
        clientTimeZone: clientTimeContext?.timeZone ?? null,
        clientLocale: clientTimeContext?.locale ?? null,
        clientUtcOffsetMinutes: clientTimeContext?.utcOffsetMinutes ?? null,
        file: {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
      },
    });

    this.em.persist(transcription);
    await this.em.flush();

    try {
      const document = await this.documentService.uploadDocument(
        file,
        'aiChatTranscription',
        String(transcription.handle ?? ''),
        'aiChatAudio',
        person,
        this.buildTranscriptionDocumentDescription(
          file,
          dto,
          transcription,
          session,
          target.provider.handle,
          target.model.handle,
        ),
      );

      transcription.document = document;
      const response = await transcribeOpenAiAudio({
        provider: target.provider,
        model: target.model.providerModel,
        fileBuffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        language: dto.language?.trim() || undefined,
      });

      transcription.status = 'completed';
      transcription.transcript = response.text?.trim() || null;
      transcription.detectedLanguage = response.language?.trim() || null;
      transcription.durationSeconds =
        response.duration ?? transcription.durationSeconds ?? null;
      transcription.responsePayload = {
        providerHandle: target.provider.handle,
        modelHandle: target.model.handle,
        usage: response.usage ?? null,
      };
      await this.em.flush();

      return buildTranscriptionResponse(transcription);
    } catch (error) {
      transcription.status = 'failed';
      transcription.failurePayload = {
        error:
          error instanceof Error ? error.message : 'ai.transcriptionFailed',
      };
      await this.em.flush();
      throw error;
    }
  }

  private assertSupportedImportAttachmentFile(file: Express.Multer.File): void {
    const filename = file.originalname?.trim().toLowerCase() ?? '';
    const extension = filename.includes('.')
      ? filename.slice(filename.lastIndexOf('.') + 1)
      : '';
    const allowedExtensions = new Set(['csv', 'tsv', 'txt']);

    if (!allowedExtensions.has(extension)) {
      throw new BadRequestException('ai.chatAttachmentUnsupportedFileType');
    }
  }

  private requireImportBatchHandle(batch: ImportBatchSummaryDto): number {
    if (typeof batch.handle !== 'number' || !Number.isFinite(batch.handle)) {
      throw new BadRequestException('import.batchNotFound');
    }

    return batch.handle;
  }

  private buildImportAttachmentDocumentDescription(
    file: Express.Multer.File,
    batch: ImportBatchSummaryDto,
    session: AiChatSessionItem | null,
  ): string {
    return this.compactDocumentDescription([
      `AI Chat import: ${file.originalname}`,
      `batch ${batch.handle}`,
      `status ${batch.status}`,
      batch.entityHandle ? `entity ${batch.entityHandle}` : null,
      batch.sourceHandle ? `source ${batch.sourceHandle}` : null,
      batch.templateHandle ? `template ${batch.templateHandle}` : null,
      session?.handle ? `session ${session.handle}` : 'session new',
      new Date().toISOString(),
    ]);
  }

  private buildTranscriptionDocumentDescription(
    file: Express.Multer.File,
    dto: CreateAiChatTranscriptionDto,
    transcription: AiChatTranscriptionItem,
    session: AiChatSessionItem | null,
    providerHandle: string,
    modelHandle: string,
  ): string {
    return this.compactDocumentDescription([
      `AI Chat transcription: ${file.originalname}`,
      transcription.handle ? `transcription ${transcription.handle}` : null,
      session?.handle ? `session ${session.handle}` : 'session new',
      dto.pageTitle?.trim() ? `page ${dto.pageTitle.trim()}` : null,
      dto.routeName?.trim() ? `route ${dto.routeName.trim()}` : null,
      `provider ${providerHandle}`,
      `model ${modelHandle}`,
      new Date().toISOString(),
    ]);
  }

  private compactDocumentDescription(
    parts: Array<string | null | undefined>,
  ): string {
    return parts
      .map((part) => part?.trim())
      .filter((part): part is string => !!part)
      .join(' | ')
      .slice(0, 256);
  }

  private buildImportAttachmentSummary(
    batch: ImportBatchSummaryDto,
  ): Record<string, unknown> {
    return {
      importBatchHandle: batch.handle,
      status: batch.status,
      filename: batch.filename,
      mimetype: batch.mimetype ?? null,
      fileSize: batch.fileSize ?? null,
      rowCount: batch.rowCount,
      readyCount: batch.readyCount,
      errorCount: batch.errorCount,
      delimiter: batch.delimiter ?? null,
      headers: batch.headers,
      sampleRows: batch.sampleRows,
      entityHandle: batch.entityHandle ?? null,
      sourceHandle: batch.sourceHandle ?? null,
      templateHandle: batch.templateHandle ?? null,
    };
  }
}
