import type { Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { WebSocket } from "ws";

import { ethers } from "ethers";
import { EventEmitter } from "node:events";

const WS_KEEP_ALIVE_CHECK_INTERVAL = 30_000; // 30 seconds
const WS_EXPECTED_PONG_BACK = 15_000; // 15 seconds
const WS_RECONNECTION_DELAY = 2000; // 2 seconds
const WS_MAX_RECONNECTION_ATTEMPTS = 5; // Retry 5 times

export abstract class BesuService implements OnModuleDestroy, OnModuleInit {
  protected readonly logger: Logger;

  private readonly eventEmitter: EventEmitter<{ connect: []; disconnect: [] }>;

  private isConnected: boolean;

  private keepAliveInterval: NodeJS.Timeout | undefined;

  private pingTimeout: NodeJS.Timeout | undefined;

  private provider:
    | ethers.JsonRpcProvider
    | ethers.WebSocketProvider
    | undefined;

  private reconnectionAttempts: number;

  private reconnectWebSocket = true;

  private readonly requestTimeout: number;

  private readonly url: string;

  constructor(url: string, requestTimeout: number, logger: Logger) {
    this.url = url;
    this.isConnected = false;
    this.logger = logger;
    this.reconnectionAttempts = 0;
    this.reconnectWebSocket = true;
    this.requestTimeout = requestTimeout;

    // eslint-disable-next-line unicorn/prefer-event-target
    this.eventEmitter = new EventEmitter();

    this.eventEmitter.on("connect", () => {
      this.isConnected = true;
    });

    this.eventEmitter.on("disconnect", () => {
      this.isConnected = false;
    });
  }

  getProvider() {
    if (!this.provider || !this.isConnected) {
      throw new Error("Currently not connected to Besu.");
    }

    return this.provider;
  }

  async onModuleDestroy() {
    this.logger.log("Destroying BesuService");

    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    if (this.pingTimeout) clearTimeout(this.pingTimeout);

    this.eventEmitter.removeAllListeners();

    if (this.provider instanceof ethers.WebSocketProvider) {
      this.reconnectWebSocket = false;
      await this.provider.destroy();
    }
  }

  async onModuleInit() {
    await new Promise<void>((resolve) => {
      this.eventEmitter.once("connect", resolve);

      // Connect to Besu on startup
      // This ensures that Besu is up and running before the app starts
      this.connect();
    });
  }

  private connect() {
    if (this.url.startsWith("http")) {
      this.setupJsonRpcProvider();
      return;
    }

    this.setupWebSocketProvider();
  }

  private setupJsonRpcProvider() {
    const { origin, password, pathname, username } = new URL(this.url);

    const fetchRequest = new ethers.FetchRequest(`${origin}${pathname}`);
    fetchRequest.timeout = this.requestTimeout;

    if (username && password) {
      fetchRequest.setCredentials(username, password);
    }

    this.provider = new ethers.JsonRpcProvider(fetchRequest, undefined, {
      staticNetwork: true,
    });

    this.eventEmitter.emit("connect");
  }

  private setupWebSocketProvider() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    if (this.pingTimeout) clearTimeout(this.pingTimeout);

    this.provider = new ethers.WebSocketProvider(this.url, undefined, {
      staticNetwork: true,
    });

    const websocket = this.provider.websocket as WebSocket;

    websocket.on("open", () => {
      this.logger.log("WebSocket connection opened");

      this.reconnectionAttempts = 0;
      this.eventEmitter.emit("connect");

      this.keepAliveInterval = setInterval(() => {
        websocket.ping();
        this.pingTimeout = setTimeout(
          () => websocket.terminate(),
          WS_EXPECTED_PONG_BACK,
        );
      }, WS_KEEP_ALIVE_CHECK_INTERVAL);
    });

    websocket.on("close", (code) => {
      this.logger.error(
        `The WebSocket connection was closed for ${this.url}. Code: ${code}`,
      );

      this.eventEmitter.emit("disconnect");

      if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
      if (this.pingTimeout) clearTimeout(this.pingTimeout);

      if (this.reconnectWebSocket) {
        this.reconnectionAttempts++;

        if (this.reconnectionAttempts > WS_MAX_RECONNECTION_ATTEMPTS) {
          this.logger.error(
            `Max reconnection attempts (${WS_MAX_RECONNECTION_ATTEMPTS}) reached for ${this.url}. Stopping reconnection.`,
          );

          this.reconnectWebSocket = false;

          // Stop the process
          process.kill(process.pid, "SIGINT");

          return;
        }

        // Do not delay the first reconnection attempt
        const delay = this.reconnectionAttempts > 1 ? WS_RECONNECTION_DELAY : 0;
        this.logger.log(
          `Attempting to reconnect in ${delay.toString()}ms... (attempt ${this.reconnectionAttempts})`,
        );

        setTimeout(() => {
          this.setupWebSocketProvider();
        }, delay);
      }
    });

    websocket.on("error", (e) => {
      this.logger.error(`WebSocket error for ${this.url}:`);
      this.logger.error(e);
    });

    websocket.on("pong", () => {
      this.logger.debug("Received pong, connection is alive");
      if (this.pingTimeout) clearInterval(this.pingTimeout);
    });
  }
}
