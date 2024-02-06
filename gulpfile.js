const gulp = require('gulp'),
    browserSync = require('browser-sync').create(),
    sass = require('gulp-sass')(require('sass')),
    autoprefixer = require('gulp-autoprefixer'),
    minifycss = require('gulp-minify-css'),
    rename = require('gulp-rename'),
    postcss = require('gulp-postcss'),
    imageResize = require('gulp-image-resize'),
    parallel = require("concurrent-transform"),
    os = require("os"),
    cp = require('child_process');

const messages = {
  jekyllBuild: '<span style="color: grey">Running:</span> $ jekyll build'
};

/**
 * Build the Jekyll Site
 */
function jekyllBuildTask(done) {
    browserSync.notify(messages.jekyllBuild);
    return cp.spawn('jekyll', ['build', '--config=_config.yml'], {stdio: 'inherit'})
        .on('close', done);
};

/**
 * Compile files from sass into both assets/css (for live injecting) and site (for future jekyll builds)
 */
function styles(done){
  gulp.src('_scss/main.scss')
    .pipe(sass({ outputStyle: 'expanded' }))
    .pipe(autoprefixer())
    .pipe(gulp.dest('assets/css'))
    .pipe(rename({suffix: '.min'}))
    .pipe(minifycss())
    .pipe(gulp.dest('assets/css'));
  done();
};

/**
 * Wait for jekyll-build, then launch the Server
 */
const browserSyncTask = gulp.series(styles, jekyllBuildTask, (done) => {
  browserSync.init({
    server: {
      baseDir: '_site'
    },
    startPath: "/index.html"
  });
  done();
});

/**
 * Automatically resize post feature images and turn them into thumbnails
 */
function thumbnails(done){
  gulp.src("assets/images/hero/*.{jpg,png}")
    .pipe(parallel(
      imageResize({ width : 350 }),
      os.cpus().length
    ))
    .pipe(gulp.dest("assets/images/thumbnail"));
  done();
};

/**
 * Watch scss files for changes & recompile
 * Watch html/md files, run jekyll
 * Watch _site generation, reload BrowserSync
 */
function watchTask(){
  gulp.watch('_scss/**/*.scss', styles);
  gulp.watch('assets/images/hero/*.{jpg,png}', thumbnails);
  gulp.watch(['*.html',
          '*.txt',
          'about/**',
          '_posts/*.markdown',
          'assets/javascripts/**/**.js',
          'assets/images/**',
          'assets/fonts/**',
          '_layouts/**',
          '_includes/**',
          'assets/css/**'
        ],
        jekyllBuildTask);
  gulp.watch("_site/index.html").on('change', browserSync.reload);
};

/**
 * Default task, running just `gulp` will compile the sass,
 * compile the jekyll site, launch BrowserSync & watch files.
 */
 exports.default = gulp.series(thumbnails, browserSyncTask, watchTask);
