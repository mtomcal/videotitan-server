import Promise from 'bluebird';
import Firebase from 'firebase';
import Fireproof from 'fireproof';
import config from '../config';

Fireproof.bless(Promise);

export default new Fireproof(new Firebase(config.firebase.url));
