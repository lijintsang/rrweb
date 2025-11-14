declare module 'rrweb-player' {
  export default class RRWebPlayer {
    constructor(options: {
      target: HTMLElement;
      props: {
        events: any[];
        width?: number;
        height?: number;
        autoPlay?: boolean;
        insertStyleRules?: string[];
        UNSAFE_replayCanvas?: boolean;
        tags?: Record<string, string>;
      };
    });
    goto(timeOffset: number, play?: boolean): void;
    addEventListener(event: string, handler: (params: any) => unknown): void;
  }
}