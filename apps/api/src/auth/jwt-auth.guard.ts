import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';

/** Mewajibkan login. `req.user` diisi oleh AuthMiddleware bila header Authorization valid. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.sub) throw new UnauthorizedException('Silakan masuk terlebih dahulu');
    return true;
  }
}

/** Mengambil id user yang sedang login: `@CurrentUser() userId: string` */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string =>
  ctx.switchToHttp().getRequest().user?.sub,
);
