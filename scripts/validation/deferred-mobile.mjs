console.error(
  'Mobile is deferred by the owner. It is excluded from active workspaces, builds and acceptance gates. Draft source is preserved; no Android delivery is claimed.',
);
process.exitCode = 1;
