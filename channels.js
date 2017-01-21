'use strict';
const MongoClient = require('mongodb').MongoClient
const _ = require('underscore');

var db;
const url = 'mongodb://localhost:27017'
MongoClient.connect(url, function(err, myDb) {
    if (err) {
        console.error(err);
    }
    db = myDb;
});

module.exports = {

    // Listener funcs:

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

    // Admin funcs:

    // if the admin does not exist, will create one
    // callback: func(error, data)
    getAdminData: function(adminId, callback) {
        db.collection('admins').findOne({fbId: adminId}, function(error, doc) {
            if (doc) {
                callback(error, doc);
            } else {
                var data = {
                    fbId: adminId,
                    permissions: [] // list of channel names
                }
                db.collection('admins').insertOne(data);
                callback(error, data);
            }
        });
    },

    // callback: func(error)
    // there is an error if the given channel name already exists
    createChannel: function(adminId, channelName, channelPassword, callback) {
        // check that the channel doesn't already exist
        db.collection('channels').findOne({name: channelName}, function(error, doc) {
            if (doc) {
                callback({error: 'that channels already exists'})
            } else {
                // create a new channel
                var data = {
                    name: channelName,
                    password: channelPassword,
                    listeners: []
                }
                db.collection('channels').insertOne(data);
                callback(null);
            }
        });
    },

    myPermissions: function(adminId, callback) {

    }
}
