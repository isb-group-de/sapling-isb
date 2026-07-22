import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { GenericPermissionGuard } from '../../auth/guard/generic-permission.guard';
import { PersonItem } from '../../entity/PersonItem';
import { GenericPermission } from '../generic/generic.decorator';
import { Customer360Service } from './customer-360.service';
import {
  CUSTOMER_360_SECTIONS,
  type Customer360Anchor,
  type Customer360Section,
} from './customer-360.types';

type AuthenticatedRequest = Request & { user: PersonItem };

@ApiTags('Customer 360')
@ApiBearerAuth()
@Controller('api/customer-360')
@UseGuards(SessionOrBearerAuthGuard, GenericPermissionGuard)
@GenericPermission('allowRead')
export class Customer360Controller {
  constructor(private readonly customer360Service: Customer360Service) {}

  @Get(':entityHandle/:handle/summary')
  getSummary(
    @Req() req: AuthenticatedRequest,
    @Param('entityHandle') entityHandle: string,
    @Param('handle') handle: string,
  ) {
    return this.customer360Service.getSummary(
      this.parseAnchor(entityHandle),
      handle,
      req.user,
    );
  }

  @Get(':entityHandle/:handle/activity')
  getActivity(
    @Req() req: AuthenticatedRequest,
    @Param('entityHandle') entityHandle: string,
    @Param('handle') handle: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
    @Query('kinds') kinds?: string,
    @Query('direction') direction?: string,
  ) {
    return this.customer360Service.getActivity(
      this.parseAnchor(entityHandle),
      handle,
      req.user,
      {
        before,
        after,
        limit: this.parseNumber(limit, 30, 1, 100),
        kinds: kinds
          ?.split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        direction:
          direction === 'inbound' ||
          direction === 'outbound' ||
          direction === 'none'
            ? direction
            : undefined,
      },
    );
  }

  @Get(':entityHandle/:handle/related/:section')
  getRelated(
    @Req() req: AuthenticatedRequest,
    @Param('entityHandle') entityHandle: string,
    @Param('handle') handle: string,
    @Param('section') section: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: string,
  ) {
    if (!CUSTOMER_360_SECTIONS.includes(section as Customer360Section)) {
      throw new BadRequestException('customer360.invalidSection');
    }
    return this.customer360Service.getRelated(
      this.parseAnchor(entityHandle),
      handle,
      req.user,
      section as Customer360Section,
      this.parseNumber(page, 1, 1, 10_000),
      this.parseNumber(limit, 20, 1, 100),
      this.parseFilter(filter),
    );
  }

  private parseAnchor(value: string): Customer360Anchor {
    if (value !== 'company' && value !== 'person') {
      throw new BadRequestException('customer360.invalidAnchor');
    }
    return value;
  }

  private parseNumber(
    value: string | undefined,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    const parsed = Number(value ?? fallback);
    return Number.isInteger(parsed)
      ? Math.max(minimum, Math.min(maximum, parsed))
      : fallback;
  }

  private parseFilter(value?: string): object {
    if (!value) return {};
    if (value.length > 10_000) {
      throw new BadRequestException('customer360.invalidFilter');
    }

    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Filter must be an object');
      }
      this.assertSafeFilter(parsed, 0);
      return parsed;
    } catch {
      throw new BadRequestException('customer360.invalidFilter');
    }
  }

  private assertSafeFilter(value: unknown, depth: number): void {
    if (depth > 8) throw new Error('Filter is too deeply nested');
    if (Array.isArray(value)) {
      value.forEach((entry) => this.assertSafeFilter(entry, depth + 1));
      return;
    }
    if (!value || typeof value !== 'object') return;

    for (const [key, entry] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error('Unsafe filter key');
      }
      this.assertSafeFilter(entry, depth + 1);
    }
  }
}
