import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@CurrentUser() userId: string, @Query('limit') limit?: string) {
    return this.service.list(userId, Math.min(Math.max(Number(limit) || 30, 1), 100));
  }

  @Get('unread-count')
  unread(@CurrentUser() userId: string) { return this.service.unreadCount(userId); }

  @Post('read-all')
  readAll(@CurrentUser() userId: string) { return this.service.markAllRead(userId); }

  @Patch(':id/read')
  read(@CurrentUser() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markRead(userId, id);
  }

  @Delete()
  clear(@CurrentUser() userId: string) { return this.service.clear(userId); }
}
