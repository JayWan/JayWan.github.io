import gulp from 'gulp';
import browserSyncLib from 'browser-sync';
import gulpSass from 'gulp-sass';
import * as dartSass from 'sass';
import autoprefixer from 'gulp-autoprefixer';
import minifycss from 'gulp-clean-css';
import rename from 'gulp-rename';
import postcss from 'gulp-postcss';
import sharp from 'sharp';
import { Transform } from 'node:stream';
import path from 'node:path';
import cp from 'child_process';

const browserSync = browserSyncLib.create();
const sass = gulpSass(dartSass);

const messages = {
  jekyllBuild: '<span style="color: grey">Running:</span> $ jekyll build'
};

function jekyllBuildTask(done) {
  browserSync.notify(messages.jekyllBuild);
  return cp.spawn('bundle', ['exec', 'jekyll', 'build', '--config=_config.yml'], { stdio: 'inherit' })
    .on('close', done);
}

export function styles() {
  return gulp.src('_scss/main.scss')
    .pipe(sass({ outputStyle: 'expanded', silenceDeprecations: ['import', 'global-builtin'] }))
    .pipe(autoprefixer())
    .pipe(gulp.dest('assets/css'))
    .pipe(rename({ suffix: '.min' }))
    .pipe(minifycss())
    .pipe(gulp.dest('assets/css'));
}

const browserSyncTask = gulp.series(styles, jekyllBuildTask, (done) => {
  browserSync.init({
    server: { baseDir: '_site' },
    startPath: '/index.html'
  });
  done();
});

function sharpResize(width) {
  return new Transform({
    objectMode: true,
    async transform(file, _enc, cb) {
      if (file.isNull() || file.isStream()) { cb(null, file); return; }
      try {
        const ext = path.extname(file.basename).toLowerCase();
        const format = (ext === '.jpg' || ext === '.jpeg') ? 'jpeg' : 'png';
        file.contents = await sharp(file.contents)
          .resize({ width, withoutEnlargement: true })
          .toFormat(format)
          .toBuffer();
        cb(null, file);
      } catch (err) {
        cb(err);
      }
    }
  });
}

export function thumbnails() {
  return gulp.src('assets/images/hero/*.{jpg,png}', { encoding: false })
    .pipe(sharpResize(350))
    .pipe(gulp.dest('assets/images/thumbnail', { encoding: false }));
}

function watchTask() {
  gulp.watch('_scss/**/*.scss', styles);
  gulp.watch('assets/images/hero/*.{jpg,png}', thumbnails);
  gulp.watch([
    '*.html',
    '*.txt',
    'about/**',
    '_posts/*.markdown',
    'assets/javascripts/**/**.js',
    'assets/images/**',
    'assets/fonts/**',
    '_layouts/**',
    '_includes/**',
    'assets/css/**'
  ], jekyllBuildTask);
  gulp.watch('_site/index.html').on('change', browserSync.reload);
}

export default gulp.series(thumbnails, browserSyncTask, watchTask);
