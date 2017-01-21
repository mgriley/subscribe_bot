'use strict';
const express = require('express');
const bodyparser = require('body-parser');
const crypto = require('crypto');
const request = require('request');
const channels = require('./channels.js');
const _ = require('underscore');

const verifyToken = 'sample_verify_token';
const appSecret = '282d470c174fcb717e78d4bef1684ca4'
//EAAad9gLAyiYBAGbKpJCBddUkxXqD0V0N13mvbJDZAmYej0ZC4EoiWfiz8mZACeXvPXcXVGUgAtXI8pduW7KtM3iADFM6ZBaavgNEr0VaeztR5lR3Ybv8bLOXKaZCGzmcgEhB6gIwbtU69wzvmrY6rhNgpKbXWiDPjaZCFfdHQKsAZDZD
const clientPageToken = 'EAAMJXqIaPQYBANBGWOgVx26L8vFZCXiIGvHY5IMc1ajGTtU1qkZAoFII3Xu1od1ddRRlrECKXc2xzYhWqHkZCnvRh4lnSDeugepMzfJgapemZBiCzksZCF9fZBLHh8BNKAGF77tiZAlM24XkvqvgJbrm2WIv70xtSiSVZCj8v0ylrgZDZD'
//EAAad9gLAyiYBAEHjL0LcFZAT0HxRD7KlFuOlZA7anZCtoQxpgVTqCxSVCj7g1w9N8zU3nBGfhUnpYc3PL6ltIcMh7aqVyZCyaA1hZAb7AwYUhtEmzBLSM2HPtK4BdnNMUlSFffG7IkNmC8ACREIaXTlcXWhKoGOiqmd2gW7AbrgZDZD
const adminPageToken = 'EAAMJXqIaPQYBAALFZAUEBGoNjcEeQlwEXaZBsD4aFgQAAEgHwueGztl862buUyA0bkKcC9QN2Ox6FL7ffZA5jFfh6E7BYp2R1gxYsN0vt7TlYJIcx0tXtFdOKCX1MgH4muV9mmrSBlF5DK6OWXU4xVpc1CxnuQCGtbpQWtjewZDZD'
const clientPageId = '1018866204924227'
const adminPageId = '844898795651577'

// setup server
const app = express();
app.use(bodyparser.json({verify: verifyRequestSignature}));

/*
app.get('/webhook/', function(req, res) {
  if (req.query['hub.verify_token'] === "yuan") {
    console.log("Validating webhook");
    res.send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});
*/

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
    const attachments = message.attachments;
    console.log('client received msg', message);       
    console.log('text', text);
    console.log('attachments', attachments);

    channels.getUserData(senderId, function(err, doc) {
        console.log("this is doc: " + doc);
        if (text === 'mine') {
            channels.myChannels(senderId, function(err, channels) {
                console.log(channels);
                var output = "your channels: ";
                for (var i = 0; i < channels.length; i++) {
                    output = output + "\n" + channels[i];
                }
                sendTextMessage(senderId, output, clientPageToken);
                output = "your channels: ";
            });
        }
        else if (text === 'all') {
            channels.allChannels(function(err, names) {
                var output = "all channels: ";
                for (var i = 0; i < names.length; i++) {
                    output = output + "\n" + names[i];
                }
                sendTextMessage(senderId, output, clientPageToken);
            });
        }
        else {


/*
            if (_.contains(doc.channels, text)) {
                console.log("gdasdfaew");
                channels.unsubscribe(senderId, text, function(err) {
                });
            }

            else {
                sendTextMessage(senderId, "Sorry, I don't understand.", clientPageToken);
            }
*/

            channels.allChannels(function(err, names) {
                if (_.contains(doc.channels, text)) {
                    channels.unsubscribe(senderId, text, function(err) {
                    });
                    sendTextMessage(senderId, "you just unsubscribed from " + text + ".", clientPageToken);
                }
                else if (_.contains(names, text)) {
                    channels.subscribe(senderId, text, function(err) {
                    });
                    console.log("you have subsribed to" + text);
                    sendTextMessage(senderId, "you just subscribed to " + text + ".", clientPageToken);
                }
                else {
                    sendTextMessage(senderId, instructions, clientPageToken);
                }
            });
            
        }
    });

}

var instructions = "Sorry, I don't understand. The commands are as follows: \n 1. type channel name to subscribe and type it again to unsubscribe \n 2. \"mine\": see all your subscribed channels \n 3. \"all\": see all available channels"; 

function serverReceiveMessage(messageEvent) {
    const senderId = messageEvent.sender.id;
    const message = messageEvent.message;
    const text = message.text;
    console.log('server received', text);

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
    if (text === 't') {
        var d = new Date();
        channels.setAdminState(senderId, d, function(err) {
        });
    }
    if (text === 'a') {
        channels.addPermission(senderId, 'mytestc', 'password', function(err) {
            if (err) {
                console.error(err);
            } else {
                console.log('permission granted');
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

app.listen(5000, function() {
    console.log('started listening');
});
