import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  CreateRoomDto,
  JoinRoomDto,
  LeaveRoomDto,
  SendMessageDto,
} from './chat-dto';
import { ChatWsExceptionFilter } from './exception-filter';

interface RoomUser {
  username: string;
  roomCode: string;
}

const MAX_ROOM_CODE_GENERATION_ATTEMPTS = 10;

@WebSocketGateway({
  cors: {
    origin:'*',
  },
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@UseFilters(new ChatWsExceptionFilter())
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  private readonly rooms = new Map<string, Set<string>>();

  private readonly users = new Map<string, RoomUser>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const user = this.users.get(client.id);
    if (user) {
      this.removeUserFromRoom(client, user.roomCode, user.username);
    }
    this.users.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('createRoom')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateRoomDto,
  ) {
    const roomCode = this.generateUniqueRoomCode();
    const username = payload.username.trim();

    this.rooms.set(roomCode, new Set([client.id]));
    this.users.set(client.id, { username, roomCode });
    client.join(roomCode);

    this.logger.log(`${username} created and joined room ${roomCode}`);

    return { event: 'roomCreated', data: { roomCode } };
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomDto,
  ) {
    const { roomCode } = payload;
    const username = payload.username.trim();

    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new WsException(`Room ${roomCode} does not exist.`);
    }

    room.add(client.id);
    this.users.set(client.id, { username, roomCode });
    client.join(roomCode);

    client.to(roomCode).emit('userJoined', {
      message: `${username} has joined the room.`,
      userId: client.id,
      username,
    });

    this.logger.log(`${username} joined room ${roomCode}`);

    return { event: 'joinedRoom', data: { roomCode } };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveRoomDto,
  ) {
    const user = this.users.get(client.id);
    if (!user || user.roomCode !== payload.roomCode) {
      throw new WsException('You are not in that room.');
    }

    this.removeUserFromRoom(client, payload.roomCode, user.username);
    this.users.delete(client.id);

    return { event: 'leftRoom', data: { roomCode: payload.roomCode } };
  }

  @SubscribeMessage('sendMessage')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ) {
    const user = this.users.get(client.id);
    if (!user || user.roomCode !== payload.roomCode) {
      throw new WsException('You must join the room before sending messages.');
    }

    this.server.to(payload.roomCode).emit('newMessage', {
      userId: client.id,
      username: user.username,
      message: payload.message.trim(),
      timestamp: new Date(),
    });
  }

  private removeUserFromRoom(
    client: Socket,
    roomCode: string,
    username: string,
  ) {
    client.leave(roomCode);

    const room = this.rooms.get(roomCode);
    if (room) {
      room.delete(client.id);
      if (room.size === 0) {
        this.rooms.delete(roomCode);
      }
    }

    this.server.to(roomCode).emit('userLeft', {
      message: `${username} has left the room.`,
      userId: client.id,
      username,
    });
  }

  private generateUniqueRoomCode(): string {
    for (
      let attempt = 0;
      attempt < MAX_ROOM_CODE_GENERATION_ATTEMPTS;
      attempt++
    ) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      if (!this.rooms.has(code)) {
        return code;
      }
    }
    throw new WsException(
      'Could not generate a unique room code. Please try again.',
    );
  }
}
