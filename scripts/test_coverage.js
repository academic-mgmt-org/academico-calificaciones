const { spawnSync } = require('node:child_process');

const reporters = new Set(['json', 'text']);
const nodeTestArgs = [];

function addReporters(value) {
  for (const reporter of String(value || '').split(',')) {
    const normalized = reporter.trim();
    if (normalized) {
      reporters.add(normalized);
    }
  }
}

for (let index = 0; index < process.argv.length - 2; index += 1) {
  const arg = process.argv[index + 2];

  if (arg === '--coverageReporters' || arg === '--coverageReporter') {
    addReporters(process.argv[index + 3]);
    index += 1;
    continue;
  }

  if (arg.startsWith('--coverageReporters=') || arg.startsWith('--coverageReporter=')) {
    addReporters(arg.slice(arg.indexOf('=') + 1));
    continue;
  }

  if (arg === '--watchAll') {
    if (process.argv[index + 3] && !process.argv[index + 3].startsWith('--')) {
      index += 1;
    }
    continue;
  }

  if (arg.startsWith('--watchAll=')) {
    continue;
  }

  nodeTestArgs.push(arg);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

run(npmCommand, ['run', 'build']);

const c8Bin = require.resolve('c8/bin/c8.js');
const c8Args = [
  c8Bin,
  '--report-dir=coverage',
  ...[...reporters].map((reporter) => `--reporter=${reporter}`),
  'node',
  '--test',
  ...nodeTestArgs,
];

run(process.execPath, c8Args);
