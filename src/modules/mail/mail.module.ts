import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('NODEMAILER_HOST') ?? 'smtp.gmail.com',
          port: configService.get<number>('NODEMAILER_PORT') ?? 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: configService.get<string>('NODEMAILER_USER'),
            pass: configService.get<string>('NODEMAILER_PASS'),
          },
        },
        defaults: {
          from: `"Smart Chat Assistant" <${configService.get<string>('NODEMAILER_USER')}>`,
        },
      }),
    }),
  ],
  exports: [MailerModule],
})
export class MailModule {}
