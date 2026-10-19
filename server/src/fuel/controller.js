import { createHash, timingSafeEqual } from "node:crypto";
import { Connection, Inbox } from "./models.js";
import { fail } from "./domain.js";
// Implement this contract only after inspecting the actual manufacturer's controller API.
export class ControllerAdapter {
  async health() {
    throw new Error("Manufacturer adapter not implemented");
  }
  async fetchEvents(_cursor) {
    throw new Error("Manufacturer adapter not implemented");
  }
  mapEvent(_raw, _equipmentMapping) {
    throw new Error("Manufacturer adapter not implemented");
  }
}
export default async function controllerRoutes(fastify) {
  fastify.post("/api/fuel/controller/:id/events", async (request, reply) => {
    const connection = await Connection.findById(request.params.id);
    const supplied = createHash("sha256")
      .update(String(request.headers["x-equipment-secret"] || ""))
      .digest();
    fail(
      connection &&
        timingSafeEqual(supplied, Buffer.from(connection.secretHash, "hex")),
      "Equipment authentication failed",
      401,
    );
    connection.lastSeenAt = new Date();
    if (!connection.enabled) {
      connection.lastError =
        "Live ingestion disabled: equipment and manufacturer adapter unverified";
      await connection.save();
      return reply.code(423).send({ error: connection.lastError });
    }
    const body = request.body;
    fail(
      typeof body?.sourceRef === "string" &&
        body.sourceRef.length > 0 &&
        body.sourceRef.length <= 200,
      "Immutable source reference required",
    );
    fail(
      typeof body.eventKey === "string" &&
        body.eventKey.length > 0 &&
        body.eventKey.length <= 200,
      "Cross-source dispensing event key required",
    );
    const payloadHash = createHash("sha256")
      .update(
        JSON.stringify({
          equipmentId: body.equipmentId,
          eventKey: body.eventKey,
          payload: body.payload,
        }),
      )
      .digest("hex");
    const old = await Inbox.findOne({
      connection: connection._id,
      sourceRef: body.sourceRef,
    }).lean();
    if (old) {
      fail(
        old.payloadHash === payloadHash && old.eventKey === body.eventKey,
        "Source reference reused with different content",
        409,
      );
      return old;
    }
    const mapping = connection.mapping?.[body.equipmentId];
    fail(mapping, "Unmapped equipment", 409);
    // Authenticated inbox accepts out-of-order delivery; supervised retry posts only an eligible open segment.
    const event = await Inbox.create({
      station: connection.station,
      branch: connection.branch,
      outlet: connection.outlet,
      connection: connection._id,
      sourceRef: body.sourceRef,
      eventKey: body.eventKey,
      payload: { ...body.payload, period: mapping.period },
      payloadHash,
      receivedAt: new Date(),
    });
    connection.lastError = undefined;
    await connection.save();
    return reply.code(202).send(event);
  });
}
