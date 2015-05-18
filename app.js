import Hapi from 'hapi';
import Joi from 'joi';
import Boom from 'boom';
import config from './config/default';
import YoutubeImport from './lib/youtube_import';
import DB from './lib/db';
import Promise from 'Bluebird';

const server = new Hapi.Server();

server.connection({ port: 3000 });

server.register({
  register: require('hapi-swagger'),
  options: {
    apiVersion: "0.1.0"
  }
}, (err) => {
  if (err) {
    server.log(['error'], 'hapi-swagger load error: ' + err);
  } else {
    server.log(['start'], 'hapi-swagger interface loaded');
  }
});

server.route({
  method: 'POST',
  path: '/youtube/{username}/sources',
  config: {
    tags: ['api', 'youtube'],
    description: 'Set sources for youtube',
    handler(request, reply) {
      DB.child(request.params.username + '/sources').set({youtube: request.payload})
        .then(() => {
          reply({
            success: true,
            result: request.payload
          });
        })
        .caught((err) => {
          reply({success: false, result: err.message});
        });
    },
    validate: {
      payload: {
        byPlaylist: Joi.array().required(),
        byUsername: Joi.array().required()
      },
      params: {
        username: Joi.string().required()
      }
    }
  }
});
server.route({
  method: 'GET',
  path: '/youtube/{username}/sources',
  config: {
    tags: ['api', 'youtube'],
    description: 'Get sources for youtube',
    handler(request, reply) {
      DB.child(request.params.username + '/sources').once('value')
        .then((snap) => {
          var value = snap.val();

          if (value) {
            reply({
              success: true,
              result: value
            });
          } else {
            reply().code(204);
          }

        })
        .caught((err) => {
          reply({success: false, result: err.message});
        });
    },
    validate: {
      params: {
        username: Joi.string().required()
      }
    }
  }
});
server.route({
  method: 'GET',
  path: '/youtube/{username}',
  config: {
    tags: ['api', 'youtube'],
    description: 'Import youtube playlists from sources',
    handler(request, reply) {
      YoutubeImport(request.params.username, config)
        .then((count) => {
          reply({
            success: true,
            result: {
              "playlists": count.playlists,
              "videos": count.videos
            }
          });
        })
        .caught((err) => {
          reply({success: false, result: err.message});
        });
    },
    validate: {
      params: {
        username: Joi.string().required()
      }
    }
  }
});

server.route({
  method: 'GET',
  path: '/youtube/{username}/playlists',
  config: {
    tags: ['api', 'youtube'],
    description: 'Retrieve Youtube Playlists for Username',
    handler(request, reply) {
      DB.child(request.params.username + '/playlists').once('value')
        .then((snap) => {
          if (snap.hasChildren()) {
            var value = snap.val();
            var playlists = Object.keys(value).map(function (key) {
              return value[key];
            });
            var size = snap.numChildren();
            reply({
              success: true,
              result: {
                playlists: playlists,
                count: size
              }
            });
          } else {
            reply().code(204);
          }
        })
        .caught((err) => {
          reply({success: false, result: err.message});
        });
    },
    validate: {
      params: {
        username: Joi.string().required()
      }
    }
  }
});

server.route({
  method: 'GET',
  path: '/youtube/{username}/playlists/{id}',
  config: {
    tags: ['api', 'youtube'],
    description: 'Retrieve Youtube Playlists for Username by Playlist ID',
    handler(request, reply) {
      DB.child('/' + request.params.username + '/playlists')
        .orderByChild("id").equalTo(request.params.id)
        .once('value')
        .then((snap) => {
          if (snap.hasChildren()) {
            var value = snap.val();
            var playlists = Object.keys(value).map(function (key) {
              return value[key];
            });
            var size = snap.numChildren();
            reply({
              success: true,
              result: {
                playlists: playlists,
                count: size
              }
            });
          } else {
            reply().code(204);
          }
        })
        .caught((err) => {
          reply({success: false, result: err.message});
        });
    },
    validate: {
      params: {
        username: Joi.string().required(),
        id: Joi.string().required()
      }
    }
  }
});

server.route({
  method: 'GET',
  path: '/youtube/{username}/playlists/{id}/videos',
  config: {
    tags: ['api', 'youtube'],
    description: 'Retrieve Youtube Videos for Username by Playlist ID',
    handler(request, reply) {
      var playlists;
      var ref = DB.child('/' + request.params.username);
      ref.child('playlists')
        .orderByChild("id").equalTo(request.params.id)
        .once('value')
        .then((snap) => {
          if (snap.hasChildren()) {
            var value = snap.val();
            var playlistId = Object.keys(value).reduce((p, key) => {
              return value[key].id;
            }, "");
            playlists = Object.keys(value).map(function (key) {
              return value[key];
            });
            return ref.child('videos').orderByChild("playlistId").equalTo(playlistId).once('value');
          }
          return Promise.reject(new Error('No Playlists'));
        })
        .then((snap) => {
          if (snap.hasChildren()) {
            var value = snap.val();
            var videos = Object.keys(value).map(function (key) {
              return value[key];
            });
            var size = snap.numChildren();
            reply({
              success: true,
              result: {
                playlists: playlists,
                videos: videos,
                count: size
              }
            });
          } else {
            reply().code(204);
          }
        })
        .caught((err) => {
          reply().code(404);
        });
    },
    validate: {
      params: {
        username: Joi.string().required(),
        id: Joi.string().required()
      }
    }
  }
});

server.start(() => {
  console.log('Server running at:', server.info.uri);
});
