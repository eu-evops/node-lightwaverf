import { describe, expect, it } from "vitest";
import LightwaveRF from ".";

const integratioTest = process.env.INTEGRATION ? describe : describe.skip;

integratioTest("integration", () => {
  it("should correctly connect to LightwaveRF cloud", async () => {
    const client = new LightwaveRF({
      email: process.env.LIGHTWAVERF_EMAIL,
      pin: process.env.LIGHTWAVERF_PIN,
    });

    const devices = await client.getDevices();
    expect(devices).toBeDefined();
  });
});
