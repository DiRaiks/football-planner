import { Schema, model, type Document } from 'mongoose';

export interface Chat extends Document {
  readonly chatId: number;
}

export class CreateChatDto {
  readonly chatId!: number;
}

export const ChatSchema = new Schema<Chat>(
  {
    chatId: { type: Number, required: true, unique: true },
  },
  { timestamps: true },
);

export const ChatModel = model<Chat>('Chat', ChatSchema);
