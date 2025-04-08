export interface S3File extends Express.Multer.File {
  location: string;
}
