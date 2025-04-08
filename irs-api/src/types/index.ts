import { Request } from 'express';
import { UserDocument } from 'src/user/schemas/user.schema';

export interface AuthenticatedRequest extends Request {
  user?: UserDocument;
}
