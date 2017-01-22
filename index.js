'use strict';
const express = require('express');
const bodyparser = require('body-parser');
const crypto = require('crypto');
const request = require('request');
const channels = require('./channels.js');
const _ = require('underscore');
const validate = require('jsonschema').validate;
const sprintf = require('sprintf-js').sprintf;

const port = 5000;
const verifyToken = 'sample_verify_token';
const appSecret = 'b3167d68247c22829e74279ca2921a60'
const clientPageToken = 'EAAQyl3PaDKIBAAhvXnVQ7aZBY43qIpX1XPN65qCmmo7P8GOeQ34UmkV1nO3Tw954ZA7jsLsbnABg8A7hKAw5cBqBv0eNThSZBG8WN3KmdDqUtOJRrhJHWahDzxqf2QH3NYYOdymtDf8rqbAsJiAxtmO7WLRKOJEiD3ZCKFC1MAZDZD'
const adminPageToken = 'EAAQyl3PaDKIBAIK3qsGBZCuXgYtCYNn677p4QCYHnr5nNKIMH7IYhgpbrXetQPeBxi1GKZASG2dIaVBAXsD6kKG8zTbx7xQxpBLyh0cfLBzsgyYK2ZAuKL4ViMvHotrqmmbrUi8Qh25Lef7Ii5L28qL6nk5pJpwU8kAtiSYswZDZD'
const clientPageId = '733259543504701'
const adminPageId = '974674739330325'

const adminInstructions = "Sorry, I don't understand. The following are the commands I know: \n" +
    "1. \"create\": create a new channel by providing channel name and password" +
    "\n 2. \"add\": add current admin to channel by providing corresponding " +
    "channel name and password \n 3. \"send\" broadcast a message by providing " +
    "name and message \n 4. \"mine\": list all your channel subscriptions";

const clientInstructions = "Sorry, I don't understand. The commands are as follows: \n 1. type channel name to subscribe and type it again to unsubscribe \n 2. \"mine\": see all your subscribed channels \n 3. \"all\": see all available channels";

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

const dataReq = {
    type: 'object',
    properties: {
        name: {
            type: 'string'
        },
        password: {
            type: 'string'
        }
    },
    required: ['name', 'password']
}
app.get('/data', function (req, res) {
    console.log('get: /data');

    // validate req
    if (validate(req.body, dataReq).errors) {
        res.status('400').send('invalid req body');
        return;
    }

    // get the channel data
    const name = data.name;
    const password = data.password;

    channels.channelData(name, password, function (err, data) {
        if (err) {
            res.send(err);
        } else {
            res.send(data);
        }
    });
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
        if (text === 'mine') {
            channels.myChannels(senderId, function (err, channels) {
                var output = "your listening to:";
                for (var i = 0; i < channels.length; i++) {
                    output = output + "\n" + channels[i];
                }
                sendTextMessage(senderId, output, clientPageToken);
            });
        }
        else if (text === 'all') {
            channels.allChannels(function (err, channels) {
                const names = _.map(channels, function (c) { return c.name; });
                var output = sprintf('%-20s%s', 'channel name', '# users\n');
                for (var i = 0; i < channels.length; i++) {
                    const c = channels[i];
                    output += sprintf('%-20s(%5i)\n', c.name, c.numUsers);
                }
                sendTextMessage(senderId, output, clientPageToken);
            });
        }
        else {
            channels.allChannels(function (err, channels) {
                const names = _.map(channels, function (c) { return c.name; });
                if (_.contains(doc.channels, text)) {
                    channels.unsubscribe(senderId, text, function (err) {
                    });
                    sendTextMessage(senderId, "you just unsubscribed from " + text, clientPageToken);
                }
                else if (_.contains(names, text)) {
                    channels.subscribe(senderId, text, function (err) { });
                    console.log("you have subsribed to" + text);
                    sendTextMessage(senderId, "you just subscribed to " + text, clientPageToken);
                }
                else {
                    sendTextMessage(senderId, clientInstructions, clientPageToken);
                }
            });

        }
    });
}

function serverReceiveMessage(messageEvent) {
    const senderId = messageEvent.sender.id;
    const message = messageEvent.message;
    const rawText = message.text;
    const text = rawText.split(" ");
    console.log('server received', message.text);

    // SAMPLE
    channels.getAdminData(senderId, function (err, doc) {

        var response = "default";
        const command = text[0].toLowerCase();

        if (text.length === 1 && command === 'mine') {
            channels.myPermissions(senderId, function (err, channels) {
                console.log('channels', channels);
                response = "Your channels: " + channels;
                sendTextMessage(senderId, response, adminPageToken);
            });
        } else if (command === 'create' && text.length === 3) {
            channels.createChannel(senderId, text[1], text[2], function (err) {
                if (err) {
                    console.log(err);
                    response = "Channel with the name \"" + text[1] + "\" already exists";
                } else {
                    response = "Created channel \"" + text[1] + "\" with password \"" + text[2] + "\"";
                }
                sendTextMessage(senderId, response, adminPageToken);
            });
        } else if (command === 'add' && text.length === 3) {
            channels.addPermission(senderId, text[1], text[2], function (err) {
                if (err) {
                    if (err.error === 'wrong password') {
                        response = "Incorrect password for channel \"" + text[1] + "\"";
                    } else {
                        response = "No channel with that name";
                    }
                } else {
                    response = "Permission added";
                }
                sendTextMessage(senderId, response, adminPageToken);
            });
        } else if (command === 'send' && text.length >= 3) {
            channels.channelListeners(senderId, text[1], function (err, listeners) {
                if (err) {
                    response = "You do not have the required permissions"
                } else {
                    // send a msg to all of the listeners
                    _.each(listeners, function (id) {
                        sendTextMessage(id, rawText.slice(rawText.indexOf(text[2])), clientPageToken);
                    });
                    response = "Successfully sent!";
                }
                sendTextMessage(senderId, response, adminPageToken);
            });
        } else {
            sendTextMessage(senderId, adminInstructions, adminPageToken);
        }

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

app.listen(port, function () {
    console.log('started listening');
});
