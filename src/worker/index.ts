import type { QueueJob } from "../shared/contracts";
import { app } from "./api";
import { sendOutbound } from "./connectors";
import { id, type ConnectionRow } from "./db";
import { sweepUnusedImages } from "./images";
import { ingestKnowledgeSource } from "./knowledge";
import { CloudflareAgentRuntime } from "./runtime";

export { ConversationAgent } from "./agent";

async function handleJob(job: QueueJob, env: Env) {
  if (job.kind === "knowledge_ingest") {
    await ingestKnowledgeSource(env, job.sourceId);
    return;
  }
  if (job.kind === "message") {
    const connection = await env.DB.prepare("SELECT * FROM connections WHERE id=?").bind(job.input.connectionId).first<ConnectionRow>();
    if (!connection) throw new Error("Connection no longer exists");
    const result = await new CloudflareAgentRuntime(env).handleMessage(job.input);
    await env.DB.prepare("UPDATE idempotency_events SET status=?,result_json=? WHERE event_id=? AND connection_id=?")
      .bind(result.status, JSON.stringify(result), job.input.eventId, connection.id).run();
    if (result.status !== "human_handoff") {
      await env.DB.prepare("INSERT OR IGNORE INTO deliveries(id,connection_id,request_id,status) VALUES(?,?,?,'pending')")
        .bind(id("delivery"), connection.id, result.requestId).run();
      try {
        const delivery = await sendOutbound(env, connection, result);
        await env.DB.prepare("UPDATE deliveries SET status='delivered',attempts=attempts+1,response_json=?,last_error=NULL,updated_at=datetime('now') WHERE connection_id=? AND request_id=?")
          .bind(JSON.stringify(delivery), connection.id, result.requestId).run();
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1000) : "Delivery failed";
        await env.DB.prepare("UPDATE deliveries SET status='failed',attempts=attempts+1,last_error=?,updated_at=datetime('now') WHERE connection_id=? AND request_id=?")
          .bind(message, connection.id, result.requestId).run();
        throw error;
      }
    }
    return;
  }
  if (job.kind === "delivery") {
    const connection = await env.DB.prepare("SELECT * FROM connections WHERE id=?").bind(job.connectionId).first<ConnectionRow>();
    if (!connection) throw new Error("Connection no longer exists");
    try {
      const response = await sendOutbound(env, connection, job.result);
      await env.DB.prepare("UPDATE deliveries SET status='delivered',attempts=attempts+1,response_json=?,last_error=NULL,updated_at=datetime('now') WHERE id=?")
        .bind(JSON.stringify(response), job.deliveryId).run();
    } catch (error) {
      await env.DB.prepare("UPDATE deliveries SET status='failed',attempts=attempts+1,last_error=?,updated_at=datetime('now') WHERE id=?")
        .bind(error instanceof Error ? error.message.slice(0, 1000) : "Delivery failed", job.deliveryId).run();
      throw error;
    }
  }
}

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sweepUnusedImages(env).then((deleted) => console.log(JSON.stringify({ event: "image_sweep", deleted: deleted.length }))));
  },
  async queue(batch: MessageBatch<QueueJob>, env: Env) {
    await Promise.all(batch.messages.map(async (message) => {
      try {
        await handleJob(message.body, env);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({ level: "error", event: "queue_job_failed", jobKind: message.body.kind, message: error instanceof Error ? error.message : "Unknown error", attempts: message.attempts }));
        message.retry({ delaySeconds: Math.min(300, 2 ** message.attempts * 5) });
      }
    }));
  },
} satisfies ExportedHandler<Env, QueueJob>;
