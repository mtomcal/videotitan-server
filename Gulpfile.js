var gulp       = require('gulp');
var streamify  = require('gulp-streamify');
var nodemon    = require('gulp-nodemon');
var jshint     = require('gulp-jshint');
var watch      = require('gulp-watch');
var source     = require('vinyl-source-stream');
var lazypipe   = require('lazypipe');

var isProduction = process.env.NODE_ENV === 'production';

gulp.task('jshint', function () {
    gulp.src(['index.js'])
        .pipe(streamify(jshint({
            laxbreak: true,
            laxcomma: true,
            esnext: true, //JSHint Harmony/ES6
            eqnull: true,
            node: true
        })))
        .pipe(jshint.reporter('jshint-stylish'));
});


gulp.task('server', function () {
  nodemon({ script: 'index.js', ext: 'js'});
});

if (isProduction) {
    gulp.task('default', ['server']);
} else {
    gulp.task('default', ['jshint', 'server']);
}
