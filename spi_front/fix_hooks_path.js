const fs = require('fs');
const path = require('path');

const dir = __dirname + '/src/modules/calidad/hooks';
const wrongPath = '../../../../../core/api';
const correctPath = '../../core/api';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.jsx'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');
  if (content.includes(wrongPath)) {
    content = content.replace(wrongPath, correctPath);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Fixed:', file);
  }
}

console.log('Done');