import { Module } from '@nestjs/common';
import { BillsModule } from '../bills/bills.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';

@Module({ imports: [BillsModule, NotificationsModule], controllers: [ParticipantsController], providers: [ParticipantsService] })
export class ParticipantsModule {}
