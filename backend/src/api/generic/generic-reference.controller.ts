import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { GenericPermissionGuard } from '../../auth/guard/generic-permission.guard';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { PersonItem } from '../../entity/PersonItem';
import { extractClientFormattingContextFromRequest } from '../common/client-formatting-context.util';
import {
  ApiGenericEntityReferenceOperation,
  GenericPermission,
} from './generic.decorator';
import { GenericService } from './generic.service';

interface GenericReferenceBody {
  entityHandle: string | number;
  referenceHandle: string | number;
}

const referenceBodyDocumentation = {
  description: 'Payload identifying the owning record and the related record.',
  required: true,
  schema: {
    type: 'object',
    properties: {
      entityHandle: {
        type: 'string',
        description: 'Handle of the primary record.',
      },
      referenceHandle: {
        type: 'string',
        description: 'Handle of the related record.',
      },
    },
    required: ['entityHandle', 'referenceHandle'],
  },
} as const;

@ApiTags('Generic')
@ApiBearerAuth()
@Controller('api/generic')
@UseGuards(SessionOrBearerAuthGuard)
export class GenericReferenceController {
  constructor(private readonly genericService: GenericService) {}

  @UseGuards(GenericPermissionGuard)
  @Post(':entityHandle/:referenceName/create')
  @GenericPermission('allowUpdate')
  @ApiOperation({
    summary: 'Create an n:m relation entry',
    description:
      'Adds a relation through the specified many-to-many reference.',
  })
  @ApiGenericEntityReferenceOperation('Creates a reference for an entity')
  @ApiBody(referenceBodyDocumentation)
  @ApiResponse({
    status: 201,
    description: 'Relation created successfully.',
    type: Object,
  })
  async createReference(
    @Req() req: Request & { user: PersonItem },
    @Param('entityHandle') entityHandle: string,
    @Param('referenceName') referenceName: string,
    @Body() body: GenericReferenceBody,
  ): Promise<unknown> {
    return this.genericService.createReference(
      entityHandle,
      referenceName,
      body.entityHandle,
      body.referenceHandle,
      req.user,
      extractClientFormattingContextFromRequest(req),
    );
  }

  @UseGuards(GenericPermissionGuard)
  @Post(':entityHandle/:referenceName/delete')
  @GenericPermission('allowUpdate')
  @ApiOperation({
    summary: 'Delete an n:m relation entry',
    description:
      'Removes a relation through the specified many-to-many reference.',
  })
  @ApiGenericEntityReferenceOperation('Deletes a reference for an entity')
  @ApiBody(referenceBodyDocumentation)
  @ApiResponse({
    status: 201,
    description: 'Relation removed successfully.',
    type: Object,
  })
  async deleteReference(
    @Req() req: Request & { user: PersonItem },
    @Param('entityHandle') entityHandle: string,
    @Param('referenceName') referenceName: string,
    @Body() body: GenericReferenceBody,
  ): Promise<unknown> {
    return this.genericService.deleteReference(
      entityHandle,
      referenceName,
      body.entityHandle,
      body.referenceHandle,
      req.user,
      extractClientFormattingContextFromRequest(req),
    );
  }
}
