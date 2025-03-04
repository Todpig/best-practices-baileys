import { Worker } from "worker_threads";
import { resolve } from "path";

export class SessionService {
  private sessions: Map<string, Worker> = new Map<string, Worker>();

  constructor() {}

  private haveSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  private createWorker(sessionId: string): Worker {
    const workerPath = resolve(__dirname, "../workers/worker.js");
    const worker = new Worker(workerPath, {
      workerData: { sessionId },
    });
    worker.on("error", (err) => {});
    worker.on("exit", (code) => {
      this.sessions.delete(sessionId);
    });
    this.sessions.set(sessionId, worker);
    return worker;
  }

  private startSession(
    sessionId: string
  ): Promise<{ qrcode: string; status: "open" | "close" | "pending" }> {
    const worker = this.createWorker(sessionId);
    return new Promise((resolve, reject) => {
      worker.postMessage({
        type: "start",
        data: { sessionId: sessionId },
      });
      worker.on("message", (message) => {
        if (message.type === "error" || message.type === "delete")
          this.sessions.delete(sessionId);
        resolve(message.data);
      });
      worker.on("error", (error) => reject(error));
    });
  }

  async createSession(userSession: any): Promise<any> {
    try {
      if (this.haveSession(userSession.sessionId))
        return { error: "Sessão já existe" };
      return await this.startSession(userSession.sessionId);
    } catch (error: any) {}
  }

  async sendText(){}
}
