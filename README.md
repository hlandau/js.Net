# Go-style networking package for Node.js

This is a partial port of the Go standard library's `net` package to Node.js.
It runs on top of Node.js's standard library but exposes a saner, better
thought out, 100% promise-based interface.

WIP. Do not use.

Usage:

    $ npm install hlandau/js.Net

    $ node
    > require('hlandau.Net/Dial');

    # TypeScript:
    import {dial} from "hlandau.Net/Dial";
