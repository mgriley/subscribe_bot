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

    // Listener funcs:

    // if the user exists, returns the user's data
    // if the user does not exist, creates the user and returns the data
    // callback: func(error, data)
    // data: {fbId, channels: list of channel names, state}
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

    // callback: func(err)
    setUserState: function(userId, state, callback) {
        db.collection('users').updateOne({fbId: userId}, {$set: {state: state}});
        callback(null);
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

    // callback: func(err, array of channel objects)
    // channel: {name, numUsers}
    allChannels: function(callback) {
        db.collection('channels').find({}).toArray(function(error, docs) {
            console.log(docs);
            const names = _.map(docs, function(doc) {
                return {name: doc.name, numUsers: doc.listeners.length};
            });
            callback(error, names);
        });
    },

    // Admin funcs:

    // if the admin does not exist, will create one
    // callback: func(error, data)
    // data: {fbId, permissions: array of channel names, state}
    getAdminData: function(adminId, callback) {
        db.collection('admins').findOne({fbId: adminId}, function(error, doc) {
            if (doc) {
                callback(error, doc);
            } else {
                var data = {
                    fbId: adminId,
                    permissions: [], // list of channel names
                    state: 'default'
                }
                db.collection('admins').insertOne(data);
                callback(error, data);
            }
        });
    },

    // assume that the given admin already has an account
    // callback: func(err)
    setAdminState: function(adminId, state, callback) {
        db.collection('admins').updateOne({fbId: adminId}, {$set: {state: state}}, function(err) {
            if (err) {
                console.error(err);
            }
        });
        callback(null);
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

                // add the channel to the admin's permission list
                db.collection('admins').updateOne({fbId: adminId}, {$push: {permissions: channelName}});
                callback(null);
            }
        });
    },

    // callback: func(error, channelNameArray)
    myPermissions: function(adminId, callback) {
        db.collection('admins').findOne({fbId: adminId}, function(error, doc) {
            callback(null, doc.permissions);    
        });
    },

    // callback: func(err)
    // err occurs if the admin doesn't have the correct permissions
    addPermission: function(adminId, channelName, channelPassword, callback) {
        db.collection('channels').findOne({name: channelName}, function(err, channel) {
            if (channel) {
                if (channel.password === channelPassword) {
                    // valid, so add channel to admin's permissions
                    db.collection('admins').updateOne({fbId: adminId}, {$push: {permissions: channelName}});
                    callback(null);
                } else {
                    callback({error: 'wrong password'});
                }
            } else {
                callback({error: 'no channel with that name'});
            }
        });
    },
    
    // callback: func(error, fbIdList)
    channelListeners: function(adminId, channelName, callback) {
        
        // ensure that the admin has permissions for the given channel
        db.collection('admins').findOne({fbId: adminId}, function(err, admin) {
            if (_.contains(admin.permissions, channelName)) {
                // get all of the listeners
                db.collection('channels').findOne({name: channelName}, function(err, channel) {
                    callback(null, channel.listeners);
                });
            } else {
                callback({error: 'permission denied'}, null);
            }
        });
    },

    // for the Dashboard:

    // get the analytics data for the given channel
    // callback: func(err, data)
    // data: {numUsers: int, 
    channelData: function(channelName, channelPassword, callback) {
        // ensure that the channel exists
        db.collection('channels').findOne({name: channelName}, function(err, channel) {
            if (channel) {
                if (channelPassword === channel.password) {
                    var data = {
                        numUsers: channel.listeners.length
                    }
                    callback(null, data);
                } else {
                    callback({error: 'wrong password'});
                }
            } else {
                callback({error: 'no channel with that name'}, null);
            }
        });
    }
}
