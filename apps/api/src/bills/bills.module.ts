import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SplitModule } from '../split/split.module';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';

@Module({
  imports: [SplitModule, NotificationsModule],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
