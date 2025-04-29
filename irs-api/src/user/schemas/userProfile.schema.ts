import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class UserProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({
    type: String,
    enum: [
      'Backend Developer',
      'Frontend Developer',
      'Flutter Developer',
      'Data Scientist',
      'Machine Learning Engineer',
      'AI Engineer',
      'DevOps Engineer',
      'Full Stack Developer',
    ],
    required: true,
  })
  jobTitle: string;

  @Prop({ required: false })
  resume: string;

  @Prop({ required: false, type: [Number] })
  resumeTensor: number[];
}

export type UserProfileDocument = UserProfile & Document;

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
