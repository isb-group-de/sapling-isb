import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { GenericPermissionGuard } from '../../auth/guard/generic-permission.guard';
import { PersonItem } from '../../entity/PersonItem';
import { extractClientFormattingContextFromRequest } from '../common/client-formatting-context.util';
import {
  GenericPermission,
  GenericPermissionEntity,
} from './generic.decorator';
import {
  MaterializeEventRecurrenceDto,
  MaterializeEventRecurrenceResponseDto,
} from './dto/materialize-event-recurrence.dto';
import { EventRecurrenceMutationService } from './event-recurrence-mutation.service';
import {
  DetachEventOccurrenceDto,
  DetachEventOccurrenceResponseDto,
  DetachEventOccurrencesDto,
  DetachEventOccurrencesResponseDto,
} from './dto/detach-event-occurrence.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@Controller('api/calendar/events')
@UseGuards(SessionOrBearerAuthGuard, GenericPermissionGuard)
@GenericPermissionEntity('event')
export class EventRecurrenceController {
  constructor(
    private readonly eventRecurrenceMutationService: EventRecurrenceMutationService,
  ) {}

  @Post(':handle/materialize-recurrence')
  @GenericPermission('allowInsert')
  @ApiOperation({
    summary: 'Resolve an Event recurrence into standalone records',
    description:
      'Atomically removes the finite recurrence rule from the source Event and creates one standalone Event for every later occurrence.',
  })
  @ApiBody({ type: MaterializeEventRecurrenceDto })
  @ApiResponse({
    status: 201,
    type: MaterializeEventRecurrenceResponseDto,
  })
  async materializeRecurrence(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: string,
    @Body() request: MaterializeEventRecurrenceDto,
  ): Promise<MaterializeEventRecurrenceResponseDto> {
    return this.eventRecurrenceMutationService.materialize(
      handle,
      request,
      req.user,
      extractClientFormattingContextFromRequest(req),
    );
  }

  @Post(':handle/detach-occurrence')
  @GenericPermission('allowUpdate')
  @ApiOperation({
    summary: 'Detach one occurrence from a recurring Event',
    description:
      'Atomically excludes one generated occurrence from its series and creates the edited occurrence as a standalone Event.',
  })
  @ApiBody({ type: DetachEventOccurrenceDto })
  @ApiResponse({ status: 201, type: DetachEventOccurrenceResponseDto })
  async detachOccurrence(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: string,
    @Body() request: DetachEventOccurrenceDto,
  ): Promise<DetachEventOccurrenceResponseDto> {
    return this.eventRecurrenceMutationService.detachOccurrence(
      handle,
      request,
      req.user,
      extractClientFormattingContextFromRequest(req),
    );
  }

  @Post(':handle/detach-occurrences')
  @GenericPermission('allowUpdate')
  @ApiOperation({
    summary: 'Detach multiple occurrences from a recurring Event',
    description:
      'Atomically excludes selected generated occurrences from their series and creates each occurrence as an edited standalone Event.',
  })
  @ApiBody({ type: DetachEventOccurrencesDto })
  @ApiResponse({ status: 201, type: DetachEventOccurrencesResponseDto })
  async detachOccurrences(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: string,
    @Body() request: DetachEventOccurrencesDto,
  ): Promise<DetachEventOccurrencesResponseDto> {
    return this.eventRecurrenceMutationService.detachOccurrences(
      handle,
      request,
      req.user,
      extractClientFormattingContextFromRequest(req),
    );
  }
}
