import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  Param,
  Get,
  Res,
  Req,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/core';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from './document.service';
import type { Request, Response } from 'express';
import {
  ApiGenericEntityOperation,
  GenericPermission,
  GenericPermissionEntity,
  GenericPermissionResolve,
} from '../generic/generic.decorator';
import { PersonItem } from '../../entity/PersonItem';
import { UseGuards } from '@nestjs/common';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { GenericPermissionGuard } from '../../auth/guard/generic-permission.guard';
import { DocumentItem } from '../../entity/DocumentItem';
import {
  DvelopDocumentActionResponse,
  DvelopDocumentService,
} from './dvelop-document.service';
import { DvelopConfigurationService } from './dvelop-configuration.service';
import type {
  DvelopConfigurationImportPayload,
  DvelopConfigurationImportResponse,
  DvelopHealthCheckResponse,
  DvelopConfigurationSyncPayload,
} from './dvelop-configuration.service';

const resolveDocumentEntityPermission = async (
  req: Request<{ handle?: string }>,
  em: EntityManager,
) => {
  const document = await em.findOne(
    DocumentItem,
    { handle: Number(req.params.handle) },
    { populate: ['entity'] },
  );

  if (!document?.entity) {
    throw new NotFoundException('document.documentNotFound');
  }

  return {
    entityHandle:
      typeof document.entity === 'object' ? document.entity.handle : undefined,
  };
};

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Controller for document operations, including upload and download endpoints.
 *
 * @property        {DocumentService} documentService  Service handling document logic
 *
 * @method          upload     Uploads a document for a given entity and reference
 * @method          download   Downloads a document by handle
 */
@ApiTags('Document')
@ApiBearerAuth()
@Controller('api/document')
@UseGuards(SessionOrBearerAuthGuard)
export class DocumentController {
  /**
   * Service handling document logic.
   * @type {DocumentService}
   */
  constructor(
    private readonly documentService: DocumentService,
    private readonly dvelopDocumentService?: DvelopDocumentService,
    private readonly dvelopConfigurationService?: DvelopConfigurationService,
  ) {}

  /**
   * Uploads a document for a given entity and reference.
   * @param entityHandle Name of the entity
   * @param reference Reference handle
   * @param file Uploaded file
   * @param typeHandle Type handle for the document
   * @param description Optional description
   * @returns Uploaded DocumentItem
   */
  @Post('upload/:entityHandle/:reference')
  @ApiOperation({
    summary: 'Upload a document for an entity record',
    description:
      'Uploads a binary file, stores it as a Sapling document, and links it to the referenced entity record.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiGenericEntityOperation(
    'Uploads a document and links it to the requested entity reference',
  )
  @ApiParam({
    name: 'reference',
    type: 'string',
    description:
      'Record handle or reference identifier the document should be attached to.',
  })
  @ApiBody({
    description: 'Multipart form-data payload for the document upload.',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Binary file that should be stored as a document.',
          nullable: false,
        },
        typeHandle: {
          type: 'string',
          description:
            'Document type handle that classifies the uploaded file.',
          default: 'document',
          nullable: false,
        },
        description: {
          type: 'string',
          description:
            'Optional free-text note that describes the purpose or content of the document.',
          default: '',
          nullable: true,
        },
      },
      required: ['file', 'typeHandle'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document metadata for the newly stored file.',
    type: DocumentItem,
  })
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(GenericPermissionGuard)
  @GenericPermission('allowUpdate')
  async upload(
    @Param('entityHandle') entityHandle: string,
    @Param('reference') reference: string,
    @Req() req: Request & { user: PersonItem },
    @UploadedFile() file: Express.Multer.File,
    @Body('typeHandle') typeHandle: string,
    @Body('description') description?: string,
  ) {
    return this.documentService.uploadDocument(
      file,
      entityHandle,
      reference,
      typeHandle,
      req.user,
      description,
    );
  }

  @Get('dvelop/open/:entityHandle/:reference')
  @ApiOperation({
    summary: 'Resolve d.velop Cloud document view URL for an entity record',
    description:
      'Returns a d.velop Cloud URL for the referenced record when an active d.velop configuration exists. Existing Sapling document handling remains the fallback.',
  })
  @ApiGenericEntityOperation(
    'Resolves the d.velop Cloud document view URL for the requested entity reference',
  )
  @ApiParam({
    name: 'reference',
    type: 'string',
    description: 'Record handle or reference identifier.',
  })
  @ApiResponse({
    status: 200,
    description:
      'd.velop Cloud URL payload when configured, otherwise a local fallback indicator.',
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermission('allowRead')
  async resolveDvelopDocumentsUrl(
    @Param('entityHandle') entityHandle: string,
    @Param('reference') reference: string,
  ): Promise<DvelopDocumentActionResponse> {
    return this.getDvelopDocumentService().buildDocumentsUrl(
      entityHandle,
      reference,
    );
  }

  @Get('dvelop/upload-dialog/:entityHandle/:reference')
  @ApiOperation({
    summary: 'Resolve d.velop Cloud storage dialog URL for an entity record',
    description:
      'Returns a d.velop Cloud storage dialog URL for the referenced record when an active d.velop configuration exists. Existing Sapling upload handling remains the fallback.',
  })
  @ApiGenericEntityOperation(
    'Resolves the d.velop Cloud storage dialog URL for the requested entity reference',
  )
  @ApiParam({
    name: 'reference',
    type: 'string',
    description: 'Record handle or reference identifier.',
  })
  @ApiResponse({
    status: 200,
    description:
      'd.velop Cloud storage dialog URL payload when configured, otherwise a local fallback indicator.',
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermission('allowUpdate')
  async resolveDvelopUploadDialogUrl(
    @Param('entityHandle') entityHandle: string,
    @Param('reference') reference: string,
  ): Promise<DvelopDocumentActionResponse> {
    return this.getDvelopDocumentService().buildUploadDialogUrl(
      entityHandle,
      reference,
    );
  }

  @Post('dvelop/config/:connectionHandle/import')
  @ApiOperation({
    summary: 'Import d.velop Cloud configuration metadata',
    description:
      'Imports already normalized repositories, object definitions, and properties for a configured d.velop Cloud connection.',
  })
  @ApiParam({
    name: 'connectionHandle',
    type: 'number',
    description: 'Numeric handle of the d.velop Cloud connection.',
  })
  @ApiBody({
    description: 'Normalized d.velop Cloud object definitions and properties.',
    schema: {
      type: 'object',
      properties: {
        repositories: {
          type: 'array',
          items: { type: 'object' },
        },
        objectDefinitions: {
          type: 'array',
          items: { type: 'object' },
        },
        properties: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Import summary for repositories, object definitions, and properties.',
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermissionEntity('dvelopConnection')
  @GenericPermission('allowUpdate')
  async importDvelopConfiguration(
    @Param('connectionHandle') connectionHandle: string,
    @Body() payload: DvelopConfigurationImportPayload,
  ): Promise<DvelopConfigurationImportResponse> {
    return this.getDvelopConfigurationService().importConfiguration(
      Number(connectionHandle),
      payload,
    );
  }

  @Post('dvelop/config/:connectionHandle/sync')
  @ApiOperation({
    summary: 'Synchronize d.velop Cloud configuration metadata',
    description:
      'Loads repositories, object definitions, and properties from d.velop Cloud server-side with the configured connection API key and imports the metadata into Sapling.',
  })
  @ApiParam({
    name: 'connectionHandle',
    type: 'number',
    description: 'Numeric handle of the d.velop Cloud connection.',
  })
  @ApiBody({
    description:
      'Selection of d.velop Cloud metadata types to synchronize. If omitted, all supported metadata types are synchronized.',
    schema: {
      type: 'object',
      properties: {
        repositories: { type: 'boolean' },
        objectDefinitions: { type: 'boolean' },
        properties: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Synchronization summary for repositories, object definitions, and properties.',
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermissionEntity('dvelopConnection')
  @GenericPermission('allowUpdate')
  async syncDvelopConfiguration(
    @Param('connectionHandle') connectionHandle: string,
    @Body() payload: DvelopConfigurationSyncPayload,
  ): Promise<DvelopConfigurationImportResponse> {
    return this.getDvelopConfigurationService().syncConfiguration(
      Number(connectionHandle),
      payload,
    );
  }

  @Post('dvelop/config/:connectionHandle/health')
  @ApiOperation({
    summary: 'Check d.velop Cloud configuration API access',
    description:
      'Checks whether the configured API key can access repositories, object definitions, and properties required by Sapling.',
  })
  @ApiParam({
    name: 'connectionHandle',
    type: 'number',
    description: 'Numeric handle of the d.velop Cloud connection.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Healthcheck result for the configured d.velop Cloud API capabilities.',
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermissionEntity('dvelopConnection')
  @GenericPermission('allowUpdate')
  async healthCheckDvelopConfiguration(
    @Param('connectionHandle') connectionHandle: string,
  ): Promise<DvelopHealthCheckResponse> {
    return this.getDvelopConfigurationService().healthCheckConfiguration(
      Number(connectionHandle),
    );
  }

  /**
   * Downloads a document by handle.
   * @param handle Document handle
   * @param res Express response object
   */
  @Get('download/:handle')
  @ApiOperation({
    summary: 'Download a stored document',
    description:
      'Returns the original file as a binary attachment and preserves the stored filename and MIME type.',
  })
  @ApiParam({
    name: 'handle',
    type: 'number',
    description: 'Numeric handle of the document to download.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Binary file download with the stored MIME type and attachment filename.',
    schema: { type: 'string', format: 'binary' },
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermission('allowRead')
  @GenericPermissionResolve(resolveDocumentEntityPermission)
  async download(
    @Param('handle') handle: number,
    @Res() res: Response,
    @Req() req: Request & { user: PersonItem },
  ) {
    const { filePath, document } = await this.documentService.downloadDocument(
      handle,
      req.user,
    );
    res.setHeader('Content-Type', document.mimetype);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.filename}"`,
    );
    res.sendFile(filePath);
  }

  /**
   * PDF Vorschau-Endpunkt: Liefert PDF mit Content-Disposition: inline
   * @param handle Document handle
   * @param res Express response object
   */
  @Get('preview/:handle')
  @ApiOperation({
    summary: 'Preview a stored document',
    description:
      'Returns the document as an inline response when the browser can preview the MIME type. PDF files are served inline; other files fall back to attachment download behavior.',
  })
  @ApiParam({
    name: 'handle',
    type: 'number',
    description: 'Numeric handle of the document to preview.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Binary document response intended for inline preview when possible.',
    schema: { type: 'string', format: 'binary' },
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermission('allowRead')
  @GenericPermissionResolve(resolveDocumentEntityPermission)
  async preview(
    @Param('handle') handle: number,
    @Res() res: Response,
    @Req() req: Request & { user: PersonItem },
  ) {
    const { filePath, document } = await this.documentService.downloadDocument(
      handle,
      req.user,
    );
    res.setHeader('Content-Type', document.mimetype);
    // PDF Vorschau: Content-Disposition inline
    if (document.mimetype === 'application/pdf') {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${document.filename}"`,
      );
    } else {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.filename}"`,
      );
    }
    res.sendFile(filePath);
  }

  private getDvelopDocumentService(): DvelopDocumentService {
    if (!this.dvelopDocumentService) {
      throw new NotFoundException('document.dvelopServiceNotAvailable');
    }

    return this.dvelopDocumentService;
  }

  private getDvelopConfigurationService(): DvelopConfigurationService {
    if (!this.dvelopConfigurationService) {
      throw new NotFoundException('document.dvelopServiceNotAvailable');
    }

    return this.dvelopConfigurationService;
  }
}
