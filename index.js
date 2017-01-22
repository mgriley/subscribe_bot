'use strict';
const express = require('express');
const bodyparser = require('body-parser');
const crypto = require('crypto');
const request = require('request');
const channels = require('./channels.js');
const _ = require('underscore');
const validate = require('jsonschema').validate;
const sprintf = require('sprintf-js').sprintf;

const port = 3003;
const verifyToken = 'sample_verify_token';
const appSecret = '177c81065bd482943604214dea6221a7'
const clientPageToken = 'EAAad9gLAyiYBAGbKpJCBddUkxXqD0V0N13mvbJDZAmYej0ZC4EoiWfiz8mZACeXvPXcXVGUgAtXI8pduW7KtM3iADFM6ZBaavgNEr0VaeztR5lR3Ybv8bLOXKaZCGzmcgEhB6gIwbtU69wzvmrY6rhNgpKbXWiDPjaZCFfdHQKsAZDZD'
const adminPageToken = 'EAAad9gLAyiYBAEHjL0LcFZAT0HxRD7KlFuOlZA7anZCtoQxpgVTqCxSVCj7g1w9N8zU3nBGfhUnpYc3PL6ltIcMh7aqVyZCyaA1hZAb7AwYUhtEmzBLSM2HPtK4BdnNMUlSFffG7IkNmC8ACREIaXTlcXWhKoGOiqmd2gW7AbrgZDZD'
const clientPageId = '1399706990047748'
const adminPageId = '646470285540501'

const adminInstructions = "sorry, I don't understand, try these: \n" +
    "1. \"create name password\"\nto create a channel with given name and password\n\n" +
    "2. \"add name password\"\nto get permission to send to an existing channel\n\n" +
    "3. \"send name my message\"\nto send a message to the channel with the given name (must be one of your channels)\n\n" +
    "4. \"mine\"\nfor list of the channels you can send to";

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
app.get('/data', function(req, res) {
    console.log('get: /data');

    // validate req
    if (validate(req.body, dataReq).errors) {
        res.status('400').send('invalid req body');
        return;
    }

    // get the channel data
    const name = data.name;
    const password = data.password;
    
    channels.channelData(name, password, function(err, data) {
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

    channels.getUserData(senderId, function(err, doc) {
        if (text === 'mine') {
            channels.myChannels(senderId, function(err, myChannels) {
                var output = "your listening to:";
                for (var i = 0; i < myChannels.length; i++) {
                    output = output + "\n" + myChannels[i];
                }
                sendTextMessage(senderId, output, clientPageToken);
            });
        }
        else if (text === 'all') {
            channels.allChannels(function(err, allChannels) {
                const names = _.map(allChannels, function(c) { return c.name; });
                var output = sprintf('%-20s%s', 'channel name', '# users\n\n');
                for (var i = 0; i < allChannels.length; i++) {
                    const c = allChannels[i];
                    output += sprintf('%-20s(%i)\n', c.name, c.numUsers);
                }
                sendTextMessage(senderId, output, clientPageToken);
            });
        }
        else {
            channels.allChannels(function(err, allChannels) {
                const names = _.map(allChannels, function(c) { return c.name; });
                if (_.contains(doc.channels, text)) {
                    channels.unsubscribe(senderId, text, function(err) {
                    });
                    sendTextMessage(senderId, "you just unsubscribed from " + text, clientPageToken);
                }
                else if (_.contains(names, text)) {
                    channels.subscribe(senderId, text, function(err) {
                    });
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
                    if (err.error === 'wrong password') {
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
            sendTextMessage(senderId, adminInstructions, adminPageToken);
        }
    } else {
        sendTextMessage(senderId, adminInstructions, adminPageToken);
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

app.listen(port, function() {
    console.log('started listening');
});
