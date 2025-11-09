import debug from "debug";
import fetch from "fetch-vcr";
import { beforeEach, describe, expect, it } from "vitest";
import { LightwaveAccount } from "./LightwaveAccount";

describe("LightwaveAccount tests", () => {
  fetch.configure({
    fixturePath: __dirname + "/.fixtures",
    mode: "playback",
  });

  global.fetch = fetch as typeof global.fetch;

  beforeEach(() => {
    // Setup code if needed
    process.env.DEBUG = "lightwave*";
    debug.enable(process.env.DEBUG);
  });

  it("should parse configuration into rooms", async () => {
    const account = new LightwaveAccount(
      debug("lightwave-rf:test"),
      "some@user.com",
      "1234"
    );
    const devices = await account.getConfiguration();
    expect(devices?.length).toBe(20);
  });
});
