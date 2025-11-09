import debug from "debug";
import { afterEach, beforeEach, describe, it } from "vitest";
import { LightwaveRFClient } from "./LightwaveRFClient";

describe("LightwaveRFClient tests", () => {
  let client: LightwaveRFClient;

  beforeEach(async () => {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const logger = debug("lightwave:test");
    logger("Starting LightwaveRFClient test");

    client = new LightwaveRFClient(logger);
    await client.connect();
  });

  afterEach(async () => {
    return client.disconnect();
  });

  it("should initialize correctly", async () => {
    process.stderr.write(process.env.DEBUG + "\n");
  });
});
