import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let fs = require('fs')

if (!fs.existsSync('./config.js')) {
  console.log('No config detected. Setting sensible defaults for local development...');
  fs.copyFile('./config.js.example', 'config.js', (err) => {
    console.log('Creating config.js complete.');
    if (err) throw err;
  })
}