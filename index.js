const express = require('express');
const bodyparser = require('body-parser');

const app = express();

app.use(bodyparser.json());

app.get('/', function(req, res) {
    res.send('hello world');
});

app.listen(3003, function() {
    console.log('started listening');
});
