import { expect, it } from "vitest";
import express, { Router } from "express";
import { actionsOidcRouter } from "../route";
import type { Server } from "node:http";

const jwt =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4ODI2YjE3LTZhMzAtNWY5Yi1iMTY5LThiZWI4MjAyZjcyMyIsInR5cCI6IkpXVCIsIng1dCI6InlrTmFZNHFNX3RhNGsyVGdaT0NFWUxrY1lsQSJ9.eyJhY3RvciI6Im4tZSIsImFjdG9yX2lkIjoiNDE2MzcwNyIsImF1ZCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9uLWUiLCJiYXNlX3JlZiI6IiIsImNoZWNrX3J1bl9pZCI6IjY1NTU0MjQ2OTQxIiwiZXZlbnRfbmFtZSI6IndvcmtmbG93X2Rpc3BhdGNoIiwiZXhwIjoxNzcyNTQyMTUwLCJoZWFkX3JlZiI6IiIsImlhdCI6MTc3MjU0MTg1MCwiaXNzIjoiaHR0cHM6Ly90b2tlbi5hY3Rpb25zLmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImpvYl93b3JrZmxvd19yZWYiOiJuLWUvZ2l0aHViX3BsYXlncm91bmQvLmdpdGh1Yi93b3JrZmxvd3Mvb2lkYy55YW1sQHJlZnMvaGVhZHMvbWFpbiIsImpvYl93b3JrZmxvd19zaGEiOiJlYzAyMmM1ZDNiMmI4M2RlZTFmZDA0NGFlZmY0MDU4NmMzNzNlYWJlIiwianRpIjoiNTIwODY4MTQtY2E1OC00ZDY4LWI1ZTUtMGViMjFmMWViMGRmIiwibmJmIjoxNzcyNTQxNTUwLCJyZWYiOiJyZWZzL2hlYWRzL21haW4iLCJyZWZfcHJvdGVjdGVkIjoiZmFsc2UiLCJyZWZfdHlwZSI6ImJyYW5jaCIsInJlcG9zaXRvcnkiOiJuLWUvZ2l0aHViX3BsYXlncm91bmQiLCJyZXBvc2l0b3J5X2lkIjoiMTE3MTYwNTYyMSIsInJlcG9zaXRvcnlfb3duZXIiOiJuLWUiLCJyZXBvc2l0b3J5X293bmVyX2lkIjoiNDE2MzcwNyIsInJlcG9zaXRvcnlfdmlzaWJpbGl0eSI6InByaXZhdGUiLCJydW5fYXR0ZW1wdCI6IjEiLCJydW5faWQiOiIyMjYyMzU1Mjg0NCIsInJ1bl9udW1iZXIiOiI2IiwicnVubmVyX2Vudmlyb25tZW50IjoiZ2l0aHViLWhvc3RlZCIsInNoYSI6ImVjMDIyYzVkM2IyYjgzZGVlMWZkMDQ0YWVmZjQwNTg2YzM3M2VhYmUiLCJzdWIiOiJyZXBvOm4tZS9naXRodWJfcGxheWdyb3VuZDpyZWY6cmVmcy9oZWFkcy9tYWluIiwid29ya2Zsb3ciOiIuZ2l0aHViL3dvcmtmbG93cy9vaWRjLnlhbWwiLCJ3b3JrZmxvd19yZWYiOiJuLWUvZ2l0aHViX3BsYXlncm91bmQvLmdpdGh1Yi93b3JrZmxvd3Mvb2lkYy55YW1sQHJlZnMvaGVhZHMvbWFpbiIsIndvcmtmbG93X3NoYSI6ImVjMDIyYzVkM2IyYjgzZGVlMWZkMDQ0YWVmZjQwNTg2YzM3M2VhYmUifQ.QDOjBGlAkrB0ndfXL-4SwgOU2yuktrSSHiC0tANlKZgoo95mMwk3JLuy9ekxrc_P3P6IKGiusGOIHbdp65VaEXTAgmGPVv1G-5rDJALYGOpAhwFrDWj9gnG9HVAx3DHjIUKUr2mJQDs39R3opSSiEsJXCAe2_GiONq5mmMsK-y8criJypIk86IjOpM0k7L0ppg_knMcrMEelABoBXlNhmjWQ3GjJC9ywrrP35XygG5lJnWSrwfD4CrsMj7xIrKK-u9xchQFZI3beL3C5cG52U3Gj2stfOPqHAQ_OpjzWkLlKW5_JbU4PwYir7NXosjdHY3T5apCLyEDFm5mdfRjAFg";
const authHeaders = {
  Authorization: `Bearer ${jwt}`,
};

const withServer = async (
  middleware: Router,
  cb: (opts: { baseUrl: string }) => Promise<void>,
) => {
  const app = express();
  const port = 12787;
  app.use(middleware);

  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen({ host: "127.0.0.1", port }, (err) =>
      err ? reject(err) : resolve(s),
    );
  });
  try {
    await cb({ baseUrl: `http://127.0.0.1:${port}` });
  } finally {
    server.close();
  }
};

const singleTrigger = (
  trigger: Omit<
    Parameters<typeof actionsOidcRouter>[0]["triggers"][number],
    "route" | "allowedRefs" | "allowedRepositories"
  > & { allowedRefs?: string[]; allowedRepositories?: string[] },
) => ({
  triggers: [
    {
      allowedRefs: ["*"],
      allowedRepositories: ["*"],
      route: "/trigger",
      ...trigger,
    },
  ],
});

it("works in the nominal case", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({ command: "true" }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "message": "OK",
          "status": 200,
        }
      `);
    },
  );
});

it("gets the env vars", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({
        command: 'echo "REPOSITORY=$REPOSITORY REF=$REF SHA=$SHA ACTOR=$ACTOR"',
        showCommandOutput: true,
      }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "message": "OK",
          "status": 200,
          "stderr": "",
          "stdout": "REPOSITORY=n-e/github_playground REF=refs/heads/main SHA=ec022c5d3b2b83dee1fd044aeff40586c373eabe ACTOR=n-e
        ",
        }
      `);
    },
  );
});

it("returns an error on no authorization header", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({ command: "true" }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "message": "Missing or invalid authorization header",
          "status": 401,
        }
      `);
    },
  );
});

it("returns an error on a bad authorization header", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({ command: "true" }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: { Authorization: "Basic abcd" },
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "message": "Missing or invalid authorization header",
          "status": 401,
        }
      `);
    },
  );
});

it("refuses an expired token", async () => {
  await withServer(
    await actionsOidcRouter({ ...singleTrigger({ command: "true" }) }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchInlineSnapshot(`
      {
        "message": "ID Token has expired",
        "status": 401,
      }
    `);
    },
  );
});

it("returns an error when exec fails", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({ command: 'bash -c "echo gruik; exit 42"' }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "code": 42,
          "message": "Command exited with code 42",
          "status": 400,
        }
      `);
    },
  );
});

it("returns an error when exec times out", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({ commandTimeoutMs: 1, command: 'sleep 10"' }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "message": "Command timed out (0s)",
          "status": 400,
        }
      `);
    },
  );
});

it("prints the output streams when exec fails and the settings are enabled", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({
        command: 'bash -c "echo -n gruik; exit 42"',
        showCommandOutput: true,
      }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "code": 42,
          "message": "Command exited with code 42",
          "status": 400,
          "stderr": "",
          "stdout": "gruik",
        }
      `);
    },
  );
});

it("returns an error on a bad ref", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({
        allowedRefs: ["gronk"],
        command: "true",
        showCommandOutput: true,
      }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "message": "Disallowed ref (branch or tag)",
          "status": 403,
        }
      `);
    },
  );
});

it("returns an error on a bad repository", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({
        allowedRepositories: ["gronk"],
        command: "true",
        showCommandOutput: true,
      }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "message": "Disallowed repository",
          "status": 403,
        }
      `);
    },
  );
});

it("returns a 500 error on internal problems", async () => {
  await withServer(
    await actionsOidcRouter({
      currentDate: new Date(1772542140 * 1000),
      ...singleTrigger({ command: "true", allowedRepositories: null as any }),
    }),
    async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/trigger`, {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "message": "Internal Error",
          "status": 500,
        }
      `);
    },
  );
});
