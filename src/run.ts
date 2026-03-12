#!/usr/bin/env node

import express from "express";
import { actionsOidcRouter } from "./route";
import type { Server } from "node:http";
import { getConfig } from "./config";

async function main() {
  const cfg = await getConfig();
  if (!cfg) return; // the logging / exit code is already done in getConfig

  const app = express();
  app.use(
    await actionsOidcRouter({
      triggers: cfg.triggers,
      jwtIssuer: cfg.jwtIssuer,
      jwksUrl: cfg.jwksUrl,
    }),
  );
  const s = await new Promise<Server>((resolve, reject) => {
    const s = app.listen({ host: cfg.host, port: cfg.port }, (err) => {
      if (err) reject(err);
      else resolve(s);
    });
  });

  const evHandler = () => {
    s.close();
  };
  s.on("SIGTERM", evHandler);
  s.on("SIGINT", evHandler);

  console.error(`Listening on port ${cfg.port}`);
}

await main();
