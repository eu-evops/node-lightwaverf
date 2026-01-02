import fetchVCR from "fetch-vcr";
import { afterEach, beforeAll, describe, it } from "vitest";
import LightwaveRF from ".";

describe("LightwaveRF", () => {
  let lw: LightwaveRF;

  beforeAll(() => {
    fetchVCR.configure({
      fixturePath: __dirname + "/.fixtures",
      mode: "playback",
    });
    global.fetch = fetchVCR as typeof global.fetch;
  });

  afterEach(async () => {
    await lw.lwClient.disconnect();
  });

  it("should allow device linking", async () => {
    lw = new LightwaveRF({
      email: "some@user.com",
      pin: "1234",
    });

    // const devices = await lw.getDevices();
    await lw.connect();
    await lw.ensureRegistration();
    await lw.lwClient.disconnect();
  });

  it("should turn device on", async () => {
    lw = new LightwaveRF({
      email: "some@user.com",
      pin: "1234",
      // Disabling link display updates as they cause buffer issues in the link
      // device
      linkDisplayUpdates: true,
    });

    // const devices = await lw.getDevices();
    await lw.connect();
    // await lw.ensureRegistration();
    const devices = await lw.getDevices();
    const roomToInteractWith = "TV Room";
    const lightToInteractWith = "Lights";

    const light = devices?.find((d) => {
      return (
        d.roomName === roomToInteractWith &&
        d.deviceName === lightToInteractWith
      );
    });

    if (!light) {
      throw new Error(`Could not find ${lightToInteractWith} in the config`);
    }

    for (let i = 0; i < 5; i++) {
      console.debug("Turning device on and off", i);
      await lw.turnOn(light);
      await lw.turnOff(light);
    }
  }, 30000);
});
