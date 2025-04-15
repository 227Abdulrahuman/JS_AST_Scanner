# JS_AST_Scanner
Uses Abstract Syntax Tree to scan a JS file for dangerous DOM Sources/Sinks


### Dependancies 
npm install @babel/parser @babel/traverse node-fetch minimist
npm install cheerio node-fetch


### Run
node ./scan.js --rules rule.txt --file script.js <OR> --url https://test.com/script.js 
