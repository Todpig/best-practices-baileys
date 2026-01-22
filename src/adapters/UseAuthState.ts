import {
  AuthenticationCreds,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
  proto,
  makeCacheableSignalKeyStore,
  SignalKeyStore,
} from "baileys";
import { MongoClient, Collection } from "mongodb";
import { Logger } from "pino";

const { DB_URI = "mongodb://admin:pass@localhost:27017", DB_NAME = "test" } =
  process.env;

export class UseAuthState {
  sessionId: string;
  sessions!: Collection<Document>;
  keys!: Collection<Document>;
  logger: Logger;
  creds!: AuthenticationCreds;
  client: MongoClient;

  constructor({ logger, sessionId }: { logger: Logger; sessionId: string }) {
    this.sessionId = sessionId;
    this.client = new MongoClient(DB_URI);
    this.logger = logger;
  }

  async init() {
    const db = this.client.db(DB_NAME!);
    this.keys = db.collection("keys");
    this.sessions = db.collection("sessions");
    await Promise.all([
      this.keys.createIndex({ sessionId: 1 }, { unique: false }),
      this.sessions.createIndex({ sessionId: 1 }, { unique: true }),
    ]);
  }

  async get() {
    await this.client.connect();
    this.creds = initAuthCreds();

    const saveKey = async (type: string, key: string, value: any) => {
      this.logger.debug(
        `Storing key whatsappId: ${this.sessionId} type: ${type} key: ${key}`,
      );
      try {
        await this.keys.updateOne(
          { sessionId: this.sessionId, type, key },
          { $set: { value: JSON.stringify(value) } },
          { upsert: true },
        );
      } catch (error: any) {
        this.logger.error(`Error storing key: ${error.message}`);
      }
    };

    const getKey = async (type: string, key: string) => {
      try {
        const result: any = await this.keys.findOne({
          sessionId: this.sessionId,
          type,
          key,
        });
        this.logger.debug(
          `${result ? "Successfully" : "Failed to"} recover key whatsappId: ${
            this.sessionId
          } type: ${type} key: ${key}`,
        );
        return result ? JSON.parse(result.value) : null;
      } catch (error: any) {
        this.logger.error(`Error retrieving key: ${error.message}`);
        return null;
      }
    };

    const removeKey = async (type: string, key: string) => {
      this.logger.debug(
        `Deleting key whatsappId: ${this.sessionId} type: ${type} key: ${key}`,
      );
      try {
        await this.keys.deleteOne({
          sessionId: this.sessionId,
          type,
          key,
        });
      } catch (error: any) {
        this.logger.error(`Error deleting key: ${error.message}`);
      }
    };

    const saveState = async () => {
      try {
        await this.sessions.updateOne(
          { sessionId: this.sessionId },
          {
            $set: {
              session: JSON.stringify(
                { creds: this.creds, keys: {} },
                BufferJSON.replacer,
                0,
              ),
            },
            $setOnInsert: {},
          },
          { upsert: true },
        );
      } catch (error: any) {
        this.logger.error(`Erro ao salvar estado da sessão: ${error.message}`);
      }
    };

    const sessionData: any = await this.sessions.findOne({
      sessionId: this.sessionId,
    });

    if (sessionData) {
      const result = JSON.parse(sessionData.session, BufferJSON.reviver);
      this.creds = result.creds;
      const { keys } = result;

      if (Object.keys(keys).length) {
        this.logger.debug("Starting conversion of keys to new format");
        const TYPE_MAP: Record<string, string> = {
          preKeys: "pre-key",
          sessions: "session",
          senderKeys: "sender-key",
          appStateSyncKeys: "app-state-sync-key",
          appStateVersions: "app-state-sync-version",
          senderKeyMemory: "sender-key-memory",
        };

        for (const oldType in keys) {
          const newType = TYPE_MAP[oldType];
          this.logger.debug(`Converting keys of type ${oldType} to ${newType}`);
          for (const key in keys[oldType]) {
            await saveKey(newType, key, keys[oldType][key]);
          }
        }
        await saveState();
      }
    }

    const keyStore: SignalKeyStore = {
      get: async <T extends keyof SignalDataTypeMap>(
        type: T,
        ids: string[],
      ) => {
        const data: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const id of ids) {
          let value = await getKey(type, id);
          if (value && type === "app-state-sync-key") {
            value = proto.Message.AppStateSyncKeyData.create(value);
          }
          data[id] = value as SignalDataTypeMap[T];
        }
        return data;
      },

      set: async (data: Record<string, Record<string, any>>) => {
        const tasks: Promise<void>[] = [];
        for (const category in data) {
          for (const id in data[category]) {
            const value = data[category][id];
            tasks.push(
              value ? saveKey(category, id, value) : removeKey(category, id),
            );
          }
        }
        await Promise.all(tasks);
      },
      clear: async () => {
        try {
          await this.keys.deleteMany({ sessionId: this.sessionId });
          await this.sessions.deleteMany({ sessionId: this.sessionId });
        } catch (error: any) {}
      },
    };

    return {
      state: {
        creds: this.creds,
        keys: makeCacheableSignalKeyStore(keyStore, this.logger),
      },
      saveState,
    };
  }
}
