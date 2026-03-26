declare module "bwip-js" {
  interface BwipOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
    backgroundcolor?: string;
  }

  export function toBuffer(options: BwipOptions): Promise<Buffer>;

  const bwipjs: {
    toBuffer(options: BwipOptions): Promise<Buffer>;
  };

  export default bwipjs;
}
