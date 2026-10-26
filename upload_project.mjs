import fs from 'fs';
import path from 'path';

const owner = 'nikolasmelo';
const repo = 'securityproject';
const branch = 'main';
const token = '';

const headers = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'UploadScript'
};

async function api(method, endpoint, body) {
  const url = `https://api.github.com/repos/${owner}/${repo}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const errorBody = await response.text();
    if ((response.status === 404 || response.status === 409) && method === 'GET') return null; // permite 404/409 no GET
    throw new Error(`GitHub API error ${response.status} on ${endpoint}: ${errorBody}`);
  }
  return response.json();
}

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    if (stat.isDirectory()) {
      if (
        file === 'node_modules' ||
        file === 'dist' ||
        file === '.git' ||
        file === '.vscode' ||
        file === '.idea' ||
        file === '.nx' ||
        file === 'coverage'
      ) {
        continue;
      }
      getFiles(fullPath, fileList);
    } else {
      if (
        file === '.DS_Store' ||
        file.startsWith('.env') ||
        file.endsWith('.log') ||
        relativePath === 'upload_project.mjs' // ignora o próprio script para não poluir
      ) {
        continue;
      }
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function upload() {
  console.log('Iniciando o upload do código-fonte completo via GitHub API...');
  const projectDir = process.cwd();
  
  // Obter lista de todos os arquivos relevantes do projeto
  const files = getFiles(projectDir);
  console.log(`Encontrados ${files.length} arquivos de código-fonte para upload.`);

  // Obter ref atual da branch main (se existir)
  let baseTreeSha = null;
  const refInfo = await api('GET', `/git/ref/heads/${branch}`);
  
  if (refInfo) {
    const commitInfo = await api('GET', `/git/commits/${refInfo.object.sha}`);
    baseTreeSha = commitInfo.tree.sha;
  } else {
    // Se a branch main não existir, verifica se o repositório está vazio inicializando um README
    const mainRef = await api('GET', `/git/ref/heads/main`).catch(() => null);
    if (!mainRef) {
       console.log('Repositório vazio. Inicializando com README.md...');
       await api('PUT', '/contents/README.md', {
         message: 'Initial commit',
         content: Buffer.from('# Security Project\nGerenciador de senhas offline criptografado.').toString('base64')
       }).catch(e => console.log('Aviso ao inicializar: ' + e.message));
       await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Criar blobs
  const treeItems = [];
  for (const file of files) {
    const relativePath = path.relative(projectDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, { encoding: 'base64' });
    
    console.log(`Fazendo upload do arquivo: ${relativePath}`);
    const blob = await api('POST', '/git/blobs', {
      content: content,
      encoding: 'base64'
    });
    
    treeItems.push({
      path: relativePath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }

  // Criar árvore
  console.log('Criando nova árvore do repositório...');
  const treePayload = { tree: treeItems };
  if (baseTreeSha) treePayload.base_tree = baseTreeSha;
  const treeInfo = await api('POST', '/git/trees', treePayload);

  // Criar commit
  console.log('Criando commit com o código-fonte...');
  const commitPayload = {
    message: 'Upload do código-fonte completo (configuração Firebase e correções)',
    tree: treeInfo.sha
  };
  if (refInfo) commitPayload.parents = [refInfo.object.sha];
  const newCommit = await api('POST', '/git/commits', commitPayload);

  // Atualizar ou criar ref para main
  if (refInfo) {
    console.log('Atualizando branch main...');
    await api('PATCH', `/git/refs/heads/${branch}`, {
      sha: newCommit.sha,
      force: true
    });
  } else {
    console.log('Criando branch main...');
    await api('POST', `/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: newCommit.sha
    });
  }

  console.log('Upload do código-fonte completo concluído com sucesso!');
}

upload().catch(console.error);
