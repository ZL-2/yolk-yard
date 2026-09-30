# Preserve Friend Codes across deployments

The game uses a stable browser credential stored under
`ravelfront-social-identity`. It is independent of the game protocol and release
number. Server identities, public codes, friend requests, friendships and blocks
must live on permanent storage. Paid Render compute alone does not provide this.

## Prepared configuration for the existing relay

- Existing service: `yolk-yard-relay` (`srv-daqlu2vavr4c738sbe40`).
- Keep one instance with the existing $7/month compute plan.
- Add a 1 GB disk mounted at `/var/data/ravelfront`.
- The revised server detects the actual mount and selects
  `/var/data/ravelfront/social.json` without an environment-variable change.
- An explicit `RAVEL_SOCIAL_DATA_PATH` takes precedence; if already configured,
  it must point to a file under the mount.

Adding a disk is a separate recurring purchase and triggers deployment with brief
downtime. Obtain approval for the displayed storage price before adding it. A
disk retains this service's single-instance architecture; a future multi-instance
relay should move these records to a shared database.

## Migration order

1. Before replacing the current instance, save its latest social snapshot through
   authenticated Render Shell/SSH. The existing default is
   `/tmp/ravelfront-social.json`. Keep this backup private; it contains player
   identities and credential hashes. Never put it in the public Git repository.
2. Add the approved disk and allow its deployment to finish. Do not assume files
   from the old ephemeral instance will be transferred automatically.
3. Transfer the saved snapshot onto the new instance. The destination social file
   must be absent; existing records require an explicit merge plan.
4. Run the revised server's migration utility:
   `node server/realtime/social-migrate.js SAVED_SNAPSHOT /var/data/ravelfront/social.json`.
   It validates the source, verifies the persistent mount, creates both primary
   and backup files with exclusive writes, checks the records and refuses to
   overwrite an existing destination. It leaves the source untouched.
5. Activate the revised server only after migration. Verify `/health` reports
   `socialStorage: "persistent-file"`, `socialAvailable: true` and
   `socialRevision: 92`. Reconnect two known browser identities and check their
   exact codes and friendship. After a second controlled deployment/restart,
   repeat that check.

During migration, prevent social writes from being made to a second, temporary
store. Capture a final snapshot immediately before stopping the old service. Live
parties and matches remain transient; this migration preserves social identities
and relationships, not matches in progress.

The store accepts the existing unversioned snapshot format and writes schema 1.
Atomic synced primary/backup files allow recovery from a damaged primary. Invalid
records or an unknown newer schema cannot initialize an empty replacement store.
An unknown saved credential is refused rather than exchanged for a new identity;
the browser keeps it and offers Retry Restoration. Creating a new code requires
an explicit choice, with the previous credential retained separately.

Checks: `node --test tests/social-persistence.test.js` and
`node scripts/social-squads-check.mjs`.
