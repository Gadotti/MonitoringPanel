'use strict';

const path     = require('path');
const fs       = require('fs');
const readline = require('readline');
const { hashPassword } = require('./src/auth');

const USERS_PATH = path.resolve(__dirname, 'configs', 'users.json');

function readUsers() {
  if (!fs.existsSync(USERS_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); }
  catch { return []; }
}

function writeUsers(users) {
  fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true });
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function askPassword(prompt) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(prompt, (answer) => { rl.close(); resolve(answer); });
      return;
    }

    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let answer = '';

    const handler = (ch) => {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(answer);
      } else if (ch === '') {
        process.exit();
      } else if (ch === '') {
        if (answer.length > 0) {
          answer = answer.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        answer += ch;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', handler);
  });
}

async function createUser() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const name = (await ask(rl, 'Nome completo: ')).trim();
  const username = (await ask(rl, 'Login (username): ')).trim();
  console.log('Nível de acesso:\n  [1] viewer  — apenas leitura\n  [2] editor  — leitura e escrita');
  const roleChoice = (await ask(rl, 'Escolha (1/2): ')).trim();
  rl.close();

  if (!username || !/^[a-zA-Z0-9._-]+$/.test(username)) {
    console.error('✗ Username inválido. Use apenas letras, números, ponto, hífen e underscore.');
    process.exit(1);
  }

  const users = readUsers();
  if (users.some(u => u.username === username)) {
    console.error(`✗ Usuário "${username}" já existe.`);
    process.exit(1);
  }

  const role = roleChoice === '2' ? 'editor' : 'viewer';

  const password = await askPassword('Senha: ');
  if (password.length < 12) {
    console.error('✗ Senha deve ter no mínimo 12 caracteres.');
    process.exit(1);
  }

  const confirm = await askPassword('Confirmar senha: ');
  if (password !== confirm) {
    console.error('✗ Senhas não coincidem.');
    process.exit(1);
  }

  const { salt, hash } = hashPassword(password);
  users.push({ name, username, role, salt, hash, createdAt: new Date().toISOString() });
  writeUsers(users);
  console.log(`✓ Usuário "${username}" criado com sucesso.`);
}

function listUsers() {
  const users = readUsers();
  if (users.length === 0) {
    console.log('Nenhum usuário cadastrado.');
    return;
  }
  users.forEach(u => {
    console.log(`${u.username} (${u.role}) — ${u.name} — criado em ${u.createdAt}`);
  });
}

function deleteUser(username) {
  const users = readUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) {
    console.error(`✗ Usuário "${username}" não encontrado.`);
    process.exit(1);
  }
  users.splice(idx, 1);
  writeUsers(users);
  console.log(`✓ Usuário "${username}" removido.`);
}

async function resetUser(username) {
  const users = readUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) {
    console.error(`✗ Usuário "${username}" não encontrado.`);
    process.exit(1);
  }

  const password = await askPassword('Nova senha: ');
  if (password.length < 12) {
    console.error('✗ Senha deve ter no mínimo 12 caracteres.');
    process.exit(1);
  }

  const confirm = await askPassword('Confirmar senha: ');
  if (password !== confirm) {
    console.error('✗ Senhas não coincidem.');
    process.exit(1);
  }

  const { salt, hash } = hashPassword(password);
  users[idx] = { ...users[idx], salt, hash };
  writeUsers(users);
  console.log(`✓ Senha de "${username}" redefinida com sucesso.`);
}

const args = process.argv.slice(2);

if (args[0] === '--list') {
  listUsers();
} else if (args[0] === '--delete') {
  if (!args[1]) { console.error('Uso: node create-user.js --delete <username>'); process.exit(1); }
  deleteUser(args[1]);
} else if (args[0] === '--reset') {
  if (!args[1]) { console.error('Uso: node create-user.js --reset <username>'); process.exit(1); }
  resetUser(args[1]).catch(err => { console.error(err.message); process.exit(1); });
} else {
  createUser().catch(err => { console.error(err.message); process.exit(1); });
}
