import Debug from 'debug';
import { LightwaveRFClient } from './LightwaveRFClient';

export interface LightwaveRFDeviceInterface {
  roomId: number
  deviceId: number
  roomName: string
  deviceName: string
  deviceType: string
}

export enum LightwaveDeviceType {
  Dimmer = "D",
  OnOff = "O",
}

export class LightwaveDevice implements LightwaveRFDeviceInterface {
  roomId: number;
  deviceId: number;
  roomName: string;
  deviceName: string;
  deviceType: LightwaveDeviceType;
  client: LightwaveRFClient;
  debug: Debug.Debugger;

  constructor(client: LightwaveRFClient, debug: debug.Debugger, roomId: number, deviceId: number, roomName: string, deviceName: string, deviceType: LightwaveDeviceType) {
    this.client = client;
    this.debug = debug.extend(deviceName);
    this.roomId = roomId;
    this.deviceId = deviceId;
    this.roomName = roomName;
    this.deviceName = deviceName;
    this.deviceType = deviceType;
  }

  async turnOn(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.debug("Device turning on");
      this.client.send(`R${this.roomId}D${this.deviceId}F1`, (message, error) => {
        resolve();
      });
    });
  }

  async turnOff(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.debug("Device turning off");
      this.client.send(`R${this.roomId}D${this.deviceId}F0`, (message, error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  async dim(percentage: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.debug("Device dimming to %d", percentage);

      const lwDim = Math.round(percentage * 0.32);
      this.client.send(`R${this.roomId}D${this.deviceId}FdP${lwDim}`, (message, error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }
}
