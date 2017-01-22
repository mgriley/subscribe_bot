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

const adminInstructions = "I don't understand, try these:\n\n" +
    "1. \"create name password\"\ncreates a channel with given name and password\n\n" +
    "2. \"add name password\"\nfor permission to send to an existing channel\n\n" +
    "3. \"send name my message\"\nto send a message to your channel with the given name\n\n" +
    "4. \"mine\"\nfor list of the channels you can send to\n\n" +
    "examples:\n\"create pandas a78hyrw\"\n\"add pandas a78hyrw\"\n\"send pandas welcome to my feed about pandas\"";

const clientInstructions = "I don't understand, try these:\n\n" + 
"1. type channel name to toggle subscribe/unsubscribe\n\n2. \"mine\": see all your subscribed channels\n\n3. \"all\": see all available channels";

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
                var output = sprintf('channel name and # listeners:\n\n');
                for (var i = 0; i < allChannels.length; i++) {
                    const c = allChannels[i];
                    output += sprintf('%s (%i)\n', c.name, c.numUsers);
                }
                sendTextMessage(senderId, output, clientPageToken);
            });
        }
        else {
            channels.allChannels(function(err, allChannels) {
                const names = _.map(allChannels, function(c) { return c.name; });
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

function handleDefaultState(senderId, message, doc) {
    var response = "default";
    const rawText = message.text;
    const text = rawText.split(" ");
    const command = text[0].toLowerCase();

    if (text.length === 1 && command === 'mine') {
        channels.myPermissions(senderId, function (err, channels) {
            console.log('channels', channels);
            const listString = _.reduce(channels, function(s, channel) { return s + channel + '\n'; }, '');
            response = "your channels:\n" + listString;
            sendTextMessage(senderId, response, adminPageToken);
        });
    } else if (command === 'create' && text.length === 3) {
        channels.createChannel(senderId, text[1], text[2], function (err) {
            if (err) {
                console.log(err);
                response = "channel with the name \"" + text[1] + "\" already exists";
            } else {
                response = "created channel \"" + text[1] + "\" with password \"" + text[2] + "\"";
            }
            sendTextMessage(senderId, response, adminPageToken);
        });
    } else if (command === 'add' && text.length === 3) {
        channels.addPermission(senderId, text[1], text[2], function (err) {
            if (err) {
                if (err.error === 'wrong password') {
                    response = "incorrect password for channel \"" + text[1] + "\"";
                } else {
                    response = "no channel with that name";
                }
            } else {
                response = "permission added";
            }
            sendTextMessage(senderId, response, adminPageToken);
        });
    } else if (command === 'send' && text.length === 2) {
        const channelName = text[1];
        channels.channelListeners(senderId, channelName, function (err, listeners) {
            if (err) {
                response = sprintf('\"%s\" is not one your channels. type \"help\" to see how to create or add a channel', channelName);
            } else {
                // change to send state
                response = 'send me a text or pic to broadcast. or \"cancel\"';
                channels.setAdminState(senderId, {name: 'send', channelName: channelName}, function(err) {});
            }
            sendTextMessage(senderId, response, adminPageToken);
        });
    } else {
        sendTextMessage(senderId, adminInstructions, adminPageToken);
    }
}

function handleSendState(senderId, message, doc) {
    if (message.text && message.text.split(' ')[0] === 'cancel') {
        sendTextMessage(senderId, 'cancelled', adminPageToken);    
    } else {
        const channelName = doc.state.channelName;
        channels.channelListeners(senderId, channelName, function (err, listeners) {
            // send a msg to all of the listeners (either a pic or an attachment)
            var sendFunc = null;
            var validType = true;

            // if it's a text message, send an exact copy of the text
            if (message.text) {
                console.log('message is text type');
                sendFunc = function(id) {
                    const msg = sprintf("%s sends:\n%s", channelName, message.text);
                    sendTextMessage(id, msg, clientPageToken);
                }
            } else if (message.attachments) {
                console.log('message is attachment type');
                // if it's a photo, send the photo
                const photo = message.attachments[0];
                if (photo.type === 'image') {
                    sendFunc = function(id) {
                        // send a text to tell who it's from, and forward the photo
                        const msg = sprintf("%s sends:", channelName);
                        sendTextMessage(id, msg, clientPageToken);
                        const imageUrl = photo.payload.url;
                        sendImageMessage(id, imageUrl, clientPageToken);
                    }
                } else {
                    // attachment isn't a photo
                    validType = false;
                }
            } else {
                // is this even possible?
                console.error('unknown message format');
                validType = false;
            }

            // if a valid msg type, send
            if (validType) {
                _.each(listeners, sendFunc);
                sendTextMessage(senderId, 'sent!', adminPageToken);
            } else {
                sendTextMessage(senderId, 'i can only send text and image, sorry', adminPageToken);
            }
        });
    }
    channels.setAdminState(senderId, {name: 'default'}, function(err) {});
}

function handleCommand(senderId, message, doc) {
    console.log(doc);
    if (doc.state.name === 'default') {
        if (message.text) {
            handleDefaultState(senderId, message, doc);
        } else {
            sendTextMessage(senderId, adminInstructions, adminPageToken);
        }
    } else if (doc.state.name === 'send') {
        handleSendState(senderId, message, doc);
    } else {
        console.error('unknown state!');
    }
}

function serverReceiveMessage(messageEvent) {
    const senderId = messageEvent.sender.id;
    const message = messageEvent.message;
    console.log('server received', message.text);

    // SAMPLE
    channels.getAdminData(senderId, function (err, doc) {
        handleCommand(senderId, message, doc);
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
