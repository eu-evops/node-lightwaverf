import { Debugger } from "debug";
import dgram, { RemoteInfo } from "dgram";
import events from "events";
import {
  LightwaveCommandQueue,
  TransactionResponse,
} from "./LightwaveCommandQueue";
import LightwaveMessageProcessor from "./LightwaveMessageProcessor";
import { LightwaveMessageProcessorForJson } from "./LightwaveMessageProcessorForJson";
import LightwaveMessageProcessorForText from "./LightwaveMessageProcessorForText";

const LIGHTWAVE_LINK_SEND_PORT = 9760;
const LIGHTWAVE_LINK_RECEIVE_PORT = 9761;

declare interface LightwaveRFClientInterface {
  on(event: "ready", listener: (client: LightwaveRFClient) => void): this;
  on(
    event: "deviceTurnedOn",
    listener: (room: number, device: number) => void
  ): this;
  on(
    event: "deviceTurnedOff",
    listener: (room: number, device: number) => void
  ): this;
  on(
    event: "deviceDimmed",
    listener: (room: number, device: number, dimPercentage: number) => void
  ): this;
  on(event: "registered", listener: () => void): this;
}

export class LightwaveRFClient
  extends events.EventEmitter
  implements LightwaveRFClientInterface
{
  private senderSocket: dgram.Socket;
  private receiverSocket: dgram.Socket;
  private commandQueue!: LightwaveCommandQueue;
  private messageProcessors: LightwaveMessageProcessor[] = [];
  private debug: Debugger;
  delay: number = 800;

  public serial?: string;
  public mac?: string;
  public model?: string;
  public uptime?: number;
  public version?: string;
  discoverLinkIp: boolean;

  constructor(
    debug: Debugger,
    private ip: string = "255.255.255.255",
    { discoverLinkIp = true }: { discoverLinkIp?: boolean } = {}
  ) {
    super();

    this.discoverLinkIp = discoverLinkIp;

    this.debug = debug.extend("client");
    this.senderSocket = dgram.createSocket("udp4");
    this.senderSocket.unref();
    this.receiverSocket = dgram.createSocket("udp4");
    this.receiverSocket.unref();

    this.commandQueue = new LightwaveCommandQueue({
      debug: this.debug,
      delay: this.delay,
      onExecute: (message) => this.exec(message),
    });

    this.messageProcessors.push(
      new LightwaveMessageProcessorForJson(this.debug)
    );
    this.messageProcessors.push(
      new LightwaveMessageProcessorForText(this.debug)
    );
  }

  public async connect() {
    const { promise, resolve, reject } = Promise.withResolvers<void>();

    this.senderSocket.bind();
    this.senderSocket.once("listening", () => {
      this.receiverSocket.bind(LIGHTWAVE_LINK_RECEIVE_PORT);
    });

    this.debug(
      "Binding receiver socket on address %s and port %d",
      this.ip,
      LIGHTWAVE_LINK_RECEIVE_PORT
    );

    this.receiverSocket.on("message", (buffer: Buffer) => {
      this.debug("RAW: %o", buffer.toString("utf-8"));
    });
    this.receiverSocket.on("message", this.processRawMessage.bind(this));
    this.receiverSocket.once("listening", () => {
      this.debug("Receiver socket bound", this.receiverSocket.address());
      resolve();
    });
    this.receiverSocket.on("error", (err: Error) => {
      reject(
        new Error("Error binding receiver socket", {
          cause: err,
        })
      );
    });

    return promise;
  }

  async disconnect() {
    this.receiverSocket.removeAllListeners();
    this.senderSocket.removeAllListeners();
    this.commandQueue.destroy();

    const { promise: senderPromise, resolve: senderResolve } =
      Promise.withResolvers<void>();
    const { promise: receiverPromise, resolve: receiverResolve } =
      Promise.withResolvers<void>();

    this.senderSocket.close(senderResolve);
    this.receiverSocket.close(receiverResolve);

    return Promise.all([senderPromise, receiverPromise]);
  }

  private async checkRegistration() {
    this.debug("Checking registration");
    try {
      const transaction = await this.send("@H");
      this.debug(transaction);
    } catch (error) {
      this.debug("Error: %o", error);
    }
    this.emit("ready", this);
  }

  public send(message: string | Buffer): Promise<TransactionResponse> {
    return this.commandQueue.send(message);
  }

  private exec(message: Buffer | string | undefined) {
    if (message === undefined) return;

    this.debug(
      "Sending message: %s to %s on port %d",
      message,
      this.ip,
      LIGHTWAVE_LINK_SEND_PORT
    );
    this.senderSocket.setBroadcast(this.ip === "255.255.255.255");
    this.senderSocket.send(
      message,
      LIGHTWAVE_LINK_SEND_PORT,
      this.ip,
      (error: Error | null, bytes: number) => {
        if (error) {
          this.debug("Message send errror: %o", error);
        }
        this.debug("Message sent: %s, length: %d", message, bytes);
      }
    );
  }

  private processRawMessage(message: Buffer, remoteInfo: dgram.RemoteInfo) {
    this.debug("Message has come through from %o", remoteInfo);
    this.debug("Message received: %o", message.toString("ascii"));

    for (const messageProcessor of this.messageProcessors) {
      if (messageProcessor.canProcess(message)) {
        this.debug(
          "Message can be processed by %s",
          messageProcessor.constructor.name
        );
        const lightwaveMessage = messageProcessor.process(message);
        this.processLightwaveMessage(lightwaveMessage, remoteInfo);
        return;
      }
    }

    throw "Message cannot be processed";
  }

  private processLightwaveMessage(
    lightwaveMessage: any,
    remoteInfo: RemoteInfo
  ) {
    this.debug("Processing lightwave message: %o", lightwaveMessage);
    this.debug("Link response fn", lightwaveMessage.fn);

    // update info from link
    if (lightwaveMessage.serial) {
      this.serial ??= lightwaveMessage.serial;
    }

    if (lightwaveMessage.mac) {
      this.mac ??= lightwaveMessage.mac;
    }

    if (lightwaveMessage.model) {
      this.model ??= lightwaveMessage.prod;
    }

    if (lightwaveMessage.uptime) {
      this.uptime = lightwaveMessage.uptime;
    }

    if (this.discoverLinkIp) {
      this.debug(`Updating link ip to ${remoteInfo.address}`);
      this.ip = remoteInfo.address;
    }

    if (lightwaveMessage.fw) {
      this.version ??= lightwaveMessage.fw;
    }

    // *!{"trans":530,"mac":"03:13:8D","time":1762607959,"pkt":"error","fn":"nonRegistered","payload":"Not yet registered. See WifiLink."}
    if (lightwaveMessage.fn) {
    }

    // *!{"trans":531,"mac":"03:13:8D","time":1762607962,"type":"link","prod":"wfl","pairType":"local","msg":"success","class":"","serial":""}
    if (
      lightwaveMessage.type === "link" &&
      lightwaveMessage.msg === "success"
    ) {
      this.emit("registered");
    }

    if (lightwaveMessage.fn === "on") {
      this.emit("deviceTurnedOn", lightwaveMessage.room, lightwaveMessage.dev);
    }

    if (lightwaveMessage.fn === "off") {
      this.emit("deviceTurnedOff", lightwaveMessage.room, lightwaveMessage.dev);
    }

    if (lightwaveMessage.fn === "dim") {
      this.emit(
        "deviceDimmed",
        lightwaveMessage.room,
        lightwaveMessage.dev,
        Math.round((lightwaveMessage.param / 32) * 100)
      );
    }

    // Handle retryable errors (ERR,6 = device busy)
    if (lightwaveMessage.error?.match(/^ERR,6,/)) {
      this.commandQueue.handleRetryableError(lightwaveMessage.id);
      return;
    }

    // Pass successful response to the queue
    if (lightwaveMessage.id !== undefined) {
      this.commandQueue.handleResponse(lightwaveMessage);
    }
  }
}
