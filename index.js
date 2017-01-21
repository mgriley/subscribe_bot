const express = require('express');
const bodyparser = require('body-parser');
const crypto = require('crypto');
const request = require('request');

const app = express();
app.use(bodyparser.json({verify: verifyRequestSignature}));

const verifyToken = 'sample_verify_token';

const pageAccessToken = 'EAAad9gLAyiYBAJrG7iJiBdCcbDiTA5pHSeJLIUMHDCZC2J2oRQ4JSDBjVPggU0vPKhZAXpr6ZCnqqhHRanuLTqBmiN1aVZCnaC9txZA90JcS1t8HT6ZCR0amrlPAJi4LV3mq2HKjIpGmP5lzR6naLJPCcKZAprDGB4IqXZBKy0onlwZDZD';
const appSecret = '177c81065bd482943604214dea6221a7'


// for validation:
app.get('/incoming', function(req, res) {
    // valid the endpoint
    console.log('received req');
    if (req.query['hub.mode'] === 'subscribe'
        && req.query['hub.verify_token'] === verifyToken) {
        console.log('validating webhook');
        res.send(req.query['hub.challenge']);
    } else {
        console.log('failed validation');
        res.status('403').send();
    }
});

app.post('/incoming', function(req, res) {
    const data = req.body;
    console.log('received msg');

    if (data.object === 'page') {
        data.entry.forEach(function(pageEntry) {
            var pageId = pageEntry.id;
            console.log('page id: ', pageId);
            
            pageEntry.messaging.forEach(function(messageEvent) {
                if (messageEvent.message) {
                    receiveMessage(messageEvent);
                } else {
                    console.log('unknown message event', messageEvent);
                }
            });
        });
    }
    res.send();
});

function receiveMessage(messageEvent) {
    const senderId = messageEvent.sender.id;
    const message = messageEvent.message;
    const text = message.text;
    console.log('received msg', message);       
    console.log('text', text);

    sendTextMessage(senderId, text);
}

function sendTextMessage(recipientId, text) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: text
        }
    };
    callSendApi(messageData);
}

function callSendApi(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: pageAccessToken},
        method: 'POST',
        json: messageData
    }, function(err, resp, body) {
        if (!err && resp.statusCode == 200) {
            console.log('send success');
        } else {
            console.error('send fail', err, resp.statusCode, body);
        }
    });
}

function verifyRequestSignature(req, res, buf) {
    console.log('verifying');
    var sig = req.headers['x-hub-signature'];
    if (!sig) {
        throw new Error('could not validate');
    } else {
        var elements = sig.split('=');
        var method = elements[0];
        var sigHash = elements[1];
        var expectedHash = crypto.createHmac('sha1', appSecret)
            .update(buf).digest('hex');
        if (sigHash !== expectedHash) {
            throw new Error('hash does not match');
        }
    }
}

app.listen(3003, function() {
    console.log('started listening');
});
