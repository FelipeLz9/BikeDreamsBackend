// Minimal shims to satisfy TypeScript when @types/express is not installed.
declare module 'express' {
  export interface Request {
    [key: string]: any;
  }
  export interface Response {
    [key: string]: any;
  }
  export type NextFunction = (...args: any[]) => any;
}


