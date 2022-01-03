import dgram from 'dgram';
import events from 'events';
import Debug, { Debugger } from 'debug';
import LightwaveMessageProcessor from './LightwaveMessageProcessor';
import LightwaveTextMessageProcessor from './LightwaveTextMessageProcessor';
import { LightwaveJsonMessageProcessor } from './LightwaveJsonMessageProcessor';
import { LightwaveTransaction } from './LightwaveTransaction';
import { Queue } from './Queue';

declare interface LightwaveRFClientInterface {
  on(event: 'ready', listener: (client: LightwaveRFClient) => void): this;
  on(event: 'deviceTurnedOn', listener: (room: number, device: number) => void): this;
  on(event: 'deviceTurnedOff', listener: (room: number, device: number) => void): this;
  on(event: 'deviceDimmed', listener: (room: number, device: number, dimPercentage: number) => void): this;
}

export class LightwaveRFClient extends events.EventEmitter implements LightwaveRFClientInterface {
  private senderSocket: dgram.Socket;
  private receiverSocket: dgram.Socket;

  private senderSocketReady: boolean = false;
  private receiverSocketReady: boolean = false;

  private commandQueue: Queue<LightwaveTransaction> = new Queue<LightwaveTransaction>();

  private messageProcessors: LightwaveMessageProcessor[] = [];

  private debug: Debug.Debugger;
  private ip: string;
  private transactionListeners: Map<number, any> = new Map();
  delay: number = 125;

  constructor(debug: Debugger, ip: string = "255.255.255.255", port: number = 9761) {
    super();

    this.ip = ip;
    this.debug = debug.extend('client');
    this.senderSocket = dgram.createSocket('udp4');
    this.receiverSocket = dgram.createSocket('udp4');

    this.messageProcessors.push(new LightwaveJsonMessageProcessor(this.debug));
    this.messageProcessors.push(new LightwaveTextMessageProcessor(this.debug));

    this.receiverSocket.on('message', (buffer: Buffer) => {
      this.debug("RAW: %o", buffer.toString('utf-8'));
    });
    this.receiverSocket.on('message', this.processRawMessage.bind(this));

    this.receiverSocket.once('listening', () => {
      this.debug("Receiver socket bound", this.receiverSocket.address());
      this.receiverSocketReady = true
    });
    this.receiverSocket.once('listening', this.socketReady.bind(this));

    this.senderSocket.once('listening', () => {
      this.debug("Sender socket bound", this.senderSocket.address());
      this.senderSocketReady = true
    });
    this.senderSocket.once('listening', this.socketReady.bind(this));

    this.senderSocket.unref();

    this.senderSocket.bind();

    this.debug("Binding receiver socket on address %s and port %d", ip, port);
    this.receiverSocket.bind(port);

    this.receiverSocket.on('error', () => {
      throw new Error("Error binding receiver socket");
    })

    process.on('SIGINT', () => {
      this.debug("\nClosing sockets");
      this.stop();
      process.exit();
    })
  }

  public stop() {
    try {
      this.receiverSocket.close();
    } catch { }
  }

  private socketReady() {
    if (!this.senderSocketReady) return;
    if (!this.receiverSocketReady) return;

    this.checkRegistration();
    this.processQueue();
  }

  private checkRegistration() {
    this.debug("Checking registration");
    this.send("@H", (transaction: LightwaveTransaction | null, error: Error) => {
      if (error) {
        this.debug('Error: %o', error);
      }

      this.debug(transaction);
      this.emit('ready');
    });
  }

  public send(message: (string | Buffer), callback: (transaction: LightwaveTransaction | null, error: Error) => void) {
    const transaction = Math.round(Math.random() * Math.pow(10, 8));
    const messageWithTransaction = `${transaction},!${message}`;
    const transactionDebug = this.debug.extend("transaction:" + transaction);

    this.transactionListeners.set(transaction, {
      message: message,
      debug: transactionDebug,
      delay: this.delay,
      callback: callback
    })

    this.debug("Queueing message: %s", messageWithTransaction);

    this.commandQueue.add(<LightwaveTransaction>{
      id: transaction,
      message: messageWithTransaction,
      debug: transactionDebug,
      callback
    });

    this.processQueue();
  }

  private async processQueue() {
    if (this.commandQueue.busy) {
      setTimeout(this.processQueue.bind(this), this.delay);
      return
    };

    const command = this.commandQueue.receive();
    if (!command) return;

    this.commandQueue.busy = true;
    const transactionListener = this.transactionListeners.get(command.id);
    const originalCallback = transactionListener.callback;

    transactionListener.callback = (transaction: LightwaveTransaction, error: Error) => {
      this.commandQueue.busy = false;
      setTimeout(this.processQueue.bind(this), this.delay);
      originalCallback(transaction, error);
    }

    setTimeout(() => {
      const listener = this.transactionListeners.get(command.id);
      if (!listener) return;

      originalCallback(null, new Error("Execution expired"));
      this.transactionListeners.delete(command.id);
      this.processQueue();
    }, 5000)


    const transactionDebug = this.debug.extend(`transaction:${command?.id}`);
    transactionDebug("Starting new transaction");
    this.exec(command!.message, (message: LightwaveTransaction | null, error: Error) => { });
  }

  private exec(message: (Buffer | string | undefined), callback: (message: LightwaveTransaction | null, error: Error) => void) {
    if (message === undefined) return;

    this.debug("Sending message: %s to %s on port %d", message, this.ip, 9760);
    this.senderSocket.setBroadcast(this.ip === "255.255.255.255");
    this.senderSocket.send(message, 9760, this.ip, (error: Error | null, bytes: number) => {
      if (error) {
        this.debug("Message send errror: %o", error);
      }
      this.debug("Message sent: %s, length: %d", message, bytes);
    })
  }

  private processRawMessage(message: Buffer, remoteInfo: dgram.RemoteInfo) {
    this.debug("Message has come through from %o", remoteInfo);
    this.debug("Message received: %o", message.toString('ascii'));

    for (const messageProcessor of this.messageProcessors) {
      if (messageProcessor.canProcess(message)) {
        this.debug("Message can be processed by %s", messageProcessor.constructor.name);
        const lightwaveMessage = messageProcessor.process(message);
        this.processLightwaveMessage(lightwaveMessage);
        return;
      }
    }

    throw "Message cannot be processed";
  }

  processLightwaveMessage(lightwaveMessage: any) {
    this.debug("Processing lightwave message: %o", lightwaveMessage);
    this.debug("Current listeners: %o", this.transactionListeners);

    this.debug("Link response fn", lightwaveMessage.fn)
    if (lightwaveMessage.fn === "on") {
      this.emit("deviceTurnedOn", lightwaveMessage.room, lightwaveMessage.dev);
    }

    if (lightwaveMessage.fn === "off") {
      this.emit("deviceTurnedOff", lightwaveMessage.room, lightwaveMessage.dev);
    }

    if (lightwaveMessage.fn === "dim") {
      this.emit("deviceDimmed", lightwaveMessage.room, lightwaveMessage.dev, Math.round(lightwaveMessage.param / 32 * 100));
    }

    const listener = this.transactionListeners.get(lightwaveMessage.id);
    if (!listener) return;


    if (lightwaveMessage.error?.match(/^ERR,6,/)) {
      listener.delay = listener.delay * 2;
      const msg = `${lightwaveMessage.id},!${listener.message}`
      this.debug("message errorred, retrying: %o, %o with delay: %o", msg, listener, listener.delay);
      setTimeout(() => {
        this.exec(msg, (message: LightwaveTransaction | null, error: Error) => {
          this.debug("message: %o, error: %o", message, error)
        });
      }, Math.round(listener.delay));
      return;
    }

    if (listener) {
      listener.debug("Found transaction listener");
      listener.callback(lightwaveMessage, null);
      listener.debug("Transaction completed, removing listener");
      this.transactionListeners.delete(lightwaveMessage.id);
      this.commandQueue.busy = false;
    } else {
      this.debug("Listener not found for message: %o", lightwaveMessage)
    }

  }
}
