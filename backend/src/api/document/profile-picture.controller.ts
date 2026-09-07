import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PersonItem } from '../../entity/PersonItem';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { ImpersonationReadOnlyGuard } from '../../auth/guard/impersonation-read-only.guard';
import { ProfilePictureService } from './profile-picture.service';
import { PROFILE_PICTURE_MAX_BYTES } from './profile-picture.util';

type ProfileRequest = Request & { user: PersonItem };

@ApiTags('Current')
@ApiBearerAuth()
@Controller('api/current/profile-pictures')
@UseGuards(SessionOrBearerAuthGuard, ImpersonationReadOnlyGuard)
export class ProfilePictureController {
  constructor(private readonly pictures: ProfilePictureService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'List the authenticated person’s profile picture documents',
  })
  list(@Req() req: ProfileRequest) {
    return this.pictures.list(req.user);
  }

  @Post()
  @ApiOperation({
    summary: 'Upload a profile picture for the authenticated person',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PROFILE_PICTURE_MAX_BYTES, files: 1 },
    }),
  )
  upload(
    @Req() req: ProfileRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.pictures.upload(req.user, file);
  }

  @Get(':handle')
  @ApiOperation({
    summary: 'Read an image belonging to the authenticated person’s profile',
  })
  async download(
    @Req() req: ProfileRequest,
    @Param('handle', ParseIntPipe) handle: number,
    @Res() res: Response,
  ) {
    const { filePath, document } = await this.pictures.download(
      req.user,
      handle,
    );
    res.setHeader('Content-Type', document.mimetype);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(filePath);
  }

  @Delete(':handle')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete an own profile picture document and its stored file',
  })
  remove(
    @Req() req: ProfileRequest,
    @Param('handle', ParseIntPipe) handle: number,
  ) {
    return this.pictures.remove(req.user, handle);
  }
}
