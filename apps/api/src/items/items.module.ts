import { Module } from '@nestjs/common';
import { BillsModule } from '../bills/bills.module';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({ imports: [BillsModule], controllers: [ItemsController], providers: [ItemsService] })
export class ItemsModule {}
