import { Worker } from "bullmq";
import { Elysia, t } from "elysia";

import { MessageDto } from "./dto";
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USERNAME } from "./env";
import { QueueService } from "./queue.service";
import { Action } from "./type";

const queueService = new QueueService({
  host: REDIS_HOST,
  port: REDIS_PORT,
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
});

const subscriptionPerConnection: Record<string, Worker> = {};

const app = new Elysia()
  .ws("/ws", {
    headers: t.Object({ authorization: t.String() }),
    body: MessageDto,
    open(ws) {
      console.log("connection from : ", ws.id);
    },
    close(ws) {
      console.log("disconnection from : ", ws.id);

      subscriptionPerConnection[ws.id]?.close();
      delete subscriptionPerConnection[ws.id];
    },
    async message(ws, message) {
      switch (message.action) {
        case Action.SUBSCRIBE:
          const subscription = queueService.subscribe({
            queue: message.event,
            callback: ws.send,
          });

          subscriptionPerConnection[ws.id.toString()] = subscription;

          break;
        case Action.PUBLISH:
          const job = await queueService.publish({
            queue: message.event,
            message: message.payload,
            messageId: crypto.randomUUID(),
          });

          ws.send({ messageId: job.id });

          break;
        default:
          throw new Error("action not supported");
      }
    },
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
