import { Router, type Request, type Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { JOSEError, JWTExpired } from "jose/errors";
import { exec as _exec, type ExecException } from "node:child_process";
import { promisify } from "node:util";
import { serializeError } from "serialize-error";

const defaults = { commandTimeoutMs: 5000, showCommandOutput: false };

const exec = promisify(_exec);

class HttpError extends Error {
  status;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const getBearer = (req: Request): string | null => {
  const h = req.header("authorization")?.split(" ");
  if (!h || h.length !== 2 || h.at(0) !== "Bearer") return null;
  return h.at(1) ?? null;
};

/**
 * Checks if haystack matches pattern. Pattern may contain the * wildcard
 * to match 0 or more characters. pattern is anchored to the start and end
 * of haystack.
 *
 * Note: creating the regex every time is a bit slow but good enough for our usage
 */
const matchWildcard = (pattern: string, haystack: string) => {
  const unanchored = pattern
    .split("*")
    // @ts-expect-error -- the types aren't supported yet in ts 5.9.3
    .map((x) => RegExp.escape(x))
    .join(".*");
  const re = new RegExp(`^${unanchored}$`);

  return re.exec(haystack);
};

export const actionsOidcRouter = async ({
  triggers: _triggers,
  jwksUrl = "https://token.actions.githubusercontent.com/.well-known/jwks",
  jwtIssuer: jwtIssuer = "https://token.actions.githubusercontent.com",
  logger = (data) => console.log(JSON.stringify(data)),
  currentDate,
}: {
  triggers: {
    route: string;
    command: string;
    commandTimeoutMs?: number;
    showCommandOutput?: boolean;
    allowedRepositories: string[];
    allowedRefs: string[];
  }[];
  jwksUrl?: string;
  jwtIssuer?: string;
  logger?: (data: Record<string, unknown>) => void;
  currentDate?: Date;
}) => {
  const triggers = _triggers.map((t) => ({ ...defaults, ...t }));

  const keySet = createRemoteJWKSet(new URL(jwksUrl));

  const router = Router();

  const handler = async (req: Request, trigger: (typeof triggers)[number]) => {
    const bearer = getBearer(req);
    if (!bearer)
      throw new HttpError(401, "Missing or invalid authorization header");

    const { payload } = await jwtVerify(bearer, keySet, {
      issuer: jwtIssuer,
      currentDate,
    });

    const ref = (payload.ref as string) ?? "";
    const repository = (payload.repository as string) ?? "";

    if (
      !trigger.allowedRepositories.some((x) => matchWildcard(x, repository))
    ) {
      throw new HttpError(403, "Disallowed repository");
    }

    if (!trigger.allowedRefs.some((x) => matchWildcard(x, ref))) {
      throw new HttpError(403, "Disallowed ref (branch or tag)");
    }

    const env = {
      REPOSITORY: repository,
      REF: ref,
      SHA: (payload.sha as string) ?? "",
      ACTOR: (payload.actor as string) ?? "",
    };

    const { stdout, stderr } = await exec(trigger.command, {
      timeout: trigger.commandTimeoutMs,
      env: {
        ...process.env,
        ...env,
      },
    }).catch((e) => {
      e.env = env;
      throw e;
    });

    return { stdout, stderr, env };
  };

  router.use(async (req, res, next) => {
    const trigger = triggers.find((t) => t.route === req.path);

    if (!trigger) return next();

    const send = (
      res: Response,
      status: number,
      data: Record<string, unknown>,
      extra: {
        execResult?: Pick<
          ExecException,
          "cmd" | "code" | "killed" | "signal" | "stderr" | "stdout"
        >;
        error?: unknown;
        env?: Record<string, unknown>;
      },
    ) => {
      const body = { status, ...data };
      res.header("content-type", "application/json").status(status).send(body);
      logger({
        req: {
          remoteAddress: req.socket.remoteAddress,
          remotePort: req.socket.remotePort,
          method: req.method,
          url: req.url,
          headers: {
            ...req.headers,
            ...(req.headers.authorization && {
              authorization: req.headers.authorization.replace(
                / [^ ]+$/,
                "[REDACTED]",
              ),
            }),
          },
        },
        res: {
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          body,
        },
        trigger,
        execResult: extra.execResult,
        ...(extra.error ? { error: serializeError(extra.error) } : {}),
        env: extra.env,
      });
    };

    try {
      const result = await handler(req, trigger);
      const extra = trigger.showCommandOutput
        ? { stderr: result.stderr, stdout: result.stdout }
        : {};
      send(
        res,
        200,
        { message: "OK", ...extra },
        {
          execResult: { stdout: result.stdout, stderr: result.stderr },
          env: result.env,
        },
      );
    } catch (e) {
      if (e instanceof HttpError)
        send(res, e.status, { message: e.message }, { error: e });
      else if (e instanceof JWTExpired)
        send(res, 401, { message: "ID Token has expired" }, { error: e });
      else if (e instanceof JOSEError)
        send(res, 401, { message: "Cannot Verify ID Token" }, { error: e });
      else if (e instanceof Error && "stderr" in e) {
        const te = e as ExecException & { env: Record<string, unknown> };
        const extra = trigger.showCommandOutput
          ? { stderr: te.stderr, stdout: te.stdout }
          : {};
        const execResult = {
          cmd: te.cmd,
          code: te.code,
          killed: te.killed,
          signal: te.signal,
          stderr: te.stderr,
          stdout: te.stdout,
        };
        if (te.killed)
          send(
            res,
            400,
            {
              message: `Command timed out (${(trigger.commandTimeoutMs / 1000).toFixed(0)}s)`,
              ...extra,
            },
            { execResult, env: te.env },
          );
        else
          send(
            res,
            400,
            {
              message: `Command exited with code ${te.code}`,
              code: te.code,
              ...extra,
            },
            { execResult, env: te.env },
          );
      } else send(res, 500, { message: "Internal Error" }, { error: e });
    }
  });

  return router;
};
