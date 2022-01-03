import debug from 'debug';

export declare interface LightwaveTransaction {
  id: number;
  message: string;
  error: any;
  debug: debug.Debugger,
  callback: (message: LightwaveTransaction, error: Error) => void
}
