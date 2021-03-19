# Setup

We use `npm` to manage dependencies. On your first run, run `npm install` from the root directory of the repo to install dependencies from the `npm-shrinkwrap.json` file.

# Compilation

We use `browserify` to generate a single JS file with all of the `npm` dependencies.

In dev, you can run `npm run watch` to continually watch for changes and produce an `build/bundle.js` file.

When you're ready, run `npm run compile` to produce a minified version of that same file.
