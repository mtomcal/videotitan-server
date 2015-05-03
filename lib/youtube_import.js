import Promise from 'bluebird';
import YoutubeAPI from 'youtube-api';

let co = Promise.coroutine;
Promise.promisifyAll(YoutubeAPI.channels);
Promise.promisifyAll(YoutubeAPI.playlists);
Promise.promisifyAll(YoutubeAPI.playlistItems);

export default function (username, config) {
  YoutubeAPI.authenticate({
    type: "key",
    key: config.youtube.key
  });

  let getVideos = co(function* (playlistId) {
    try {
      var baseResult = yield YoutubeAPI.playlistItems.listAsync({
        "part": "snippet",
        "resultsPerPage": 50,
        "playlistId": playlistId
      });

      var token = baseResult[0].nextPageToken;

      var videos = [].concat(baseResult[0].items.map(
        (item) => {
          return {
            id: item.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high.url
          };
        }
      ));

      while (token) {
        var result = yield YoutubeAPI.playlistItems.listAsync({
          "part": "snippet",
          "resultsPerPage": 50,
          "pageToken": token,
          "playlistId": playlistId
        });

        videos = videos.concat(result[0].items.map((item) => {
            return {
              id: item.videoId,
              title: item.snippet.title,
              description: item.snippet.description
            };
          }));

        if (typeof result[0].nextPageToken !== "undefined") {
          token = result[0].nextPageToken;
        } else {
          token = false;
        }
      }

      return videos;

    } catch (e) {
      console.error(e.stack);
    }
  });

  let getChannelID = co(function* (username) {
    try {
      var result = yield YoutubeAPI.channels.listAsync({
        "part": "id",
        "forUsername": username
      });
      return result[0].items[0].id;

    } catch(e) {
      console.error(e.stack);
    }
  });

  let getPlaylists = co(function* (channelId) {
    try {
      var baseResult = yield YoutubeAPI.playlists.listAsync({
        "part": "snippet",
        "resultsPerPage": 50,
        "channelId": channelId
      });

      var token = baseResult[0].nextPageToken;

      var playlists = [].concat(baseResult[0].items.map(
        (item) => {
          return {
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description
          };
        }
      ));

      while (token) {
        var result = yield YoutubeAPI.playlists.listAsync({
          "part": "snippet",
          "resultsPerPage": 50,
          "pageToken": token,
          "channelId": channelId
        });

        playlists = playlists
          .concat(result[0].items.map((item) => {
            return {
              id: item.id,
              title: item.snippet.title,
              description: item.snippet.description
            };
          }));

        if (typeof result[0].nextPageToken !== "undefined") {
          token = result[0].nextPageToken;
        } else {
          token = false;
        }
      }
      return playlists;

    } catch (e) {
      console.error(e.stack);
    }
  });



  getChannelID(username)
    .then((id) => {
      return getPlaylists(id);
    })
    .then(function (playlists) {
      var promises = playlists.map(co(function* (playlist) {
        return yield getVideos(playlist.id);
      }));
      return Promise.all(promises);
    })
    .then(function (videos) {
      var flattenedVideos = videos.reduce(function (prev, next) {
        return prev.concat(next);
      }, []);
      console.log(flattenedVideos);
    });
}
