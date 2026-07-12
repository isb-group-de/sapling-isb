import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { EntityTemplateDto } from './dto/entity-template.dto';
import {
  ApiGenericEntityOperation,
  GenericPermission,
} from '../generic/generic.decorator';
import { GenericPermissionGuard } from '../../auth/guard/generic-permission.guard';
import { TemplateService } from './template.service';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { GenericCustomFieldService } from '../generic/generic-custom-field.service';
import type { Request, Response } from 'express';
import { createHash } from 'crypto';

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Controller for handling entity template metadata endpoints.
 *
 * @property        templateService      Service for template operations
 * @method          getEntityTemplate    Get the properties (columns) of an entity as metadata
 */
@ApiTags('Template')
@ApiBearerAuth()
@Controller('api/template')
@UseGuards(SessionOrBearerAuthGuard)
export class TemplateController {
  /**
   * Injects the TemplateService for retrieving entity templates.
   * @param templateService Service for template operations
   */
  constructor(
    private readonly templateService: TemplateService,
    private readonly genericCustomFieldService: GenericCustomFieldService = {
      appendCustomFieldTemplates: (
        _entityHandle: string,
        templates: EntityTemplateDto[],
      ): Promise<EntityTemplateDto[]> => Promise.resolve(templates),
    } as unknown as GenericCustomFieldService,
  ) {}

  /**
   * Get the properties (columns) of an entity as metadata.
   * @param entityHandle The name of the entity
   * @returns Array of entity property metadata
   * @route GET /api/template/:entityHandle
   * @access Protected
   */
  @Get(':entityHandle')
  @ApiOperation({
    summary: 'Get entity template metadata',
    description:
      'Returns the property metadata that describes the fields, relations, and structural characteristics of the requested entity.',
  })
  @ApiParam({
    name: 'entityHandle',
    type: String,
    description:
      'Registered Sapling entity handle whose template should be returned.',
  })
  @ApiGenericEntityOperation('Returns the properties (columns) of an entity')
  @ApiResponse({
    status: 200,
    description:
      'Array of entity property metadata objects describing fields, relation types, nullability, and other template details.',
    type: EntityTemplateDto,
    isArray: true,
  })
  @ApiResponse({
    status: 304,
    description: 'Template metadata has not changed since the supplied ETag.',
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermission('allowRead')
  async getEntityTemplate(
    @Param('entityHandle') entityHandle: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EntityTemplateDto[] | undefined> {
    const templates =
      await this.genericCustomFieldService.appendCustomFieldTemplates(
        entityHandle,
        this.templateService.getEntityTemplate(entityHandle),
      );
    const etag = `"${createHash('sha256')
      .update(JSON.stringify(templates))
      .digest('base64url')}"`;

    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      res.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }

    return templates;
  }
}
