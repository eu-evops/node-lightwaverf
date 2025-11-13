import fetchVCR from "fetch-vcr";
import { beforeAll, describe, it } from "vitest";
import LightwaveRF from ".";

describe("LightwaveRF", () => {
  beforeAll(() => {
    fetchVCR.configure({
      fixturePath: __dirname + "/.fixtures",
      mode: "playback",
    });
    global.fetch = fetchVCR as typeof global.fetch;
  });

  it("should allow device linking", async () => {
    const lw = new LightwaveRF({
      email: "some@user.com",
      pin: "1234",
    });

    // const devices = await lw.getDevices();
    await lw.connect();
    await lw.ensureRegistration();
    await lw.lwClient.disconnect();
  });

  it("should turn device on", async () => {
    const lw = new LightwaveRF({
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

    const wallLamps = devices?.find((d) => {
      return d.deviceName === "Table lamp";
    });

    if (!wallLamps) {
      throw new Error("Could not find table lamp in the config");
    }

    for (let i = 0; i < 5; i++) {
      console.debug("Turning device on and off", i);
      await lw.turnOn(wallLamps);
      await lw.turnOff(wallLamps);
    }

    await lw.lwClient.disconnect();
  }, 30000);
});
