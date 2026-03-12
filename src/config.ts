import { readFile } from "node:fs/promises";
import { parseArgs } from "util";
import z from "zod";
import JSON5 from "json5";

const envSchema = z.object({
  HOST: z.string().optional(),
  PORT: z.coerce.number().optional(),
});

const configSchema = z.strictObject({
  host: z.string().optional(),
  port: z.number().optional(),
  jwtIssuer: z.string().optional(),
  jwksUrl: z.string().optional(),
  triggers: z.array(
    z.strictObject({
      route: z.string().regex(/^\/[A-za-z0-9-_]+$/),
      command: z.string(),
      commandTimeoutMs: z.number().optional(),
      showCommandOutput: z.boolean().default(false),
      allowedRepositories: z.array(z.string()),
      allowedRefs: z.array(z.string()),
    }),
  ),
});

export const getConfig = async () => {
  const args = parseArgs({
    args: process.argv.slice(2),
    options: { config: { type: "string" }, "config-file": { type: "string" } },
  });

  const configText = args.values["config-file"]
    ? await readFile(args.values["config-file"], "utf-8")
    : args.values.config;

  if (!configText) {
    console.error("Either --config or --config-file is required");
    process.exitCode = -1;
    return null;
  }

  const env = envSchema.safeParse(process.env);
  if (env.error) {
    console.error("Invalid Environment:");
    console.error(z.prettifyError(env.error));
    process.exitCode = -1;
    return null;
  }

  const config = configSchema.safeParse(JSON5.parse(configText));
  if (config.error) {
    console.error("Invalid Configuration:");
    console.error(z.prettifyError(config.error));
    process.exitCode = -1;
    return null;
  }

  config.data.host = env.data.HOST ?? config.data.host ?? "0";
  config.data.port = env.data.PORT ?? config.data.port ?? 3000;

  return config.data;
};
