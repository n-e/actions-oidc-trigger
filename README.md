# actions-oidc-trigger

Trigger commands on your server from GitHub Actions, with OIDC authentication.

OpenID Connect (OIDC) doesn't require any tokens or configuration, making the setup easy and secure. See [this post](https://www.even.li/posts/2026-03-03-deploy-github-actions-without-storing-secrets-using-oidc/) for more information.

## Quick Start

On your server, add a `/deploy` endpoint that updates the service Docker image to the one tagged with the commit that triggered the deployment:

```sh
npx actions-oidc-trigger --config '{
    triggers: [{
        route: "/deploy",
        command: "docker service update --image yourservice:$SHA yourservice",
        allowedRepositories: ["yourorg/yourrepo"],
        allowedRefs: ["refs/heads/main"],
    }]
}'
```

In your repository, create an action that builds a Docker image, publishes it, then triggers our endpoint:

```yaml
on:
  push:
    branches: ["main"]

permissions:
  id-token: write

jobs:
  build-publish:
    # build and publish your Docker image here

  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Install OIDC Client from Core Package
        run: npm install @actions/core@1.6.0 @actions/http-client

      - name: Get Id Token
        uses: actions/github-script@v8
        id: idtoken
        with:
          script: |
            const coredemo = require('@actions/core')
            let id_token = await coredemo.getIDToken()
            coredemo.setOutput('id_token', id_token)

      - name: Trigger the deployment to your server
        run: |
          curl -XPOST http://your_server:3000/deploy \
            -H "Authorization: Bearer ${{ steps.idtoken.outputs.id_token }}"
```

## Security

`actions-oidc-triggers` is designed with security as the main concern:

- It has the minimal footprint possible
- It accepts a minimal amount of user input.
- It is secure by default (options such as `showCommandOutput` are disabled by default, filtering by ref and repository must be set)

### Configuration security considerations

The following configuration settings can relax the security:

- `triggers.showCommandOutput`: When enabling this setting, make sure that the commands do not print information that you do not want exposed to the caller (for example users allowed to see the actions logs or modify the actions)
- wildcards in `triggers.allowedRepositories`: this setting can allow actions from any repository in any organization to call the trigger. Make sure you only add repositories you want to allow
- wildcards in `triggers.allowedRefs`: ref names are controlled by the committers, and can contain almost any character. If you set allowedRefs to wildcards and use the `$REF` environment variables, make sure you properly escape it.

### HTTPS

As for any service, use a reverse proxy to enable https.

## API

```sh
curl -XPOST "http://localhost:3000/$ENDPOINT" \
    -H "Authorization: Bearer $ID_TOKEN"
```

where:

- `$ENDPOINT` is one of the `triggers.route` parameter
- `$ID_TOKEN` is the OIDC ID Token. See [Quick Start](#quick-start) for how to obtain a GitHub Actions token or your provider documentation.

If the command succeeds, the API returns:

```json
{
  "message": "OK",
  "status": 200
}
```

If the command fails, the API returns:

```json
{
  "code": 42,
  "message": "Command exited with code 42",
  "status": 400
}
```

If `triggers.showCommandOutput` is enabled, the standard outputs are also returned:

```json
{
  "message": "OK",
  "status": 200,
  "stderr": "",
  "stdout": "Deployment Succeeded!"
}
```

## Command Execution

The command is executed in the default shell, and is terminated after `triggers.commandTimeoutMs` milliseconds.

The following variables are added to the command's environment:

- **`REPOSITORY`:** The repository the action was triggered on. Example: `n-e/actions-oidc-trigger`
- **`REF`:** The git reference the action was triggered on. Example: `refs/heads/main`
- **`SHA`:** The sha of the commit the action was triggered on. Example: `ec022c5d3b2b83dee1fd044aeff40586c373eabe`
- **`ACTOR`:** The actor that triggered the action. Example: `n-e`

> [!IMPORTANT]
> Branch and tag names are set by the committer and can contain almost any character. You must escape the `REF` variable properly to avoid any vulnerabilities, especially in public repositories. If in doubt, keep the `triggers.allowedRefs` setting enabled. See also [Dealing with special characters in branch and tag names
> ](https://docs.github.com/en/get-started/using-git/dealing-with-special-characters-in-branch-and-tag-names).

## Configuration

### Command-Line Arguments

**`--config `:** The configuration. Example: `-- config "{ triggers: [{ route:'/deploy', command: 'true' }]}"`.

**`--config-file`:** The configuration file. Example: `--config-file actions-oidc-trigger.json5`

### Environment Variables

**`HOST`:** The Host to listen on. Example: `127.0.0.1`. Default: `0`

**`PORT`:** The Host to listen on. Default: `3000`

The environment variables take precedence over the configuration file.

### Configuration File

```json5
// Configuration file with every property
{
  host: "0",
  port: 3000,
  jwksUrl: "https://example.com/.well-known/jwks",
  jwtIssuer: "https://example.com/actions",
  triggers: [
    {
      route: "/deploy",
      command: "echo 'hello world'",
      commandTimeoutMs: 10_000,
      showCommandOutput: true,
      allowedRepositories: ["n-e/actions-oidc-trigger"],
      allowedRefs: ["refs/heads/main", "refs/tags/v*"],
    },
  ],
}
```

**`host`:** Same as the HOST environment variable

**`port`:** Same as the PORT environment variable

**`jwksUrl`:** The URL containing the keys to verify the OIDC token. Default: `https://token.actions.githubusercontent.com/.well-known/jwks`

**`jwtIssuer`:** The issuer the OIDC token needs to have. Default: `https://token.actions.githubusercontent.com`

**`triggers.route`:** An endpoint to listen on. Example: `/deploy`, `/deployment_status`

**`triggers.command`:** The command to run. See [Command Execution](#command-execution). Example: `docker service update --image yourservice:$SHA yourservice`

**`triggers.commandTimeoutMs`:** The timeout before the command is terminated with the SIGTERM signal and the trigger returns an error. Default: `5000`

**`triggers.showCommandOutput`:** Whether to return the command stdout and stderr to the caller. Default: `false`

> [!IMPORTANT]
> Make sure that `command` doesn't print sensitive information before enabling this setting.

**`triggers.allowedRefs`:** The refs that this trigger can be triggered on. It can either be an exact ref (`refs/heads/main`) or contain `*` wildcards.

**`triggers.allowedRepositories`:** The repositories that this trigger can be triggered on. It can either be an exact repository (`n-e/actions-oidc-trigger`) or contain `*` wildcards.

> [!IMPORTANT]
> If you use the `*` wildcard alone (`allowedRepositories: ["*"]`), every GitHub user will be able to trigger the trigger from their repositories' actions.

## Programmatic Use

```ts
import express from "express";
import { actionsOidcRouter } from "actions-oidc-trigger";

const app = express();

app.use(
  "/triggers",
  await actionsOidcRouter({
    // The options are almost the same as those in the configuration file
    triggers: [
      {
        route: "/deploy",
        command: "...",
        allowedRepositories: ["yourorg/yourrepo"],
        allowedRefs: ["refs/heads/main"],
      },
    ],
  }),
);

app.listen(3000);
```

The deploy trigger will be exposed at `http://localhost:3000/triggers/deploy`

## Run on other forges

actions-oidc-trigger can be configured to work with other forges. For example with Forgejo actions, configure actions-oidc-connect thusly:

```json5
{
  jwtIssuer: "https://yourserver.com/api/actions",
  jwksUrl: "https://yourserver.com/login/oauth/keys",
  triggers: [...],
}
```

See:

- [Forgejo Actions | Security OpenID Connect](https://forgejo.org/docs/next/user/actions/security-openid-connect/)
- [Forgejo | OAuth2 provider](https://forgejo.org/docs/next/user/oauth2-provider/)
