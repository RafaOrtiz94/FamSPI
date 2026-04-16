const fs = require('fs');
const path = require('path');

const dir = __dirname + '/src/modules/calidad';
const oldImport = '../../../../services/api';
const newImport = '../../core/api';

function fixDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      fixDir(filepath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      let content = fs.readFileSync(filepath, 'utf8');
      if (content.includes(oldImport)) {
        content = content.replace(oldImport, newImport);
        fs.writeFileSync(filepath, content, 'utf8');
        console.log('Fixed:', filepath.replace(__dirname + '/', ''));
      }
    }
  }
}

fixDir(dir);
console.log('Done');