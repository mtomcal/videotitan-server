import Hapi from 'hapi';
import Joi from 'joi';
import Boom from 'boom';

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
  method: 'GET',
  path: '/import/{username}',
  config: {
    tags: ['api', 'import'],
    description: 'Import playlists for user',
    handler(request, reply) {

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
