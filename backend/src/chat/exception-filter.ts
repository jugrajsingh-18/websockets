import { ArgumentsHost, Catch, WsExceptionFilter } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
@Catch()
export class ChatWsExceptionFilter
  extends BaseWsExceptionFilter
  implements WsExceptionFilter
{
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    const message =
      exception instanceof WsException
        ? exception.getError()
        : (exception as any)?.response?.message || 'Something went wrong.';

    client.emit('error', {
      message: Array.isArray(message) ? message.join(', ') : message,
    });
  }
}
