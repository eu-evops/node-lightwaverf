import Debug, { Debugger } from "debug";
import { RequestAPI, RequiredUriUrl } from "request";
import rp from "request-promise";
import { LightwaveDevice, LightwaveDeviceType } from "./LightwaveDevice";
import { LightwaveRFClient } from "./LightwaveRFClient";

export class LightwaveAccount {
  debug: Debug.Debugger;
  client: LightwaveRFClient;
  email: string;
  pin: string;
  mainDebug: Debug.Debugger;

  constructor(debug: Debugger, client: LightwaveRFClient, email: string, pin: string) {
    if (!email || !pin) {
      throw "No email or pin specified. The server configuration (rooms, devices, etc.) cannot be obtained";
    }
    this.mainDebug = debug;
    this.debug = debug.extend('account');
    this.client = client;
    this.email = email;
    this.pin = pin;
  }

  getConfiguration(callback: any) {
    this.debug('Getting rooms from LightWave');
    var self = this;
    var host = 'https://control-api.lightwaverf.com';
    var json = rp.defaults({
      json: true
    });

    var auth: RequestAPI<rp.RequestPromise<any>, rp.RequestPromiseOptions, RequiredUriUrl>, token;
    json.get(host + '/v1/user?password=' + this.pin + '&username=' + this.email)
      .then(function (res) {
        return json.get(host + '/v1/auth?application_key=' + res.application_key)
      })
      .then(function (res) {
        token = res.token;
        auth = json.defaults({
          headers: {
            'X-LWRF-token': token,
            'X-LWRF-platform': 'ios',
            'X-LWRF-skin': 'lightwaverf'
          }
        });

        return auth.get(host + '/v1/device_type?nested=1');
      })
      .then(function (res) {
        return auth.get(host + '/v1/user_profile?nested=1')
      })
      .then(function (res) {
        self.parseRooms(res, callback);
      });
  }


  parseRooms(lightwaveResponse: any, callback: (devices: LightwaveDevice[], error: Error | null) => void) {
    this.debug('Parsing lightwaveResponse: ',
      lightwaveResponse.content.estates[0].locations[0].zones[0].rooms[0].devices);

    const home = lightwaveResponse.content.estates[0].locations[0].zones[0];
    const devices = [];

    for (var i = 0; i < home.rooms.length; i++) {
      var r = home.rooms[i];

      this.debug("Room " + r.name + " with " + r.devices.length + " devices");

      // Get device types
      //   O: On/Off Switch
      //   D: Dimmer
      //   R: Radiator(s)
      //   P: Open/Close
      //   I: Inactive (i.e. not configured)
      //   m: Mood (inactive)
      //   M: Mood (active)
      //   o: All Off
      var deviceTypeMapping: Map<number, LightwaveDeviceType> = new Map<number, LightwaveDeviceType>();
      deviceTypeMapping.set(1, LightwaveDeviceType.OnOff);
      deviceTypeMapping.set(2, LightwaveDeviceType.Dimmer);
      deviceTypeMapping.set(3, LightwaveDeviceType.OnOff);

      for (var j = 0; j < r.devices.length; j++) {
        var d = r.devices[j];

        const device = new LightwaveDevice(
          this.client,
          this.mainDebug,
          r.room_number,
          d.device_number,
          r.name,
          d.name,
          deviceTypeMapping.get(d.device_type_id)!
        );

        devices.push(device);
      }
    }

    this.debug('Devices: %O', devices)

    callback(devices, null);
  };

}