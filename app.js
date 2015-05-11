import Hapi from 'hapi';
import Joi from 'joi';
import Boom from 'boom';
import config from './config/default';
import YoutubeImport from './lib/youtube_import';
import DB from './lib/db';

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

server.start(() => {
  console.log('Server running at:', server.info.uri);
});
