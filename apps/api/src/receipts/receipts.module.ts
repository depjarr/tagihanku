import { Module } from '@nestjs/common';
import { GroqOcrProvider } from './ocr/groq-ocr.provider';
import { OCR_PROVIDER } from './ocr/ocr.provider';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';

@Module({
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    GroqOcrProvider,
    {
      provide: OCR_PROVIDER,
      useClass: GroqOcrProvider,
    },
  ],
  exports: [ReceiptsService, GroqOcrProvider],
})
export class ReceiptsModule {}