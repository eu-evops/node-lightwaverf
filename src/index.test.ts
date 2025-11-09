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
  });

  it("should turn device on", async () => {
    const lw = new LightwaveRF({
      email: "some@user.com",
      pin: "1234",
    });

    // const devices = await lw.getDevices();
    await lw.connect();
    // await lw.ensureRegistration();
    const devices = await lw.getDevices();

    const wallLamps = devices?.find((d) => {
      return d.deviceName === "Wall lamps";
    });

    if (!wallLamps) {
      throw new Error("Could not find wall lamps in the config");
    }

    lw.turnOff(wallLamps);
  });
});
