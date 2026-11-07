/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies cause unpredictable runtime behavior and must be eliminated.',
      from: { path: '^src' },
      to: { circular: true }
    },
    {
      name: 'domain-pure',
      severity: 'error',
      comment: 'Hexagonal Architecture: Pure domain models must NEVER import from infrastructure, routes, storage, or notifications.',
      from: { path: '^src/domain' },
      to: { path: '^src/(routes|storage|notifications|plugins|server|app)' }
    },
    {
      name: 'math-pure',
      severity: 'error',
      comment: 'Pure Mathematical Engine: Math modules must only depend on domain types and must NEVER import infrastructure or transport.',
      from: { path: '^src/math' },
      to: { path: '^src/(routes|storage|notifications|plugins|server|app)' }
    },
    {
      name: 'recurrence-pure',
      severity: 'error',
      comment: 'Recurrence Engine: Schedule evaluation must only depend on domain and math, never on storage or routes.',
      from: { path: '^src/recurrence' },
      to: { path: '^src/(routes|storage|plugins|server|app)' }
    },
    {
      name: 'storage-isolated',
      severity: 'error',
      comment: 'Hexagonal Storage: Storage adapters must only implement ports and must never import route handlers or server.',
      from: { path: '^src/storage' },
      to: { path: '^src/(routes|server|app)' }
    },
    {
      name: 'notifications-isolated',
      severity: 'error',
      comment: 'Notification Engine: Notification evaluation must never import route handlers or server.',
      from: { path: '^src/notifications' },
      to: { path: '^src/(routes|server|app)' }
    },
    {
      name: 'core-cloud-agnostic',
      severity: 'error',
      comment: 'Cloud Agnostic Guardrail: Core domain and math layers must never import vendor cloud or communication SDKs.',
      from: { path: '^src/(domain|math|recurrence)' },
      to: { path: '(@aws-sdk|twilio|@google-cloud|@azure)' }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    },
    reporterOptions: {
      text: {
        highlightFocused: true
      }
    }
  }
};
