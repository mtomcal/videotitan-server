import Promise from 'bluebird';
import YoutubeAPI from 'youtube-api';
import DB from './db';

let co = Promise.coroutine;
Promise.promisifyAll(YoutubeAPI.channels);
Promise.promisifyAll(YoutubeAPI.playlists);
Promise.promisifyAll(YoutubeAPI.playlistItems);


var Youtube = {};


Youtube.Helpers = function (YoutubeAPI, username, config) {
  
  /**
   * Public: Consume Youtube Videos By Playlist Id
   * @param  {string} playlistId   Youtube Playlist ID
   * @return {function*}           generator function
   */
  let getVideos = co(function* (playlistId) {
    try {
      //Get Playlist items at max pagination of 50 items
      var baseResult = yield YoutubeAPI.playlistItems.listAsync({
        "part": "snippet",
        "resultsPerPage": 50,
        "playlistId": playlistId
      });

      //Get the next page token for next page of results from Youtube API
      var token = baseResult[0].nextPageToken;

      //Shape the data into a structure for storage
      var videos = [].concat(baseResult[0].items.map(
        (item) => {
          var resultObj = {
            id: item.snippet.resourceId.videoId,
            playlistId: playlistId,
            title: item.snippet.title,
            description: item.snippet.description
          };

          //Pic the high quality image thumbnail url for videos
          if (item.snippet.thumbnails) {
            resultObj.thumbnail = item.snippet.thumbnails.high.url;
          }

          return resultObj;
        }
      ));

      //Iterate when a next page token exists
      while (token) {
        var result = yield YoutubeAPI.playlistItems.listAsync({
          "part": "snippet",
          "resultsPerPage": 50,
          "pageToken": token,
          "playlistId": playlistId
        });

        //Shape the data TODO need to abstract to a function to follow DRY better
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

        //Check existence of the next page token
        if (typeof result[0].nextPageToken !== "undefined") {
          token = result[0].nextPageToken;
        } else {
          //Otherwise return false to break the loop
          token = false;
        }
      }

      return videos;

    } catch (e) {
      console.error(e.stack);
    }
  });
  
    /**
   * Public: Get the Channel Id from the Youtube Username
   * @param  {string} username  Youtube username
   * @return {string}           Youtube Channel ID
   */
  let getChannelID = co(function* (username) {
    try {
      var result = yield YoutubeAPI.channels.listAsync({
        "part": "id",
        "forUsername": username
      });
      //Get ID from the payload
      return result[0].items[0].id;

    } catch(e) {
      console.error(e.stack);
    }
  });
  
  /**
   * Public: Get Playlists for a Channel ID
   * @param  {string} channelId Youtube Channel Id
   * @return {array}            List of Playlist Objects
   */
  let getPlaylists = co(function* (channelId) {
    try {
      //API Request for Playlists
      var baseResult = yield YoutubeAPI.playlists.listAsync({
        "part": "snippet",
        "resultsPerPage": 50,
        "channelId": channelId
      });

      var token = baseResult[0].nextPageToken;

      //Shape the structure of the playlist metadata
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
        //API Request for Playlists
        var result = yield YoutubeAPI.playlists.listAsync({
          "part": "snippet",
          "resultsPerPage": 50,
          "pageToken": token,
          "channelId": channelId
        });

        //Shape the structure of the playlists payload
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
  
  //Helper to retrieve all channelIds for each Youtube username sourced
  let getChannelIDs = co(function* (sourceUsernames) {
    //Async map of channel id retrieval
    var idsAsync = sourceUsernames.map(co(function* (username) {
      return yield getChannelID(username);
    }));
    //After all we can use Promise.all for the async yield
    return yield Promise.all(idsAsync);
  });
  
  /**
   * Public Methods
   **/
  return {
    getPlaylists: getPlaylists,
    getChannelID: getChannelID,
    getChannelIDs: getChannelIDs,
    getVideos: getVideos
  }
}


/**
 * Begin public module
 * @param  {string} username Youtube username
 * @param  {string} config   config
 * @return {function}
 */
export default function (username, config) {
  
  YoutubeAPI.authenticate({
    type: "key",
    key: config.youtube.key
  });
  
  var Helpers = Youtube.Helpers(YoutubeAPI, username, config);
  
  //Set the Firebase path references
  var byPlaylistRef = DB.child(username + "/sources/youtube/byPlaylist");
  var byUsernameRef = DB.child(username + "/sources/youtube/byUsername");
  var playlistRef = DB.child(username + "/playlists_importing");
  var videosRef = DB.child(username + "/videos_importing");
  var playlistFinalRef = DB.child(username + "/playlists");
  var videosFinalRef = DB.child(username + "/videos");

  //Helper to retrieve values for all returned firebase references
  let getVal = co(function* (ref) {
    var snap = yield ref.once('value');
    if (snap.hasChildren()) {
      return snap.val();
    }
    return [];
  });

  //Helper to reduce all playlists for all channels into one playlist list
  let reducePlaylists = co(function* (channelIds) {

    //Resolve an array of promises for getPlaylists
    var firstPassAsync = channelIds.map(co(function* (id) {
      return yield Helpers.getPlaylists(id);
    }));

    //Resolve all promises
    var firstPass = yield Promise.all(firstPassAsync);

    //Reduce array of arrays of Playlists into a single flat array
    var secondPass = firstPass.reduce((p, n) => {
      return p.concat(n);
    }, []);

    return secondPass;
  });

  return co(function* (){
    //Retrieve playlists requested by user for import
    var sourcePlaylists = yield getVal(byPlaylistRef);
    //Retrieve usernames requested by user for import
    var sourceUsernames = yield getVal(byUsernameRef);

    var playlists = [];

    //Dump the source playlists into the master list of playlists
    playlists = playlists.concat(sourcePlaylists);

    //Retrieve channel ids for each sourced username
    var channelIds = yield Helpers.getChannelIDs(sourceUsernames);

    //Retrieve and reduce playlists for all channel ids into playlists master lis
    playlists = playlists.concat(yield reducePlaylists(channelIds));

    //Retrieve videos for each playlist and store them in Firebase
    yield Promise.all(playlists.map(co(function* (playlist) {
      if (playlist && playlist.id) {
        playlistRef.push(playlist);
        var videos = yield Helpers.getVideos(playlist.id);
        videos.forEach(function (item) {
          videosRef.push(item);
        });
      }
    })));
    //Firebase retrieval of all playlists and videos
    var playlistsSnap = yield playlistRef.once('value');
    var videosSnap = yield videosRef.once('value');

    var playlistsLen = playlistsSnap.numChildren();

    //Replace the old playlist final ref with playlists from the import playlist ref
    yield playlistFinalRef.set(null);
    yield playlistFinalRef.set(playlistsSnap.val());
    yield playlistRef.set(null);

    var videosLen = videosSnap.numChildren();

    //Replace the old video final ref with videos from the import playlist ref
    yield videosFinalRef.set(null);
    yield videosFinalRef.set(videosSnap.val());
    yield videosRef.set(null);
    //Return census of playlists and videos imported
    return {"playlists": playlistsLen, "videos": videosLen};
  })();
}
