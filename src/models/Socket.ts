import makeWASocket, {
  Browsers,
  UserFacingSocketConfig,
  WASocket,
} from "baileys";
import { pino } from "pino";
import { UseAuthState } from "../adapters/UseAuthState";
import { getWhatsappSocketVersion } from "../utils/global";

export class Socket {
  sessionId: string;
  socketOptions: Partial<UserFacingSocketConfig>;
  logger = pino({ level: "fatal" });
  socketInstance: WASocket | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.socketOptions = {
      browser: Browsers.macOS("Desktop"),
      logger: this.logger,
      syncFullHistory: false,
      linkPreviewImageThumbnailWidth: 800,
      printQRInTerminal: true,
    };
  }

  getSocket(): WASocket {
    if (!this.socketInstance) {
      throw new Error("Socket not initialized. Call `initialize` first.");
    }
    return this.socketInstance;
  }

  async start() {
    const useAuthState = new UseAuthState({
      logger: this.logger,
      sessionId: this.sessionId,
    });
    await useAuthState.init();
    const authState = await useAuthState.get();
    this.socketInstance = makeWASocket({
      ...this.socketOptions,
      auth: {
        creds: authState.state.creds,
        keys: authState.state.keys,
      },
      version: await getWhatsappSocketVersion(),
    });
    this.socketInstance.ev.on("creds.update", authState.saveState);
  }
}
