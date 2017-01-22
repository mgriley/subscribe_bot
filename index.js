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

const instructions = "Sorry, I don't understand. The following are the commands I know: \n" +
    "1. \"create\": create a new channel by providing channel name and password" +
    "\n 2. \"add\": add current admin to channel by providing corresponding " +
    "channel name and password \n 3. \"send\" broadcast a message by providing " +
    "name and message \n 4. \"mine\": list all your channel subscriptions";

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
        channels.setUserState(senderId, s, function (err) {
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
    const rawText = message.text;
    const text = rawText.split(" ");
    console.log('server received', message.text);

    // SAMPLE
    channels.getAdminData(senderId, function (err, doc) {
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

    var response = "default";
    const command = text[0].toLowerCase();

    if (text.length === 1 && command === 'mine') {
        channels.myPermissions(senderId, function (err, channels) {
            console.log('channels', channels);
            response = "Your channels: " + channels;
            sendTextMessage(senderId, response, adminPageToken);
        });
    } else if (text.length === 3) {

        const param1 = text[1];
        const param2 = text[2];

        if (command === 'create') {
            channels.createChannel(senderId, param1, param2, function (err) {
                if (err) {
                    console.log(err);
                    response = "Channel with the name \"" + param1 + "\" already exists";
                } else {
                    response = "Created channel \"" + param1 + "\" with password \"" + param2 + "\"";
                }
                sendTextMessage(senderId, response, adminPageToken);
            });
        } else if (command === 'add') {
            channels.addPermission(senderId, param1, param2, function (err) {
                if (err) {
                    if (err.error = 'wrong password') {
                        response = "Incorrect password for channel \"" + param1 + "\"";
                    } else {
                        response = "No channel with that name";
                    }
                } else {
                    response = "Permission added";
                }
                sendTextMessage(senderId, response, adminPageToken);
            });
        } else if (command === 'send') {
            channels.channelListeners(senderId, param1, function (err, listeners) {
                if (err) {
                    response = "You do not have the required permissions"
                } else {
                    // send a msg to all of the listeners
                    _.each(listeners, function (id) {
                        sendTextMessage(id, rawText.indexOf(param2), clientPageToken);
                    });
                    response = "Successfully sent!";
                }
                sendTextMessage(senderId, response, adminPageToken);
            });
        } else {
            sendTextMessage(senderId, instructions, adminPageToken);
        }
    } else {
        sendTextMessage(senderId, instructions, adminPageToken);
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
