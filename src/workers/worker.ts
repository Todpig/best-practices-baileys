import { parentPort } from "worker_threads";
import { Session } from "../models/Session";
import { fakeTyping } from "../utils/global";
import { WASocket } from "baileys";

interface SignalActions {
  start: ({ sessionId }: any) => Promise<void>;
  sendText: ({ header, text }: any) => Promise<void>;
  close: () => Promise<void>;
}

async function getJid(sock: WASocket, phone: string) {
  const formattedPhone = phone.replace(/[^0-9]/g, "");

  const result = await sock?.onWhatsApp(formattedPhone);

  if (result && result.length > 0) {
    const [{ jid }] = result;
    return jid;
  }

  return null;
}

let session: Session;

const formatMessage = {
  text: ({ text, linkPreview }: any) => ({ text, linkPreview }),
  image: ({ url, text }: any) => ({
    image: { url },
    caption: text,
  }),
  video: ({ url, text }: any) => ({
    video: { url },
    caption: text,
  }),
  poll: ({ name, values, selectableCount }: any) => ({
    poll: { name, values, selectableCount },
  }),
};

async function genericSend<T>(
  receivers: string[],
  content: T,
  formatMessage: (content: T) => any,
) {
  if (!session)
    return parentPort?.postMessage({
      type: "error",
      data: "Session not initialized",
    });

  const progress = {
    sentChats: 0,
    unsentChats: 0,
    totalChats: receivers.length,
  };

  for (const chat of receivers) {
    try {
      const socket = session.getWASocket();
      const JID = await getJid(socket, chat);
      await fakeTyping(socket, JID as string);
      const formattedMessage = formatMessage(content);
      await socket?.sendMessage(JID as string, formattedMessage);
      progress.sentChats++;
    } catch (error) {
      progress.unsentChats++;
    }
  }
}
const signalsActions: SignalActions = {
  start: async ({ sessionId }: any) => {
    session = new Session(sessionId);
    const { qrcode, status } = await session.connect();
    parentPort?.postMessage({
      type: "qrcode",
      data: { qrcode, status },
    });
  },
  sendText: async ({ receivers, text, linkPreview }: any) => {
    await genericSend(receivers, { text, linkPreview }, formatMessage["text"]);
  },
  close: async () => {
    if (!session) return;
    parentPort?.postMessage({
      type: "close",
      data: "Close session",
    });
    session.getWASocket()?.end(new Error("Closed by user"));
    process.exit(0);
  },
};

parentPort?.on(
  "message",
  async (message: { type: keyof SignalActions; data: any }) => {
    try {
      if (signalsActions[message.type]) {
        signalsActions[message.type](message.data);
      } else {
        parentPort?.postMessage({
          type: "error",
          data: "Unknown message type",
        });
      }
    } catch (error: any) {
      parentPort?.postMessage({ type: "error", data: error.message });
    }
  },
);
