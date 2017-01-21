'use strict';
const express = require('express');
const bodyparser = require('body-parser');
const crypto = require('crypto');
const request = require('request');
const channels = require('./channels.js');
const _ = require('underscore');

const verifyToken = 'sample_verify_token';
const appSecret = '177c81065bd482943604214dea6221a7'
const clientPageToken = 'EAAad9gLAyiYBAGbKpJCBddUkxXqD0V0N13mvbJDZAmYej0ZC4EoiWfiz8mZACeXvPXcXVGUgAtXI8pduW7KtM3iADFM6ZBaavgNEr0VaeztR5lR3Ybv8bLOXKaZCGzmcgEhB6gIwbtU69wzvmrY6rhNgpKbXWiDPjaZCFfdHQKsAZDZD'
const adminPageToken = 'EAAad9gLAyiYBAEHjL0LcFZAT0HxRD7KlFuOlZA7anZCtoQxpgVTqCxSVCj7g1w9N8zU3nBGfhUnpYc3PL6ltIcMh7aqVyZCyaA1hZAb7AwYUhtEmzBLSM2HPtK4BdnNMUlSFffG7IkNmC8ACREIaXTlcXWhKoGOiqmd2gW7AbrgZDZD'
const clientPageId = '1399706990047748'
const adminPageId = '646470285540501'

// setup server
const app = express();
app.use(bodyparser.json({verify: verifyRequestSignature}));

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
    res.send();

    if (data.object === 'page') {
        data.entry.forEach(function(pageEntry) {
            const pageId = pageEntry.id;
            console.log('page id: ', pageId);
            
            pageEntry.messaging.forEach(function(messageEvent) {
                if (messageEvent.message) {
                    if (pageId === clientPageId) {
                        clientReceiveMessage(messageEvent);
                    } else if (pageId === adminPageId) {
                        serverReceiveMessage(messageEvent);
                    } else {
                        console.error('unknown page id');
                    }
                } else {
                    console.log('unknown message event', messageEvent);
                }
            });
        });
    }
});

function clientReceiveMessage(messageEvent) {
    const senderId = messageEvent.sender.id;
    const message = messageEvent.message;
    const text = message.text;
    console.log('client received msg', message);       
    console.log('text', text);

    channels.getUserData(senderId, function(err, doc) {
        console.log(doc);
    });

    if (text === 's') {
        channels.subscribe(senderId, 'mytestb', function(err) {
        });
    }
    if (text === 'u') {
        channels.unsubscribe(senderId, 'mytestb', function(err) {
        });
    }
    if (text === 'm') {
        channels.myChannels(senderId, function(err, names) {
            console.log('mine:', names);
        });
    }
    if (text === 'a') {
        channels.allChannels(function(err, names) {
            if (err) {
                console.error(err);
            }
            console.log('all: ', names);
        });
    }

    sendTextMessage(senderId, text, clientPageToken);
}

function serverReceiveMessage(messageEvent) {
    const senderId = messageEvent.sender.id;
    const message = messageEvent.message;
    const text = message.text;
    console.log('server received', text);

    channels.getAdminData(senderId, function(err, doc) {
        console.log(doc);
    });

    if (text === 'm') {
        channels.myPermissions(senderId, function(err, channels) {
            console.log('channels', channels);
        });
    }
    if (text === 'c') {
        channels.createChannel(senderId, 'mytestb', 'password', function(err) {
            if (err) {
                console.log(err);
            } else {
                console.log('created');
            }
        });
    }
    if (text === 'l') {
        channels.channelListeners(senderId, 'mytestb', function(err, listeners) {
            if (err) {
                console.error(err);
            } else {
                // send a msg to all of the listeners
                _.each(listeners, function(id) {
                    sendTextMessage(id, 'greetings', clientPageToken);
                });
            }
        });
    }

    sendTextMessage(senderId, text, adminPageToken);
}

function sendTextMessage(recipientId, text, pageToken) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: text
        }
    };
    callSendApi(messageData, pageToken);
}

function callSendApi(messageData, pageToken) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: pageToken},
        method: 'POST',
        json: messageData
    }, function(err, resp, body) {
        if (!err && resp.statusCode === 200) {
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
