import { delay, WASocket } from "baileys";

const socketVersionPage =
  "https://wppconnect-team.github.io/pt-BR/whatsapp-versions";
const versionFinder = /[1-9]+.[0-9]+.[0-9]+-alpha/;

export async function getWhatsappSocketVersion(): Promise<
  [number, number, number]
> {
  const siteHtml = await fetch(socketVersionPage).then((res) => res.text());
  const versionMatch = versionFinder.exec(siteHtml);
  if (!versionMatch) throw new Error("Version not found in the HTML");
  const versionString = versionMatch[0];
  const versionArray = versionString
    .split(".")
    .map((n) => Number(n.replace(/\D/g, "")));
  return [versionArray[0], versionArray[1], versionArray[2]];
}

function generateRandomValue(max: number, min: number) {
  return Math.random() * (max - min) + min;
}

export async function fakeTyping(socket: WASocket, jid: string) {
  await socket.sendPresenceUpdate("composing", jid);
  await delay(generateRandomValue(3000, 5000));
  await socket.sendPresenceUpdate("paused", jid);
}
