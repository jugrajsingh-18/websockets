import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const ROOM_CODE_PATTERN = /^\d{6}$/;

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(30)
  username: string;
}

export class JoinRoomDto {
  @IsString()
  @Matches(ROOM_CODE_PATTERN, { message: 'roomCode must be a 6-digit code' })
  roomCode: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(30)
  username: string;
}

export class LeaveRoomDto {
  @IsString()
  @Matches(ROOM_CODE_PATTERN, { message: 'roomCode must be a 6-digit code' })
  roomCode: string;
}

export class SendMessageDto {
  @IsString()
  @Matches(ROOM_CODE_PATTERN, { message: 'roomCode must be a 6-digit code' })
  roomCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
