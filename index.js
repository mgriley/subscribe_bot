'use strict';
const express = require('express');
const bodyparser = require('body-parser');
const crypto = require('crypto');
const request = require('request');
const channels = require('./channels.js');
const _ = require('underscore');

const verifyToken = 'sample_verify_token';
const appSecret = 'b3167d68247c22829e74279ca2921a60'
const clientPageToken = 'EAAQyl3PaDKIBAAhvXnVQ7aZBY43qIpX1XPN65qCmmo7P8GOeQ34UmkV1nO3Tw954ZA7jsLsbnABg8A7hKAw5cBqBv0eNThSZBG8WN3KmdDqUtOJRrhJHWahDzxqf2QH3NYYOdymtDf8rqbAsJiAxtmO7WLRKOJEiD3ZCKFC1MAZDZD'
const adminPageToken = 'EAAQyl3PaDKIBAIK3qsGBZCuXgYtCYNn677p4QCYHnr5nNKIMH7IYhgpbrXetQPeBxi1GKZASG2dIaVBAXsD6kKG8zTbx7xQxpBLyh0cfLBzsgyYK2ZAuKL4ViMvHotrqmmbrUi8Qh25Lef7Ii5L28qL6nk5pJpwU8kAtiSYswZDZD'
const clientPageId = '733259543504701'
const adminPageId = '974674739330325'

// setup server
const app = express();
app.use(bodyparser.json({ verify: verifyRequestSignature }));

// for validation:
app.get('/incoming', function (req, res) {
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

app.post('/incoming', function (req, res) {
    const data = req.body;
    console.log('received msg');
    res.send();

    if (data.object === 'page') {
        data.entry.forEach(function (pageEntry) {
            const pageId = pageEntry.id;
            console.log('page id: ', pageId);

            pageEntry.messaging.forEach(function (messageEvent) {
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
    const attachments = message.attachments;
    console.log('client received msg', message);       
    console.log('text', text);
    console.log('attachments', attachments);

    channels.getUserData(senderId, function (err, doc) {
        console.log(doc);
    });

    if (text === 's') {
        channels.subscribe(senderId, 'mytestb', function (err) {
        });
    }
    if (text === 'u') {
        channels.unsubscribe(senderId, 'mytestb', function (err) {
        });
    }
    if (text === 'm') {
        channels.myChannels(senderId, function (err, names) {
            console.log('mine:', names);
        });
    }
    if (text === 'a') {
        channels.allChannels(function (err, names) {
            if (err) {
                console.error(err);
            }
            console.log('all: ', names);
        });
    }
    if (text === 't') {
        const s = new Date();
        channels.setUserState(senderId, s, function(err) {
        });
    }

    if (text) {
        sendTextMessage(senderId, text, clientPageToken);
    }
    if (attachments) {
        sendImageMessage(senderId, attachments[0].payload.url, clientPageToken);
    }
}

function serverReceiveMessage(messageEvent) {
    const senderId = messageEvent.sender.id;
    const message = messageEvent.message;
    const text = message.text.split(" ");
    console.log('server received', message.text);

    // SAMPLE
    channels.getAdminData(senderId, function(err, doc) {
        console.log(doc);

        // FOR WILL
        /*
        if (doc.state === 'default') {
            // ... user types 'send channelname'
            channels.setAdminState(senderId, 'sendnext', function(err) {
            });
        } else if (doc.state === 'sendnext') {
            if (text === 'cancel') {
                // ...
                channels.setAdminState(senderId, 'default', function(err) {});
            } else {
                // broadcast whatever text or image got sent
            }
        }
        */
    });

    var response = "";

    if (text.length === 3) {
        const command = text[0];
        const param1 = text[1];
        const param2 = text[2];

        if (text[0] === 'm') {
            channels.myPermissions(senderId, function (err, channels) {
                console.log('channels', channels);
            });
        }

        if (text[0] === 'create') {
            channels.createChannel(senderId, param1, param2, function (err) {
                if (err) {
                    //console.log(err);
                    response = err;
                } else {
                    response = "Created";
                }
            });
        }
        
        if (text[0] === 'l') {
            channels.channelListeners(senderId, 'mytestb', function (err, listeners) {
                if (err) {
                    console.error(err);
                } else {
                    // send a msg to all of the listeners
                    _.each(listeners, function (id) {
                        sendTextMessage(id, 'greetings', clientPageToken);
                    });
                }
            });
        }
        if (text[0] === 'test') {
            console.log('test type');
        }

        sendTextMessage(senderId, "heard", adminPageToken);
    }
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

function sendImageMessage(recipientId, imageUrl, pageToken) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: 'image',
                payload: {
                    url: imageUrl
                }
            }
        }
    }
    callSendApi(messageData, pageToken);
}

function callSendApi(messageData, pageToken) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: pageToken },
        method: 'POST',
        json: messageData
    }, function (err, resp, body) {
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

app.listen(5000, function () {
    console.log('started listening');
});
