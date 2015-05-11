import Promise from 'bluebird';
import YoutubeAPI from 'youtube-api';
import DB from './db';

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
          var resultObj = {
            id: item.snippet.resourceId.videoId,
            playlistId: playlistId,
            title: item.snippet.title,
            description: item.snippet.description
          };

          if (item.snippet.thumbnails) {
            resultObj.thumbnail = item.snippet.thumbnails.high.url;
          }

          return resultObj;
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
          var resultObj = {
            id: item.snippet.resourceId.videoId,
            playlistId: playlistId,
            title: item.snippet.title,
            description: item.snippet.description
          };

          if (item.snippet.thumbnails) {
            resultObj.thumbnail = item.snippet.thumbnails.high.url;
          }

          return resultObj;
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
            description: item.snippet.description,
            type: "youtube"
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
              description: item.snippet.description,
              type: "youtube"
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

  var byPlaylistRef = DB.child(username + "/sources/youtube/byPlaylist");
  var byUsernameRef = DB.child(username + "/sources/youtube/byUsername");
  var playlistRef = DB.child(username + "/playlists_importing");
  var videosRef = DB.child(username + "/videos_importing");
  var playlistFinalRef = DB.child(username + "/playlists");
  var videosFinalRef = DB.child(username + "/videos");

  let getVal = co(function* (ref) {
    var snap = yield ref.once('value');
    if (snap.hasChildren()) {
      return snap.val();
    }
    return [];
  });

  let getChannelIDs = co(function* (sourceUsernames) {
    var idsAsync = sourceUsernames.map(co(function* (username) {
      return yield getChannelID(username);
    }));

    return yield Promise.all(idsAsync);
  });

  let reducePlaylists = co(function* (channelIds) {

    var firstPassAsync = channelIds.map(co(function* (id) {
      return yield getPlaylists(id);
    }));

    var firstPass = yield Promise.all(firstPassAsync);

    var secondPass = firstPass.reduce((p, n) => {
      return p.concat(n);
    }, []);

    return secondPass;
  });

  return co(function* () {
    var sourcePlaylists = yield getVal(byPlaylistRef);
    var sourceUsernames = yield getVal(byUsernameRef);
    var playlists = [];

    playlists = playlists.concat(sourcePlaylists);

    var channelIds = yield getChannelIDs(sourceUsernames);

    playlists = playlists.concat(yield reducePlaylists(channelIds));

    yield Promise.all(playlists.map(co(function* (playlist) {
      playlistRef.push(playlist);
      var videos = yield getVideos(playlist.id);
      videos.forEach(function (item) {
        videosRef.push(item);
      });
    })));
    var playlistsSnap = yield playlistRef.once('value');
    var videosSnap = yield videosRef.once('value');

    var playlistsLen = playlistsSnap.numChildren();
    yield playlistFinalRef.set(null);
    yield playlistFinalRef.set(playlistsSnap.val());
    yield playlistRef.set(null);

    var videosLen = videosSnap.numChildren();
    yield videosFinalRef.set(null);
    yield videosFinalRef.set(videosSnap.val());
    yield videosRef.set(null);
    return {"playlists": playlistsLen, "videos": videosLen};
  })();
}
