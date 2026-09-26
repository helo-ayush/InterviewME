const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

function resolvePython(appSubdir) {
  const venvWin = path.join(rootDir, 'apps', appSubdir, '.venv', 'Scripts', 'python.exe');
  const venvUnix = path.join(rootDir, 'apps', appSubdir, '.venv', 'bin', 'python');
  if (fs.existsSync(venvWin)) return venvWin;
  if (fs.existsSync(venvUnix)) return venvUnix;
  return isWin ? 'python' : 'python3';
}

const apiPython = resolvePython('api');
const agentPython = resolvePython('agent');
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const SERVICES = {
  api: {
    name: 'API',
    color: '\x1b[34m', // Blue
    cmd: apiPython,
    args: ['-m', 'uvicorn', 'main:app', '--app-dir', 'apps/api', '--reload', '--port', '8000'],
    cwd: rootDir,
  },
  agent: {
    name: 'AGENT',
    color: '\x1b[32m', // Green
    cmd: agentPython,
    args: ['apps/agent/agent.py', 'dev'],
    cwd: rootDir,
  },
  web: {
    name: 'WEB',
    color: '\x1b[35m', // Magenta
    cmd: npmCmd,
    args: ['run', 'dev'],
    cwd: path.join(rootDir, 'apps', 'web'),
  },
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function startProcess(serviceKey) {
  const service = SERVICES[serviceKey];
  if (!service) {
    console.error(`Unknown service: ${serviceKey}. Available: ${Object.keys(SERVICES).join(', ')}`);
    process.exit(1);
  }

  const prefix = `${service.color}${BOLD}[${service.name}]${RESET} `;
  console.log(`${prefix}Starting ${service.name}...`);

  const child = spawn(service.cmd, service.args, {
    cwd: service.cwd,
    shell: serviceKey === 'web' ? isWin : false,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.log(`${prefix}${line}`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.error(`${prefix}${line}`);
      }
    });
  });

  child.on('close', (code) => {
    console.log(`${prefix}Process exited with code ${code}`);
  });

  return child;
}

const target = process.argv[2];

if (target && SERVICES[target]) {
  // Single service mode (e.g., node scripts/dev.js api)
  startProcess(target);
} else {
  // All services mode
  console.log(`\n${BOLD}=== Starting InterviewME (API + AGENT + WEB) ===${RESET}\n`);
  const children = Object.keys(SERVICES).map((key) => startProcess(key));

  function cleanup() {
    console.log(`\n${BOLD}Shutting down all services...${RESET}`);
    children.forEach((child) => {
      try {
        if (isWin) {
          spawn('taskkill', ['/pid', child.pid, '/f', '/t'], { stdio: 'ignore' });
        } else {
          child.kill('SIGINT');
        }
      } catch (e) {
        // ignore
      }
    });
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
