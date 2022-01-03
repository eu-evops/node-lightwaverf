import "./LightwaveTransaction";

declare interface LightwaveMessageProcessor {
  process(message: Buffer): any;
  canProcess(message: Buffer): boolean;
}

export default LightwaveMessageProcessor;