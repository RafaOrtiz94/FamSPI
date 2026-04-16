const fs = require('fs');
const path = require('path');

const dir = __dirname + '/src/modules/calidad/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('Workspace.jsx'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');
  const oldImport = '../../../hooks/useAuth';
  const newImport = '../../../core/auth/useAuth';
  
  if (content.includes(oldImport)) {
    content = content.replace(oldImport, newImport);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Fixed:', file);
  }
}

console.log('Done');