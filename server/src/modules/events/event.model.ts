import { Schema, model } from "mongoose";

export interface EventEntity {
  place: string;
  time: string;
  date: string;
  minimum: number;
  playersAmount: number;
  eventName: string;
  creatorId: string;
}

const EventSchema = new Schema<EventEntity>(
  {
    place: { type: String, required: true },
    time: { type: String, required: true },
    date: { type: String, required: true },
    minimum: { type: Number, required: true },
    playersAmount: { type: Number, required: true },
    eventName: { type: String, required: true },
    creatorId: { type: String, required: true },
  },
  { timestamps: true },
);
export const EventModel = model<EventEntity>("Event", EventSchema);
