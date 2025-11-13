import debug from "debug";
import { EventEmitter } from "events";
import { LightwaveAccount } from "./LightwaveAccount";
import { ILightwaveDevice, LightwaveDevice } from "./LightwaveDevice";
import { LightwaveRFClient } from "./LightwaveRFClient";

export { LightwaveDeviceType } from "./LightwaveDevice";
export { type ILightwaveDevice };

class LightwaveRFConfiguration {
  timeout?: number = 1000;
  ip?: string;
  file?: any;
  host?: any;
  email?: any;
  pin?: any;
  linkDisplayUpdates?: boolean;
}

declare interface ILightwaveRF {
  on(
    event: "deviceTurnedOn",
    listener: (roomId: number, deviceId: number) => void
  ): this;
  on(
    event: "deviceTurnedOff",
    listener: (roomId: number, deviceId: number) => void
  ): this;
  on(
    event: "deviceDimmed",
    listener: (roomId: number, deviceId: number, percentage: number) => void
  ): this;
}

interface LightwaveEvents {
  deviceTurnedOn: [number, number];
  deviceTurnedOff: [number, number];
  deviceDimmed: [number, number, number];
}

/** * LightwaveRF API
 *
 * @param object config The config
 *
 * An instance of the LightwaveRF API
 */
export default class LightwaveRF
  extends EventEmitter<LightwaveEvents>
  implements ILightwaveRF
{
  timeout: number = 1000;
  queue: any = [];
  ready = true;
  awaitRegistrration = false;
  currentTransactionNumber: number = 4674773;
  devices: Array<LightwaveDevice> = [];
  messageCounter = 0;
  config: LightwaveRFConfiguration = {};
  responseListeners = new Map<number, any>();
  lwClient: LightwaveRFClient;
  lwAccount: LightwaveAccount;
  debug: debug.Debugger;
  private linkDisplayUpdates: boolean;

  constructor({
    email,
    pin,
    ip,
    timeout,
    linkDisplayUpdates = true,
  }: LightwaveRFConfiguration) {
    super();
    this.setMaxListeners(255);
    this.debug = debug("lightwave");
    this.linkDisplayUpdates = linkDisplayUpdates;

    this.debug("Initialising LightwaveRF Client");

    this.lwClient = new LightwaveRFClient(this.debug, ip);
    this.lwClient.once("ready", () => {
      this.debug("LightwaveRF ready");
    });

    this.lwAccount = new LightwaveAccount(this.debug, email, pin);

    this.timeout = timeout || 1000;
    this.devices = [];

    const self = this;

    this.lwClient.on(
      "deviceTurnedOn",
      function (roomId: number, deviceId: number) {
        self.emit("deviceTurnedOn", roomId, deviceId);
      }
    );
    this.lwClient.on(
      "deviceTurnedOff",
      function (roomId: number, deviceId: number) {
        self.emit("deviceTurnedOff", roomId, deviceId);
      }
    );
    this.lwClient.on(
      "deviceDimmed",
      function (roomId: number, deviceId: number, percentage: number) {
        self.emit("deviceDimmed", roomId, deviceId, percentage);
      }
    );
  }

  get serial() {
    return this.lwClient.serial;
  }

  get mac() {
    return this.lwClient.mac;
  }

  get uptime() {
    return this.lwClient.uptime;
  }

  get model() {
    return this.lwClient.model;
  }

  get version() {
    return this.lwClient.version;
  }

  async getDevices() {
    return new Promise<LightwaveDevice[]>((resolve, reject) =>
      this.lwAccount.getConfiguration((devices, error) => {
        if (error) return reject(error);
        resolve(devices);
      })
    );
  }

  async turnOn({ roomId, deviceId, roomName, deviceName }: ILightwaveDevice) {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const linkDisplayUpdate = this.linkDisplayUpdates
      ? `|${roomName} ${deviceName}|Turn on|`
      : "";

    this.lwClient.send(
      `!F1R${roomId}D${deviceId}${linkDisplayUpdate}`,
      (_, error) => {
        if (error) return reject(error);
        resolve();
      }
    );

    return promise;
  }

  async turnOff({ roomId, deviceId, roomName, deviceName }: ILightwaveDevice) {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const linkDisplayUpdate = this.linkDisplayUpdates
      ? `|${roomName} ${deviceName}|Turn off|`
      : "";

    this.lwClient.send(
      `!F0R${roomId}D${deviceId}${linkDisplayUpdate}`,
      (_, error) => {
        if (error) return reject(error);
        resolve();
      }
    );

    return promise;
  }

  async dim(
    { roomId, deviceId, roomName, deviceName }: ILightwaveDevice,
    percentage: number
  ) {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const lwDim = Math.round(percentage * 0.32);

    const linkDisplayUpdate = this.linkDisplayUpdates
      ? `|${roomName} ${deviceName}|Dim to ${percentage}%|`
      : "";

    this.lwClient.send(
      `!FdP${lwDim}R${roomId}D${deviceId}${linkDisplayUpdate}`,
      (_, error) => {
        if (error) return reject(error);
        resolve();
      }
    );

    return promise;
  }

  async connect() {
    return this.lwClient.connect();
  }

  async isRegistered() {
    return new Promise<boolean>((resolve) => {
      const user = process.env.USER;
      this.lwClient.send(`@H|Check registration|user:${user}|`, (response) => {
        return resolve(!response?.error);
      });
    });
  }

  async ensureRegistration() {
    return new Promise<void>((resolve) => {
      const user = process.env.USER;
      this.lwClient.send(`@H|Check registration|user:${user}|`, (response) => {
        if (!response?.error) {
          return resolve();
        }

        this.debug("We are not registered with the hub");
        this.lwClient.send("!F*p");
      });

      this.lwClient.on("registered", resolve);
    });
  }
}
