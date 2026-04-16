const fs = require('fs');
const path = require('path');

const dir = __dirname + '/src/modules/calidad/hooks';
const oldImport = '../../../core/api';
const newImport = '../../core/api';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');
  if (content.includes(oldImport)) {
    content = content.replace(oldImport, newImport);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Fixed:', file);
  }
}

console.log('Done');