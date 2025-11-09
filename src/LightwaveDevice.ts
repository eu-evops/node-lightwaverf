import debug from "debug";

export interface ILightwaveDevice {
  roomId: number;
  deviceId: number;
  roomName: string;
  deviceName: string;
  deviceType: string;
}

export enum LightwaveDeviceType {
  Dimmer = "D",
  OnOff = "O",
}

export class LightwaveDevice implements ILightwaveDevice {
  roomId: number;
  deviceId: number;
  roomName: string;
  deviceName: string;
  deviceType: LightwaveDeviceType;
  debug: debug.Debugger;

  constructor(
    debug: debug.Debugger,
    roomId: number,
    deviceId: number,
    roomName: string,
    deviceName: string,
    deviceType: LightwaveDeviceType
  ) {
    this.debug = debug.extend(deviceName);
    this.roomId = roomId;
    this.deviceId = deviceId;
    this.roomName = roomName;
    this.deviceName = deviceName;
    this.deviceType = deviceType;
  }
}
