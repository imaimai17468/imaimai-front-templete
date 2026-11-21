# Supply Chain and Release Hunting

#### When to use this file

Reach for this file when the target generates source, runs CI, or deploys from a pipeline. This domain covers trust handoffs from source and dependency to the Worker that runs. Lockfile installs, install scripts, the registry, pinned versions and actions, workflow triggers and permissions, secrets in history, and what the build output holds are covered by `webapp-security-review`'s `supply-chain.md` and `deployment.md`, which the hunter prompt carries alongside this file. The app ships no updater and loads no plugins, so neither has a class here.

Split large targets into generated inputs, CI isolation, and deploy authorization.

## Core discipline (include in every agent prompt for this domain)

```
- A mutable or known-vulnerable dependency is not a finding by itself. Show who can influence resolution, which build consumes it, and what execution or release boundary follows.
- Follow integrity across every handoff: source identity, resolved inputs, build worker, artifact identity, test result, and deploy.
- CI configuration is authorization code. Establish which event triggered a workflow, whose code runs, which secrets and tokens exist, and what it may publish or mutate.
- A checksum fetched from the same untrusted location as the artifact does not establish independent integrity. Identify the trusted root and failure behavior.
- Use `confirmed` for in-repo control-flow failures with bounded local validation. Use `needs_validation` for branch protection, hosted-runner, registry, or production deploy facts that are not observable.
```

## Build-input attack classes (subagent_type: `general`)

**Generated-source and codegen provenance gaps**
Schemas, vendored archives, generated clients, localization, documentation examples, or binary blobs produce executable or shipped content without the same review and integrity gate as source. Compare local regeneration with committed output and verify who controls input and generator.

## CI and automation attack classes (subagent_type: `general`)

**Workflow command and expression confusion**
Attacker-controlled branch names, commit messages, issue fields, artifact names, matrix values, or generated output enter shell commands, template expressions, paths, or privileged workflow inputs without canonical validation.

**Cache, artifact, and workspace trust mixing**
A lower-trust job can populate a cache, artifact, shared workspace, or output that a higher-trust job later restores and executes or releases. Review cache keys and namespaces, artifact producer identity, digest binding, retention, and whether promotion re-resolves by mutable name.

## Deploy attack classes (subagent_type: `general`)

**Build-to-promotion substitution**
Tests, review, and deploy refer to mutable tags, filenames, branches, or artifact IDs rather than the same immutable digest. Check every copy, repack, and provenance step between build and deploy.

**Release authorization and signing-policy gaps**
A release or signature is accepted from the wrong workflow, repository, branch, environment, key role, or threshold. Review identity claims inside attestations and verify the consumer validates them, not just a valid signature. Rotation, expiry, and revocation must fail closed where policy requires.

## Universal moves (apply across the above)

- Walk backward from a deployed Worker version to every source, generated input, credential, worker, cache, test result, and authorization decision.
- Compare untrusted and protected workflow events side by side. Mark each persisted channel crossing between them and require an immutable identity plus producer trust.
- Review revoked key, failed download, missing attestation, rollback, and registry outage paths. The failure policy is part of release integrity.

## Validation rules (apply before reporting ANY finding here)

1. Name the lower-trust actor, controllable source/cache/artifact/metadata, consuming trusted job or deploy, and resulting unauthorized publication, code inclusion, secret disclosure, or privileged execution.
2. Prove artifact identity across the broken handoff. A different mutable name or unbound digest must reach a real consumer.
3. Verify built-in package-manager, repository-host, registry, and signing defaults for the pinned version. Unknown hosted controls require `needs_validation`.
4. Keep local validation bounded: use a harmless fixture repository, dummy credential marker, local registry/config, and non-production artifact namespace. Do not publish or alter a real release.
5. Return `confirmed` only with a complete source-visible handoff and meaningful result. Return `needs_validation` with the precise branch, runner, registry, signing, or deployment fact an owner must observe.
