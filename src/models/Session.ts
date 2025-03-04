import { DisconnectReason, WASocket } from "baileys";
import { Boom } from "@hapi/boom";
import { Socket } from "./Socket";

interface SessionConnectionProps {
  socket: WASocket;
  qrcode: string;
  status: "open" | "close" | "pending";
}

export class Session {
  id: string;
  socket: Socket;
  waSocket: WASocket | null = null;
  isConnected: boolean;
  chats: any[] = [];

  constructor(id: string) {
    this.id = id;
    this.socket = new Socket(id);
    this.isConnected = false;
  }

  getWASocket() {
    return this.socket.getSocket();
  }

  async connect(): Promise<SessionConnectionProps> {
    await this.socket.start();
    this.waSocket = this.socket.getSocket();
    return new Promise((resolve, reject) => {
      this.waSocket!.ev.on("connection.update", async (update) => {
        const statusCode = (update.lastDisconnect?.error as Boom)?.output
          ?.statusCode;
        const { connection, qr } = update;
        if (connection === "open") {
          this.isConnected = true;
          return resolve({
            qrcode: "",
            socket: this.waSocket!,
            status: "open",
          });
        }
        if (connection === "close") {
          if (DisconnectReason.restartRequired == statusCode)
            return this.connect();
          resolve({
            socket: this.waSocket!,
            qrcode: "",
            status: "close",
          });
        }
        if (qr && this.id) {
          setTimeout(() => {
            if (!this.isConnected) console.log("Vou deletar");
          }, 50 * 1000);
          resolve({
            socket: this.waSocket!,
            qrcode: qr,
            status: "pending",
          });
        }
      });
      this.waSocket!.ev.on("messaging-history.set", async ({ contacts }) => {
        this.chats = contacts.map((contact) => {
          return { id: contact.id, name: contact.name || "Desconhecido" };
        });
      });
      this.waSocket!.ev.on("contacts.upsert", async (contacts) => {});
    });
  }
}
