import { Debugger } from "debug";
import "./LightwaveTransaction";
import { LightwaveTransaction } from "./LightwaveTransaction";
import LightwaveMessageProcessor from "./LightwaveMessageProcessor";

export class LightwaveJsonMessageProcessor implements LightwaveMessageProcessor {
  debug: Debugger;
  constructor(debug: Debugger) {
    this.debug = debug.extend('jsonMessageProcessor');
  }

  process(message: Buffer): any {
    this.debug('Processing message')
    const textMessage = message.toString('utf-8').replace('*!', '');
    const json = JSON.parse(textMessage);

    const response = json;
    response.id = json.trans;
    response.error = json.error ?? null;

    return response;
  }

  canProcess(message: Buffer): boolean {
    this.debug("Checking if can process message");
    return message.toString('utf-8').startsWith('*!');
  }

}