import { Debugger } from "debug";
import LightwaveMessageProcessor from "./LightwaveMessageProcessor";
import "./LightwaveTransaction";

export default class LightwaveMessageProcessorForText
  implements LightwaveMessageProcessor
{
  debug: Debugger;
  constructor(debug: Debugger) {
    this.debug = debug.extend("textMessageProcessor");
  }

  process(message: Buffer): any {
    this.debug("Processing message");
    const textMessage = message.toString("utf-8");
    var parts = textMessage.split(",");
    var trans = parts.splice(0, 1);
    var content = parts.join(",").replace(/(\r\n|\n|\r)/gm, "");

    const response: any = {};
    response.id = parseInt(trans[0]);
    response.message = content;
    response.error = content.match("^ERR") ? content : null;
    return response;
  }

  canProcess(message: Buffer): boolean {
    this.debug("Checking if can process message");
    return message.toString("utf-8").endsWith("\n");
  }
}
