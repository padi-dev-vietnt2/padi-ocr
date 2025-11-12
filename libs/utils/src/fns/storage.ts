import { join } from 'path';

export const storagePath = (...paths: string[]) =>
  join(__dirname, 'storage', ...paths);
export const publicPath = (...paths: string[]) =>
  join(__dirname, 'storage', 'public', ...paths);
