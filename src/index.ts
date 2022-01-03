import { EventEmitter } from 'events';
import Debug from 'debug';
import { LightwaveRFClient } from './LightwaveRFClient';
import { LightwaveAccount } from './LightwaveAccount';
import { LightwaveDevice } from './LightwaveDevice';


class LightwaveRFConfiguration {
    timeout?: number = 1000;
    ip?: string;
    file?: any;
    host?: any;
    email?: any;
    pin?: any;
}

declare interface ILightwaveRF {
    on(event: 'deviceTurnedOn', listener: (roomId: number, deviceId: number) => void): this;
    on(event: 'deviceTurnedOff', listener: (roomId: number, deviceId: number) => void): this;
    on(event: 'deviceDimmed', listener: (roomId: number, deviceId: number, percentage: number) => void): this;
}

/** * LightwaveRF API
 *
 * @param object config The config
 *
 * An instance of the LightwaveRF API
 */
export default class LightwaveRF extends EventEmitter implements ILightwaveRF {
    timeout: number = 1000;
    queue: any = [];
    ready = true;
    awaitRegistrration = false;
    currentTransactionNumber: number = 4674773;
    devices: Array<LightwaveDevice> = [];
    messageCounter = 0;
    config: LightwaveRFConfiguration = {};
    responseListeners = new Map<number, any>();
    lwClient: LightwaveRFClient;
    debug: Debug.Debugger;

    constructor(config: LightwaveRFConfiguration, callback: (config: any, error: any) => void) {
        super();
        this.debug = Debug('lightwaverf');

        this.debug('Initialising LightwaveRF Client')
        this.lwClient = new LightwaveRFClient(this.debug, config.ip)
        this.lwClient.on('ready', () => {
            this.debug('LightwaveRF ready');
            this.initialiseConfiguration(callback);
        })

        this.timeout = config.timeout || 1000;

        this.devices = [];//[{roomId:0,roomName:'',
        //deviceId:0,deviceName:'',
        //deviceType:''}];

        //Config
        this.config = config;

        const self = this;

        this.lwClient.on('deviceTurnedOn', function () {
            self.emit('deviceTurnedOn', ...arguments);
        })
        this.lwClient.on('deviceTurnedOff', function () {
            self.emit('deviceTurnedOff', ...arguments);
        })
        this.lwClient.on('deviceDimmed', function () {
            self.emit('deviceDimmed', ...arguments);
        })

        //Receive message
        // this.receiveSocket.on("message", function (message: Buffer, rinfo: dgram.RemoteInfo) {
        //     // If we were using broadcast IP, we have now
        //     // discovered Link device IP and can switch off
        //     // broadcast
        //     if (self.config.ip == '255.255.255.255') {
        //         console.log("We have now discovered Link IP address: %s", rinfo.address);
        //         self.config.ip = rinfo.address
        //         self.sendSocket.setBroadcast(false)
        //     }

        //     //Check this came from the lightwave unit
        //     if (rinfo.address !== self.config.ip) {
        //         //Came from wrong ip]
        //         console.warn("Response came from a different IP than our configured", rinfo.address, self.config.ip)
        //         return false;
        //     }

        //     const parseResponse = (buffer: Buffer) => {
        //         const response: any = new Object();
        //         const message = buffer.toString('utf-8');
        //         if (message.match(/^\*!/)) {
        //             const jsonResponse = JSON.parse(message.replace(/^\*!/, ''))
        //             self.currentTransactionNumber = jsonResponse.trans + 1;
        //             Object.assign(response, jsonResponse)

        //             response.error = response.pkt === "error" ? response.fn : null;
        //         } else {
        //             //Split off the code for the message
        //             var parts = message.split(",");
        //             var trans = parts.splice(0, 1);
        //             var content = parts.join(",").replace(/(\r\n|\n|\r)/gm, "");
        //             response.trans = parseInt(trans[0]);
        //             response.message = content;
        //             response.error = content.match("^ERR") ? content : null;
        //         }

        //         response.trans = response.trans !== null ? parseInt(response.trans) : null;

        //         return response;
        //     }

        //     let linkResponse = parseResponse(message)
        //     debug(">>>>>>>> Received response msg: %s, response: %s, rinfo: %s", message, linkResponse, rinfo);
        //     if (linkResponse.error === "nonRegistered" && !self.awaitRegistrration) {
        //         console.warn("Your device is not registered, please accept registration on the Link devices")
        //         self.register(() => { });
        //     }

        //     if (linkResponse.msg === "success" && linkResponse.pairType) {
        //         self.awaitRegistrration = false;
        //     }



        //     debug(self.responseListeners);
        //     var responseListenerData = self.responseListeners.get(linkResponse.trans);
        //     if (!responseListenerData) {
        //         debug("We haven't got anyone to respond to, ignoring the message")
        //         return;
        //     }

        //     debug(`[Transaction: ${linkResponse.trans}] Processing time: ${new Date().getTime() - responseListenerData.time}`)

        //     responseListenerData.listener(
        //         linkResponse.error,
        //         linkResponse.fn,
        //     );

        //     self.responseListeners.delete(linkResponse.trans);
        // });

        // this.receiveSocket.on("listening", function () {
        //     var address = self.receiveSocket.address();
        //     debug("Receiver socket listening " + address.address + ":" + address.port);

        //     self.send('@H', (code, err) => {
        //         if (err) {
        //             console.log('code', code, 'error', err)
        //             return
        //         }

        //         self.initialiseConfiguration(callback);
        //     })
        // });

        // this.sendSocket.bind();

        // this.sendSocket.on('listening', () => {
        //     debug("Send socket is ready")
        //     debug("Setting up receiver socket")
        //     //Bind to the receive port
        //     self.receiveSocket.bind(9761);
        // })


        process.on('SIGINT', () => {
            this.stop();
            this.lwClient.stop();
        })
    }

    stop() {
        this.debug("Stopping server sockets")
    }

    initialiseConfiguration(callback: (config: any, error: string) => void) {
        //Check config
        const lwAccount = new LightwaveAccount(this.debug, this.lwClient, this.config.email, this.config.pin)
        lwAccount.getConfiguration(callback)
    }


    /**
     * Register this device with the Wi-Fi Link
     *
     * @param Function callback The callback function
     *
     * @return void
     */
    register(callback: any) {
        this.awaitRegistrration = true;
        this.sendUdp("!F*p", callback);
    }

    /**
     * Turn a device off
     *
     * @param integer  roomId   The room ID
     * @param integer  deviceId The device ID
     * @param Function callback The callback for if there are any errors
     *
     * @return void
     */
    turnDeviceOff(roomId: number, deviceId: number, callback?: any) {
        var state = "0";
        this.exec("!R" + roomId + "D" + deviceId + "F" + state + "|\0", callback);
    }

    /**
     * Turn a device on
     * 
     * @param integer  roomId   The room ID
     * @param integer  deviceId The device ID
     * @param Function callback The callback for if there are any errors
     *
     * @return void
     */
    turnDeviceOn(roomId: number, deviceId: number, callback?: any) {
        // this.devices.find(d => d.roomId == roomId && d.deviceId == deviceId)?.turnOn();
    }
    /**
     * Set the dim percentage of a device
     *
     * @param integer  roomId        The room ID
     * @param integer  deviceId      The device ID
     * @param integer  dimPercentage The percentage to set the device dim
     * @param Function callback      The callback for if there are any errors
     *
     * @return void
     */
    setDeviceDim(roomId: string, deviceId: string, dimPercentage: number, callback: any) {
        // var dimAmount = dimPercentage * 0.32; //Dim is on a scale from 0 to 32

        // if (dimAmount === 0) {
        //     this.turnDeviceOff(roomId, deviceId, callback);
        // } else {
        //     this.exec("!R" + roomId + "D" + deviceId + "FdP" + dimAmount + "|\0", callback);
        // }
    }

    /**
     * Get message code
     *
     * @return string
     */
    private getTransactionNumber(): number {
        return this.currentTransactionNumber;
    }


    private exec(...args: any[]) {
        // Check if the queue has a reasonable size
        if (this.queue.length > 100) {
            this.queue.pop();
        }

        this.debug("Ading to queue: " + args.join(" "));
        this.queue.push(args);
        this.process();
    };

    private send(cmd: string, callback: (code: any, err: any) => void) {
        this.sendUdp(cmd, callback);
        //if (callback) callback();
    };
    /**
     * Send a message over udp
     *
     * @param string   message  The message to send
     * @param Function callback The callback for if there are any errors
     *
     * @return void
     */
    private sendUdp(message: string, callback: any) {
        //Add to message
        const transactionNumber = this.getTransactionNumber();
        //Prepend code to message
        message = `${transactionNumber},${message}`;

        this.debug(`[${this.config.ip}][trans: ${transactionNumber}] Sending message: ${message}`);

        //Create buffer from message
        const messageBuffer = Buffer.from(message, 'utf-8');

        this.debug("Callback for message: " + message, callback);
        //Add listener
        if (callback) {
            this.debug("Registering call back with transaction number: " + transactionNumber);
            this.responseListeners.set(transactionNumber, {
                time: new Date().getTime(),
                listener: callback
            });

            this.debug(this.responseListeners)

            // Expire request, trigger retry
            setTimeout(() => {
                const listener = this.responseListeners.get(transactionNumber);
                if (listener) {
                    this.debug(`[Transaction $(transactionNumber)] The listener is still there, triggering error`);
                    this.responseListeners.delete(transactionNumber);
                    callback("ERR:EXPIRED", undefined);
                }
            }, 1000);
        }

        //Broadcast the message
        // this.sendSocket.send(messageBuffer, 0, messageBuffer.length, 9760, this.config.ip);
    }

    private process() {
        this.debug("Checking queue")
        if (this.queue.length === 0) return;
        if (!this.ready) return;
        var self = this;
        this.ready = false;
        this.debug("Processing queue...");
        this.debug("Items in the queue", this.queue.length);
        this.send.apply(this, this.queue.shift());
        setTimeout(function () {
            self.ready = true;
            self.process();
        }, this.timeout);
    };



}
