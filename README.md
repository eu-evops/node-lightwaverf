# @evops/lightwaverf

> A modern TypeScript client library for controlling LightwaveRF home automation devices

[![npm version](https://img.shields.io/npm/v/@evops/lightwaverf.svg)](https://www.npmjs.com/package/@evops/lightwaverf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Control your LightwaveRF smart lights, switches, and dimmers from Node.js with a clean, type-safe API. This library communicates with LightwaveRF Link Plus devices over your local network and integrates with the LightwaveRF cloud API for device configuration.

## Features

- 🎯 **Type-Safe** - Full TypeScript support with strict type checking
- 🔌 **Event-Driven** - Real-time device state change notifications
- 🔄 **Automatic Device Discovery** - Finds LightwaveRF Link devices on your network
- 🔐 **Registration Management** - Handles device pairing automatically
- ⚡ **Command Queueing** - Built-in queue prevents command collisions
- 🔁 **Retry Logic** - Automatic retry with exponential backoff on errors
- 🐛 **Debug Logging** - Comprehensive debug output via `debug` module
- ☁️ **Cloud Integration** - Fetches device configuration from LightwaveRF cloud
- ✅ **Well Tested** - Comprehensive test suite with Vitest

## Installation

```bash
npm install @evops/lightwaverf
```

## Quick Start

```typescript
import LightwaveRF from '@evops/lightwaverf';

// Initialize the client
const lw = new LightwaveRF({
  email: 'your-email@example.com',
  pin: '1234',
  ip: '192.168.1.100' // Optional: Link IP (auto-discovered if omitted)
});

// Connect and ensure registration
await lw.connect();
await lw.ensureRegistration();

// Get all your devices
const devices = await lw.getDevices();
console.log('Found devices:', devices);

// Control a device
const myLight = devices.find(d => d.deviceName === 'Living Room Light');
await lw.turnOn(myLight);
await lw.dim(myLight, 50); // Set to 50% brightness
await lw.turnOff(myLight);
```

## API Reference

### Constructor

```typescript
new LightwaveRF(config: LightwaveRFConfiguration)
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `email` | `string` | - | Your LightwaveRF account email |
| `pin` | `string` | - | Your LightwaveRF account PIN |
| `ip` | `string` | `255.255.255.255` | Link device IP (defaults to broadcast for auto-discovery) |
| `timeout` | `number` | `1000` | Command timeout in milliseconds |

### Methods

#### Device Control

##### `turnOn(device: ILightwaveDevice): Promise<void>`

Turns a device on.

```typescript
await lw.turnOn({ roomId: 1, deviceId: 1, roomName: 'Living Room', deviceName: 'Light' });
```

##### `turnOff(device: ILightwaveDevice): Promise<void>`

Turns a device off.

```typescript
await lw.turnOff(myLight);
```

##### `dim(device: ILightwaveDevice, percentage: number): Promise<void>`

Dims a device to the specified percentage (0-100).

```typescript
await lw.dim(myLight, 75); // Set to 75% brightness
```

#### Device Management

##### `getDevices(): Promise<LightwaveDevice[]>`

Retrieves all devices from your LightwaveRF cloud account.

```typescript
const devices = await lw.getDevices();
devices.forEach(device => {
  console.log(`${device.roomName} - ${device.deviceName} (${device.deviceType})`);
});
```

#### Connection & Registration

##### `connect(): Promise<void>`

Connects to the LightwaveRF Link device on your local network.

```typescript
await lw.connect();
```

##### `isRegistered(): Promise<boolean>`

Checks if the client is registered with the Link device.

```typescript
const registered = await lw.isRegistered();
if (!registered) {
  console.log('Please press the button on your Link device to register');
}
```

##### `ensureRegistration(): Promise<void>`

Ensures the client is registered with the Link. If not registered, enters pairing mode. You'll need to press the pairing button on your Link device.

```typescript
await lw.ensureRegistration();
```

#### Device Information (Read-only Properties)

```typescript
console.log('Serial:', lw.serial);
console.log('MAC Address:', lw.mac);
console.log('Uptime:', lw.uptime);
console.log('Model:', lw.model);
console.log('Firmware Version:', lw.version);
```

### Events

The client extends `EventEmitter` and emits the following events:

#### `deviceTurnedOn`

Emitted when a device is turned on (including via physical switches or other apps).

```typescript
lw.on('deviceTurnedOn', (roomId: number, deviceId: number) => {
  console.log(`Device ${deviceId} in room ${roomId} was turned on`);
});
```

#### `deviceTurnedOff`

Emitted when a device is turned off.

```typescript
lw.on('deviceTurnedOff', (roomId: number, deviceId: number) => {
  console.log(`Device ${deviceId} in room ${roomId} was turned off`);
});
```

#### `deviceDimmed`

Emitted when a device is dimmed to a specific level.

```typescript
lw.on('deviceDimmed', (roomId: number, deviceId: number, percentage: number) => {
  console.log(`Device ${deviceId} in room ${roomId} dimmed to ${percentage}%`);
});
```

### Types

#### `ILightwaveDevice`

```typescript
interface ILightwaveDevice {
  roomId: number;
  deviceId: number;
  roomName: string;
  deviceName: string;
  deviceType: string;
}
```

#### `LightwaveDeviceType`

```typescript
enum LightwaveDeviceType {
  Dimmer = "D",
  OnOff = "O"
}
```

#### `LightwaveDevice`

A class representing a physical LightwaveRF device. Returned by `getDevices()`.

```typescript
class LightwaveDevice {
  roomId: number;
  deviceId: number;
  roomName: string;
  deviceName: string;
  deviceType: LightwaveDeviceType;
}
```

## Examples

### Basic Device Control

```typescript
import LightwaveRF from '@evops/lightwaverf';

const lw = new LightwaveRF({
  email: 'your-email@example.com',
  pin: '1234'
});

await lw.connect();
await lw.ensureRegistration();

// Turn on all devices
const devices = await lw.getDevices();
for (const device of devices) {
  await lw.turnOn(device);
}
```

### Scene Control with Dimming

```typescript
// Create a movie night scene
async function movieNightScene(lw, devices) {
  const ceilingLight = devices.find(d => d.deviceName === 'Ceiling Light');
  const lampLeft = devices.find(d => d.deviceName === 'Lamp Left');
  const lampRight = devices.find(d => d.deviceName === 'Lamp Right');

  await lw.turnOff(ceilingLight);
  await lw.dim(lampLeft, 30);
  await lw.dim(lampRight, 30);
}

await movieNightScene(lw, await lw.getDevices());
```

### Event Monitoring

```typescript
// Monitor all device state changes
lw.on('deviceTurnedOn', (roomId, deviceId) => {
  console.log(`[ON]  Room ${roomId}, Device ${deviceId}`);
});

lw.on('deviceTurnedOff', (roomId, deviceId) => {
  console.log(`[OFF] Room ${roomId}, Device ${deviceId}`);
});

lw.on('deviceDimmed', (roomId, deviceId, percentage) => {
  console.log(`[DIM] Room ${roomId}, Device ${deviceId} -> ${percentage}%`);
});
```

### Control by Room and Device ID

If you already know your room and device IDs, you can control devices directly without fetching from the cloud:

```typescript
await lw.turnOn({
  roomId: 1,
  deviceId: 2,
  roomName: 'Living Room',
  deviceName: 'Light'
});
```

### Error Handling

```typescript
try {
  await lw.connect();
  await lw.ensureRegistration();

  const devices = await lw.getDevices();
  await lw.turnOn(devices[0]);
} catch (error) {
  console.error('Error controlling devices:', error);
}
```

### Enable Debug Logging

Use the `debug` module to see detailed logging:

```bash
DEBUG=lightwave* node your-script.js
```

This will show all UDP communication, command queue operations, and API calls.

## How It Works

### Architecture

1. **LightwaveRF Client (Main API)** - High-level interface for device control and management
2. **LightwaveRFClient** - Low-level UDP client handling communication with Link devices
3. **LightwaveAccount** - Cloud API integration for device configuration
4. **Message Processors** - Parse JSON and text protocol responses
5. **Queue System** - Manages command transactions and prevents conflicts

### Communication Protocol

The library communicates with LightwaveRF Link devices using:

- **Protocol**: UDP
- **Ports**: Sends on 9760, receives on 9761
- **Rate Limiting**: 125ms delay between commands
- **Transaction-Based**: Each command gets a unique transaction ID
- **Response Timeout**: 5 seconds (configurable)
- **Format**: Supports both JSON (`*!{...}`) and text responses

### Device Discovery

When no IP is specified (or `255.255.255.255` is used), the library broadcasts on the local network to automatically discover LightwaveRF Link devices.

## Requirements

- Node.js 14 or higher
- LightwaveRF Link or Link Plus device
- LightwaveRF account (for device configuration)
- Local network access to the Link device

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Link device

**Solution**:
- Ensure your Link device is powered on and connected to the same network
- Try specifying the Link IP address explicitly in the config
- Check your firewall allows UDP traffic on ports 9760/9761

### Registration Issues

**Problem**: `ensureRegistration()` hangs or fails

**Solution**:
- Press and release the pairing button on your Link device when prompted
- The Link button should flash during pairing mode
- Registration is usually required only once per client

### Device Control Not Working

**Problem**: Commands don't affect devices

**Solution**:
- Verify you're registered with `await lw.isRegistered()`
- Check device IDs match your actual device configuration
- Enable debug logging to see command/response details
- Ensure devices are paired with your Link in the LightwaveRF app

### Cloud API Issues

**Problem**: `getDevices()` fails

**Solution**:
- Verify your email and PIN are correct
- Check your internet connection (cloud API requires internet)
- Ensure you have devices configured in your LightwaveRF account

## Migration from 0.x to 1.0

Version 1.0 is a complete TypeScript rewrite with breaking changes. See [CHANGELOG.md](CHANGELOG.md) for details.

### Key Changes

- ✅ Public API remains compatible
- ⚠️ Output directory changed from `dist` to `.dist`
- ⚠️ Internal files renamed (only affects direct imports)
- ⚠️ CLI removed (use library API directly)
- ⚠️ Modern ES2024 output with strict TypeScript

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build TypeScript
npm run prepublish
```

## Testing

The library includes comprehensive tests using Vitest with HTTP request recording/replay:

```bash
npm test
```

Tests use `fetch-vcr` to record API interactions, making them fast and reliable.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

Originally based on [node-lightwaverf](https://github.com/ollieparsley/node-lightwaverf) by Ollie Parsley.

Rewritten and maintained by [Stanislaw Wozniak](https://github.com/eu-evos).

## Related Projects

- [LightwaveRF Official Website](https://lightwaverf.com/)
- [LightwaveRF API Documentation](https://api.lightwaverf.com/)

## Support

- Issues: [GitHub Issues](https://github.com/eu-evos/node-lightwaverf/issues)
- Email: Contact via GitHub

---

**Made with ⚡ by the community**
