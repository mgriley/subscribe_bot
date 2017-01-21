'use strict';
const MongoClient = require('mongodb').MongoClient
const _ = require('underscore');

var db;
const url = 'mongodb://localhost:27017/botcast'
MongoClient.connect(url, function(err, myDb) {
    if (err) {
        console.error(err);
    }
    db = myDb;
});

module.exports = {

    // if the user exists, returns the user's data
    // if the user does not exist, creates the user and returns the data
    // callback: func(error, data)
    getUserData: function(userId, callback) {
        db.collection('users').findOne({fbId: userId}, function(error, doc) {
            if (doc) {
                callback(null, doc);
            } else {
                var data = {
                    fbId: userId,
                    channels: [],
                    state: 'default'
                }
                db.collection('users').insertOne(data);
                callback(null, data);
            }
        });
    },

    // assume valid userId and channelName
    // userId cannot already be in the channel
    // callback: fun(error)
    subscribe: function(userId, channelName, callback) {
        // add listener
        var addListener = {
            $push: {
                listeners: userId
            }
        };
        db.collection('channels').updateOne({name: channelName}, addListener);
        
        var addChannel = {
            $push: {
                channels: channelName
            }
        };
        db.collection('users').updateOne({fbId: userId}, addChannel);

        callback(null);
    },

    // callback: fun(error)
    // user must already be in the channel!
    unsubscribe: function(userId, channelName, callback) {
        var removeListener = {
            $pull: {
                listeners: userId
            }
        }
        db.collection('channels').updateOne({name: channelName}, removeListener);
        var removeChannel = {
            $pull: {
                channels: channelName    
            }
        }
        db.collection('users').updateOne({fbId: userId}, removeChannel);

        callback(null);
    },

    // callback: func(error, channelNameArray)
    // must be valid userId
    myChannels: function(userId, callback) {
        db.collection('users').findOne({fbId: userId}, function(error, doc) {
            callback(error, doc.channels);
        });
    },

    // callback: func(err, channelNameArray)
    allChannels: function(callback) {
        db.collection('channels').find({}).toArray(function(error, docs) {
            console.log(docs);
            const names = _.map(docs, function(doc) {
                return doc.name;
            });
            callback(error, names);
        });
    },
}
