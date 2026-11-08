# Hosting a mirror in mainland China

GitHub Pages is the primary deployment. This guide describes a static mirror on
Alibaba Cloud OSS for visitors who cannot reach GitHub reliably. It is optional
and requires your own cloud account; no credentials belong in this repository.

## Before you start

- An Alibaba Cloud account and an OSS bucket in a mainland region.
- `ossutil` installed and configured locally (`ossutil config`). Keep the
  credentials in the ossutil profile, never in this repo or in CI variables that
  print to logs.
- A custom domain is optional. Serving a mainland custom domain requires an ICP
  filing; the default `*.oss-cn-*.aliyuncs.com` endpoint does not.
- HTTPS: bind a certificate to the custom domain in the OSS console. The default
  OSS endpoint is HTTP-only for static website hosting.

## Build for the mirror

GitHub Pages uses the `/depth-loom/` base path. A mirror served from the domain
root must rebuild with `/`:

```bash
npm ci
npx vite build --base=/
```

`npm run build` runs `tsc -b` first; `npx vite build` skips the type check, so run
`npm run typecheck` separately if you build this way. The output is `dist/`,
including the 46.4 MB of model weights and the generated `public/ort/` runtime.
Budget roughly 75 MB of storage and the corresponding outbound traffic.

## Upload

```bash
export OSS_BUCKET=your-bucket
export OSS_ENDPOINT=oss-cn-shanghai.aliyuncs.com

ossutil cp -r dist/ "oss://${OSS_BUCKET}/" \
  --endpoint "${OSS_ENDPOINT}" \
  --update
```

Then in the OSS console:

1. Enable static website hosting and set the default index document to
   `index.html`. There are no client-side routes, so a 404 fallback is optional.
2. Set `Cache-Control: public, max-age=31536000, immutable` on `assets/`,
   `models/`, and `ort/`, whose file names are content-hashed or immutable.
3. Set `Cache-Control: no-cache` on `index.html` so a new deploy is picked up.
4. Bind the custom domain and certificate if you have one.

Re-running the upload command publishes a new build; old hashed assets can be
removed with `ossutil rm` or an OSS lifecycle rule.

## Checks after deploying

- Open the mirror over HTTPS and confirm the browser requests
  `models/depth-anything-v2-small/...` and `ort/...` from the mirror origin, not
  from GitHub or a CDN.
- Run one depth estimation and one PNG export. WebM export depends on the
  visitor's browser, not on the mirror.
- Confirm `index.html` is not cached across deploys.

## What not to do

- Do not upload `.env` files, `node_modules`, or the Playwright reports.
- Do not put AccessKey secrets in the repository, in `vite` env variables, or in
  commands that end up in shell history on a shared machine.
- Do not promise a custom domain before the ICP filing is approved.
