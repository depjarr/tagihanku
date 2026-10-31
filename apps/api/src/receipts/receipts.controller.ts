import {
  BadRequestException,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { OwnerGuard } from '../common/owner.guard';
import { ReceiptsService } from './receipts.service';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {}

  @Post('ai-scan')
  @ApiOperation({ summary: 'Scan foto struk langsung dengan AI Gemini tanpa perlu login/tagihan' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        ALLOWED.includes(file.mimetype)
          ? cb(null, true)
          : cb(new BadRequestException('Format file harus JPG, PNG, atau WebP'), false),
    }),
  )
  scanDirect(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File foto struk wajib diunggah');
    return this.service.scanDirect(file);
  }

  @Post(':billId')
  @UseGuards(OwnerGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadToBill(@Param('billId', ParseUUIDPipe) billId: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File foto struk wajib diunggah');
    return this.service.process(billId, file);
  }
}