/* eslint-disable @typescript-eslint/no-explicit-any */
// Add missing type declarations
declare module 'json-schema' {
  export interface JSONSchema4 {
    [key: string]: any;
  }
}

declare module 'estree' {
  export interface Node {
    type: string;
    [key: string]: any;
  }
} 