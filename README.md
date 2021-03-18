# Setup

We use `npm` to manage dependencies. On your first run, run `npm install` from the root directory of the repo to install dependencies from the `npm-shrinkwrap.json` file.

# Compilation

We use `browserify` to generate a single JS file with all of the `npm` dependencies.

After installing dependencies, run `bash ./compile.sh` from the root directory of the repo to watch for changes in `index.js`
and automatically compile them into the bundle.