declare module 'jsonwebtoken';
declare module 'bcryptjs';

declare module 'mongoose' {
  namespace Schema {
    // Add any Schema types needed
    type Types = any;
  }
  
  namespace Types {
    class ObjectId {
      constructor(id?: string | ObjectId);
      toString(): string;
    }
  }
  
  function model<T>(name: string, schema: any): any;
  
  class Schema {
    constructor(definition: any, options?: any);
    pre(hook: string, callback: Function): void;
  }
} 