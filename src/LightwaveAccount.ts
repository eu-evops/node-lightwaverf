import Debug, { Debugger } from "debug";
import { LightwaveDevice, LightwaveDeviceType } from "./LightwaveDevice";

export class LightwaveAccount {
  debug: Debug.Debugger;
  email: string;
  pin: string;
  mainDebug: Debug.Debugger;

  constructor(debug: Debugger, email: string, pin: string) {
    if (!email || !pin) {
      throw "No email or pin specified. The server configuration (rooms, devices, etc.) cannot be obtained";
    }
    this.mainDebug = debug;
    this.debug = debug.extend("account");
    this.email = email;
    this.pin = pin;
  }

  async getConfiguration(
    callback?: (devices: LightwaveDevice[], error: any) => void
  ) {
    this.debug("Getting rooms from LightWave");
    var self = this;
    var host = "https://control-api.lightwaverf.com";

    function assertResponse(response: Response) {
      if (!response.ok) {
        throw new Error("Network response was not ok: " + response.statusText);
      }
      return response.json();
    }

    let token: string = "";
    try {
      this.debug("Fetching token from LightWave", {
        url: host + "/v1/user?password=****&username=****",
      });
      const userResponse = await fetch(
        host + "/v1/user?password=" + this.pin + "&username=" + this.email
      );
      this.debug("User response: %O", userResponse);
      const userData = await assertResponse(userResponse);
      const authResponse = await fetch(
        host + "/v1/auth?application_key=" + userData.application_key
      );
      const authData = await assertResponse(authResponse);
      token = authData.token;

      const deviceTypeResponse = await fetch(
        host + "/v1/device_type?nested=1",
        {
          headers: {
            "X-LWRF-token": token,
            "X-LWRF-platform": "ios",
            "X-LWRF-skin": "lightwaverf",
          },
        }
      );
      const something = await assertResponse(deviceTypeResponse);

      const userProfileResponse = await fetch(
        host + "/v1/user_profile?nested=1",
        {
          headers: {
            "X-LWRF-token": token,
            "X-LWRF-platform": "ios",
            "X-LWRF-skin": "lightwaverf",
          },
        }
      );
      const userProfileData = await assertResponse(userProfileResponse);
      return self.parseRooms(userProfileData, callback);
    } catch (error) {
      this.debug("Error fetching configuration: %O", error);
      if (!callback) {
        throw error;
      }

      callback([], error as Error);
    }
  }

  parseRooms(
    lightwaveResponse: any,
    callback?: (devices: LightwaveDevice[], error: Error | null) => void
  ) {
    this.debug(
      "Parsing lightwaveResponse: ",
      lightwaveResponse.content.estates[0].locations[0].zones[0].rooms[0]
        .devices
    );

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
      var deviceTypeMapping: Map<number, LightwaveDeviceType> = new Map<
        number,
        LightwaveDeviceType
      >();
      deviceTypeMapping.set(1, LightwaveDeviceType.OnOff);
      deviceTypeMapping.set(2, LightwaveDeviceType.Dimmer);
      deviceTypeMapping.set(3, LightwaveDeviceType.OnOff);

      for (var j = 0; j < r.devices.length; j++) {
        var d = r.devices[j];

        const device = new LightwaveDevice(
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

    if (!callback) {
      return devices;
    }

    callback(devices, null);
  }
}
