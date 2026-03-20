const { marked } = require('marked');

// Mimic our extension
marked.use({ extensions: [{
  name: 'htmlComment',
  level: 'inline',
  start(src) { return src.indexOf('<' + '!--'); },
  tokenizer(src) {
    const m = /^<!--[\s\S]*?-->/.exec(src);
    if (m) return { type: 'htmlComment', raw: m[0], text: m[0] };
  },
  renderer(t) { return '<span>X</span>'; }
}]});

console.log('=== Test 1: comment at start ===');
const tokens1 = marked.lexer('<' + '!-- start --> some text\n');
console.log(JSON.stringify(tokens1, null, 2));

console.log('\n=== Test 2: comment in middle ===');
const tokens2 = marked.lexer('hello <' + '!-- note --> world\n');
console.log(JSON.stringify(tokens2, null, 2));

console.log('\n=== Test 3: standalone block comment ===');
const tokens3 = marked.lexer('<' + '!-- block -->\n');
console.log(JSON.stringify(tokens3, null, 2));
