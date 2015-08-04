import Promise from 'bluebird';
import Firebase from 'firebase';
import Fireproof from 'fireproof';
import config from '../config';

Fireproof.bless(Promise);

var ref = new Fireproof(new Firebase(config.firebase.url));
ref.authWithCustomToken(config.firebase.secret)
  .then(function (auth) {
    console.log(auth);
  }).catch((err) => {
    console.log(err);
  });

export default ref;
