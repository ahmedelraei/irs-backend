import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from 'src/shared/enums/roles.enum';
import { UserProfileDocument } from './userProfile.schema';

export type UserDocument = User & Document & {
  profile?: UserProfileDocument;
};

@Schema({
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
})
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, default: true })
  isVerified: boolean;

  @Prop({ type: String, required: true, enum: Role, default: Role.USER })
  role: Role;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add virtual field for profile
UserSchema.virtual('profile', {
  ref: 'UserProfile',
  localField: '_id',
  foreignField: 'user',
  justOne: true
});
