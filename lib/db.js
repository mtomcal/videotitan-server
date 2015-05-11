import Promise from 'bluebird';
import Firebase from 'firebase';
import Fireproof from 'fireproof';

Fireproof.bless(Promise);

export default new Fireproof(new Firebase('https://videotitan.firebaseio.com/'));
